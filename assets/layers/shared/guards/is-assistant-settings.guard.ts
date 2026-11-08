import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { type AssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { modelPrecisionSuffixes } from '@/layers/shared/models/model-metadata.model';

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const settingsValidators: Record<keyof AssistantSettings, (value: unknown) => boolean> = {
  mode: (value) => value === AssistantModes.LOCAL || value === AssistantModes.ONLINE,
  model: (value) => typeof value === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value),
  onlineModel: (value) => value === undefined || (typeof value === 'string' && /^[\w.-]+$/.test(value)),
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
