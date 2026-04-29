import { ChatMessage, Chunk, UserMessage } from '../models/models';

export interface ChatMessageModelContract {
  getMsg(): ChatMessage[];

  createNewUserEntry(context: Chunk[], query: string): UserMessage;

  populate(msg: ChatMessage): void;
}
