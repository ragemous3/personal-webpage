import { type ChatMessage } from '@/layers/data/models/models';

export interface ChatHistoryRepositoryContract {
  load(conversationId: string): Promise<ChatMessage[]>;
  save(conversationId: string, messages: readonly ChatMessage[]): Promise<void>;
  clear(conversationId: string): Promise<void>;
}
