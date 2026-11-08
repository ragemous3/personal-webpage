import { type Chat } from '@/layers/data/local-chat-lm.data';
import { type DB } from '@/layers/data/local-vector-database.data';
import { isEnabled, readSettings, resourceAvailability, selectionIdentity, sharedRevision } from '@/layers/data/utils/runtime-configuration.utility';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { type RuntimeConfigurationAdapterContract } from '@/layers/shared/contracts/runtime-configuration-adapter.contract';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { isAssistantSettings } from '@/layers/shared/guards/is-assistant-settings.guard';
import { type AssistantSettings, type RuntimeAvailability, type RuntimeConfigurationState } from '@/layers/shared/models/assistant-settings.model';
import { type ModelDescriptor } from '@/layers/shared/models/model-metadata.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export class RuntimeConfigurationAdapter implements RuntimeConfigurationAdapterContract {
  readonly stateSubscription = createStatefulSubscribable<RuntimeConfigurationState>({
    responding: false,
  });
  readonly #disconnect: () => void;
  readonly #model;
  readonly #database;
  #selected: AssistantSettings | undefined;
  #application: Promise<void> = Promise.resolve();
  #databaseHosted = false;
  #failed = false;
  #applying = false;

  constructor(
    private readonly coordinator: RuntimeCoordinatorContract,
    private readonly chat: Pick<Chat, 'configuration'>,
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
    const local = settings.mode === AssistantModes.LOCAL;
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
    };
    const database = { ...this.#database, device: settings.execution };
    Object.assign(this.chat.configuration.payload, model);
    Object.assign(this.database.configuration.payload, database);
    this.#applying = true;
    const enabled = isEnabled(settings);
    const configured = this.coordinator.configure(
      enabled ? { ...(local ? { llm: model } : {}), vectordb: database } : {},
      {
        enabled,
        settings,
      },
    );
    const application = configured.then(() => {
      if (this.#application !== application) return;
      this.#applying = false;
      if (enabled && !this.#databaseHosted) {
        this.#databaseHosted = true;
        this.database.initialize();
      }
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
      mounted: this.#mountSettings(state),
      responding: state.responding === true,
      runtime: this.#availability(state, state.selection.settings),
    });
  };

  #mountSettings(state: Record<string, unknown>): AssistantSettings | undefined {
    if (!isRecord(state.mountSelection) || state.mountSelection.enabled === false) return undefined;
    const mounted = readSettings(state.mountSelection);
    if (this.#applying && !areValuesEqual(mounted, this.#selected)) return undefined;
    return mounted;
  }

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
      selected.mode === AssistantModes.LOCAL &&
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
