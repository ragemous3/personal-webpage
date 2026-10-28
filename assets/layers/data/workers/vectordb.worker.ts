import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { IndexDBBase } from '@/layers/data/idb-base.data';
import { VectorDBHNSWData } from '@/layers/data/vectordb-hnsw.data';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ProgressInfo } from '@/layers/shared/models/progress.model';

import { type TaskResponse, type VectorDatabaseDTO as VectorDatabaseDto } from './models';

let initialization: Promise<void> | undefined;
let database: VectorDBHNSWData;
let ID = ''; //defined from outside
let NAME: string | undefined = ''; //defined from outside
//TODO: // progressTracker is a dupe from llm and also the vectordb:progress is hardcoded
//
const progressTracker = (progress: ProgressInfo): void => {
  send('vectordb:progress:response', progress);
};

const send = (task: TaskResponse, payload: unknown): void => {
  postMessage({ id: ID, name: NAME, task, payload });
};

const handleQueries = async (query: string | undefined, topK = 5): Promise<SearchResult> => {
  if (!query) {
    throw new Error('Expected defined query');
  }
  return await database.query(query, topK);
};

const initialize = async (request: VectorDatabaseDto): Promise<void> => {
  const { payload } = request;
  if (!isDatabaseConfig(payload))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid database configuration`);
  const apiBase = new ApiBase(payload.baseUrl);
  const store = new IndexDBBase(payload.indexStoreName);
  database = new VectorDBHNSWData(payload, apiBase, store);
  await database.init(progressTracker);
};

const handleRequest = async (request: VectorDatabaseDto): Promise<void> => {
  const { id, task, payload, name, requestId } = request;
  if (task === 'vectordb:init') {
    initialization ??= initialize(request);
    await initialization;
    postMessage({ id, name, task: 'vectordb:ready', payload: null });
  }
  if (task === 'vectordb:query' && payload) {
    const response = await handleQueries(payload.query);
    postMessage({
      id,
      name,
      requestId,
      task: 'vectordb:query:response',
      payload: { response, query: payload.query },
    });
  }
};

onmessage = async (messageEvent: MessageEvent<VectorDatabaseDto>): Promise<void> => {
  const { id, task, name }: VectorDatabaseDto = messageEvent.data;
  ID = id;
  NAME = name;
  try {
    await handleRequest(messageEvent.data);
  } catch (error) {
    if (task === 'vectordb:init') initialization = undefined;
    if (error instanceof Error) {
      postMessage({
        ...messageEvent.data,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });

      return;
    }
    postMessage({
      ...messageEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(error),
        stack: null,
      },
    });
  }
};
// TODO:// Attach ID to the error
onmessageerror = (error: unknown): void => {
  postMessage(error);
};
