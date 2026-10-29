import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { chatbotContext } from '@/layers/views/context/chatbot.context';
import { configurationContext } from '@/layers/views/context/configuration.context';

import { buildConfigurableChatbotDeps } from './factories/chatbot-offline.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends LitElement {
  readonly _provide: ContextProvider<typeof chatbotContext, this>;
  readonly #settingsProvider: ContextProvider<typeof configurationContext, this>;
  #dependencies: ReturnType<typeof buildConfigurableChatbotDeps> | undefined;

  constructor() {
    super();
    this._provide = new ContextProvider(this, {
      context: chatbotContext,
    });
    this.#settingsProvider = new ContextProvider(this, { context: configurationContext });
  }

  connectedCallback(): void {
    super.connectedCallback();
    globalThis.addEventListener('pagehide', this.#stop);
    globalThis.addEventListener('pageshow', this.#start);
    this.#start();
  }

  readonly #start = (): void => {
    if (this.#dependencies || !this.isConnected) return;
    this.#dependencies = buildConfigurableChatbotDeps(config, globalThis);
    this._provide.setValue(this.#dependencies.service);
    this.#settingsProvider.setValue(this.#dependencies.settings);
  };

  readonly #stop = (): void => {
    this.#dependencies?.dispose();
    this.#dependencies = undefined;
  };

  disconnectedCallback(): void {
    this.#stop();
    globalThis.removeEventListener('pagehide', this.#stop);
    globalThis.removeEventListener('pageshow', this.#start);
    super.disconnectedCallback();
  }

  render(): TemplateResult<1> {
    return html`
      <assistant-configuration></assistant-configuration>
      <chat-container></chat-container>
    `;
  }
}
