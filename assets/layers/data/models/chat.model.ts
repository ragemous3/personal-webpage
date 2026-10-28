import { type ChatMessageModelContract } from '@/layers/data/contracts/chat-model.contract';

import { type ChatMessage, type Chunk, type SysMessage, type UserMessage } from './models';

export class ChatMessageModel implements ChatMessageModelContract {
  readonly #chatMessages: ChatMessage[] = [];

  constructor(protected sysMessage: SysMessage) {
    this.#chatMessages.push(sysMessage);
  }

  getMsg = (): ChatMessage[] => [...this.#chatMessages];

  createNewUserEntry = (context: Chunk[], query: string): UserMessage => {
    const question: UserMessage = {
      role: 'user',
      content: `CONTEXT:
    ${context.map((chunk) => chunk.text).join('\n')}
  QUESTION:
    ${query}
  `,
    };
    this.populate(question);
    return question;
  };

  populate = (message: ChatMessage): number => this.#chatMessages.push(message);
}
