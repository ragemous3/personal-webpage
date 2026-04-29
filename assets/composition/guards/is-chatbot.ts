import { ChatbotConfig } from '../models/models';

export const isChatbot = (chatbotConfig: unknown): chatbotConfig is ChatbotConfig =>
  chatbotConfig &&
  chatbotConfig !== null &&
  typeof chatbotConfig === 'object' &&
  'sysmessage' in chatbotConfig
    ? true
    : false;
