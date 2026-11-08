import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';

import { buildRagService } from './chatbot.factory';
import { getLocalChatBot } from './local-chat-bot.factory';

export const buildChatbotOfflineDeps = (
  shared: ChatbotDependencies,
): RagDependencies => {
  const chat = getLocalChatBot(shared.coordinator, shared.configuration.model, false, false);
  const dependencies = buildRagService(chat, shared);
  chat.initialize();
  return dependencies;
};
