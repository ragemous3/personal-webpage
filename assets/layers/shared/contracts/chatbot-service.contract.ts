import { type ChatMessage } from '@/layers/data/models/models';
import { type WritableStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface ChatbotServiceContract {
  chatMessagesSubscription: WritableStatefulConnections<ChatMessage[]>;
  init(): void;
  send(question: string): void;
}
