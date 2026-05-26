/* eslint-disable unicorn/prefer-add-event-listener */
export class IndexDBBase {
  indexDBVersion = 21;
  constructor(private readonly indexName: string) {}

  openDB = (storeName = 'FILE_DATA'): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(this.indexName, this.indexDBVersion);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          reject(new Error('Store should`ve been loaded earlier.'));
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        resolve(database);
      };
      request.onerror = () => {
        console.error(request.error);
        if (request.error instanceof Error) {
          reject(request.error);
        }
      };
    });
}
