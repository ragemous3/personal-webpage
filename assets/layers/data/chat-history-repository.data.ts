import { IndexDBBase } from '@/layers/data/idb-base.data';
import { type ChatMessage } from '@/layers/data/models/models';
import { type ChatHistoryRepositoryContract } from '@/layers/shared/contracts/chat-history-repository.contract';
import { isRecord } from '@/layers/shared/guards/guards';

const storeName = 'conversations';
const parseMessages = (value: unknown): ChatMessage[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Saved conversation is invalid.');
  return value.map((message: unknown) => {
    if (
      !isRecord(message) ||
      !['user', 'assistant'].includes(String(message.role)) ||
      typeof message.content !== 'string'
    )
      throw new Error('Saved conversation is invalid.');
    return {
      role: message.role as 'user' | 'assistant',
      content: message.content,
      ...(message.interrupted === true ? { interrupted: true } : {}),
    };
  });
};

export class ChatHistoryRepository implements ChatHistoryRepositoryContract {
  readonly #store: IndexDBBase;
  #database: Promise<IDBDatabase> | undefined;

  constructor(factory: IDBFactory | undefined) {
    this.#store = new IndexDBBase('assistant-chat-history', factory, 1);
  }

  async #open(): Promise<IDBDatabase> {
    this.#database ??= this.#store
      .openStore(storeName)
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
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.addEventListener('complete', () => resolve(request.result));
      transaction.addEventListener('abort', () =>
        reject(transaction.error ?? new Error('History transaction failed.')),
      );
      transaction.addEventListener('error', () =>
        reject(transaction.error ?? new Error('History transaction failed.')),
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
