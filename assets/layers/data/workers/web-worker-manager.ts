import { MessageBase } from './models';
import { SeverityLevelCodes } from '../../shared/constants';
import { WorkerBase } from '../abstracts/worker-base.abstract';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export class WebWorkerManager<To extends MessageBase<unknown>, From> extends WorkerBase<
  Worker,
  To,
  From
> {
  constructor(
    protected scriptPath: string,
    protected carrierName: string,
  ) {
    super(scriptPath, carrierName);
  }

  terminate = (): void => {
    if (this.isTerminating || !this.carrier) return;
    this.isTerminating = true;
    this.carrier.terminate();
    this.carrier = undefined;
    this.isTerminating = false;
  };

  setupEventListeners(): void | null {
    if (!this.carrier) return null;
    this.carrier.onmessage = this.handleMessage.bind(this);
    this.carrier.onerror = this.handleError.bind(this);
  }

  send(message: To): void {
    if (!this.carrier) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Expected a defined worker`);
      return;
    }

    this.carrier.postMessage(message);
  }

  initialize(wm: To): void {
    if (!this.isScriptPath(this.scriptPath)) return;
    if (this.carrier) throw new Error('Worker already initialized');

    try {
      this.carrier = new Worker(new URL(this.scriptPath, import.meta.url), {
        type: 'module',
      });
    } catch (e) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init worker: ${e}`);
    }

    this.setupEventListeners();
    this.send(wm);
  }
}
