import { ContentRepository } from '@/layers/data/content-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/chatbot.service';
import { SeverityLevelCodes } from '@/layers/shared/constants';

import { getLocalChatBot } from './local-chat-bot.factory';
import { getVectorDatabase } from './local-vector-database.factory';
import { getOfflineConfiguration } from './offline-configuration';
import { getRuntimeCoordinator } from './runtime-coordinator.factory';

export const buildChatbotOfflineDeps = (cfg: unknown): RagService | undefined => {
  try {
    const configuration = getOfflineConfiguration(cfg);
    const runtime = getRuntimeCoordinator(cfg);
    const chat = getLocalChatBot(runtime, configuration.model);
    const database = getVectorDatabase(runtime, configuration.database);
    return new RagService(
      chat,
      database,
      new ContentRepository(configuration.baseURL),
      new ChatMessageModel({ role: 'system', content: configuration.systemMessage }),
      runtime,
    );
  } catch (error) {
    console.error(`[${SeverityLevelCodes.ERROR}] - Failed to configure offline chatbot`, error);
  }
};
