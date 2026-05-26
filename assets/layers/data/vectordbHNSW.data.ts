import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import {
  type HierarchicalNSW,
  type HnswlibModule,
  loadHnswlib,
  syncFileSystem,
} from 'hnswlib-wasm';
import { type SearchResult, type SpaceName } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';

import { SeverityLevelCodes } from '../shared/constants';
import { type Nullable } from '../shared/models';
import { type ProgressInfo } from '../shared/models/progress.model';
import { ApiBase } from './abstracts/base.infra';
import { IndexDBBase } from './idb-base.data';
import { HNSWDBEntryMetadata, type HNSWDBEntry } from './models/models';

export class VectorDBHNSWData {
  private readonly key: string;

  private lib: Nullable<HnswlibModule> = null;
  private index?: HierarchicalNSW;
  private embedder: FeatureExtractionPipeline | undefined;

  private readonly apiBase: ApiBase;
  private readonly indexDb: IndexDBBase;

  constructor(private readonly config: DatabaseConfig) {
    this.key = `${this.config.indexStoreName}/${this.config.indexEntry}`;
    this.apiBase = new ApiBase(this.config.baseUrl);
    this.indexDb = new IndexDBBase(this.config.indexStoreName);
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

      await this.readInExternalFile();

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

  private readonly fetchAndStore = async (): Promise<void> => {
    try {
      const database: IDBDatabase = await this.indexDb.openDB();
      const metadata: HNSWDBEntryMetadata = await this.apiBase.loadJSON<HNSWDBEntryMetadata>(
        this.config.metadataPath,
        (data: unknown): HNSWDBEntryMetadata => {
          if (!this.guardHSNWEntryMetadata(data))
            throw new Error(
              `[${SeverityLevelCodes.ERROR}] - Expected HNSWDBEntryMetadata but got something else`,
            );
          return data;
        },
      );
      const contents: Uint8Array | undefined = await this.apiBase.loadUint8Array();

      if (!contents) {
        throw new Error(`[${SeverityLevelCodes.FATAL}] - expected contents to be defined`);
      }

      const data: HNSWDBEntry = {
        timestamp: new Date(metadata.timestamp),
        mode: metadata.mode,
        contents,
      };

      await new Promise((resolve, reject): void => {
        const tx = database.transaction('FILE_DATA', 'readwrite');
        const index = tx.objectStore('FILE_DATA');
        const cleanup = (): void => {
          tx.removeEventListener('complete', onComplete);
          tx.removeEventListener('error', onFailure);
          tx.removeEventListener('abort', onFailure);
        };
        index.put(data, this.key);

        tx.oncomplete = resolve;

        const handleFailure = (event): void => {
          reject(event);
        };

        tx.addEventListener('error', handleFailure);
        tx.addEventListener('abort', handleFailure);
      });
    } catch (error) {
      throw new Error(`[${SeverityLevelCodes.FATAL}] - Failed to fetch and store HNSW database`, {
        cause: error,
      });
    }
  };

  private readonly readInExternalFile = async (): Promise<void> => {
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
