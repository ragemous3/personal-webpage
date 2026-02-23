import { html } from 'lit';
import { Message } from '@huggingface/transformers';
export const chatBubble = (message: Message, from: number) =>
  html`<div from=${from}>${message}</div>`;
