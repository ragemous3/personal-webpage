import { DB } from '@/layers/data/local-vector-database.data';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { type MessageBase } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

let database: DB | undefined;

export const getVectorDatabase = (
  hub: HubContract,
  messageCoordinator: StateMachineConnectionContract<MessageBase<unknown>, MessageBase<unknown>>,
  broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
  config: RagConfigBase<DatabaseConfig>,
  singleton = true,
): DB => {
  if (singleton && database) {
    return database;
  }
  const result = new DB(hub, messageCoordinator, broadcast, config);
  if (singleton) {
    database = result;
  }
  return result;
};
