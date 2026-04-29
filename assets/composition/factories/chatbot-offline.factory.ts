import { BroadcastKeys, WorkerFileNames, WorkerKeys } from '../../layers/data/contants/constants';
import { ContentRepository } from '../../layers/data/content-repository.data';
import { HubConnection } from '../../layers/data/hub.connection';
import { Hub } from '../../layers/data/hub.data';
import { ChatMessageModel } from '../../layers/data/models/chat.model';
import { MessageBase } from '../../layers/data/workers/models';
import { RagService } from '../../layers/services/chatbot.service';
import { SeverityLevelCodes } from '../../layers/shared/constants';
import { isRecord, isString } from '../../layers/shared/guards/guards';
import { isChatbot } from '../guards/is-chatbot';
import { isSysMessageConfig } from '../guards/is-sysMessage';
import { ChatbotConfig } from '../models/models';
import { getLocalChatBot } from './bot-port.factory';
import { getOrCreateBroadcast } from './broadcast.factory';
import { getLocalDB } from './db-port.factory';
import { getSharedWorker } from './shared-worker.factory';

export const buildChatbotOfflineDeps = (cfg: {
  PAGE_PARAMS: Record<string, unknown>;
  SITE_PARAMS: Record<string, unknown>;
  WORKER_NAMES: Record<(typeof WorkerFileNames)[keyof typeof WorkerFileNames], string>;
}) => {
  try {
    const vectorDBBroadcastSender = getOrCreateBroadcast<
      MessageBase<unknown>,
      MessageBase<unknown>
    >(BroadcastKeys.VECTORDB, true);
    const chatBroadcastSender = getOrCreateBroadcast<MessageBase<unknown>, MessageBase<unknown>>(
      BroadcastKeys.LLM,
      true,
    );
    const vectorDBBroadcastReciever = getOrCreateBroadcast<
      MessageBase<unknown>,
      MessageBase<unknown>
    >(BroadcastKeys.VECTORDB);
    const chatBroadcastSenderReciever = getOrCreateBroadcast<
      MessageBase<unknown>,
      MessageBase<unknown>
    >(BroadcastKeys.LLM);

    const msgCordinatorScriptPath = cfg.WORKER_NAMES[WorkerFileNames.stateMachine];
    const hubScriptPath = cfg.WORKER_NAMES[WorkerFileNames.hub];
    const llmScriptPath = cfg.WORKER_NAMES[WorkerFileNames.llm];
    const vectorDBscriptPath = cfg.WORKER_NAMES[WorkerFileNames.vectordb];
    const msgCordinator = getSharedWorker(msgCordinatorScriptPath);
    const hubConnector = new HubConnection(hubScriptPath, WorkerKeys.HUB);
    const hubPort = new Hub(
      hubConnector,
      msgCordinator,
      [vectorDBBroadcastSender, chatBroadcastSender],
      WorkerKeys.HUB,
    );
    const chat = getLocalChatBot(
      llmScriptPath,
      hubPort,
      msgCordinator,
      chatBroadcastSenderReciever,
    );
    const db = getLocalDB(vectorDBscriptPath, hubPort, msgCordinator, vectorDBBroadcastReciever);
    const baseURL: unknown | undefined = cfg?.SITE_PARAMS?.baseURL;
    const params = cfg?.SITE_PARAMS?.params;

    if (!isRecord(params))
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Site params params property not defined but is expected`,
      );
    const chatbotConfig: ChatbotConfig | unknown = params.chatbot;

    if (!isChatbot(chatbotConfig))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params chatbot not defined`);

    const sysMessageConfig: unknown | undefined = chatbotConfig?.sysmessage;

    if (!isSysMessageConfig(sysMessageConfig))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params chatbot.sysMessage not defined`);

    if (!isString(baseURL))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Site params baseURL not defined`);

    const chunkRepo = new ContentRepository(baseURL ?? '/');
    const chatModel = new ChatMessageModel({ role: 'system', content: sysMessageConfig.offline });
    return new RagService(chat, db, chunkRepo, chatModel);
  } catch (e) {
    console.error(e);
  }
};
