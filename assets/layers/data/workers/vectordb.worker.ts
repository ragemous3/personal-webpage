import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { VectorDBHNSWData } from '@/layers/data/vectordbHNSW.data';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ProgressInfo } from '@/layers/shared/models/progress.model';

import { type TaskResponse, type VectorDatabaseDTO as VectorDatabaseDto } from './models';
// Impossible to inject as a dependency to
const database = new VectorDBHNSWData();
let ID = ''; //defined from outside
let NAME: string | undefined = ''; //defined from outside
//TODO: // progressTracker is a dupe from llm and also the vectordb:progress is hardcoded
//
const progressTracker = (progress: ProgressInfo): void => {
  send('vectordb:progress:response', progress);
};

const send = <T>(task: TaskResponse, payload: T): void => {
  postMessage({ id: ID, name: NAME, task, payload });
};

const handleQueries = async (query: string | undefined, topK = 5): Promise<SearchResult> => {
  if (!query) {
    throw new Error('Expected defined query');
  }
  return await database.query(query, topK);
};

onmessage = async (messageEvent: MessageEvent<VectorDatabaseDto>): Promise<void> => {
  const { id, task, payload, name }: VectorDatabaseDto = messageEvent.data;
  ID = id;
  NAME = name;
  try {
    if (task === 'vectordb:init') {
      await database.init(progressTracker);
      return;
    }

    if (task === 'vectordb:query' && payload) {
      const resp = await handleQueries(payload.query);
      send('vectordb:query:response', {
        id: ID,
        name: NAME,
        task,
        payload: {
          response: resp,
          query: payload.query,
        },
      });
      return;
    }
  } catch (error) {
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
