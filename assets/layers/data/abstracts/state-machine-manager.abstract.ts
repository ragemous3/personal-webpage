import { MessageBase } from '../workers/models';
import { SeverityLevelCodes } from '../../shared/constants';
import { StateMachineContract } from '../../shared/contracts/state-machine.contract';
import { WorkerBase } from './worker-base.abstract';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export abstract class SharedWorkerManager<To extends MessageBase<unknown>, From>
  extends WorkerBase<MessagePort, To, From>
  implements StateMachineContract<MessagePort, To, From>
{
  constructor(
    protected scriptPath: string,
    protected carrierName: string,
  ) {
    super(scriptPath, carrierName);
  }

  terminate = (): void => {
    if (this.isTerminating || !this.carrier) return;
    this.isTerminating = true;
    this.carrier.close();
    this.carrier = undefined;
    this.isTerminating = false;
  };

  protected setupEventListeners(): void | null {
    if (!this.carrier) return null;
    this.carrier.onmessage = this.handleMessage.bind(this);
    this.carrier.onmessageerror = this.handleError.bind(this);
  }

  send(message: To): void {
    if (!this.carrier) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Expected a defined worker`);
      return;
    }

    this.carrier.postMessage(message);
  }

  initialize(): void {
    if (!this.isScriptPath(this.scriptPath)) return;
    if (this.carrier) throw new Error('Worker already initialized');

    try {
      const carrier = new SharedWorker(new URL(this.scriptPath, import.meta.url), {
        type: 'module',
      });
      this.carrier = carrier.port;
      this.carrier.start();
    } catch (e) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init worker: ${e}`);
    }

    this.setupEventListeners();
  }
}
