import {
  type AssistantSettings,
  type ConfigurationState,
} from '@/layers/shared/models/assistant-settings.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface ConfigurationServiceContract {
  readonly stateSubscription: ReadonlyStatefulConnections<ConfigurationState>;
  update(settings: AssistantSettings): boolean;
  retry(): void;
  refreshOptions(): Promise<void>;
  switchBack(): void;
  restoreDefaults(): void;
  dispose(): void;
}
