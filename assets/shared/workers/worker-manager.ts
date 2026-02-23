import { SeverityLevelCodes } from '../constants';
import { Task, WorkerMessageFrom, WorkerMessageTo } from './models';
// TODO: IMplement this and type it.
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export class WorkerManager {
  workerScript: string | undefined;
  worker: Worker | undefined;
  isTerminating: boolean | undefined = false;
  workerName: string = '';

  constructor(workerScript: string, workerName: string) {
    this.workerScript = workerScript;
    this.workerName = workerName;
  }

  isWorker = (worker: Worker | undefined): worker is Worker =>
    worker ? true : false;

  isWorkerScript = (
    workerScript: string | undefined,
  ): workerScript is string =>
    typeof workerScript === 'string' ? true : false;

  async initialize(wm: WorkerMessageTo): Promise<unknown> {
    if (!this.isWorkerScript(this.workerScript)) return;
    if (this.worker) {
      throw new Error('Worker already initialized');
    }
    try {
      this.worker = new Worker(new URL(this.workerScript, import.meta.url), {
        type: 'module',
      });
    } catch (e) {
      throw new Error(
        `[${SeverityLevelCodes.FATAL}][${wm.task}] - Failed to init worker: ${e}`,
      );
    }
    this.setupEventListeners();

    // Wait for worker to signal ready
    return await this.sendMessage(wm);
  }

  setupEventListeners(): void | null {
    if (!this.isWorker(this.worker)) return null;
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  async sendMessage(
    message: WorkerMessageTo,
  ): Promise<WorkerMessageFrom | undefined> {
    return new Promise(
      (resolve, reject): Promise<WorkerMessageFrom> | undefined => {
        if (!this.isWorker(this.worker)) return;
        const timeout = setTimeout((): void => {
          reject(new Error('Worker message timeout'));
        }, 120000);
        const messageHandler = (
          event: MessageEvent<WorkerMessageFrom>,
        ): void | undefined => {
          if (event.data.id === message.id) {
            clearTimeout(timeout);
            if (!this.isWorker(this.worker)) {
              reject(`Worker not init`);
              return;
            }
            this.worker.removeEventListener('message', messageHandler);
            resolve(event.data);
          }
        };

        this.worker.addEventListener('message', messageHandler);
        this.worker.postMessage(message);
      },
    );
  }

  handleMessage(event: { data: WorkerMessageFrom }): void {
    console.info(`[${this.workerName}] Worker message:`, event.data);
  }

  handleError(error: ErrorEvent): void {
    console.error(`${this.workerName}: Worker error:`, error);

    this.terminate();
  }

  terminate = async (): Promise<void | undefined> => {
    if (this.isTerminating || !this.isWorker(this.worker)) return;
    this.isTerminating = true;
    await this.sendMessage({ task: `${this.workerName}:cleanup` });
    this.worker.terminate();
    this.worker = undefined;
    this.isTerminating = false;
  };
}
