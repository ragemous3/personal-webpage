import { type ChatMessage, type Chunk, type UserMessage } from '@/layers/data/models/models';

export interface ChatMessageModelContract {
  getMsg(): ChatMessage[];

  createNewUserEntry(context: Chunk[], query: string): UserMessage;

  populate(message: ChatMessage): void;
}
