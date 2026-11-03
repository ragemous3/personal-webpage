import { type ChatMessageModelContract } from '@/layers/data/contracts/chat-model.contract';
import { type ChatMessage, type Chunk } from '@/layers/data/models/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import {
  type ChatbotServiceContract,
  type ChatState,
} from '@/layers/shared/contracts/chatbot-service.contract';
import { type ContentRepositoryContract } from '@/layers/shared/contracts/content-repository.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import { type RuntimeLifecycleContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

export class RagService implements ChatbotServiceContract {
  readonly chatMessagesSubscription = createStatefulSubscribable<ChatMessage[]>([]);
  readonly stateSubscription = createStatefulSubscribable<ChatState>({ status: 'initializing' });
  #transportUnsubscribers: Array<() => void> = [];
  #attachedClients = 0;
  #chatReady = false;
  #databaseReady = false;
  readonly #failedWorkers = new Set<'llm' | 'vectordb'>();
  #active: string | undefined;
  #question: string | undefined;
  #messages: ChatMessage[] = [];
  #recovery: Promise<void> | undefined;
  #runtimeFailed = false;
  #configuring = false;

  constructor(
    private readonly chat: StandardCommunicationContract,
    private readonly database: StandardCommunicationContract,
    private readonly repo: ContentRepositoryContract,
    private readonly chatModel: ChatMessageModelContract,
    private readonly runtime?: RuntimeLifecycleContract,
  ) {}

  init = (): void => {
    if (this.#transportUnsubscribers.length > 0) return;
    const status = this.runtime?.onData?.((data) => {
      if (!isRecord(data) || data.task !== 'runtime:state' || !isRecord(data.payload)) return;
      this.#configuring = data.payload.configuring === true;
      if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
    });
    this.#transportUnsubscribers = [
      ...(status ? [status] : []),
      this.database.onData((data) => {
        const requestId = this.#active;
        void this.#handleDatabase(data).catch((error: unknown) => {
          if (requestId === this.#active) this.#fail(error);
        });
      }),
      this.chat.onData(this.#handleChat),
    ];
  };

  attach = (): (() => void) => {
    this.#attachedClients++;
    this.init();
    let attached = true;
    return () => {
      if (!attached) return;
      attached = false;
      if (--this.#attachedClients === 0) this.dispose();
    };
  };

  dispose = (): void => {
    if (this.#attachedClients > 0) return;
    this.reset();
    for (const disconnect of this.#transportUnsubscribers) disconnect();
    this.#transportUnsubscribers = [];
  };

  send = (question: string): void => {
    if (!question.trim() || this.stateSubscription.getValue()?.status !== 'ready') return;
    this.#question = question;
    this.#messages.push({ role: 'user', content: question }, { role: 'assistant', content: '' });
    this.#start();
  };

  readonly #start = (): void => {
    this.#active = crypto.randomUUID();
    this.stateSubscription.emit({ status: 'responding' });
    this.#publish();
    try {
      const requestId = this.#active;
      if (this.runtime)
        void this.runtime
          .begin(requestId)
          .then(() => {
            if (this.#active === requestId)
              this.database.send({ query: this.#question }, requestId);
            else this.runtime?.finish(requestId);
          })
          .catch((error: unknown) => {
            if (this.#active === requestId) {
              this.#runtimeFailed = true;
              this.#fail(error);
            }
          });
      else this.database.send({ query: this.#question }, requestId);
    } catch (error) {
      this.#fail(error);
    }
  };

  cancel = (): void => {
    if (!this.#active) return;
    const requestId = this.#active;
    this.#active = undefined;
    this.#cancelWork(requestId);
    this.#interrupt('Response interrupted.');
  };

  reset = (): void => {
    this.cancel();
    this.#question = undefined;
    this.#messages = [];
    this.chatModel.reset();
    this.#publish();
    if (this.#chatReady && this.#databaseReady && !this.#runtimeFailed) this.#ready();
  };

  retry = (): void => {
    if (this.stateSubscription.getValue()?.status !== 'error') return;
    if (this.#runtimeFailed) {
      void this.reconnect();
      return;
    }
    if (!this.#chatReady || !this.#databaseReady) {
      this.#ready();
      this.#retryFailedWorkers();
      return;
    }
    if (!this.#question) {
      this.#failedWorkers.clear();
      this.#ready();
      return;
    }
    this.#messages[this.#messages.length - 1] = { role: 'assistant', content: '' };
    this.#start();
  };

  reconnect = (): Promise<void> => {
    this.#recovery ??= this.#reconnect().finally(() => {
      this.#recovery = undefined;
    });
    return this.#recovery;
  };

  readonly #reconnect = async (): Promise<void> => {
    if (!this.runtime) {
      this.retry();
      return;
    }
    try {
      await this.runtime.reconnect();
      this.#runtimeFailed = false;
      this.#failedWorkers.clear();
      this.#ready();
    } catch {
      this.#runtimeFailed = true;
      this.#interrupt('Something went wrong');
    }
  };

  readonly #cancelWork = (requestId: string): void => {
    try {
      this.chat.send({}, requestId, 'cancel');
    } catch {
      /* Transport failure is already reported. */
    }
    try {
      this.database.send({}, requestId, 'cancel');
    } catch {
      /* Transport failure is already reported. */
    }
    this.runtime?.finish(requestId);
  };

  #retryFailedWorkers(): void {
    const failed = [...this.#failedWorkers];
    this.#failedWorkers.clear();
    for (const worker of failed) {
      if (worker === 'llm') this.chat.initialize();
      else this.database.initialize();
    }
  }

  readonly #ready = (): void => {
    this.stateSubscription.emit({
      status:
        this.#chatReady && this.#databaseReady && !this.#configuring ? 'ready' : 'initializing',
    });
  };

  readonly #publish = (): void => {
    this.chatMessagesSubscription.emit(this.#messages.map((message) => ({ ...message })));
  };

  readonly #interrupt = (error: string): void => {
    const answer = this.#messages.at(-1);
    if (answer?.role === 'assistant') answer.interrupted = true;
    this.stateSubscription.emit({
      status: 'error',
      error,
      ...(this.#runtimeFailed ? { runtimeFailure: true } : {}),
    });
    this.#publish();
  };

  readonly #fail = (error: unknown): void => {
    const active = this.#active;
    this.#active = undefined;
    if (active) this.#cancelWork(active);
    const message =
      isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
    this.#interrupt(this.#runtimeFailed ? 'Something went wrong' : message);
  };

  #accept(data: unknown): data is Record<string, unknown> {
    if (!isRecord(data)) return false;
    if (this.#handleLoading(data.task)) return false;
    this.#observeRuntimeFailure(data);
    if (this.#handleReady(data.task)) return false;
    if (this.#handleInitializationError(data)) return false;
    const current = Boolean(this.#active) && data.requestId === this.#active;
    if (this.#handleResponseError(data, current)) return false;
    return current;
  }

  #observeRuntimeFailure(data: Record<string, unknown>): void {
    if (data.runtimeFailure === true && data.error) this.#runtimeFailed = true;
  }
  #handleResponseError(data: Record<string, unknown>, current: boolean): boolean {
    if (!data.error || (!current && data.requestId)) return false;
    this.#fail(data.error);
    return true;
  }

  #handleLoading(task: unknown): boolean {
    if (task !== 'llm:loading' && task !== 'vectordb:loading') return false;
    if (task === 'llm:loading') this.#chatReady = false;
    else this.#databaseReady = false;
    if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
    return true;
  }

  #handleInitializationError(data: Record<string, unknown>): boolean {
    if (!data.error) return false;
    if (data.task !== 'llm:init' && data.task !== 'vectordb:init') return false;
    const worker = data.task === 'llm:init' ? 'llm' : 'vectordb';
    this.#failedWorkers.add(worker);
    if (worker === 'llm') this.#chatReady = false;
    else this.#databaseReady = false;
    this.#fail(data.error);
    return true;
  }

  #handleReady(task: unknown): boolean {
    if (task !== 'llm:ready' && task !== 'vectordb:ready') return false;
    if (task === 'llm:ready') this.#chatReady = true;
    else this.#databaseReady = true;
    if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
    return true;
  }

  #context(response: unknown, chunks: Chunk[]): Chunk[] {
    if (!isRecord(response) || !Array.isArray(response.neighbors))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid retrieval response`);
    return response.neighbors.flatMap((index: unknown) =>
      typeof index === 'number' && chunks[index] ? [chunks[index]] : [],
    );
  }

  async #handleDatabase(data: unknown): Promise<void> {
    if (!this.#accept(data)) return;
    if (data.task !== 'vectordb:query:response' || !isRecord(data.payload)) return;
    const requestId = this.#active;
    const chunks = await this.repo.getChunksAsync('/content-data/chunks.json');
    if (this.#active !== requestId) return;
    const context = this.#context(data.payload.response, chunks);
    this.chatModel.reset();
    for (const message of this.#messages.slice(0, -2)) {
      if (!message.interrupted) this.chatModel.populate(message);
    }
    if (this.#question === undefined) return;
    this.chatModel.createNewUserEntry(context, this.#question);
    this.chat.send({ message: this.chatModel.getMsg() }, requestId);
  }

  readonly #handleChat = (data: unknown): void => {
    if (!this.#accept(data)) return;
    const answer = this.#messages.at(-1);
    if (!answer) return;
    if (data.task === 'llm:stream:response' && typeof data.payload === 'string')
      answer.content += data.payload;
    if (data.task === 'llm:message:response') {
      const text = this.#finalText(data.payload);
      if (text !== undefined) answer.content = text;
      this.#finishResponse();
      this.#active = undefined;
      this.#ready();
    }
    this.#publish();
  };

  readonly #finishResponse = (): void => {
    if (this.#active) this.runtime?.finish(this.#active);
  };

  #finalText(payload: unknown): string | undefined {
    if (!isRecord(payload)) return undefined;
    if (typeof payload.generated_text === 'string') return payload.generated_text;
    if (!Array.isArray(payload.generated_text)) return undefined;
    const message: unknown = payload.generated_text.at(-1);
    return isRecord(message) && message.role === 'assistant' && typeof message.content === 'string'
      ? message.content
      : undefined;
  }
}
