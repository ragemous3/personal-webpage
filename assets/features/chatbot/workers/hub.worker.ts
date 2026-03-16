import { WorkerManager } from '../../../shared/workers/worker-manager';
import { SeverityLevelCodes } from '../../../shared/constants';
import { ChatbotWorkers } from '../infra/models';
import { WorkerFileNames } from '../infra/constants';
import { LlmDTO, VectorDbDto, WorkerMessageHub } from './models';

const llmName = 'llm';
const vectorDbName = 'vectorDB';
let llmWorker: WorkerManager<LlmDTO, string> | undefined;
let vectorDbWorker: WorkerManager<VectorDbDto, string> | undefined;

const init = async (hubConf: WorkerMessageHub<ChatbotWorkers>): Promise<void> => {
  console.log(`Running ${hubConf.task} - stand by`);
  llmWorker = new WorkerManager(hubConf.config[WorkerFileNames.llm], llmName);
  vectorDbWorker = new WorkerManager(hubConf.config[WorkerFileNames.vectordb], vectorDbName);

  vectorDbWorker.listen((data) => postMessage(data));
  vectorDbWorker.initialize({
    id: crypto.randomUUID(),
    task: 'vectordb:init',
    payload: null,
  });

  llmWorker.listen((data) => postMessage(data));
  llmWorker.initialize({
    id: crypto.randomUUID(),
    task: 'llm:init',
    payload: null,
  });
};
//
// const sendMessage = async (payload: WorkerMessageHub<unknown>) => {
//   if (!payload) {
//     throw new Error('Expected payload to be defined, not empty or non existant');
//   }
//
//   if (!payload.llm) {
//     throw new Error('Expected LLM payload to be defined, not empty or non existant');
//   }
//
//   if (!payload.llm || !payload.vector) {
//     throw new Error('Expected LLM payload to be defined, not empty or non existant');
//   }
//
//   if (!vectorDbWorker || !llmWorker) {
//     throw new Error('Expected initiated workers!');
//   }
//
//   vectorDbWorker.sendMessage(payload.vector);
// };

onmessage = async (e: MessageEvent<WorkerMessageHub<ChatbotWorkers>>): Promise<void> => {
  const { task }: Partial<WorkerMessageHub<ChatbotWorkers>> = e.data;
  console.log('recieved message');
  try {
    console.log(`Hub message recieved`);
    if (task === 'hub:init') await init(e.data);
  } catch (err: unknown) {
    if (err instanceof Error) {
      postMessage({
        ...e.data,
        error: {
          name: `[${SeverityLevelCodes.ERROR}]${err.name}`,
          message: err.message,
          stack: err.stack,
        },
      });
      return;
    }

    postMessage({
      ...e.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(err),
        stack: null,
      },
    });
  }
};

onmessageerror = (err: unknown) => postMessage('error');
