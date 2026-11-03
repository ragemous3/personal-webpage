export interface AssistantSettings {
  mode: 'local' | 'online';
  model: 'Xenova/Qwen1.5-0.5B-Chat';
  execution: 'auto' | 'wasm' | 'webgpu';
  precision: 'q4' | 'auto';
  maxNewTokens: number;
  sampling: boolean;
  temperature: number;
  topP: number;
}

export interface ConfigurationState {
  selected: AssistantSettings;
  active?: AssistantSettings | undefined;
  pending: boolean;
  loading: boolean;
  available: boolean;
  notice?: string | undefined;
  error?: string | undefined;
  canSwitchBack: boolean;
}

export interface RuntimeAvailability {
  selected?: AssistantSettings;
  active?: AssistantSettings;
  pending: boolean;
  loading: boolean;
  ready: boolean;
  error?: string | undefined;
}

export interface ConfigurationRuntimeState {
  responding: boolean;
  runtime?: RuntimeAvailability;
}

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
