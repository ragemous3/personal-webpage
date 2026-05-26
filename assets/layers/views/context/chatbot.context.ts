import { createContext } from '@lit/context';

import { type ChatbotServiceContract } from '@/layers/shared/contracts/chatbot-service.contract';
export const chatbotContext = createContext<ChatbotServiceContract>(Symbol('chatbotService'));
