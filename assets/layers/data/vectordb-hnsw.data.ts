import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import {
  type HierarchicalNSW,
  type HnswlibModule,
  loadHnswlib,
  syncFileSystem,
} from 'hnswlib-wasm';
import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { type StoreContract } from '@/layers/data/contracts/store-base.contract';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ApiContract } from '@/layers/shared/contracts/api.contract';
import { type Nullable } from '@/layers/shared/models';
import { type ProgressInfo } from '@/layers/shared/models/progress.model';

import { type HNSWDBEntry, type HNSWDBEntryMetadata } from './models/models';

export class VectorDBHNSWData {
  private readonly key: string;

  private lib: Nullable<HnswlibModule> = null;
  private index?: HierarchicalNSW;
  private embedder: FeatureExtractionPipeline | undefined;

  constructor(
    private readonly config: DatabaseConfig,
    private readonly apiBase: ApiContract,
    private readonly store: StoreContract<Promise<IDBDatabase>>,
  ) {
    this.key = `${this.config.indexStoreName}/${this.config.indexEntry}`;
  }

  init = async (emitProgress: (progress: ProgressInfo) => void): Promise<void> => {
    try {
      emitProgress({
        name: 'vectordb',
        file: 'VectorDBHNSWData',
        status: 'initiate',
      });
      this.lib = await loadHnswlib();

      this.index = new this.lib.HierarchicalNSW(
        this.config.spaceName,
        this.config.dim,
        this.config.indexEntry,
      );

      this.index.initIndex(
        this.config.maxEls,
        this.config.nodeConnections,
        this.config.efConstructor,
        this.config.seedGen,
      );

      emitProgress({
        name: 'vectordb',
        file: 'index',
        status: 'download',
      });

      emitProgress({
        name: 'vectordb',
        file: 'index',
        status: 'progress',
        progress: 0,
        loaded: 0,
        total: 100,
      });

      await this.readExternalFile();

      emitProgress({
        name: 'vectordb',
        file: 'index',
        status: 'progress',
        progress: 100,
        loaded: 100,
        total: 100,
      });

      const exists = this.lib.EmscriptenFileSystemManager.checkFileExists('data.dat');

      if (exists && this.lib.EmscriptenFileSystemManager.isSynced()) {
        await this.index.readIndex('data.dat', this.config.dim);
        this.index.setEfSearch(200);
      }

      this.embedder = await this.createEmbedder(emitProgress);
      emitProgress({
        name: 'vectordb',
        file: 'index',
        status: 'done',
      });
      emitProgress({
        status: 'ready',
        task: '',
        model: 'HNSWlib',
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `[${SeverityLevelCodes.ERROR}] - Something went wrong with init - ${error.message}`,
          {
            cause: error,
          },
        );
      }
    }
  };

  createEmbedder = async (
    emitProgress: (progress: ProgressInfo) => void,
  ): Promise<FeatureExtractionPipeline> =>
    await pipeline('feature-extraction', this.config.featureExtractionModel, {
      device: 'webgpu',
      dtype: 'uint8',
      progress_callback: emitProgress,
    });

  query = async (query: string, topK = 5): Promise<SearchResult> => {
    if (!this.index || !this.embedder) {
      throw new Error('Expected Index and embedder to be defined!');
    }
    const queryEmbedding = await this.embedder([query], {
      pooling: 'mean',
      normalize: true,
    });

    return this.index.searchKnn(
      queryEmbedding.tolist(),
      topK,
      () => false, //TODO: Might break since im not sure what to filter off etc.
    );
  };

  private readonly guardHSNWEntryMetadata = (data: unknown): data is HNSWDBEntryMetadata =>
    typeof data === 'object' && data !== null && 'timestamp' in data && 'mode' in data
      ? true
      : false;
  private readonly parseMetadata = (data: unknown): HNSWDBEntryMetadata => {
    if (!this.guardHSNWEntryMetadata(data)) {
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Expected HNSWDBEntryMetadata but got something else`,
      );
    }

    return data;
  };
  private readonly getIndexedDBFailureCause = (tx: IDBTransaction, event: Event): unknown => {
    const target = event.target;

    if (tx.error) {
      return tx.error;
    }

    if (target instanceof IDBRequest && target.error) {
      return target.error;
    }

    return new DOMException('IndexedDB transaction failed', 'UnknownError');
  };

  private readonly storeHNSWEntry = (database: IDBDatabase, data: HNSWDBEntry): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction('FILE_DATA', 'readwrite');
      const store = tx.objectStore('FILE_DATA');

      const cleanup = (): void => {
        tx.removeEventListener('complete', onComplete);
        tx.removeEventListener('error', onFailure);
        tx.removeEventListener('abort', onFailure);
      };

      const onComplete = (): void => {
        cleanup();
        resolve();
      };

      const onFailure = (event: Event): void => {
        cleanup();

        reject(
          new Error(
            `[${SeverityLevelCodes.FATAL}] - IndexedDB transaction failed while storing HNSW database`,
            { cause: this.getIndexedDBFailureCause(tx, event) },
          ),
        );
      };

      tx.addEventListener('complete', onComplete, { once: true });
      tx.addEventListener('error', onFailure, { once: true });
      tx.addEventListener('abort', onFailure, { once: true });
      store.put(data, this.key);
    });
  };

  private readonly fetchAndStore = async (): Promise<void> => {
    try {
      const database = await this.store.openStore(this.config.indexStoreName);

      const metadata = await this.apiBase.loadJSON<HNSWDBEntryMetadata>(
        this.config.metadataPath,
        this.parseMetadata,
      );

      const contents = await this.apiBase.loadUint8Array(this.config.vectorsPath);

      if (!contents) {
        throw new Error(`[${SeverityLevelCodes.FATAL}] - expected contents to be defined`);
      }

      const timestamp = new Date(metadata.timestamp);

      if (Number.isNaN(timestamp.getTime())) {
        throw new TypeError(`[${SeverityLevelCodes.ERROR}] - Invalid metadata timestamp`);
      }

      await this.storeHNSWEntry(database, {
        timestamp,
        mode: metadata.mode,
        contents,
      });
    } catch (error) {
      throw new Error(`[${SeverityLevelCodes.FATAL}] - Failed to fetch and store HNSW database`, {
        cause: error,
      });
    }
  };
  private readonly readExternalFile = async (): Promise<void> => {
    try {
      await this.fetchAndStore();
      await syncFileSystem('read');
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
      }
      console.error(`Expected caught Error to be instanceof Error!`);
    }
  };
}
