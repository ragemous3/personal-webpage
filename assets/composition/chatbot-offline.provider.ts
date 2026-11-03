import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { chatbotContext } from '@/layers/views/context/chatbot.context';
import { configurationContext } from '@/layers/views/context/configuration.context';

import { buildConfigurableChatbotDeps } from './factories/configurable-chatbot.factory';

@customElement('chatbot-offline-provider')
export class ChatbotOfflineProvider extends LitElement {
  readonly _provide: ContextProvider<typeof chatbotContext, this>;
  #dependencies: ReturnType<typeof buildConfigurableChatbotDeps> | undefined;

  readonly settingsProvider: ContextProvider<typeof configurationContext, this>;

  constructor() {
    super();
    const dependencies = buildConfigurableChatbotDeps(config, globalThis);
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
    this.#dependencies = buildConfigurableChatbotDeps(config, globalThis);
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
