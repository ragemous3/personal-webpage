import { type AssistantSettings, type RuntimeConfigurationState } from '@/layers/shared/models/assistant-settings.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface RuntimeConfigurationAdapterContract {
  readonly stateSubscription: ReadonlyStatefulConnections<RuntimeConfigurationState>;
  setAvailable(available: boolean): void;
  select(settings: AssistantSettings): void;
  apply(settings: AssistantSettings): Promise<void>;
}
