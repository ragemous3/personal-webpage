import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';
import { HeadTTSAdapter } from '@/layers/data/head-tts.adapter';
import { OnlineChatClient } from '@/layers/data/online-chat.client';
import { SeverityLevelCodes } from '@/layers/shared/constants';

import { buildRagService } from './chatbot.factory';

export const buildChatbotOnlineDeps = (shared: ChatbotDependencies): RagDependencies => {
  const settings = shared.settings.stateSubscription.getValue()?.mounted;
  if (!settings?.onlineModel)
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Online model is unavailable.`);
  return buildRagService(
    new OnlineChatClient(shared.configuration.onlineApiBaseURL, {
      model: settings.onlineModel,
      maxOutputTokens: settings.maxNewTokens,
    }),
    shared,
    new HeadTTSAdapter(shared.configuration.baseURL),
  );
};
