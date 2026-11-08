import { IndexDBBase } from '@/layers/data/idb-base.data';
import { type ChatMessage } from '@/layers/data/models/models';
import { parseMessages } from '@/layers/data/utils/chat-history.utility';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ChatHistoryRepositoryContract } from '@/layers/shared/contracts/chat-history-repository.contract';

export class ChatHistoryRepository implements ChatHistoryRepositoryContract {
  static readonly #storeName = 'conversations';
  readonly #store: IndexDBBase;
  #database: Promise<IDBDatabase> | undefined;

  constructor(factory: IDBFactory | undefined) {
    this.#store = new IndexDBBase('assistant-chat-history', factory, 1);
  }

  async #open(): Promise<IDBDatabase> {
    this.#database ??= this.#store
      .openStore(ChatHistoryRepository.#storeName)
      .then((database) => {
        database.addEventListener('versionchange', () => this.dispose());
        return database;
      })
      .catch((error: unknown) => {
        this.#database = undefined;
        throw error;
      });
    return this.#database;
  }

  async #transaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.#open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(ChatHistoryRepository.#storeName, mode);
      const request = operation(transaction.objectStore(ChatHistoryRepository.#storeName));
      transaction.addEventListener('complete', () => resolve(request.result));
      transaction.addEventListener('abort', () =>
        reject(transaction.error ?? new Error(`[${SeverityLevelCodes.ERROR}] - History transaction failed.`)),
      );
      transaction.addEventListener('error', () =>
        reject(transaction.error ?? new Error(`[${SeverityLevelCodes.ERROR}] - History transaction failed.`)),
      );
    });
  }

  async load(conversationId: string): Promise<ChatMessage[]> {
    const value: unknown = await this.#transaction('readonly', (store) =>
      store.get(conversationId),
    );
    return parseMessages(value);
  }

  async save(conversationId: string, messages: readonly ChatMessage[]): Promise<void> {
    const snapshot = structuredClone(messages);
    await this.#transaction('readwrite', (store) => store.put(snapshot, conversationId));
  }

  async clear(conversationId: string): Promise<void> {
    await this.#transaction('readwrite', (store) => store.delete(conversationId));
  }

  dispose(): void {
    void this.#database?.then((database) => database.close(), () => {
      // The operation that opened this connection reports its failure to the caller.
    });
    this.#database = undefined;
  }
}
