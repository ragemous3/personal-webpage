import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { type ChatMessageModelContract } from '@/layers/data/contracts/chat-model.contract';
import {
  isMessageBase,
  isVectorDbResponse as isVectorDatabaseResponse,
} from '@/layers/data/guards/is-message-base.guard';
import { type ChatMessage, type Chunk } from '@/layers/data/models/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ChatbotServiceContract } from '@/layers/shared/contracts/chatbot-service.contract';
import { type ContentRepositoryContract } from '@/layers/shared/contracts/content-repository.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import {
  createStatefulSubscribable,
  type WritableStatefulConnections,
} from '@/layers/shared/utils/subscribable';

// Mechanism orchestration
export class RagService implements ChatbotServiceContract {
  #initialized = false; //To make it idempotent
  chatMessagesSubscription: WritableStatefulConnections<ChatMessage[]> = createStatefulSubscribable<
    ChatMessage[]
  >([]);

  constructor(
    private readonly chat: StandardCommunicationContract,
    private readonly database: StandardCommunicationContract,
    private readonly repo: ContentRepositoryContract,
    private readonly chatModel: ChatMessageModelContract,
  ) {}

  getContent = ({ neighbors }: SearchResult, chunks: Chunk[]): Chunk[] =>
    neighbors
      .map((index): Chunk | undefined => chunks[index])
      .filter((data): data is Chunk => data !== undefined);

  send = (query: string): void => {
    this.database.send({
      query,
    });
  };

  readonly #handleDbResponse = async (data: unknown): Promise<void> => {
    if (!isMessageBase(data, isVectorDatabaseResponse)) {
      console.error(`$[${SeverityLevelCodes.ERROR}] - Expected Search results from DB`);
      return;
    }
    const payload = data.payload;
    const chunks = await this.repo.getChunksAsync('/content-data/chunks.json');

    const content = this.getContent(payload.response, chunks);
    this.chatModel.createNewUserEntry(content, payload.query);
    this.chat.send({ message: this.chatModel.getMsg() });
  };

  //TODO: Add a g uard and a type here. Add the msg char whenever it lands here to the chatmodel object for nw. keep track of index
  readonly #handleChatResponse = (data: unknown): void => {};

  init = (): void => {
    if (this.#initialized) {
      console.warn(`${SeverityLevelCodes.WARNING} Init was called twice..`);
    }
    this.#initialized = true;
    this.database.onData((data): void => void this.#handleDbResponse(data).catch(console.error));
    this.chat.onData(this.#handleChatResponse);
  };
}
