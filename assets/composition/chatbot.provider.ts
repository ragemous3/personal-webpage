import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';

import { chatbotCompositionContext } from '@/composition/context/chatbot-composition.context';
import { buildChatbotDeps } from '@/composition/factories/chatbot.factory';
import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { type AssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { configurationContext } from '@/layers/views/context/configuration.context';

@customElement('chatbot-provider')
export class ChatbotProvider extends LitElement {
  #dependencies = buildChatbotDeps(config, globalThis);
  readonly #configurationProvider = new ContextProvider(this, {
    context: configurationContext,
    initialValue: this.#dependencies.settings,
  });
  readonly #dependenciesProvider = new ContextProvider(this, {
    context: chatbotCompositionContext,
    initialValue: this.#dependencies,
  });
  #disposed = false;
  #disconnect: (() => void) | undefined;
  @state() mounted: AssistantSettings | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.#disposed) {
      this.#dependencies = buildChatbotDeps(config, globalThis);
      this.#configurationProvider.setValue(this.#dependencies.settings);
      this.#dependenciesProvider.setValue(this.#dependencies);
      this.#disposed = false;
    }
    this.#disconnect = this.#dependencies.settings.stateSubscription.connect((value) => {
      this.mounted = value.mounted;
    });
  }

  disconnectedCallback(): void {
    this.#disconnect?.();
    this.#dependencies.dispose();
    this.#disposed = true;
    super.disconnectedCallback();
  }

  render(): TemplateResult {
    const settings = this.mounted;
    return html`
      <assistant-configuration></assistant-configuration>
      ${settings
        ? keyed(
            JSON.stringify(settings),
            settings.mode === AssistantModes.LOCAL
              ? html`<chatbot-offline-provider></chatbot-offline-provider>`
              : html`<chatbot-online-provider></chatbot-online-provider>`,
          )
        : html`<p role="status">initializing</p>`}
    `;
  }
}
