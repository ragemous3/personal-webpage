import { DB } from '@/layers/data/local-vector-database.data';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

const databases = new WeakMap<RuntimeCoordinatorContract, DB>();
export const getVectorDatabase = (
  runtime: RuntimeCoordinatorContract,
  config: RagConfigBase<DatabaseConfig>,
  singleton = true,
  autoStart = true,
): DB => {
  const database = databases.get(runtime);
  if (singleton && database) {
    if (database.configuration !== config)
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Retrieval DB already belongs to another application configuration.`);
    return database;
  }
  const result = new DB(runtime, config, autoStart);
  if (singleton) {
    databases.set(runtime, result);
    const dispose = result.dispose;
    result.dispose = (): void => {
      dispose();
      databases.delete(runtime);
    };
  }
  return result;
};
