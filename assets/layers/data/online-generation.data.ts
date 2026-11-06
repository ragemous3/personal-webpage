import { type Chat, type StoppingCriteria, type TextGenerationConfig, type TextGenerationSingle } from '@huggingface/transformers';

import { GenerationAbstract } from '@/layers/data/abstracts/generation.abstract';
import { isRecord } from '@/layers/shared/guards/guards';
import { readJsonLines } from '@/layers/shared/utils/ndjson.utility';

const readEvent = (event: unknown): { text: string; done: boolean } => {
  if (!isRecord(event)) throw new Error('Invalid online response.');
  if (event.type === 'error') throw new Error('Online generation failed. Retry explicitly.');
  if (event.type === 'done') return { text: '', done: true };
  if (event.type === 'delta' && typeof event.text === 'string') return { text: event.text, done: false };
  throw new Error('Invalid online stream event.');
};

export class OnlineGeneration extends GenerationAbstract {
  constructor(
    private readonly model: string,
    options: Partial<TextGenerationConfig>,
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
  ) { super(options); }

  async chatMessageHandler(
    messages: Chat, callback: (text: string) => void,
    _stopping?: StoppingCriteria, signal?: AbortSignal,
  ): Promise<TextGenerationSingle> {
    const response = await this.#start(messages, signal);
    return this.#read(response, callback);
  }

  async #start(messages: Chat, signal?: AbortSignal): Promise<Response> {
    const response = await this.request('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model, maxOutputTokens: this.options.max_new_tokens ?? 1024,
        messages: messages.filter(({ role }) => role !== 'system'),
      }),
      signal: signal ?? null,
    });
    if (!response.ok || !response.body) throw new Error(`Online API request failed (${response.status}).`);
    return response;
  }

  async #read(response: Response, callback: (text: string) => void): Promise<TextGenerationSingle> {
    if (!response.body) throw new Error('Online response has no body.');
    let text = '';
    let done = false;
    for await (const value of readJsonLines(response.body)) {
      if (done) throw new Error('Unexpected output after completion.');
      const event = readEvent(value);
      text += event.text;
      done = event.done;
      if (event.text) callback(event.text);
    }
    if (!done) throw new Error('Online response was interrupted. Retry explicitly.');
    return { generated_text: text };
  }

  dispose = (): Promise<void> => Promise.resolve();
}
