import { isSiteConfiguratonGlobal } from '@/composition/guards/is-site-configuration';
import { isSysMessageConfig } from '@/composition/guards/is-sys-message';
import { BroadcastKeys, WorkerFileNames, WorkerKeys } from '@/layers/data/contants/constants';
import {
  databaseNumberKeys,
  databaseStringKeys,
} from '@/layers/data/contants/local-database.constants';
import { ContentRepository } from '@/layers/data/content-repository.data';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { HubConnection } from '@/layers/data/hub.connection';
import { Hub } from '@/layers/data/hub.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { RagService } from '@/layers/services/chatbot.service';
import { isRecord, isString } from '@/layers/shared/guards/guards';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

import { getOrCreateBroadcast } from './broadcast.factory';
import { getLocalChatBot } from './local-chat-bot.factory';
import { getVectorDatabase } from './local-vector-database.factory';
import { getSharedWorker } from './shared-worker.actory';

interface OfflineConfiguration {
  baseURL: string;
  systemMessage: string;
  hubSource: string;
  stateMachineSource: string;
  model: RagConfigBase<LmConfig>;
  database: RagConfigBase<DatabaseConfig>;
}

const requireRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(`Expected an object for ${name}`);
  }
  return value;
};

const requireString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (!isString(value) || value.trim().length === 0) {
    throw new Error(`Expected a nonempty string for ${key}`);
  }
  return value;
};

const getOfflineConfiguration = (cfg: unknown): OfflineConfiguration => {
  if (!isSiteConfiguratonGlobal(cfg)) {
    throw new Error('Expected a defined site configuration global');
  }
  const workers = requireRecord(cfg.WORKER_NAMES, 'WORKER_NAMES');
  const site = requireRecord(cfg.SITE_PARAMS, 'SITE_PARAMS');
  const parameters = requireRecord(site.params, 'SITE_PARAMS.params');
  const chatbot = requireRecord(parameters.chatbot, 'chatbot');
  const config = requireRecord(chatbot.config, 'chatbot.config');
  const rawModel = requireRecord(config.locallm, 'chatbot.config.locallm');
  const rawDatabase = requireRecord(config.localdatabase, 'chatbot.config.localdatabase');
  const baseURL = requireString(site, 'baseURL');
  const hubSource = requireString(workers, WorkerFileNames.hub);
  const stateMachineSource = requireString(workers, WorkerFileNames.stateMachine);
  const model = {
    ...rawModel,
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
  };
  if (!isLmConfig(model)) {
    throw new Error('Invalid chatbot.config.locallm configuration');
  }
  if (!isDatabaseConfig(database)) {
    throw new Error('Invalid chatbot.config.localdatabase configuration');
  }
  if (!isSysMessageConfig(chatbot.sysmessage)) {
    throw new Error('Invalid chatbot.sysmessage configuration');
  }
  return {
    baseURL,
    hubSource,
    stateMachineSource,
    systemMessage: chatbot.sysmessage.offline,
    model: { name: WorkerKeys.LLM, payload: model },
    database: { name: WorkerKeys.VECTORDB, payload: database },
  };
};

export const buildChatbotOfflineDeps = (cfg: unknown): RagService | undefined => {
  try {
    const configuration = getOfflineConfiguration(cfg);
    const vectorDBBroadcastSender = getOrCreateBroadcast(BroadcastKeys.VECTORDB, true);
    const chatBroadcastSender = getOrCreateBroadcast(BroadcastKeys.LLM, true);
    const vectorDBBroadcastReciever = getOrCreateBroadcast(BroadcastKeys.VECTORDB);
    const chatBroadcastReciever = getOrCreateBroadcast(BroadcastKeys.LLM);
    const messageCoordinator = getSharedWorker(configuration.stateMachineSource);
    const hubConnector = new HubConnection(configuration.hubSource, WorkerKeys.HUB);
    const hubPort = new Hub(
      hubConnector,
      messageCoordinator,
      [vectorDBBroadcastSender, chatBroadcastSender],
      WorkerKeys.HUB,
    );
    const chat = getLocalChatBot(
      hubPort,
      messageCoordinator,
      chatBroadcastReciever,
      configuration.model,
    );
    const database = getVectorDatabase(
      hubPort,
      messageCoordinator,
      vectorDBBroadcastReciever,
      configuration.database,
    );
    const chunkRepo = new ContentRepository(configuration.baseURL);
    const chatModel = new ChatMessageModel({
      role: 'system',
      content: configuration.systemMessage,
    });
    return new RagService(chat, database, chunkRepo, chatModel);
  } catch (error) {
    console.error(error);
  }
};
