import { buildRagService, type ChatbotDependencies } from './chatbot.factory';
import { getLocalChatBot } from './local-chat-bot.factory';

export const buildChatbotOfflineDeps = (
  shared: ChatbotDependencies,
): ReturnType<typeof buildRagService> => {
  const chat = getLocalChatBot(shared.coordinator, shared.configuration.model, false, false);
  const dependencies = buildRagService(chat, shared);
  chat.initialize();
  return dependencies;
};
