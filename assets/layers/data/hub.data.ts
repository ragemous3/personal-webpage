import { WorkerKeys } from './contants/constants';
import { HubConnection } from './hub.connection';
import { HubAbstract } from './abstracts/port-hub.abstract';
import { MessageBase } from './workers/models';
import { HubContract } from '../shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../shared/contracts/message-connection.contract';
import { BroadcastContract } from '../shared/contracts/broadcast-port.contract';

export class Hub extends HubAbstract implements HubContract {
  constructor(
    protected hub: HubConnection,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
    protected broadcasts: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>[],
    public entityName: WorkerKeys,
  ) {
    super(hub, stateMachine, broadcasts, entityName);
    this.checkAvailability();
  }
}
