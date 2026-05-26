import { type StateMachineConnectionContract } from '../shared/contracts/message-connection.contract';
import { SharedWorkerManager } from './abstracts/state-machine-manager.abstract';
import { type MessageBase } from './workers/models';

export class MessageCoordinatorConnection<To extends MessageBase<unknown>, From>
  extends SharedWorkerManager<To, From>
  implements StateMachineConnectionContract<To, From>
{
  constructor(
    protected scriptPath: string,
    protected carrierName: string,
  ) {
    super(scriptPath, carrierName);
    this.initialize();
  }
}
