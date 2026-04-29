import { ChatMessage } from '../../data/models/models';
import { WritableStatefulConnections } from '../utils/subscribable';

export interface ChatbotServiceContract {
  chatMessagesSubscription: WritableStatefulConnections<ChatMessage[]>;
  init(): void;
  send(question: string): void;
}
