import { ChatMessage, Chunk } from '../data/models/models';
import { ContentRepositoryContract } from '../shared/contracts/content-repository.contract';
import { SeverityLevelCodes } from '../shared/constants';
import { ChatbotServiceContract } from '../shared/contracts/chatbot-service.contract';
import { SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { ChatMessageModelContract } from '../data/contracts/chat-model.contract';
import {
  createStatefulSubscribable,
  WritableStatefulConnections,
} from '../shared/utils/subscribable';
import { StandardCommunicationContract } from '../shared/contracts/port.contract';
import { isMessageBase, isVectorDbResponse } from '../data/guards/is-message-base';

// Mechanism orchestration
export class RagService implements ChatbotServiceContract {
  #initialized = false; //To make it idempotent
  chatMessagesSubscription: WritableStatefulConnections<ChatMessage[]> = createStatefulSubscribable<
    ChatMessage[]
  >([]);

  constructor(
    private chat: StandardCommunicationContract,
    private db: StandardCommunicationContract,
    private repo: ContentRepositoryContract,
    private chatModel: ChatMessageModelContract,
  ) {}

  getContent = ({ neighbors }: SearchResult, chunks: Chunk[]): Chunk[] =>
    neighbors.map((index) => chunks[index]).filter((data) => data !== undefined);

  send = (query: string) =>
    this.db.send({
      query,
    });

  #handleDbResponse = async (data: unknown) => {
    if (!isMessageBase(data, isVectorDbResponse)) {
      console.error(`$[${SeverityLevelCodes.ERROR}] - Expected Search results from DB`);
      return;
    }
    const p = data?.payload;
    const chunks = await this.repo.getChunksAsync('/content-data/chunks.json');
    const content = this.getContent(p.response, chunks);
    this.chatModel.createNewUserEntry(content, p.query);
    this.chat.send({ message: this.chatModel.getMsg() });
  };

  //TODO: Add a g uard and a type here. Add the msg char whenever it lands here to the chatmodel object for nw. keep track of index
  #handleChatResponse = (data: unknown) => {
    console.log(`recieved response! ${data}`);
  };

  init = async () => {
    if (this.#initialized) {
      console.warn(`${SeverityLevelCodes.WARNING} Init was called twice..`);
    }
    this.#initialized = true;
    this.db.onData(this.#handleDbResponse);
    this.chat.onData(this.#handleChatResponse);
  };
}
