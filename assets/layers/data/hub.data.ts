import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';

import { HubAbstract } from './abstracts/hub.abstract';
import { type WorkerKeys } from './contants/constants';
import { type HubConnection } from './hub.connection';
import { type MessageBase } from './workers/models';

export class Hub extends HubAbstract implements HubContract {
  constructor(
    protected hub: HubConnection,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>>,
    protected broadcasts: Array<BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>>,
    public name: WorkerKeys,
  ) {
    super(hub, stateMachine, broadcasts, name);
    this.checkAvailability();
  }
}
