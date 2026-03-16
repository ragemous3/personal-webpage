import { SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { SeverityLevelCodes } from '../../../shared/constants';
import { VectorDBHNSW } from '../services/vectordbHNSW.service';
import { VectorDbDto } from './models';

const db = new VectorDBHNSW();

const handleQueries = async (
  query: string | undefined,
  topK: number = 5,
): Promise<SearchResult> => {
  if (!query) {
    throw new Error('Expected defined query');
  }
  return await db.query(query, topK);
};

onmessage = async (messageEvent: MessageEvent<VectorDbDto>): Promise<void> => {
  const { task, payload } = messageEvent.data;

  if (task == 'vectordb:init') {
    await db.init();
    postMessage('vectordb:ready');
    return;
  }

  if (task == 'vectordb:query') {
    const resp = await handleQueries(payload.query);
    postMessage(resp ? resp : `[${SeverityLevelCodes.ERROR}] - Expected defined value'`);
    return;
  }
};
