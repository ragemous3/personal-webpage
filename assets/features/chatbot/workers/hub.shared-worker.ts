import { Task, WorkerMessageTo } from '../../../shared/workers/models';
import { WorkerManager } from '../../../shared/workers/worker-manager';
import { LLMWorkerData } from '../models/models';

const llmName = 'llm';
const vectorDbName = 'vectorDB';

const ports: Set<MessagePort> = new Set();

const getWorkerMessage = (task: Task): WorkerMessageTo => ({
  task,
  id: crypto.randomUUID(),
});

const init = async (): Promise<void> => {
  const llmWorker = new WorkerManager('./llm.worker.ts', llmName);
  const vectorDbWorker = new WorkerManager(
    './vectordb.worker.ts',
    vectorDbName,
  );

  await llmWorker.initialize(getWorkerMessage(`${llmName}:init`));
  await vectorDbWorker.initialize(getWorkerMessage(`${vectorDbName}:init`));
};

onconnect = (e: MessageEvent<unknown>): void => {
  console.log(`SharedWorker MessageEvent: ${e}`);
  const port: MessagePort | undefined = e.ports[0];
  if (!port) return;
  ports.add(port);

  port.onmessage = async (e: MessageEvent<LLMWorkerData>): Promise<void> => {
    const { task, chatMessages, query }: Partial<LLMWorkerData> = e.data;
    console.log(`SharedWorker message recieved`);
    if (task === 'init') await init();
    postMessage('DONE');
  };
};
