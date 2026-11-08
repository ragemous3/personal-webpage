import { customElement } from 'lit/decorators.js';

import { ChatbotModeProviderAbstract } from '@/composition/chatbot-mode-provider.abstract';
import { buildChatbotOnlineDeps } from '@/composition/factories/chatbot-online.factory';
import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';

@customElement('chatbot-online-provider')
export class ChatbotOnlineProvider extends ChatbotModeProviderAbstract {
  protected build(shared: ChatbotDependencies): RagDependencies {
    return buildChatbotOnlineDeps(shared);
  }
}
