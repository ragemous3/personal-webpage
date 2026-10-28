import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

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
  active?: AssistantSettings;
  pending: boolean;
  loading: boolean;
  available: boolean;
  notice?: string | undefined;
  error?: string | undefined;
  canSwitchBack: boolean;
}

export interface ConfigurationRuntimeContract {
  readonly stateSubscription: ReadonlyStatefulConnections<{ responding: boolean }>;
  setAvailable(available: boolean): void;
  select(settings: AssistantSettings): void;
  apply(settings: AssistantSettings): Promise<void>;
}

export interface ConfigurationServiceContract {
  readonly stateSubscription: ReadonlyStatefulConnections<ConfigurationState>;
  update(settings: AssistantSettings): boolean;
  retry(): void;
  switchBack(): void;
  restoreDefaults(): void;
  dispose(): void;
}
