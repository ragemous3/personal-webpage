import { type ChatbotConfig } from '@/composition/models/models';

export const isChatbot = (chatbotConfig: unknown): chatbotConfig is ChatbotConfig =>
  chatbotConfig && typeof chatbotConfig === 'object' && 'sysmessage' in chatbotConfig
    ? true
    : false;
