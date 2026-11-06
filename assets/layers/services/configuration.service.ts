import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ConfigurationRepositoryContract } from '@/layers/shared/contracts/configuration-repository.contract';
import { type ConfigurationServiceContract } from '@/layers/shared/contracts/configuration-service.contract';
import { type ModelMetadataRepositoryContract } from '@/layers/shared/contracts/model-metadata-repository.contract';
import { type OnlineModelRepositoryContract } from '@/layers/shared/contracts/online-model-repository.contract';
import { type RuntimeConfigurationAdapterContract } from '@/layers/shared/contracts/runtime-configuration-adapter.contract';
import {
  type AssistantSettings,
  type ConfigurationState,
  defaultAssistantSettings,
  isAssistantSettings,
  metadataPrecisionChoices,
  type RuntimeAvailability,
  type RuntimeConfigurationState,
} from '@/layers/shared/models/assistant-settings.model';
import { type ModelMetadata } from '@/layers/shared/models/model-metadata.model';
import { type OnlineModel } from '@/layers/shared/models/online-model.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export class ConfigurationService implements ConfigurationServiceContract {
  readonly #state;
  readonly #defaults: AssistantSettings;
  readonly stateSubscription;
  #metadataRevision = 0;
  readonly #metadata = new Map<string, ModelMetadata>();
  #responding = false;
  #running = false;
  #disposed = false;
  #revision = 0;
  #lastWorking?: AssistantSettings;
  #sharedRuntime: RuntimeAvailability | undefined;
  #seenSelectionId: string | undefined;
  #selectionBaseline: string | undefined;
  #disconnect: Array<() => void> = [];
  #onlineModels: OnlineModel[] = [];

  #current(): ConfigurationState {
    const state = this.#state.getValue();
    if (!state)
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Configuration state is unavailable`);
    return state;
  }

  constructor(
    private readonly repository: ConfigurationRepositoryContract,
    private readonly adapter: RuntimeConfigurationAdapterContract,
    private readonly metadata: ModelMetadataRepositoryContract,
    private readonly online?: OnlineModelRepositoryContract,
  ) {
    const saved = repository.load();
    const profile = metadata.models[0];
    if (!profile) throw new Error(`[${SeverityLevelCodes.ERROR}] - No models are configured`);
    const restored = saved.value;
    const defaults = {
      ...defaultAssistantSettings,
      model: profile.id,
      precision: profile.precision,
    };
    this.#defaults = defaults;
    const savedValid =
      isAssistantSettings(restored) && metadata.models.some(({ id }) => id === restored.model);
    this.#state = createStatefulSubscribable<ConfigurationState>({
      selected: Object.freeze(savedValid ? { ...restored } : defaults),
      pending: true,
      loading: true,
      available: false,
      canSwitchBack: false,
      metadataLoading: false,
      notice:
        saved.notice ??
        (saved.value === undefined || savedValid
          ? undefined
          : 'Saved settings are invalid. Defaults restored.'),
    });
    this.stateSubscription = { connect: this.#state.connect, getValue: this.#state.getValue };
    this.adapter.select(this.#current().selected);
    this.#disconnect = [
      repository.observe((record) => {
        if (this.#disposed) return;
        const observed = record.value;
        const valid =
          isAssistantSettings(observed) &&
          this.metadata.models.some(({ id }) => id === observed.model);
        const state = this.#current();
        this.#state.emit({
          ...state,
          notice:
            record.notice ??
            (record.value !== undefined && !valid
              ? 'Saved settings are invalid. Defaults restored.'
              : state.notice),
        });
        this.#select(valid ? observed : defaults, false);
      }),
      adapter.stateSubscription.connect(this.#observeRuntime),
    ];
    this.#schedule();
    void this.refreshOptions(false);
  }

  readonly #observeRuntime = (state: RuntimeConfigurationState): void => {
    if (state.mounted) this.#state.emit({ ...this.#current(), mounted: state.mounted });
    this.#responding = state.responding;
    if (state.runtime) this.#publishRuntime(state.runtime);
    if (!state.responding) this.#schedule();
  };

  #publishRuntime(runtime: RuntimeAvailability): void {
    this.#sharedRuntime = runtime;
    this.#captureSelectionIdentity(runtime.selectionId);
    const previous = this.#current().selected;
    const state = this.#sharedSelection(runtime);
    if (!state) return;
    this.#rememberWorking(runtime);
    const available = this.#runtimeReady(runtime, state.selected);
    if (state.available !== available) this.adapter.setAvailable(available);
    this.#state.emit({
      ...state,
      active: runtime.active ?? state.active,
      loading: runtime.loading,
      pending: runtime.pending,
      available,
      error: this.#runtimeError(runtime, state),
      canSwitchBack: Boolean(this.#lastWorking),
    });
    if (this.#optionsChanged(previous, state.selected)) void this.refreshOptions();
    else if (previous.execution !== state.selected.execution) this.#updateChoices();
  }

  #captureSelectionIdentity(identity: string | undefined): void {
    if (!identity) return;
    this.#seenSelectionId = identity;
    this.#selectionBaseline ??= identity;
  }

  #sharedSelection(runtime: RuntimeAvailability): ConfigurationState | undefined {
    const state = this.#current();
    if (this.#staleFailure(runtime, state)) return undefined;
    if (areValuesEqual(runtime.selected, state.selected)) return state;
    if (!this.#canAdoptDifferent(runtime, state)) return undefined;
    this.#revision++;
    return { ...state, selected: Object.freeze({ ...runtime.selected }), error: undefined };
  }

  #staleFailure(runtime: RuntimeAvailability, state: ConfigurationState): boolean {
    return Boolean(state.error) && !runtime.error && !this.#canReplaceFailure(runtime, state);
  }

  #canAdoptDifferent(
    runtime: RuntimeAvailability,
    state: ConfigurationState,
  ): runtime is RuntimeAvailability & { selected: AssistantSettings } {
    return (
      !this.#running &&
      (!state.pending || Boolean(state.error)) &&
      this.#canReplaceFailure(runtime, state) &&
      isAssistantSettings(runtime.selected) &&
      this.metadata.models.some(({ id }) => id === runtime.selected?.model)
    );
  }

  #canReplaceFailure(runtime: RuntimeAvailability, state: ConfigurationState): boolean {
    if (!state.error) return true;
    return runtime.selectionId !== undefined && runtime.selectionId !== this.#selectionBaseline;
  }

  #invalidateSharedSnapshot(): void {
    this.#selectionBaseline = this.#seenSelectionId;
    this.#sharedRuntime = undefined;
  }

  #runtimeError(runtime: RuntimeAvailability, state: ConfigurationState): string | undefined {
    if (runtime.error) return this.#failureMessage(state.selected, runtime.error);
    return runtime.pending ? state.error : undefined;
  }

  #rememberWorking(runtime: RuntimeAvailability): void {
    if (runtime.ready && !runtime.pending && runtime.active && this.#available(runtime.active)) this.#lastWorking = runtime.active;
  }

  #runtimeReady(runtime: RuntimeAvailability, selected: AssistantSettings): boolean {
    return runtime.ready && !runtime.pending && !runtime.error && this.#available(selected);
  }

  update(settings: AssistantSettings): boolean {
    if (
      this.#disposed ||
      !isAssistantSettings(settings) ||
      !this.metadata.models.some(({ id }) => id === settings.model)
    )
      return false;
    if (!this.#onlineAllowed(settings)) return false;
    const previous = this.#current().selected;
    if (!this.#unchangedModelSettings(previous, settings) && !this.#supports(settings))
      return false;
    this.#select(settings);
    return true;
  }

  #optionsChanged(previous: AssistantSettings, next: AssistantSettings): boolean {
    return previous.model !== next.model || previous.mode !== next.mode;
  }

  #unchangedModelSettings(previous: AssistantSettings, next: AssistantSettings): boolean {
    return previous.model === next.model && previous.precision === next.precision && previous.execution === next.execution;
  }

  #select(settings: AssistantSettings, persist = true): void {
    const state = this.#current();
    if (areValuesEqual(state.selected, settings)) return;
    this.#invalidateSharedSnapshot();
    this.#revision++;
    const notice = (persist ? this.repository.save(settings).notice : undefined) ?? state.notice;
    this.#state.emit({
      ...state,
      selected: Object.freeze({ ...settings }),
      pending: true,
      available: false,
      error: undefined,
      notice,
    });
    this.adapter.select(settings);
    this.adapter.setAvailable(false);
    this.#schedule();
    this.#updateChoices();
    if (state.selected.model !== settings.model || state.selected.mode !== settings.mode) void this.refreshOptions();
  }

  #onlineAllowed(settings: AssistantSettings): boolean {
    if (settings.mode !== 'online' || !settings.onlineModel || !this.online) return true;
    return this.#onlineModels.some(({ id, maxOutputTokens }) => id === settings.onlineModel && settings.maxNewTokens <= maxOutputTokens);
  }

  #available(settings: AssistantSettings): boolean {
    return settings.mode === 'local' || Boolean(this.online && this.#onlineModels.some(({ id }) => id === settings.onlineModel));
  }

  #schedule(): void {
    const state = this.#current();
    if (this.#disposed || this.#running || this.#responding || !state.pending || state.error)
      return;
    this.#running = true;
    void this.#apply().finally(() => {
      this.#running = false;
      const shared = this.#sharedRuntime;
      if (shared && !shared.pending && !areValuesEqual(shared.selected, this.#current().selected))
        this.#publishRuntime(shared);
      this.#schedule();
    });
  }

  async #apply(): Promise<void> {
    const before = this.#current();
    const revision = this.#revision;
    this.#invalidateSharedSnapshot();
    this.adapter.setAvailable(false);
    this.#state.emit({ ...before, loading: true });
    try {
      await this.adapter.apply(before.selected);
      if (this.#disposed || revision !== this.#revision) return;
      const available = this.#available(before.selected);
      if (available) this.#lastWorking = before.selected;
      this.#state.emit({
        ...this.#current(),
        active: before.selected,
        pending: false,
        loading: false,
        available,
        canSwitchBack: Boolean(this.#lastWorking),
        error: undefined,
      });
      this.adapter.setAvailable(available);
    } catch (error) {
      if (this.#disposed || revision !== this.#revision) return;
      this.#state.emit({
        ...this.#current(),
        loading: false,
        available: false,
        error: this.#failureMessage(before.selected, error),
        canSwitchBack: Boolean(this.#lastWorking),
      });
    }
  }

  #failureMessage(settings: AssistantSettings, error: unknown): string {
    const diagnostic = error instanceof Error ? error.message : String(error);
    const recovery = this.#lastWorking
      ? 'Switch back to working settings or restore defaults.'
      : 'Retry these settings or restore defaults.';
    return `Could not apply ${JSON.stringify(settings)}: ${diagnostic}. ${recovery}`;
  }

  #supports(settings: AssistantSettings): boolean {
    if (settings.mode === 'online') return true;
    const metadata = this.#metadata.get(settings.model);
    if (metadata)
      return metadataPrecisionChoices(metadata, settings.execution).some(
        ({ value }) => value === settings.precision,
      );
    return this.metadata.models.some(
      ({ id, precision }) => id === settings.model && precision === settings.precision,
    );
  }

  #updateChoices(): void {
    const state = this.#current();
    if (state.selected.mode === 'online' && this.online) {
      this.#onlineChoices(state);
      return;
    }
    const descriptor = this.metadata.models.find(({ id }) => id === state.selected.model);
    if (!descriptor) return;
    const metadata = this.#metadata.get(descriptor.id);
    this.#state.emit({
      ...state,
      choices: {
        models: this.metadata.models.map(({ id, label }) => ({ value: id, label })),
        precisions: metadata
          ? metadataPrecisionChoices(metadata, state.selected.execution)
          : [{ value: descriptor.precision, label: descriptor.precision.toUpperCase() }],
        revision: descriptor.revision,
      },
    });
  }

  #onlineChoices(state: ConfigurationState): void {
    const model = this.#onlineModels.find(({ id }) => id === state.selected.onlineModel);
    this.#state.emit({ ...state, choices: {
      models: this.#onlineModels.map(({ id, label }) => ({ value: id, label })),
      precisions: [], revision: '', reasoningEffort: model?.reasoningEffort ?? 'low',
      maxOutputTokens: model?.maxOutputTokens ?? 1024,
    } });
  }

  async refreshOptions(refresh = true): Promise<void> {
    if (this.#current().selected.mode === 'online' && this.online) {
      await this.#refreshOnline();
      return;
    }
    await this.#refreshLocal(refresh);
  }

  async #refreshLocal(refresh: boolean): Promise<void> {
    const revision = ++this.#metadataRevision;
    const model = this.#current().selected.model;
    this.#updateChoices();
    this.#state.emit({ ...this.#current(), metadataLoading: true, metadataError: undefined });
    try {
      const metadata = await this.metadata.load(model, refresh);
      if (this.#disposed || revision !== this.#metadataRevision) return;
      this.#metadata.set(model, metadata);
      this.#state.emit({ ...this.#current(), metadataLoading: false });
      this.#updateChoices();
    } catch (error) {
      if (this.#disposed || revision !== this.#metadataRevision) return;
      this.#state.emit({
        ...this.#current(),
        metadataLoading: false,
        metadataError: `Could not retrieve model options: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  async #refreshOnline(): Promise<void> {
    const revision = ++this.#metadataRevision;
    this.#state.emit({ ...this.#current(), metadataLoading: true, metadataError: undefined });
    try {
      const models = await this.online?.load();
      if (this.#disposed || revision !== this.#metadataRevision || !models) return;
      this.#installOnlineModels(models);
    } catch (error) {
      if (this.#disposed || revision !== this.#metadataRevision) return;
      this.#state.emit({ ...this.#current(), metadataLoading: false, metadataError: String(error) });
    }
  }

  #installOnlineModels(models: OnlineModel[]): void {
    this.#onlineModels = models;
    const state = this.#current();
    const model = models.find(({ id }) => id === state.selected.onlineModel) ?? models[0];
    if (!model) throw new Error('No online models are configured.');
    this.#state.emit({ ...state, metadataLoading: false });
    this.#select({ ...state.selected, onlineModel: model.id, maxNewTokens: Math.min(state.selected.maxNewTokens, model.maxOutputTokens) });
    this.#updateChoices();
    if (!this.#current().available) {
      this.#state.emit({ ...this.#current(), pending: true });
      this.#schedule();
    }
  }

  retry(): void {
    const state = this.#current();
    this.#invalidateSharedSnapshot();
    this.#revision++;
    this.#state.emit({ ...state, pending: true, error: undefined, available: false });
    this.#schedule();
  }

  switchBack(): void {
    if (!this.#lastWorking) return;
    if (areValuesEqual(this.#lastWorking, this.#current().selected)) this.retry();
    else this.#select(this.#lastWorking);
  }

  restoreDefaults(): void {
    this.#select({ ...this.#defaults });
    if (this.#state.getValue()?.error) this.retry();
  }

  dispose(): void {
    this.#disposed = true;
    for (const disconnect of this.#disconnect) disconnect();
    this.#disconnect = [];
  }
}
