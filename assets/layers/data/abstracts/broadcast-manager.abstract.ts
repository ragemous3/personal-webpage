import { type MessageBase } from '@/layers/data/workers/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type BroadcastBaseContract } from '@/layers/shared/contracts/broadcast.contract';

import { MessagingBase } from './message-base.abstract';

export abstract class BroadcastManager<To extends MessageBase<unknown>, From>
  extends MessagingBase<BroadcastChannel, To, From>
  implements BroadcastBaseContract<BroadcastChannel, To, From>
{
  constructor(public name: string) {
    super(name);
  }

  terminate = (): void => {
    if (this.isTerminating || !this.carrier) return;
    this.isTerminating = true;
    this.carrier.close();
    this.carrier = undefined;
    this.isTerminating = false;
  };

  setupEventListeners(): void | null {
    if (!this.carrier) return null;
    this.carrier.onmessage = this.handleMessage.bind(this);
    this.carrier.addEventListener('messageerror', this.handleError.bind(this));
  }

  send(message: To): void {
    if (!this.carrier) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Expected a defined worker`);
      return;
    }

    this.carrier.postMessage(message);
  }

  initialize(): void {
    if (this.carrier) {
      console.error('broadcast already initialized');
      return;
    }

    try {
      this.carrier = new BroadcastChannel(this.name);
    } catch (error) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init broadcast: ${error}`);
    }

    this.setupEventListeners();
  }
}
