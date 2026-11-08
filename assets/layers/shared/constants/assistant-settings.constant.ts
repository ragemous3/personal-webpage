import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { type AssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { type SettingChoice } from '@/layers/shared/models/model-metadata.model';

export const defaultAssistantSettings: Readonly<AssistantSettings> = Object.freeze({
  mode: AssistantModes.LOCAL,
  model: 'Xenova/Qwen1.5-0.5B-Chat',
  execution: 'auto',
  precision: 'q4',
  maxNewTokens: 256,
  sampling: false,
  temperature: 0.7,
  topP: 0.9,
});

export const modeChoices: SettingChoice[] = [
  { value: AssistantModes.LOCAL, label: 'Local' },
  { value: AssistantModes.ONLINE, label: 'Online' },
];
export const executionChoices: SettingChoice[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'wasm', label: 'CPU' },
  { value: 'webgpu', label: 'WebGPU' },
];
