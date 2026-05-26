import { type Chat } from '@huggingface/transformers';
import { consume } from '@lit/context';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { type ChatbotServiceContract } from '@/layers/shared/contracts/chatbot-service.contract';
import { chatbotContext } from '@/layers/views/context/chatbot.context';

@customElement('chat-container')
export class ChatContainer extends LitElement {
  // static styles = chatBubbleStyles;
  @property({ type: Array }) messages: Chat = [];

  @consume({ context: chatbotContext, subscribe: true })
  chatbotService!: ChatbotServiceContract;

  @state() value = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.chatbotService.init();
  }
  render(): TemplateResult {
    return html`
      <div class="chat-container">
        <form @submit=${() => this.onSubmit}>
          <input
            .value=${this.value}
            @input=${(event: Event): void => {
              this.value = (event.target as HTMLInputElement).value;
            }}
          /
          <button type="submit">send away a question</button>
        </form>
      </div>
    `;
  }
  private readonly onSubmit = (submitEvent: SubmitEvent): void => {
    submitEvent.preventDefault();
    this.chatbotService.send(this.value);
  };
}
