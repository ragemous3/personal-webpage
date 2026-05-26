import { type BroadcastContract } from '../shared/contracts/broadcast-port.contract';
import { BroadcastManager } from './abstracts/broadcast-manager.abstract';
import { type MessageBase } from './workers/models';

export class Broadcast<To extends MessageBase<unknown>, From>
  extends BroadcastManager<To, From>
  implements BroadcastContract<To, From>
{
  constructor(public name: string) {
    super(name);
    this.initialize();
  }
}
