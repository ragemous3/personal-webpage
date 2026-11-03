import { DB } from '@/layers/data/local-vector-database.data';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

let database: DB | undefined;
export const getVectorDatabase = (
  runtime: RuntimeCoordinatorContract,
  config: RagConfigBase<DatabaseConfig>,
  singleton = true,
): DB => {
  if (singleton && database) return database;
  const result = new DB(runtime, config);
  if (singleton) database = result;
  return result;
};
