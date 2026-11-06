import { customElement } from 'lit/decorators.js';

import { ChatbotModeProviderAbstract } from '@/composition/chatbot-mode-provider.abstract';
import {
  type buildRagService,
  type ChatbotDependencies,
} from '@/composition/factories/chatbot.factory';
import { buildChatbotOnlineDeps } from '@/composition/factories/chatbot-online.factory';

@customElement('chatbot-online-provider')
export class ChatbotOnlineProvider extends ChatbotModeProviderAbstract {
  protected build(shared: ChatbotDependencies): ReturnType<typeof buildRagService> {
    return buildChatbotOnlineDeps(shared);
  }
}
