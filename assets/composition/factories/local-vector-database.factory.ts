import { WorkerKeys } from '@/layers/data/contants/constants';
import { DB } from '@/layers/data/local-vector-database.data';
import { type MessageBase } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';

let database: DB | undefined;

export const getVectorDatabase = (
  vectorDBscriptPath: string,
  hubPort: HubContract,
  messageCordinator: StateMachineConnectionContract<MessageBase<unknown>, MessageBase<unknown>>,
  broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
  singleton = true,
): DB => {
  if (!database && singleton) {
    database = new DB(
      vectorDBscriptPath,
      hubPort,
      messageCordinator,
      broadcast,
      WorkerKeys.VECTORDB,
    );
    return database;
  }

  if (singleton && database) return database;

  return new DB(vectorDBscriptPath, hubPort, messageCordinator, broadcast, WorkerKeys.VECTORDB);
};
