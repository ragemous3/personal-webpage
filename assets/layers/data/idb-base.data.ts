export class IndexDBBase {
  indexName: string = '/hnswlib-index';
  indexDBVersion = 21;
  constructor(indexName: string) {
    this.indexName = indexName;
  }

  openDB = (storeName: string = 'FILE_DATA'): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(this.indexName, this.indexDBVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          reject(new Error('Store should`ve been loaded earlier.'));
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        resolve(db);
      };
      request.onerror = () => {
        console.error(request.error);
        reject(request.error);
      };
    });
}
