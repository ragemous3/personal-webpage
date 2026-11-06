import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { chatbotCompositionContext } from '@/composition/context/chatbot-composition.context';
import { buildChatbotDeps } from '@/composition/factories/chatbot.factory';
import { configurationContext } from '@/layers/views/context/configuration.context';

@customElement('chatbot-provider')
export class ChatbotProvider extends LitElement {
  #dependencies = buildChatbotDeps(config, globalThis);
  readonly #settings = new ContextProvider(this, {
    context: configurationContext,
    initialValue: this.#dependencies.settings,
  });
  readonly #shared = new ContextProvider(this, {
    context: chatbotCompositionContext,
    initialValue: this.#dependencies,
  });
  #disposed = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.#disposed) return;
    this.#dependencies = buildChatbotDeps(config, globalThis);
    this.#settings.setValue(this.#dependencies.settings);
    this.#shared.setValue(this.#dependencies);
    this.#disposed = false;
  }

  disconnectedCallback(): void {
    this.#dependencies.dispose();
    this.#disposed = true;
    super.disconnectedCallback();
  }

  render(): TemplateResult {
    return html`
      <assistant-configuration></assistant-configuration>
      <chatbot-host
        .offline=${html`<chatbot-offline-provider></chatbot-offline-provider>`}
        .online=${html`<chatbot-online-provider></chatbot-online-provider>`}
      ></chatbot-host>
    `;
  }
}
