import { WorkerKeys } from './contants/constants';
import { StandardCommunication } from './abstracts/port.abstract';
import { MessageBase } from './workers/models';
import { HubContract } from '../shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../shared/contracts/message-connection.contract';
import { BroadcastContract } from '../shared/contracts/broadcast-port.contract';

export class DB extends StandardCommunication {
  constructor(
    protected source: string,
    protected hub: HubContract,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
    protected broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
    public entityName: WorkerKeys,
  ) {
    super(source, hub, stateMachine, broadcast, entityName);
  }
}
