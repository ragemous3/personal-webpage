import { type Chat } from '@/layers/data/local-chat-lm.data';
import { type DB } from '@/layers/data/local-vector-database.data';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type RuntimeConfigurationAdapterContract } from '@/layers/shared/contracts/runtime-configuration-adapter.contract';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  type AssistantSettings,
  isAssistantSettings,
  type RuntimeAvailability,
  type RuntimeConfigurationState,
} from '@/layers/shared/models/assistant-settings.model';
import { type ModelDescriptor } from '@/layers/shared/models/model-metadata.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

const selectionIdentity = (selection: unknown): Pick<RuntimeAvailability, 'selectionId'> =>
  isRecord(selection) && typeof selection.selectionId === 'string'
    ? { selectionId: selection.selectionId }
    : {};

const isEnabled = (settings: AssistantSettings): boolean => settings.mode === 'local' || Boolean(settings.onlineModel);

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
  _mode: AssistantSettings['mode'],
): { ready: boolean; loading: boolean; error?: string } => {
  const error = resourceFailure(resources);
  const ready = resourcesReady(resources);
  return { ready, loading: !ready && !error, ...(error ? { error } : {}) };
};

const sharedRevision = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const resources: unknown[] = value;
  const model = resources.find((entry) => isRecord(entry) && entry.role === 'llm');
  return isRecord(model) && typeof model.revision === 'string' ? model.revision : undefined;
};

export class RuntimeConfigurationAdapter implements RuntimeConfigurationAdapterContract {
  readonly stateSubscription = createStatefulSubscribable<RuntimeConfigurationState>({
    responding: false,
  });
  readonly #disconnect: () => void;
  readonly #model;
  readonly #database;
  #selected: AssistantSettings | undefined;
  #application: Promise<void> = Promise.resolve();
  #hosted = false;
  #failed = false;
  #applying = false;

  constructor(
    private readonly coordinator: RuntimeCoordinatorContract,
    private readonly chat: Pick<Chat, 'configuration' | 'initialize'>,
    private readonly database: Pick<DB, 'configuration' | 'initialize'>,
    readonly setAvailable: (available: boolean) => void,
    private readonly models: readonly ModelDescriptor[],
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
    const profile = this.models.find(({ id }) => id === settings.model);
    if (!profile) throw new Error(`[${SeverityLevelCodes.ERROR}] - Model is not configured`);
    const model = {
      ...this.#model,
      model: profile.id,
      revision: profile.revision,
      device: settings.execution,
      dtype: settings.precision,
      generation,
      online: !local,
      ...(local ? {} : { model: settings.onlineModel ?? profile.id }),
    };
    const database = { ...this.#database, device: settings.execution };
    Object.assign(this.chat.configuration.payload, model);
    Object.assign(this.database.configuration.payload, database);
    this.#applying = true;
    const enabled = isEnabled(settings);
    const configured = this.coordinator.configure(enabled ? { llm: model, vectordb: database } : {}, {
      enabled,
      settings,
    });
    const application = configured.then(() => {
      if (this.#application !== application) return;
      this.#applying = false;
      if (!enabled || this.#hosted) return;
      this.#hosted = true;
      this.chat.initialize();
      this.database.initialize();
    });
    this.#application = application;
    this.stateSubscription.emit({
      responding: this.stateSubscription.getValue()?.responding ?? false,
    });
    void application.catch(() => {
      if (this.#application === application) {
        this.#failed = true;
        this.#applying = false;
      }
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
    const configuring = state.configuring === true || this.#applying;
    const resources = this.#resources(state.resources, selected, configuring);
    const pending = configuring || !areValuesEqual(selected, active) || resources.loading;
    return {
      selected,
      ...selectionIdentity(state.selection),
      ...(active ? { active } : {}),
      pending,
      loading: state.configurationLoading === true || resources.loading,
      ready: isEnabled(selected) && !pending && resources.ready,
      error: resources.error,
    };
  };

  #resources(
    value: unknown,
    selected: AssistantSettings,
    configuring: boolean,
  ): ReturnType<typeof resourceAvailability> {
    const resources = resourceAvailability(value, selected.mode);
    const revision = sharedRevision(value);
    const expected = this.models.find(({ id }) => id === selected.model)?.revision;
    if (
      !configuring &&
      selected.mode === 'local' &&
      resources.ready &&
      revision &&
      revision !== expected
    ) {
      resources.ready = false;
      resources.error =
        'Shared model revision differs from this page. Retry or reload to align the configuration.';
    }
    return resources;
  }

  dispose = (): void => {
    this.#disconnect();
  };
}
