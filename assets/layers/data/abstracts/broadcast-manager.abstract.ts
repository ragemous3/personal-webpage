import { MessageBase } from '../workers/models';
import { MessagingBase } from './message-base.abstract';
import { SeverityLevelCodes } from '../../shared/constants';
import { BroadcastBaseContract } from '../../shared/contracts/broadcast.contract';
import {
  createStatefulSubscribable,
  WritableStatefulConnections,
} from '../../shared/utils/subscribable';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export abstract class BroadcastManager<To extends MessageBase<unknown>, From>
  extends MessagingBase<BroadcastChannel, To, From>
  implements BroadcastBaseContract<BroadcastChannel, To, From>
{
  constructor(public name: string) {
    super(name);
  }

  //TODO:// not used?
  subscribable: WritableStatefulConnections<From> = createStatefulSubscribable();

  terminate = (): void => {
    if (this.isTerminating || !this.carrier) return;
    console.log('GOT terminated');
    this.isTerminating = true;
    this.carrier.close();
    this.carrier = undefined;
    this.isTerminating = false;
  };

  setupEventListeners(): void | null {
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
    if (this.carrier) {
      console.error('broadcast already initialized');
      return;
    }

    try {
      this.carrier = new BroadcastChannel(this.name);
    } catch (e) {
      console.error(`[${SeverityLevelCodes.FATAL}] - Failed to init broadcast: ${e}`);
    }

    this.setupEventListeners();
  }
}
