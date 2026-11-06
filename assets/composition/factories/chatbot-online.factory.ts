import { OnlineChatClient } from '@/layers/data/online-chat.client';

import { buildRagService, type ChatbotDependencies } from './chatbot.factory';

export const buildChatbotOnlineDeps = (
  shared: ChatbotDependencies,
): ReturnType<typeof buildRagService> => {
  const settings = shared.settings.stateSubscription.getValue()?.mounted;
  if (!settings?.onlineModel) throw new Error('Online model is unavailable.');
  return buildRagService(
    new OnlineChatClient('/api/', {
      model: settings.onlineModel,
      maxOutputTokens: settings.maxNewTokens,
    }),
    shared,
  );
};
