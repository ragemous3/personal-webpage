import { customElement } from 'lit/decorators.js';

import { ChatbotModeProviderAbstract } from '@/composition/chatbot-mode-provider.abstract';
import {
  type buildRagService,
  type ChatbotDependencies,
} from '@/composition/factories/chatbot.factory';
import { buildChatbotOfflineDeps } from '@/composition/factories/chatbot-offline.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends ChatbotModeProviderAbstract {
  protected build(shared: ChatbotDependencies): ReturnType<typeof buildRagService> {
    return buildChatbotOfflineDeps(shared);
  }
}
