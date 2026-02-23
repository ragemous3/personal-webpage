import {
  FeatureExtractionPipeline,
  pipeline,
  Tensor,
} from '@huggingface/transformers';
import {
  HierarchicalNSW,
  HnswlibModule,
  loadHnswlib,
  syncFileSystem,
} from 'hnswlib-wasm';
import { SearchResult, SpaceName } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { SeverityLevelCodes } from '../../../shared/constants';
import { Nullable } from '../../../shared/models';
import { ApiBase } from '../../../shared/services/api-base.service';
import { IndexDBBase } from '../../../shared/services/idb.service';
import { HNSWDBEntry } from '../models/models';

export class VectorDBHNSW {
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
  apiBase = new ApiBase();
  indexDb = new IndexDBBase('/hnswlib-index');

  constructor() {}

  init = async (): Promise<boolean> => {
    try {
      this.lib = await loadHnswlib();

      this.index = new this.lib.HierarchicalNSW(
        this.spaceName,
        this.dim,
        this.indexEntry,
      );

      this.index.initIndex(
        this.maxEls,
        this.nodeConnections,
        this.efConstructor,
        this.seedGen,
      );

      await this.readInExternalFile();

      const exists =
        this.lib.EmscriptenFileSystemManager.checkFileExists('data.dat');

      if (exists && this.lib.EmscriptenFileSystemManager.isSynced()) {
        await this.index.readIndex('data.dat', this.dim);
        this.index.setEfSearch(200);
      }

      this.embedder = await this.createEmbedder();
    } catch (e) {
      return e;
    }
    return 1;
  };

  createEmbedder = async (): Promise<FeatureExtractionPipeline> =>
    await pipeline('feature-extraction', this.featureExtractionModel, {
      device: 'webgpu',
      dtype: 'uint8',
    });

  query = async (
    query: string,
    topK: number = 5,
  ): Promise<SearchResult | undefined> => {
    if (!this.index || !this.embedder) {
      console.error('Must call init before query!');
      return undefined;
    }
    const queryEmbedding = await this.embedder([query], {
      pooling: 'mean',
      normalize: true,
    });

    this.index.searchKnn(<Float32Array>queryEmbedding.data, topK, undefined);
  };

  private fetchAndStore = async (): Promise<void> => {
    const db: IDBDatabase = await this.indexDb.openDB();
    if (!db) throw new Error('Failed to init DB');

    const metadata: Omit<HNSWDBEntry, 'contents'> =
      await this.apiBase.loadJSON();
    const contents: Uint8Array<ArrayBufferLike> | undefined =
      await this.apiBase.loadUint8Array();

    if (!contents) {
      console.error(
        `[${SeverityLevelCodes.FATAL}] - expected contents to be defined`,
      );
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
