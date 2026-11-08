import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { type ChatMessage } from '@/layers/data/models/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ChatGenerationContract } from '@/layers/shared/contracts/chat-generation.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type ChatGenerationState } from '@/layers/shared/models/chat-generation.model';
import { readJsonLines } from '@/layers/shared/utils/ndjson.utility';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

export class OnlineChatClient extends ApiBase implements ChatGenerationContract {
  readonly stateSubscription = createStatefulSubscribable<ChatGenerationState>({ ready: true });
  #disposed = false;
  readonly #requests = new Map<string, AbortController>();

  constructor(
    baseURL: string,
    private readonly options: { model: string; maxOutputTokens: number },
    fetcher?: typeof fetch,
  ) {
    super(baseURL, fetcher);
  }

  initialize = (): void => {
    if (!this.#disposed) this.stateSubscription.emit({ ready: true });
  };

  cancel(requestId: string): void {
    this.#requests.get(requestId)?.abort();
  }

  async generate(
    messages: readonly ChatMessage[],
    onText: (text: string) => void,
    requestId: string,
  ): Promise<string> {
    if (this.#disposed || this.#requests.has(requestId))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Chat generation is unavailable.`);
    const controller = new AbortController();
    this.#requests.set(requestId, controller);
    try {
      return await this.#generate(messages, onText, controller.signal);
    } finally {
      if (this.#requests.get(requestId) === controller) this.#requests.delete(requestId);
    }
  }

  #readEvent(event: unknown): { text: string; done: boolean } {
    if (!isRecord(event))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid online response.`);
    if (event.type === 'error')
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Online generation failed. Retry explicitly.`,
      );
    if (event.type === 'done') return { text: '', done: true };
    if (event.type === 'delta' && typeof event.text === 'string')
      return { text: event.text, done: false };
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid online stream event.`);
  }

  async #generate(
    messages: readonly ChatMessage[],
    callback: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
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
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Online API request failed (${response.status}).`,
      );
    let text = '';
    let done = false;
    for await (const value of readJsonLines(response.body)) {
      if (done)
        throw new Error(`[${SeverityLevelCodes.ERROR}] - Unexpected output after completion.`);
      const event = this.#readEvent(value);
      text += event.text;
      done = event.done;
      if (event.text) callback(event.text);
    }
    if (!done)
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Online response was interrupted. Retry explicitly.`,
      );
    return text;
  }

  dispose = (): void => {
    for (const controller of this.#requests.values()) controller.abort();
    this.#requests.clear();
    this.#disposed = true;
    this.stateSubscription.emit({ ready: false });
    this.stateSubscription.disconnect();
  };
}
