import { StateMachineConnectionContract } from '../shared/contracts/message-connection.contract';
import { MessageBase } from './workers/models';
import { SharedWorkerManager } from './abstracts/state-machine-manager.abstract';

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
