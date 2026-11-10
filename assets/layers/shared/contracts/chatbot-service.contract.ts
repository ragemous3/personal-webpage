import { type ChatMessage } from '@/layers/data/models/models';
export type { ChatMessage } from '@/layers/data/models/models';
import {
  type ReadonlyConnections,
  type WritableStatefulConnections,
} from '@/layers/shared/utils/subscribable';

export interface ChatbotServiceContract {
  readonly lifecycleSubscription: ReadonlyConnections<ChatLifecycleEvent>;
  chatMessagesSubscription: WritableStatefulConnections<ChatMessage[]>;
  stateSubscription: WritableStatefulConnections<ChatState>;
  attach(): () => void;
  init(): void;
  send(question: string): void;
  cancel(): void;
  reset(): void;
  retry(): void;
  reconnect(): Promise<void>;
  dispose(): void;
}

export interface ChatState {
  status: 'initializing' | 'ready' | 'responding' | 'error';
  error?: string;
  runtimeFailure?: boolean;
  storageFailure?: boolean;
}

export type ChatLifecycleEvent = 'invalidate' | 'unavailable' | 'available';
