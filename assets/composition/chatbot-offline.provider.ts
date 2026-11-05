import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { chatbotContext } from '@/layers/views/context/chatbot.context';
import { configurationContext } from '@/layers/views/context/configuration.context';

import { buildChatbotOfflineDeps } from './factories/chatbot-offline.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends LitElement {
  readonly _provide: ContextProvider<typeof chatbotContext, this>;
  #dependencies: ReturnType<typeof buildChatbotOfflineDeps> | undefined;

  readonly settingsProvider: ContextProvider<typeof configurationContext, this>;

  constructor() {
    super();
    const dependencies = buildChatbotOfflineDeps(config, globalThis);
    this.#dependencies = dependencies;
    const initialValue = dependencies.service;
    this.settingsProvider = new ContextProvider(this, {
      context: configurationContext,
      initialValue: dependencies.settings,
    });
    this._provide = new ContextProvider(this, {
      context: chatbotContext,
      initialValue,
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.#dependencies) return;
    this.#dependencies = buildChatbotOfflineDeps(config, globalThis);
    this._provide.setValue(this.#dependencies.service);
    this.settingsProvider.setValue(this.#dependencies.settings);
  }

  disconnectedCallback(): void {
    this.#dependencies?.dispose();
    this.#dependencies = undefined;
    super.disconnectedCallback();
  }

  render(): TemplateResult<1> {
    return html`
      <assistant-configuration></assistant-configuration>
      <chat-container></chat-container>
    `;
  }
}
