import { type StoreContract } from '@/layers/data/contracts/store-base.contract';
import { SeverityLevelCodes } from '@/layers/shared/constants';

/* eslint-disable unicorn/prefer-add-event-listener */
export class IndexDBBase implements StoreContract<Promise<IDBDatabase>> {
  constructor(
    private readonly indexName: string,
    private readonly factory?: IDBFactory,
    private readonly version?: number,
  ) {}

  openStore = (storeName = 'FILE_DATA'): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = (this.factory ?? indexedDB).open(this.indexName, this.version);
      let blocked = false;

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
      };

      request.onsuccess = () => {
        const database = request.result;
        if (blocked) database.close();
        else resolve(database);
      };
      request.onerror = () => {
        console.error(`[${SeverityLevelCodes.ERROR}] - Failed to open IndexedDB`, request.error);
        reject(request.error ?? new Error('Failed to open IndexedDB'));
      };
      request.onblocked = () => {
        blocked = true;
        reject(new Error('IndexedDB upgrade is blocked. Close older tabs and retry.'));
      };
    });
}
