import { Task, WorkerMessageTo } from '../../../shared/workers/models';
import { WorkerManager } from '../../../shared/workers/worker-manager';
import { LLMWorkerData } from '../models/models';
import { SeverityLevelCodes } from '../../../shared/constants';

const llmName = 'llm';
const vectorDbName = 'vectorDB';

const init = async (): Promise<void> => {
  const llmWorker = new WorkerManager('/js/batch/llm.worker.ts.js', llmName);
  const vectorDbWorker = new WorkerManager('/js/batch/vectordb.worker.ts.js', vectorDbName);
  await llmWorker.initialize(getWorkerMessage(`${llmName}:init`));
  await vectorDbWorker.initialize(getWorkerMessage(`${vectorDbName}:init`));
};

self.onmessage = async (e: MessageEvent<LLMWorkerData>): Promise<void> => {
  const { task, chatMessages, query }: Partial<LLMWorkerData> = e.data;
  try {
    console.log(`Hub message recieved`);
    if (task === 'init') await init();
  } catch (err: unknown) {
    if (err instanceof Error) {
      postMessage({
        task,
        query,
        error: {
          name: `[${SeverityLevelCodes.ERROR}]${err.name}`,
          message: err.message,
          stack: err.stack,
        },
      });
      return;
    }

    postMessage({
      task,
      query,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(err),
        stack: null,
      },
    });
  }
};

self.onmessageerror = (err: unknown) => postMessage('error');
