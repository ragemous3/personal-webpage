import { Chat } from '@huggingface/transformers';
import { html, LitElement, TemplateResult } from 'lit';
import { customElement, eventOptions, property, state } from 'lit/decorators.js';

import { chatBubbleStyles } from './styles/chatbot.style';
import { consume } from '@lit/context';
import { chatbotContext } from '../../composition/contexts/chatbot.context';
import { ChatbotServiceContract } from '../shared/contracts/chatbot-service.contract';

@customElement('chat-container')
export class ChatContainer extends LitElement {
  // static styles = chatBubbleStyles;
  @property({ type: Array }) messages: Chat = [];

  @consume({ context: chatbotContext, subscribe: true })
  chatbotService!: ChatbotServiceContract;

  @state() value: string = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.chatbotService.init();
  }

  onSubmit(e: SubmitEvent): void {
    e.preventDefault();
    this.chatbotService.send(this.value);
  }

  render(): TemplateResult {
    return html`<div class="chat-container">
      <form @submit=${this.onSubmit}>
        <input
          .value=${this.value}
          @input=${(e: Event) => {
            this.value = (e.target as HTMLInputElement).value;
          }}
        />
        <button type="submit">send away a question</button>
      </form>
    </div>`;
  }
}
