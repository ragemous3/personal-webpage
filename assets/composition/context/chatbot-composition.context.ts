import { createContext } from '@lit/context';

import { type ChatbotDependencies } from '@/composition/factories/chatbot.factory';

export const chatbotCompositionContext = createContext<ChatbotDependencies>(
  Symbol('chatbot-composition'),
);
