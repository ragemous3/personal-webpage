import { createContext } from '@lit/context';
import { ChatbotServiceContract } from '../../layers/shared/contracts/chatbot-service.contract';
export const chatbotContext = createContext<ChatbotServiceContract | undefined>(
  Symbol('chatbotService'),
);
