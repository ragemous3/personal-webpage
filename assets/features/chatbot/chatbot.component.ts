import { Chat } from '@huggingface/transformers';
import { html, LitElement, TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { chatBubbleStyles } from './chatbot.styles';
import { chatBubble } from './components/chat-bubble.template';
import { ChatbotService } from './services/chatbot.service';
/*
 * 1. chatbot is doing init
 * 2. chatbot awaits recievedMessage (Some info text that it finished its init)
 * 3. -||-
 * 4. User is  writing their query and clicks the send button.
 * 5. Message is picked up from the input and sent to RAGService.
 * 6. Old messages appends message
 * 	6.1 - Call vectorDBWorker with the 'query' and get the neighbors back.
 * 7. Get the context from the chunks.json, filter out any undefined and Get the context from the chunks.json, produce an Error if any undefined found.
 * 8. Append the context to sysPrompt variable, append the sysprompt first and the rest of the messages to a new Array, send it to llmWorker And wait for response
 * 9. Get response and append it to messages in the correct format
 * 	9.1 Send the response back to chatbot and render the results.
 */

@customElement('chat-container')
export class ChatContainer extends LitElement {
  service: ChatbotService;
  static styles = chatBubbleStyles;
  @query('#query-input-name') queryInputBox!: HTMLInputElement;
  @property({ type: Array }) messages: Chat = [];
  @property({ attribute: false }) hej: string = 'test';

  constructor(service: ChatbotService = new ChatbotService()) {
    super();
    this.service = service;
  }
  connectedCallback(): void {
    super.connectedCallback();
    this.service.init();
  }

  render = (): TemplateResult =>
    html`<div class="chat-container">
        ${this.messages.map((message, role): TemplateResult => chatBubble(message, role))}
      </div>
      <div class="chat-input"><input id="query-input-name"/> <button @click="this.query></button></div>`;
  /* 
  #query = () => {
    const v = this.queryInputBox.value;
    if (!v) return;
    this.ragService.sendMsg(v);
  }; */
}
