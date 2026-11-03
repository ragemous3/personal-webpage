import { isSiteConfiguratonGlobal } from '@/composition/guards/is-site-configuration';
import { isSysMessageConfig } from '@/composition/guards/is-sys-message';
import { WorkerFileNames, WorkerKeys } from '@/layers/data/contants/constants';
import {
  databaseNumberKeys,
  databaseStringKeys,
} from '@/layers/data/contants/local-database.constants';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord, isString } from '@/layers/shared/guards/guards';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

interface OfflineConfiguration {
  baseURL: string;
  systemMessage: string;
  coordinatorSource: string;
  model: RagConfigBase<LmConfig>;
  database: RagConfigBase<DatabaseConfig>;
}

const requireRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected an object for ${name}`);
  }
  return value;
};

const requireString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (!isString(value) || value.trim().length === 0) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a nonempty string for ${key}`);
  }
  return value;
};

const modelLocations = (
  value: Record<string, unknown>,
): { modelBaseUrl?: string; wasmBaseUrl?: string } => ({
  ...(typeof value.modelbaseurl === 'string' ? { modelBaseUrl: value.modelbaseurl } : {}),
  ...(typeof value.wasmbaseurl === 'string' ? { wasmBaseUrl: value.wasmbaseurl } : {}),
});

export const getOfflineConfiguration = (cfg: unknown): OfflineConfiguration => {
  if (!isSiteConfiguratonGlobal(cfg)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a defined site configuration global`);
  }
  const workers = requireRecord(cfg.WORKER_NAMES, 'WORKER_NAMES');
  const site = requireRecord(cfg.SITE_PARAMS, 'SITE_PARAMS');
  const parameters = requireRecord(site.params, 'SITE_PARAMS.params');
  const chatbot = requireRecord(parameters.chatbot, 'chatbot');
  const config = requireRecord(chatbot.config, 'chatbot.config');
  const rawModel = requireRecord(config.locallm, 'chatbot.config.locallm');
  const rawDatabase = requireRecord(config.localdatabase, 'chatbot.config.localdatabase');
  const baseURL = requireString(site, 'baseURL');
  const coordinatorSource = requireString(workers, WorkerFileNames.coordinator);
  const model = {
    ...rawModel,
    ...modelLocations(rawModel),
    source: requireString(workers, WorkerFileNames.llm),
    generation: rawModel.generation === undefined ? {} : rawModel.generation,
  };
  const database = {
    ...Object.fromEntries(
      [...databaseStringKeys, ...databaseNumberKeys].map((key) => [
        key,
        rawDatabase[key.toLowerCase()],
      ]),
    ),
    source: requireString(workers, WorkerFileNames.vectordb),
    baseUrl: baseURL,
    device: rawDatabase.device ?? rawModel.device,
    ...modelLocations(rawDatabase),
  };
  if (!isLmConfig(model)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid chatbot.config.locallm configuration`);
  }
  if (!isDatabaseConfig(database)) {
    throw new Error(
      `[${SeverityLevelCodes.ERROR}] - Invalid chatbot.config.localdatabase configuration`,
    );
  }
  if (!isSysMessageConfig(chatbot.sysmessage)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid chatbot.sysmessage configuration`);
  }
  return {
    baseURL,
    coordinatorSource,
    systemMessage: chatbot.sysmessage.offline,
    model: { name: WorkerKeys.LLM, payload: model },
    database: { name: WorkerKeys.VECTORDB, payload: database },
  };
};
