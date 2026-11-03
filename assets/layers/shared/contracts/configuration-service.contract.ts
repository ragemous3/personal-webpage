import {
  type AssistantSettings,
  type ConfigurationRuntimeState,
  type ConfigurationState,
} from '@/layers/shared/models/assistant-settings.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface ConfigurationRuntimeContract {
  readonly stateSubscription: ReadonlyStatefulConnections<ConfigurationRuntimeState>;
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
