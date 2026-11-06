import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { type ChatMessage } from '@/layers/data/models/models';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { readJsonLines } from '@/layers/shared/utils/ndjson.utility';

const readEvent = (event: unknown): { text: string; done: boolean } => {
  if (!isRecord(event)) throw new Error('Invalid online response.');
  if (event.type === 'error') throw new Error('Online generation failed. Retry explicitly.');
  if (event.type === 'done') return { text: '', done: true };
  if (event.type === 'delta' && typeof event.text === 'string')
    return { text: event.text, done: false };
  throw new Error('Invalid online stream event.');
};

export class OnlineChatClient extends ApiBase implements StandardCommunicationContract {
  readonly name = 'llm';
  readonly #listeners = new Set<(data: unknown) => void>();
  readonly #requests = new Map<string, AbortController>();

  constructor(
    baseURL: string,
    private readonly options: { model: string; maxOutputTokens: number },
    fetcher?: typeof fetch,
  ) {
    super(baseURL, fetcher);
  }

  onData = (listener: (data: unknown) => void): (() => void) => {
    this.#listeners.add(listener);
    listener({ task: 'llm:ready' });
    return () => this.#listeners.delete(listener);
  };

  initialize = (): void => {
    this.#emit({ task: 'llm:ready' });
  };

  send = (
    payload: unknown,
    requestId = crypto.randomUUID(),
    action: 'query' | 'cancel' = 'query',
  ): void => {
    if (action === 'cancel') {
      this.#requests.get(requestId)?.abort();
      return;
    }
    if (!isRecord(payload) || !Array.isArray(payload.message))
      throw new Error('Invalid chat request.');
    const controller = new AbortController();
    this.#requests.set(requestId, controller);
    const emit = (data: Record<string, unknown>): void => {
      if (!controller.signal.aborted) this.#emit({ ...data, requestId });
    };
    void this.generate(
      payload.message as ChatMessage[],
      (text) => emit({ task: 'llm:stream:response', payload: text }),
      controller.signal,
    )
      .then((result) => emit({ task: 'llm:message:response', payload: result }))
      .catch(() =>
        emit({
          task: 'llm:query',
          error: { message: 'Online generation failed. Retry explicitly.' },
        }),
      )
      .finally(() => this.#requests.delete(requestId));
  };

  #emit(data: unknown): void {
    for (const listener of this.#listeners) listener(data);
  }

  async generate(
    messages: ChatMessage[],
    callback: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<{ generated_text: string }> {
    const response = await this.request('generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.options,
        messages: messages.filter(({ role }) => role !== 'system'),
      }),
      signal: signal ?? null,
    });
    if (!response.ok || !response.body)
      throw new Error(`Online API request failed (${response.status}).`);
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

  dispose = (): void => {
    for (const controller of this.#requests.values()) controller.abort();
    this.#requests.clear();
    this.#listeners.clear();
  };
}
