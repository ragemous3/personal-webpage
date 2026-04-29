import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { HierarchicalNSW, HnswlibModule, loadHnswlib, syncFileSystem } from 'hnswlib-wasm';
import { SearchResult, SpaceName } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { HNSWDBEntry } from './models/models';
import { SeverityLevelCodes } from '../shared/constants';
import { Nullable } from '../shared/models';
import { ApiBase } from './abstracts/base.infra';
import { IndexDBBase } from './idb-base.data';
import { ProgressInfo } from '../shared/models/progress.model';

export class VectorDBHNSWData {
  HNSW_LIB_STORE = '/hnswlib-index';
  key = `${this.HNSW_LIB_STORE}/data.dat`;
  lib: Nullable<HnswlibModule> = null;

  dim = 384;
  nodeConnections = 16;
  maxEls = 29;
  efConstructor = 200;
  seedGen = 100;

  index?: HierarchicalNSW;
  indexEntry: string = 'data.dat';
  spaceName: SpaceName = 'cosine';

  featureExtractionModel: string = 'Xenova/all-MiniLM-L6-v2';
  embedder: FeatureExtractionPipeline | undefined;
  apiBase = new ApiBase('');
  indexDb = new IndexDBBase('/hnswlib-index');

  constructor() {}

  init = async (emitProgress: (progress: ProgressInfo) => void): Promise<void> => {
    try {
      emitProgress({
        name: 'vectordb',
        file: 'VectorDBHNSWData',
        status: 'initiate',
      });
      this.lib = await loadHnswlib();

      this.index = new this.lib.HierarchicalNSW(this.spaceName, this.dim, this.indexEntry);

      this.index.initIndex(this.maxEls, this.nodeConnections, this.efConstructor, this.seedGen);

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
        await this.index.readIndex('data.dat', this.dim);
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
    } catch (e) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Error init VectorDBHNSWData - ${e}`);
    }
  };

  createEmbedder = async (
    emitProgress: (progress: ProgressInfo) => void,
  ): Promise<FeatureExtractionPipeline> =>
    await pipeline('feature-extraction', this.featureExtractionModel, {
      device: 'webgpu',
      dtype: 'uint8',
      progress_callback: emitProgress,
    });

  query = async (query: string, topK: number = 5): Promise<SearchResult> => {
    if (!this.index || !this.embedder) {
      throw new Error('Expected Index and embedder to be defined!');
    }
    const queryEmbedding = await this.embedder([query], {
      pooling: 'mean',
      normalize: true,
    });

    if (!queryEmbedding) {
      throw new Error('Expected queryEmbeddings to be defined!');
    }

    return this.index.searchKnn(<Float32Array>queryEmbedding.data, topK, undefined);
  };

  private fetchAndStore = async (): Promise<void> => {
    const db: IDBDatabase = await this.indexDb.openDB();
    if (!db) throw new Error('Failed to init DB');

    const metadata: Omit<HNSWDBEntry, 'contents'> = await this.apiBase.loadJSON();
    const contents: Uint8Array<ArrayBufferLike> | undefined = await this.apiBase.loadUint8Array();

    if (!contents) {
      console.error(`[${SeverityLevelCodes.FATAL}] - expected contents to be defined`);
      return undefined;
    }

    const data: HNSWDBEntry = {
      timestamp: new Date(metadata.timestamp),
      mode: metadata.mode,
      contents,
    };

    await new Promise((resolve, reject): void => {
      const tx = db.transaction('FILE_DATA', 'readwrite');
      const index = tx.objectStore('FILE_DATA');

      index.put(data, this.key);

      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = (): void => reject(tx.error);
    });
  };

  private readInExternalFile = async (): Promise<void> => {
    await this.fetchAndStore();
    await syncFileSystem('read');
  };
}
