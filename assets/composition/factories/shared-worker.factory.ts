import { WorkerKeys } from '../../layers/data/contants/constants';
import { MessageCoordinatorConnection } from '../../layers/data/message-coordinator.connection';
import { MessageBase } from '../../layers/data/workers/models';
import { StateMachineConnectionContract } from '../../layers/shared/contracts/message-connection.contract';

let sharedWorkerWrapper: MessageCoordinatorConnection<MessageBase<unknown>, unknown> | undefined;

export const getSharedWorker = (
  msgCordinatorScriptPath: string,
  singleton: boolean = true,
): StateMachineConnectionContract<MessageBase<unknown>, unknown> => {
  if (!sharedWorkerWrapper && singleton) {
    sharedWorkerWrapper = new MessageCoordinatorConnection(
      msgCordinatorScriptPath,
      WorkerKeys.STATE_MACHINE,
    );
    return sharedWorkerWrapper;
  }

  if (singleton && sharedWorkerWrapper) return sharedWorkerWrapper;

  return new MessageCoordinatorConnection(msgCordinatorScriptPath, WorkerKeys.STATE_MACHINE);
};
