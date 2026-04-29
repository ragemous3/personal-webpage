import { SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { SeverityLevelCodes } from '../../shared/constants';
import { Task, TaskResponse, VectorDbDto } from './models';
import { VectorDBHNSWData } from '../vectordbHNSW.data';
import { ProgressInfo } from '../../shared/models/progress.model';
// Impossible to inject as a dependency to
const db = new VectorDBHNSWData();
let ID = ''; //defined from outside
let NAME: string | undefined = ''; //defined from outside
//TODO: // progressTracker is a dupe from llm and also the vectordb:progress is hardcoded
//
const progressTracker = (progress: ProgressInfo) => send('vectordb:progress:response', progress);

const send = <T>(task: TaskResponse, payload: T) => {
  postMessage({ id: ID, name: NAME, task, payload });
};

const handleQueries = async (
  query: string | undefined,
  topK: number = 5,
): Promise<SearchResult> => {
  if (!query) {
    throw new Error('Expected defined query');
  }
  return await db.query(query, topK);
};

onmessage = async (msgEvent: MessageEvent<VectorDbDto>): Promise<void> => {
  const { id, task, payload, name }: VectorDbDto = msgEvent.data;
  ID = id;
  NAME = name;
  try {
    if (task == 'vectordb:init') {
      await db.init(progressTracker);
      return;
    }

    if (task == 'vectordb:query' && payload) {
      const resp = await handleQueries(payload.query);
      if (!resp) throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected defined value'`);
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
  } catch (err) {
    if (err instanceof Error) {
      postMessage({
        ...msgEvent.data,
        error: {
          name: `${err.name}`,
          message: err.message,
          stack: err.stack,
        },
      });

      return;
    }
    postMessage({
      ...msgEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(err),
        stack: null,
      },
    });
  }
};
// TODO:// Attach ID to the error
onmessageerror = (err: unknown) => postMessage(err);
