import { WorkerKeys } from '@/layers/data/contants/constants';
import { MessageCoordinatorConnection } from '@/layers/data/message-coordinator.connection';
import { type MessageBase } from '@/layers/data/workers/models';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';

let sharedWorkerWrapper:
  | MessageCoordinatorConnection<MessageBase<unknown>, MessageBase<unknown>>
  | undefined;

export const getSharedWorker = (
  messageCordinatorScriptPath: string,
  singleton = true,
): StateMachineConnectionContract<MessageBase<unknown>, MessageBase<unknown>> => {
  if (!sharedWorkerWrapper && singleton) {
    sharedWorkerWrapper = new MessageCoordinatorConnection(
      messageCordinatorScriptPath,
      WorkerKeys.STATE_MACHINE,
    );
    return sharedWorkerWrapper;
  }

  if (singleton && sharedWorkerWrapper) return sharedWorkerWrapper;

  return new MessageCoordinatorConnection(messageCordinatorScriptPath, WorkerKeys.STATE_MACHINE);
};
