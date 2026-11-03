import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ConfigurationRepositoryContract } from '@/layers/shared/contracts/configuration-repository.contract';
import {
  type ConfigurationRuntimeContract,
  type ConfigurationServiceContract,
} from '@/layers/shared/contracts/configuration-service.contract';
import {
  type AssistantSettings,
  type ConfigurationRuntimeState,
  type ConfigurationState,
  defaultAssistantSettings,
  isAssistantSettings,
  type RuntimeAvailability,
} from '@/layers/shared/models/assistant-settings.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export class ConfigurationService implements ConfigurationServiceContract {
  readonly #state;
  readonly stateSubscription;
  #responding = false;
  #running = false;
  #disposed = false;
  #revision = 0;
  #lastWorking?: AssistantSettings;
  #sharedRuntime: RuntimeAvailability | undefined;
  #seenSelectionId: string | undefined;
  #selectionBaseline: string | undefined;
  #disconnect: Array<() => void> = [];

  #current(): ConfigurationState {
    const state = this.#state.getValue();
    if (!state)
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Configuration state is unavailable`);
    return state;
  }

  constructor(
    private readonly repository: ConfigurationRepositoryContract,
    private readonly runtime: ConfigurationRuntimeContract,
  ) {
    const saved = repository.load();
    this.#state = createStatefulSubscribable<ConfigurationState>({
      selected: Object.freeze(
        isAssistantSettings(saved.value) ? { ...saved.value } : { ...defaultAssistantSettings },
      ),
      pending: true,
      loading: true,
      available: false,
      canSwitchBack: false,
      notice:
        saved.notice ??
        (saved.value === undefined || isAssistantSettings(saved.value)
          ? undefined
          : 'Saved settings are invalid. Defaults restored.'),
    });
    this.stateSubscription = { connect: this.#state.connect, getValue: this.#state.getValue };
    this.runtime.select(this.#current().selected);
    this.#disconnect = [
      repository.observe((record) => {
        if (this.#disposed) return;
        const valid = isAssistantSettings(record.value);
        const state = this.#current();
        this.#state.emit({
          ...state,
          notice:
            record.notice ??
            (record.value !== undefined && !valid
              ? 'Saved settings are invalid. Defaults restored.'
              : state.notice),
        });
        this.#select(
          valid ? (record.value as AssistantSettings) : { ...defaultAssistantSettings },
          false,
        );
      }),
      runtime.stateSubscription.connect(this.#observeRuntime),
    ];
    this.#schedule();
  }

  readonly #observeRuntime = (state: ConfigurationRuntimeState): void => {
    this.#responding = state.responding;
    if (state.runtime) this.#publishRuntime(state.runtime);
    if (!state.responding) this.#schedule();
  };

  #publishRuntime(runtime: RuntimeAvailability): void {
    this.#sharedRuntime = runtime;
    this.#captureSelectionIdentity(runtime.selectionId);
    const state = this.#sharedSelection(runtime);
    if (!state) return;
    this.#rememberWorking(runtime);
    const available = runtime.ready && !runtime.pending && !runtime.error;
    if (state.available !== available) this.runtime.setAvailable(available);
    this.#state.emit({
      ...state,
      active: runtime.active ?? state.active,
      loading: runtime.loading,
      pending: runtime.pending,
      available,
      error: this.#runtimeError(runtime, state),
      canSwitchBack: Boolean(this.#lastWorking),
    });
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
      isAssistantSettings(runtime.selected)
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
    if (runtime.ready && !runtime.pending && runtime.active) this.#lastWorking = runtime.active;
  }

  update(settings: AssistantSettings): boolean {
    if (this.#disposed || !isAssistantSettings(settings)) return false;
    this.#select(settings);
    return true;
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
    this.runtime.select(settings);
    this.runtime.setAvailable(false);
    this.#schedule();
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
    this.runtime.setAvailable(false);
    this.#state.emit({ ...before, loading: true });
    try {
      await this.runtime.apply(before.selected);
      if (this.#disposed || revision !== this.#revision) return;
      const available = before.selected.mode === 'local';
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
      this.runtime.setAvailable(available);
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
    this.#select({ ...defaultAssistantSettings });
    if (this.#state.getValue()?.error) this.retry();
  }

  dispose(): void {
    this.#disposed = true;
    for (const disconnect of this.#disconnect) disconnect();
    this.#disconnect = [];
  }
}
