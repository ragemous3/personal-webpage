import { SeverityLevelCodes } from '../constants';
import { AnyFunction } from '../models';
import { WorkerMessageBase } from './models';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export class WorkerManager<To extends WorkerMessageBase<unknown>, From> {
  workerScript: string | undefined;
  worker: Worker | undefined;
  isTerminating: boolean | undefined = false;
  workerName: string = '';
  listeners = new Set<(data: WorkerMessageBase<unknown>) => void>();

  constructor(workerScript: string, workerName: string) {
    this.workerScript = workerScript;
    this.workerName = workerName;
  }

  listen = (func: (data: WorkerMessageBase<unknown>) => void): Set<unknown> =>
    this.listeners.add(func);
  isWorker = (worker: Worker | undefined): worker is Worker => (worker ? true : false);

  isWorkerScript = (workerScript: string | undefined): workerScript is string =>
    typeof workerScript === 'string' ? true : false;

  initialize(wm: To): void {
    if (!this.isWorkerScript(this.workerScript)) return;
    if (this.worker) {
      throw new Error('Worker already initialized');
    }
    try {
      this.worker = new Worker(new URL(this.workerScript, import.meta.url), {
        type: 'module',
      });
    } catch (e) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init worker: ${e}`);
    }
    this.#setupEventListeners();
    this.sendMessage(wm);
  }

  #setupEventListeners(): void | null {
    if (!this.isWorker(this.worker)) return null;
    this.worker.onmessage = this.#handleMessage.bind(this);
    this.worker.onerror = this.#handleError.bind(this);
  }

  sendMessage(message: To): void {
    if (!this.worker) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Expected a defined worker`);
      return;
    }

    this.worker.postMessage(message);
  }

  #handleMessage = (event: { data: WorkerMessageBase<From> }): void => {
    for (const listener of this.listeners) {
      listener(event.data);
    }
  };

  #handleError = (error: ErrorEvent): void => {
    console.error(`${this.workerName}: Worker error:`, error);

    this.terminate();
  };

  terminate = async (): Promise<void | undefined> => {
    if (this.isTerminating || !this.isWorker(this.worker)) return;
    this.isTerminating = true;
    this.worker.terminate();
    this.worker = undefined;
    this.isTerminating = false;
  };
}
