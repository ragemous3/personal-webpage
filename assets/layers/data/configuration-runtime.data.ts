import { type Chat } from '@/layers/data/local-chat-lm.data';
import { type DB } from '@/layers/data/local-vector-database.data';
import { type ConfigurationRuntimeContract } from '@/layers/shared/contracts/configuration-service.contract';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  type AssistantSettings,
  type ConfigurationRuntimeState,
  isAssistantSettings,
  type RuntimeAvailability,
} from '@/layers/shared/models/assistant-settings.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

const selectionIdentity = (selection: unknown): Pick<RuntimeAvailability, 'selectionId'> =>
  isRecord(selection) && typeof selection.selectionId === 'string'
    ? { selectionId: selection.selectionId }
    : {};

const readSettings = (selection: unknown): AssistantSettings | undefined =>
  isRecord(selection) && isAssistantSettings(selection.settings) ? selection.settings : undefined;

const resourceFailure = (resources: unknown): string | undefined => {
  if (!Array.isArray(resources)) return undefined;
  const entries: unknown[] = resources;
  const failure = entries.find((resource) => isRecord(resource) && resource.status === 'failed');
  if (!isRecord(failure)) return undefined;
  return typeof failure.error === 'string' ? failure.error : 'Model configuration failed';
};

const resourcesReady = (resources: unknown): boolean => {
  if (!Array.isArray(resources)) return false;
  const entries: unknown[] = resources;
  return entries.every(
    (resource) =>
      isRecord(resource) &&
      typeof resource.status === 'string' &&
      ['ready', 'busy', 'stopping'].includes(resource.status),
  );
};
const resourceAvailability = (
  resources: unknown,
  mode: AssistantSettings['mode'],
): { ready: boolean; loading: boolean; error?: string } => {
  const error = mode === 'local' ? resourceFailure(resources) : undefined;
  const ready = resourcesReady(resources);
  return { ready, loading: mode === 'local' && !ready && !error, ...(error ? { error } : {}) };
};

export class ConfigurationRuntime implements ConfigurationRuntimeContract {
  readonly stateSubscription = createStatefulSubscribable<ConfigurationRuntimeState>({
    responding: false,
  });
  readonly #disconnect: () => void;
  readonly #model;
  readonly #database;
  #selected: AssistantSettings | undefined;
  #application: Promise<void> = Promise.resolve();
  #hosted = false;
  #failed = false;

  constructor(
    private readonly coordinator: RuntimeCoordinatorContract,
    private readonly chat: Pick<Chat, 'configuration' | 'initialize'>,
    private readonly database: Pick<DB, 'configuration' | 'initialize'>,
    readonly setAvailable: (available: boolean) => void,
  ) {
    this.#model = { ...chat.configuration.payload };
    this.#database = { ...database.configuration.payload };
    this.#disconnect = coordinator.onData(this.#observe);
  }

  select = (settings: AssistantSettings): void => {
    this.#selected = settings;
    this.#failed = false;
    this.setAvailable(false);
    const local = settings.mode === 'local';
    const generation = {
      max_new_tokens: settings.maxNewTokens,
      do_sample: settings.sampling,
      ...(settings.sampling ? { temperature: settings.temperature, top_p: settings.topP } : {}),
    };
    const model = {
      ...this.#model,
      model: settings.model,
      device: settings.execution,
      dtype: settings.precision,
      generation,
    };
    const database = { ...this.#database, device: settings.execution };
    Object.assign(this.chat.configuration.payload, model);
    Object.assign(this.database.configuration.payload, database);
    const configured = this.coordinator.configure(local ? { llm: model, vectordb: database } : {}, {
      enabled: local,
      settings,
    });
    const application = configured.then(() => {
      if (this.#application !== application || !local || this.#hosted) return;
      this.#hosted = true;
      this.chat.initialize();
      this.database.initialize();
    });
    this.#application = application;
    void application.catch(() => {
      if (this.#application === application) this.#failed = true;
    });
  };

  apply = async (settings: AssistantSettings): Promise<void> => {
    if (this.#failed || !areValuesEqual(settings, this.#selected)) this.select(settings);
    await this.#application;
  };

  readonly #observe = (message: unknown): void => {
    if (!isRecord(message) || message.task !== 'runtime:state' || !isRecord(message.payload))
      return;
    const state = message.payload;
    if (!isRecord(state.selection) || !isAssistantSettings(state.selection.settings)) return;
    this.stateSubscription.emit({
      responding: state.responding === true,
      runtime: this.#availability(state, state.selection.settings),
    });
  };

  readonly #availability = (
    state: Record<string, unknown>,
    selected: AssistantSettings,
  ): RuntimeAvailability => {
    const active = readSettings(state.activeSelection);
    const resources = resourceAvailability(state.resources, selected.mode);
    const pending =
      state.configuring === true || !areValuesEqual(selected, active) || resources.loading;
    return {
      selected,
      ...selectionIdentity(state.selection),
      ...(active ? { active } : {}),
      pending,
      loading: state.configurationLoading === true || resources.loading,
      ready: selected.mode === 'local' && !pending && resources.ready,
      ...(resources.error ? { error: resources.error } : {}),
    };
  };

  dispose = (): void => {
    this.#disconnect();
  };
}
