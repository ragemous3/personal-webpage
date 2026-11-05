import {
  type ModelMetadata,
  modelPrecisionSuffixes,
  type SettingChoice,
} from '@/layers/shared/models/model-metadata.model';

export interface AssistantSettings {
  mode: 'local' | 'online';
  model: string;
  execution: 'auto' | 'wasm' | 'webgpu';
  precision: keyof typeof modelPrecisionSuffixes | 'auto';
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
  choices?: { models: SettingChoice[]; precisions: SettingChoice[]; revision: string };
  metadataLoading?: boolean;
  metadataError?: string | undefined;
}

export interface RuntimeAvailability {
  selectionId?: string;
  selected?: AssistantSettings;
  active?: AssistantSettings;
  pending: boolean;
  loading: boolean;
  ready: boolean;
  error?: string | undefined;
}

export interface RuntimeConfigurationState {
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
  model: (value) => typeof value === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value),
  execution: (value) => value === 'auto' || value === 'wasm' || value === 'webgpu',
  precision: (value) =>
    typeof value === 'string' && (value === 'auto' || Object.hasOwn(modelPrecisionSuffixes, value)),
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

export const modeChoices: SettingChoice[] = [
  { value: 'local', label: 'Local' },
  { value: 'online', label: 'Online' },
];
export const executionChoices: SettingChoice[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'wasm', label: 'CPU' },
  { value: 'webgpu', label: 'WebGPU' },
];
export const metadataPrecisionChoices = (
  metadata: ModelMetadata,
  execution: AssistantSettings['execution'],
): SettingChoice[] => [
  ...(metadata.precisions.includes(metadata.autoPrecision[execution])
    ? [{ value: 'auto', label: 'Auto' }]
    : []),
  ...metadata.precisions.map((value) => ({ value, label: value.toUpperCase() })),
];
