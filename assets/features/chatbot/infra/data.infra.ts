import { Chunk } from '../models/models';
import { ChatbotWorkers, WorkerFileName } from './models';
import { WorkerManager } from '../../../shared/workers/worker-manager';
import { WorkerFileNames } from './constants';
import { WorkerMessageHub } from '../workers/models';
import { ApiBase } from '../../../shared/infra/base.infra';
import { InfraConfigurationDTO } from '../../../shared/infra/models';
import { EntityStatusLog, WorkerMessageBase } from '../../../shared/workers/models';
import { EntityStatusTypes } from '../../../shared/workers/constants';

export class ChatbotInfra extends ApiBase<InfraConfigurationDTO<WorkerFileName>> {
  chunks: Chunk[] = [];
  workerNames: ChatbotWorkers | undefined;
  broadcaster: SharedWorker | undefined;
  hub: WorkerManager<WorkerMessageHub<ChatbotWorkers>, unknown> | undefined;
  channelId = crypto.randomUUID();

  initializeBroadcaster = (adress: string) => {
    try {
      this.broadcaster = new SharedWorker(new URL(adress, import.meta.url), {
        name: 'radio',
        type: 'module',
      });
      this.broadcaster.port.start();
      this.broadcaster.port.addEventListener('message', this.getSharedWorkerMessage);
    } catch {
      throw new Error('Failed to init broadcast');
    }
  };
  isEntityStatusLog = (payload: unknown): payload is EntityStatusLog =>
    payload &&
    typeof payload === 'object' &&
    'entity' in payload &&
    'initiator' in payload &&
    'status' in payload
      ? true
      : false;
  //TODO:// Handle concurrency here
  handleLLMInit = () => {};
  handleVectorDB = () => {};
  getSharedWorkerMessage = (event: MessageEvent<unknown>) => {
    const data: unknown = event.data;
    if (!this.isEntityStatusLog(data)) {
      return;
    }

    if (data.initiator !== this.channelId && data.initiator !== 'announcement') return;

    if (entity === 'llm') this.handleLLMInit(data);
    if (data.status === EntityStatusTypes.UNINITIALIZED) {
    }
    if (data.status === EntityStatusTypes.BUSY) {
    }
  };

  getWorkerFileNames = async (): Promise<ChatbotWorkers> => {
    const config: InfraConfigurationDTO<WorkerFileName> = await this.getConfig();
    if (!config?.workerMap) {
      throw new Error('workers should be defined');
    }
    return config.workerMap;
  };

  init = async () => {
    console.log(`Init started`);
    this.chunks = await this.loadJSON('/content-data/chunks.json');
    this.workerNames = await this.getWorkerFileNames(); // TO check if instantated: ----> chrome://inspect/#workers

    this.initializeBroadcaster(this.workerNames[WorkerFileNames.broadcaster]);
    this.hub = new WorkerManager(this.workerNames[WorkerFileNames.hub], WorkerFileNames.hub);

    this.hub.initialize({
      task: 'hub:init',
      payload: {
        llm: {
          id: this.channelId,
          task: 'llm:init',
          payload: null,
        },
      },
      config: this.workerNames,
      id: this.channelId,
    });

    hubWorker.listen((data: WorkerMessageBase<unknown>) => {
      if (!this.broadcaster) throw new Error('Broadcast not initialized!');
      //need to decide exactly what kind of task it is from the sender side
      this.broadcaster.port.postMessage(data);
    });

    console.log(`Init finished`);
  };
  //
  // Necessary if i want to update chats in all tabs
  initSharedWorker = () => {
    // Shared worker code
    // const hub = new SharedWorker(ncrypto.randomUUID });
    // Shared worker codecrypto.randomUUID });
    // Shared worker codecrypto.randomUUID });
    // Shared worker codeew URL('/js/batch/hub.shared-worker.ts.js', import.meta.url), {
    //   type: 'module',
    // });
    // hub.port.addEventListener('message', (e: Event): void => {
    //   console.log(e);
    // });
    // hub.port.onmessageerror = (e): void => console.error(e);
    // hub.onerror = (e: ErrorEvent): void => {
    //   console.error('hub: messageerror', e);
    // };
    // hub.port.start();
    // hub.port.postMessage({ task: 'init', id: crypto.randomUUID });
  };
}
