//@ts-ignore
import * as config from '@params/config';
//@ts-ignore
import * as params from '@params';
import { html, LitElement } from 'lit';
import { ContextProvider } from '@lit/context';

import { customElement } from 'lit/decorators.js';
import { chatbotContext } from './contexts/chatbot.context';
import { buildChatbotOfflineDeps } from './factories/chatbot-offline.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends LitElement {
  // IGNORING ERROR SINCE USED ONLY BY LIT
  // @ts-ignore
  private _provide = new ContextProvider(this, {
    context: chatbotContext,
    initialValue: buildChatbotOfflineDeps(config),
  });

  render() {
    return html`<chat-container></chat-container>`;
  }
}
