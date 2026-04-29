import { WorkerKeys } from '../../layers/data/contants/constants';
import { DB } from '../../layers/data/db.data';
import { MessageBase } from '../../layers/data/workers/models';
import { BroadcastContract } from '../../layers/shared/contracts/broadcast-port.contract';
import { HubContract } from '../../layers/shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../../layers/shared/contracts/message-connection.contract';

let db: DB | undefined;

export const getLocalDB = (
  vectorDBscriptPath: string,
  hubPort: HubContract<unknown>,
  msgCordinator: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
  broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
  singleton: boolean = true,
) => {
  if (!db && singleton) {
    db = new DB(vectorDBscriptPath, hubPort, msgCordinator, broadcast, WorkerKeys.VECTORDB);
    return db;
  }

  if (singleton && db) return db;

  return new DB(vectorDBscriptPath, hubPort, msgCordinator, broadcast, WorkerKeys.VECTORDB);
};
