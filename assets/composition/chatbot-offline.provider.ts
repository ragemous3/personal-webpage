import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { chatbotContext } from '@/layers/views/context/chatbot.context';

import { buildChatbotOfflineDeps } from './factories/chatbot-offline.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends LitElement {
  readonly _provide: ContextProvider<typeof chatbotContext, this>;

  constructor() {
    super();
    const initialValue = buildChatbotOfflineDeps(config);
    this._provide = new ContextProvider(this, {
      context: chatbotContext,
      ...(initialValue === undefined ? {} : { initialValue }),
    });
  }

  render(): TemplateResult<1> {
    return html`<chat-container></chat-container>`;
  }
}
