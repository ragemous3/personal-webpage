import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ConfigurationRepositoryContract } from '@/layers/shared/contracts/configuration-repository.contract';
import {
  type AssistantSettings,
  type ConfigurationRuntimeContract,
  type ConfigurationRuntimeState,
  type ConfigurationServiceContract,
  type ConfigurationState,
  type RuntimeAvailability,
} from '@/layers/shared/contracts/configuration-service.contract';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export const defaultAssistantSettings: Readonly<AssistantSettings> = Object.freeze({
  mode: 'local',
  model: 'Xenova/Qwen1.5-0.5B-Chat',
  execution: 'auto',
  precision: 'q4',
  maxNewTokens: 256,
  sampling: false,
  temperature: 0.7,
  topP: 0.9,
});

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const settingsValidators: Record<keyof AssistantSettings, (value: unknown) => boolean> = {
  mode: (value) => value === 'local' || value === 'online',
  model: (value) => value === defaultAssistantSettings.model,
  execution: (value) => value === 'auto' || value === 'wasm' || value === 'webgpu',
  precision: (value) => value === 'q4' || value === 'auto',
  maxNewTokens: (value) => inRange(value, 1, 1024) && Number.isInteger(value),
  sampling: (value) => typeof value === 'boolean',
  temperature: (value) => inRange(value, 0.1, 2),
  topP: (value) => inRange(value, 0, 1) && value > 0,
};

export const isAssistantSettings = (value: unknown): value is AssistantSettings => {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  return Object.entries(settingsValidators).every(([key, validate]) => validate(settings[key]));
};

export class ConfigurationService implements ConfigurationServiceContract {
  readonly #state;
  readonly stateSubscription;
  #responding = false;
  #running = false;
  #disposed = false;
  #revision = 0;
  #lastWorking?: AssistantSettings;
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
    const state = this.#current();
    if (!areValuesEqual(runtime.selected, state.selected)) return;
    this.#state.emit({ ...state, active: runtime.active ?? state.active,
      loading: runtime.loading, pending: runtime.pending,
      available: runtime.ready && !runtime.pending && !runtime.error,
      error: runtime.error ? this.#failureMessage(state.selected, runtime.error) : undefined,
      canSwitchBack: Boolean(this.#lastWorking) });
  }

  update(settings: AssistantSettings): boolean {
    if (this.#disposed || !isAssistantSettings(settings)) return false;
    this.#select(settings);
    return true;
  }

  #select(settings: AssistantSettings, persist = true): void {
    const state = this.#current();
    if (areValuesEqual(state.selected, settings)) return;
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
      this.#schedule();
    });
  }

  async #apply(): Promise<void> {
    const before = this.#current();
    const revision = this.#revision;
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
    const recovery = this.#lastWorking ? 'Switch back to working settings or restore defaults.' : 'Retry these settings or restore defaults.';
    return `Could not apply ${JSON.stringify(settings)}: ${diagnostic}. ${recovery}`;
  }

  retry(): void {
    const state = this.#current();
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
