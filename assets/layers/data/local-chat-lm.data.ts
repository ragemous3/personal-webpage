import { StandardCommunication } from '@/layers/data/abstracts/standard-communication.abstract';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type PendingChatGeneration } from '@/layers/data/models/pending-chat-generation.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ChatGenerationContract } from '@/layers/shared/contracts/chat-generation.contract';
import { type ChatMessage } from '@/layers/shared/contracts/chatbot-service.contract';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type ChatGenerationState } from '@/layers/shared/models/chat-generation.model';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

export class Chat extends StandardCommunication<LmConfig> implements ChatGenerationContract {
  readonly stateSubscription = createStatefulSubscribable<ChatGenerationState>({ ready: false });
  readonly #requests = new Map<string, PendingChatGeneration>();
  #disposed = false;

  constructor(
    runtime: RuntimeCoordinatorContract,
    configuration: RagConfigBase<LmConfig>,
    autoStart = true,
  ) {
    super(runtime, configuration, false);
    this.connections.push(this.onData(this.#receive), this.#disposeGeneration);
    if (autoStart) this.initialize();
  }

  generate(
    messages: readonly ChatMessage[],
    onText: (text: string) => void,
    requestId: string,
  ): Promise<string> {
    if (
      this.#disposed ||
      !this.stateSubscription.getValue()?.ready ||
      this.#requests.has(requestId)
    )
      return Promise.reject(
        new Error(`[${SeverityLevelCodes.ERROR}] - Chat generation is unavailable.`),
      );
    return new Promise((resolve, reject) => {
      this.#requests.set(requestId, { text: '', onText, resolve, reject });
      try {
        this.send({ message: messages }, requestId);
      } catch (error) {
        this.#requests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  cancel(requestId: string): void {
    const pending = this.#requests.get(requestId);
    if (!pending) return;
    this.#requests.delete(requestId);
    pending.reject(new DOMException('Generation cancelled.', 'AbortError'));
    this.send({}, requestId, 'cancel');
  }

  readonly #disposeGeneration = (): void => {
    this.#disposed = true;
    for (const pending of this.#requests.values())
      pending.reject(new DOMException('Chat disposed.', 'AbortError'));
    this.#requests.clear();
    this.stateSubscription.emit({ ready: false });
    this.stateSubscription.disconnect();
  };

  readonly #receive = (data: unknown): void => {
    if (!isRecord(data)) return;
    if (data.task === 'llm:loading') {
      this.stateSubscription.emit({ ready: false });
      return;
    }
    if (data.task === 'llm:ready') {
      this.stateSubscription.emit({ ready: true });
      return;
    }
    const requestId = typeof data.requestId === 'string' ? data.requestId : undefined;
    const pending = requestId ? this.#requests.get(requestId) : undefined;
    if (data.error) {
      this.#receiveError(data, requestId, pending);
      return;
    }
    this.#receiveText(data, requestId, pending);
  };

  #receiveText(
    data: Record<string, unknown>,
    requestId: string | undefined,
    pending: PendingChatGeneration | undefined,
  ): void {
    if (!pending || !requestId) return;
    if (data.task === 'llm:stream:response' && typeof data.payload === 'string') {
      pending.text += data.payload;
      pending.onText(data.payload);
    }
    if (data.task === 'llm:message:response') {
      this.#requests.delete(requestId);
      pending.resolve(this.#finalText(data.payload) ?? pending.text);
    }
  }

  #errorMessage(error: unknown): string {
    return isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
  }

  #receiveError(
    data: Record<string, unknown>,
    requestId: string | undefined,
    pending: PendingChatGeneration | undefined,
  ): void {
    if (requestId && !pending) return;
    const message = this.#errorMessage(data.error);
    const error = Object.assign(new Error(message), {
      runtimeFailure: data.runtimeFailure === true,
    });
    if (!requestId || data.task === 'llm:init') {
      this.stateSubscription.emit({
        ready: false,
        error: message,
        ...(error.runtimeFailure ? { runtimeFailure: true } : {}),
      });
      for (const request of this.#requests.values()) request.reject(error);
      this.#requests.clear();
    } else {
      this.#requests.delete(requestId);
      pending?.reject(error);
    }
  }

  #finalText(payload: unknown): string | undefined {
    if (!isRecord(payload)) return;
    if (typeof payload.generated_text === 'string') return payload.generated_text;
    if (!Array.isArray(payload.generated_text)) return;
    const message: unknown = payload.generated_text.at(-1);
    return isRecord(message) && message.role === 'assistant' && typeof message.content === 'string'
      ? message.content
      : undefined;
  }
}
