import { isChatbot } from '@/composition/guards/is-chatbot';
import { isSiteConfiguratonGlobal } from '@/composition/guards/is-site-configuration';
import { isSysMessageConfig } from '@/composition/guards/is-sys-message';
import { BroadcastKeys, WorkerFileNames, WorkerKeys } from '@/layers/data/contants/constants';
import { ContentRepository } from '@/layers/data/content-repository.data';
import { HubConnection } from '@/layers/data/hub.connection';
import { Hub } from '@/layers/data/hub.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/chatbot.service';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord, isString } from '@/layers/shared/guards/guards';

import { getOrCreateBroadcast } from './broadcast.factory';
import { getLocalChatBot } from './local-chat-bot.factory';
import { getVectorDatabase } from './local-vector-database.factory';
import { getSharedWorker } from './shared-worker.actory';

export const buildChatbotOfflineDeps = (cfg: unknown): RagService | undefined => {
  try {
    if (!isSiteConfiguratonGlobal(cfg))
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Expected a defined site configuration global`,
      );
    const vectorDBBroadcastSender = getOrCreateBroadcast(BroadcastKeys.VECTORDB, true);
    const chatBroadcastSender = getOrCreateBroadcast(BroadcastKeys.LLM, true);
    const vectorDBBroadcastReciever = getOrCreateBroadcast(BroadcastKeys.VECTORDB);
    const chatBroadcastSenderReciever = getOrCreateBroadcast(BroadcastKeys.LLM);

    const messageCordinatorScriptPath = cfg.WORKER_NAMES[WorkerFileNames.stateMachine];
    const hubScriptPath = cfg.WORKER_NAMES[WorkerFileNames.hub];
    const llmScriptPath = cfg.WORKER_NAMES[WorkerFileNames.llm];
    const vectorDBscriptPath = cfg.WORKER_NAMES[WorkerFileNames.vectordb];
    const messageCordinator = getSharedWorker(messageCordinatorScriptPath);
    const hubConnector = new HubConnection(hubScriptPath, WorkerKeys.HUB);
    const hubPort = new Hub(
      hubConnector,
      messageCordinator,
      [vectorDBBroadcastSender, chatBroadcastSender],
      WorkerKeys.HUB,
    );

    // TODO: Add the guard here isLlmConfig and extract the value and insert it.
    const chat = getLocalChatBot(
      llmScriptPath,
      hubPort,
      messageCordinator,
      chatBroadcastSenderReciever,
    );
    // TODO: Add the guard her isDatabaseConfig e and extract the value and insert it.
    const database = getVectorDatabase(
      vectorDBscriptPath,
      hubPort,
      messageCordinator,
      vectorDBBroadcastReciever,
    );
    const baseURL: unknown = cfg.SITE_PARAMS.baseURL;
    const parameters = cfg.SITE_PARAMS.params;

    if (!isRecord(parameters))
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Site params params property not defined but is expected`,
      );
    const chatbotConfig: unknown = parameters.chatbot;

    if (!isChatbot(chatbotConfig))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params chatbot not defined`);

    const sysMessageConfig: unknown = chatbotConfig.sysmessage;

    if (!isSysMessageConfig(sysMessageConfig))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params chatbot.sysMessage not defined`);

    if (!isString(baseURL))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params baseURL not defined`);

    const chunkRepo = new ContentRepository(baseURL);
    const chatModel = new ChatMessageModel({ role: 'system', content: sysMessageConfig.offline });
    return new RagService(chat, database, chunkRepo, chatModel);
  } catch (error) {
    console.error(error);
  }
};
