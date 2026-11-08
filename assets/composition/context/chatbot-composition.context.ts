import { createContext } from '@lit/context';

import { type ChatbotDependencies } from '@/composition/models/chatbot-dependencies.model';

export const chatbotCompositionContext = createContext<ChatbotDependencies>(
  Symbol('chatbot-composition'),
);
