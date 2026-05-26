import { type MessageBase } from '@/layers/data/workers/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type StateMachineContract } from '@/layers/shared/contracts/state-machine.contract';

import { WorkerBase } from './worker-base.abstract';

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
    } catch (error) {
      if (error instanceof Error)
        console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init worker: ${error}`);
    }

    this.setupEventListeners();
  }

  terminate = (): void => {
    if (this.isTerminating || !this.carrier) return;
    this.isTerminating = true;
    this.carrier.close();
    this.carrier = undefined;
    this.isTerminating = false;
  };

  protected setupEventListeners(): undefined {
    if (!this.carrier) return;
    this.carrier.addEventListener('message', this.handleMessage.bind(this));
    this.carrier.addEventListener('messageerror', this.handleError.bind(this));
  }
}
