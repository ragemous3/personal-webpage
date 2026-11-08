import { consume, ContextProvider } from '@lit/context';
import { html, LitElement, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import { chatbotCompositionContext } from '@/composition/context/chatbot-composition.context';
import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';
import { chatbotContext } from '@/layers/views/context/chatbot.context';

export abstract class ChatbotModeProviderAbstract extends LitElement {
  @consume({ context: chatbotCompositionContext, subscribe: true })
  @property({ attribute: false })
  shared?: ChatbotDependencies;
  readonly #provider = new ContextProvider(this, { context: chatbotContext });
  #dependencies: RagDependencies | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this.#dependencies?.dispose();
    this.#dependencies = undefined;
    super.disconnectedCallback();
  }

  render(): TemplateResult {
    return html`<chat-container></chat-container>`;
  }
  protected abstract build(shared: ChatbotDependencies): RagDependencies;

  protected willUpdate(): void {
    if (!this.shared || this.#dependencies) return;
    this.#dependencies = this.build(this.shared);
    this.#provider.setValue(this.#dependencies.service);
  }
}
