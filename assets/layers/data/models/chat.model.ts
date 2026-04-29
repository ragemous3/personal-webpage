import { ChatMessageModelContract } from '../contracts/chat-model.contract';
import { ChatMessage, Chunk, SysMessage, UserMessage } from './models';

export class ChatMessageModel implements ChatMessageModelContract {
  #chatMessages: ChatMessage[] = [];

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

  populate = (msg: ChatMessage) => this.#chatMessages.push(msg);
}
