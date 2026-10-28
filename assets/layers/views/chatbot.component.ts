import { consume } from '@lit/context';
import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  type ChatbotServiceContract,
  type ChatMessage,
  type ChatState,
} from '@/layers/shared/contracts/chatbot-service.contract';
import { chatbotContext } from '@/layers/views/context/chatbot.context';

@customElement('chat-container')
export class ChatContainer extends LitElement {
  @consume({ context: chatbotContext, subscribe: true })
  @property({ attribute: false })
  chatbotService?: ChatbotServiceContract;
  @state() messages: ChatMessage[] = [];
  @state() value = '';
  @state() lifecycle: ChatState = { status: 'initializing' };
  #bound: ChatbotServiceContract | undefined;
  #connections: Array<() => void> = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.#bind();
  }

  disconnectedCallback(): void {
    this.#disconnect();
    super.disconnectedCallback();
  }

  #disconnect(): void {
    for (const disconnect of this.#connections) disconnect();
    this.#connections = [];
    this.#bound = undefined;
  }

  #bind(): void {
    if (!this.isConnected || this.#bound === this.chatbotService) return;
    this.#disconnect();
    const service = this.chatbotService;
    if (!service) return;
    this.#bound = service;
    this.#connections = [
      service.chatMessagesSubscription.connect((messages) => {
        this.messages = messages;
      }),
      service.stateSubscription.connect((state) => {
        this.lifecycle = state;
      }),
      service.attach(),
    ];
  }

  render(): TemplateResult {
    return html`
      <div class="chat-container">
        <div role="log" aria-live="polite">
          ${this.messages.map(
            (message) =>
              html`
                <p>
                                ${message.role}: ${message.content}${message.interrupted ? ' (interrupted)' : ''}
                              </p>
              `,
          )}
        </div>
        <p role="status">${this.lifecycle.status}</p>
        ${this.lifecycle.error ? html`<p role="alert">${this.lifecycle.error}</p>` : ''}
        <form @submit=${this.onSubmit}>
          <input
            aria-label="Question"
            .value=${this.value}
            ?disabled=${this.lifecycle.status !== 'ready'}
            @input=${(event: Event): void => {
              this.value = (event.target as HTMLInputElement).value;
            }}
          />
          <button
            type="submit"
            ?disabled=${this.lifecycle.status !== 'ready' || !this.value.trim()}
          >
            Send
          </button>
        </form>
        <button
          @click=${() => this.chatbotService?.cancel()}
          ?disabled=${this.lifecycle.status !== 'responding'}
        >
          Cancel
        </button>
        <button @click=${() => this.chatbotService?.reset()}>Reset</button>
        ${this.lifecycle.status === 'error'
          ? html`<button @click=${() => this.chatbotService?.retry()}>Retry</button>`
          : ''}
      </div>
    `;
  }

  protected updated(_changed: PropertyValues): void {
    this.#bind();
  }

  private readonly onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (this.lifecycle.status !== 'ready' || !this.value.trim()) return;
    this.chatbotService?.send(this.value);
    this.value = '';
  };
}
