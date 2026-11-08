import { type ModelPrecision, type SettingChoice } from '@/layers/shared/models/model-metadata.model';

export interface AssistantSettings {
  mode: 'local' | 'online';
  model: string;
  onlineModel?: string;
  execution: 'auto' | 'wasm' | 'webgpu';
  precision: ModelPrecision | 'auto';
  maxNewTokens: number;
  sampling: boolean;
  temperature: number;
  topP: number;
}

export interface ConfigurationState {
  mounted?: AssistantSettings | undefined;
  selected: AssistantSettings;
  active?: AssistantSettings | undefined;
  pending: boolean;
  loading: boolean;
  available: boolean;
  notice?: string | undefined;
  error?: string | undefined;
  canSwitchBack: boolean;
  choices?: { models: SettingChoice[]; precisions: SettingChoice[]; revision: string; reasoningEffort?: string; maxOutputTokens?: number };
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
  mounted?: AssistantSettings | undefined;
  responding: boolean;
  runtime?: RuntimeAvailability;
}
