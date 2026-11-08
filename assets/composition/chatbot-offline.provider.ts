import { customElement } from 'lit/decorators.js';

import { ChatbotModeProviderAbstract } from '@/composition/chatbot-mode-provider.abstract';
import { buildChatbotOfflineDeps } from '@/composition/factories/chatbot-offline.factory';
import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends ChatbotModeProviderAbstract {
  protected build(shared: ChatbotDependencies): RagDependencies {
    return buildChatbotOfflineDeps(shared);
  }
}
