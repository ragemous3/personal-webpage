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

const readSettings = (selection: unknown): AssistantSettings | undefined =>
  isRecord(selection) && isAssistantSettings(selection.settings) ? selection.settings : undefined;

const resourceFailure = (resources: unknown): string | undefined => {
  if (!Array.isArray(resources)) return undefined;
  const entries: unknown[] = resources;
  const failure = entries.find((resource) => isRecord(resource) && resource.status === 'failed');
  if (!isRecord(failure)) return undefined;
  return typeof failure.error === 'string' ? failure.error : 'Model configuration failed';
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
    this.chat.configuration.payload = model;
    this.database.configuration.payload = database;
    this.#application = this.coordinator.configure(
      local ? { llm: model, vectordb: database } : {},
      { enabled: local, settings },
    );
    const application = this.#application;
    void application.catch(() => {
      if (this.#application === application) this.#failed = true;
    });
    if (local && !this.#hosted) {
      this.#hosted = true;
      this.chat.initialize();
      this.database.initialize();
    }
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
    const error = selected.mode === 'local' ? resourceFailure(state.resources) : undefined;
    const pending = state.configuring === true;
    return {
      selected,
      ...(active ? { active } : {}),
      pending: pending || !areValuesEqual(selected, active),
      loading: state.configurationLoading === true,
      ready: active?.mode === 'local' && !pending && !error,
      ...(error ? { error } : {}),
    };
  };

  dispose = (): void => {
    this.#disconnect();
  };
}
