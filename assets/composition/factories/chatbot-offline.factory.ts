import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';
import { BrowserSpeechAdapter } from '@/layers/data/browser-speech.adapter';

import { buildRagService } from './chatbot.factory';
import { getLocalChatBot } from './local-chat-bot.factory';

export const buildChatbotOfflineDeps = (shared: ChatbotDependencies): RagDependencies => {
  const chat = getLocalChatBot(shared.coordinator, shared.configuration.model, false, false);
  const dependencies = buildRagService(chat, shared, new BrowserSpeechAdapter());
  chat.initialize();
  return dependencies;
};
