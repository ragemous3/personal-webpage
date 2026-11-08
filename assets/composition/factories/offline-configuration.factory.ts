import { isSiteConfiguratonGlobal } from '@/composition/guards/is-site-configuration';
import { isSysMessageConfig } from '@/composition/guards/is-sys-message';
import { type ChatbotConfiguration } from '@/composition/models/chatbot-configuration.model';
import { modelLocations } from '@/composition/utils/model-locations.utility';
import { WorkerFileNames, WorkerKeys } from '@/layers/data/contants/constants';
import {
  databaseNumberKeys,
  databaseStringKeys,
} from '@/layers/data/contants/local-database.constants';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import {
  requireHttpDirectoryURL,
  requireNonEmptyString,
  requireRecord,
} from '@/layers/shared/utils/validation.utility';

export const getOfflineConfiguration = (cfg: unknown): ChatbotConfiguration => {
  if (!isSiteConfiguratonGlobal(cfg)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a defined site configuration global`);
  }
  const workers = requireRecord(cfg.WORKER_NAMES, 'WORKER_NAMES');
  const site = requireRecord(cfg.SITE_PARAMS, 'SITE_PARAMS');
  const parameters = requireRecord(site.params, 'SITE_PARAMS.params');
  const chatbot = requireRecord(parameters.chatbot, 'chatbot');
  const config = requireRecord(chatbot.config, 'chatbot.config');
  const online = requireRecord(config.online, 'chatbot.config.online');
  const apiBaseURL = requireHttpDirectoryURL(online.apibaseurl, 'chatbot.config.online.apiBaseURL');
  const rawModel = requireRecord(config.locallm, 'chatbot.config.locallm');
  const rawDatabase = requireRecord(config.localdatabase, 'chatbot.config.localdatabase');
  const baseURL = requireNonEmptyString(site.baseURL, 'baseURL');
  const coordinatorSource = requireNonEmptyString(
    workers[WorkerFileNames.coordinator],
    WorkerFileNames.coordinator,
  );
  const { metadatabaseurl, ...modelParameters } = rawModel;
  const model = {
    ...modelParameters,
    ...modelLocations(rawModel),
    source: requireNonEmptyString(workers[WorkerFileNames.llm], WorkerFileNames.llm),
    generation: rawModel.generation === undefined ? {} : rawModel.generation,
  };
  const database = {
    ...Object.fromEntries(
      [...databaseStringKeys, ...databaseNumberKeys].map((key) => [
        key,
        rawDatabase[key.toLowerCase()],
      ]),
    ),
    source: requireNonEmptyString(workers[WorkerFileNames.vectordb], WorkerFileNames.vectordb),
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
    onlineApiBaseURL: apiBaseURL,
    modelMetadataBaseURL:
      metadatabaseurl === undefined
        ? undefined
        : requireNonEmptyString(metadatabaseurl, 'metadataBaseUrl'),
    baseURL,
    coordinatorSource,
    systemMessage: chatbot.sysmessage.offline,
    model: { name: WorkerKeys.LLM, payload: model },
    database: { name: WorkerKeys.VECTORDB, payload: database },
  };
};
