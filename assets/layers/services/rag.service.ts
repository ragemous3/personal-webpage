import { type ChatMessageModelContract } from '@/layers/data/contracts/chat-model.contract';
import { type ChatMessage, type Chunk } from '@/layers/data/models/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ChatGenerationContract } from '@/layers/shared/contracts/chat-generation.contract';
import { type ChatSessionContract } from '@/layers/shared/contracts/chat-session.contract';
import {
  type ChatbotServiceContract,
  type ChatLifecycleEvent,
  type ChatState,
} from '@/layers/shared/contracts/chatbot-service.contract';
import { type ContentRepositoryContract } from '@/layers/shared/contracts/content-repository.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type ChatGenerationState } from '@/layers/shared/models/chat-generation.model';
import { createIsolatedSubscribable } from '@/layers/shared/utils/isolated-subscribable.utility';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

export class RagService implements ChatbotServiceContract {
  readonly #lifecycle = createIsolatedSubscribable<ChatLifecycleEvent>();
  readonly lifecycleSubscription = { connect: this.#lifecycle.connect };
  readonly chatMessagesSubscription = createStatefulSubscribable<ChatMessage[]>([]);
  readonly stateSubscription = createStatefulSubscribable<ChatState>({ status: 'initializing' });
  #transportUnsubscribers: Array<() => void> = [];
  #attachedClients = 0;
  #chatReady = false;
  #databaseReady = false;
  readonly #failedResources = new Set<'chat' | 'database'>();
  #active: string | undefined;
  #question: string | undefined;
  #messages: ChatMessage[] = [];
  #recovery: Promise<void> | undefined;
  #runtimeFailed = false;
  #configuring = false;
  #available = true;
  #runtimeAvailable = true;
  #historyReady = false;
  #restoring = false;
  #storageFailed = false;
  #storageRecovery = false;
  #clearing = false;
  #revision = 0;
  #writes: Promise<void> = Promise.resolve();
  #lease: string | undefined;

  constructor(
    private readonly chat: ChatGenerationContract,
    private readonly database: StandardCommunicationContract,
    private readonly repo: ContentRepositoryContract,
    private readonly chatModel: ChatMessageModelContract,
    private readonly session: ChatSessionContract,
  ) {}

  get runtime(): ChatSessionContract['runtime'] {
    return this.session.runtime;
  }

  init = (): void => {
    if (this.#transportUnsubscribers.length > 0) return;
    if (!this.#historyReady) void this.#restore();
    const status = this.runtime?.onData?.((data) => {
      if (!isRecord(data) || data.task !== 'runtime:state' || !isRecord(data.payload)) return;
      this.#configuring = data.payload.configuring === true;
      if (isRecord(data.payload.activeSelection))
        this.#runtimeAvailable = data.payload.activeSelection.enabled !== false;
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
      this.chat.stateSubscription.connect(this.#handleChatState),
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
    this.cancel();
    for (const disconnect of this.#transportUnsubscribers) disconnect();
    this.#transportUnsubscribers = [];
  };

  whenSettled = async (): Promise<void> => {
    let pending;
    do {
      pending = this.#writes;
      await pending;
    } while (pending !== this.#writes);
  };

  setAvailable = (available: boolean): void => {
    this.#lifecycle.emit(available ? 'available' : 'unavailable');
    this.#available = available;
    if (available) {
      this.#runtimeFailed = false;
      this.#failedResources.clear();
    }
    if (!this.#active) this.#ready();
  };

  send = (question: string): void => {
    if (!question.trim() || this.stateSubscription.getValue()?.status !== 'ready') return;
    this.#lifecycle.emit('invalidate');
    this.#question = question;
    this.#messages.push({ role: 'user', content: question }, { role: 'assistant', content: '' });
    this.#start();
  };

  readonly #start = (): void => {
    this.#active = crypto.randomUUID();
    this.stateSubscription.emit({ status: 'responding' });
    const requestId = this.#active;
    this.#lease = requestId;
    void this.#begin(requestId);
  };

  async #begin(requestId: string): Promise<void> {
    try {
      await this.runtime?.begin(requestId);
      if (this.#active !== requestId) {
        this.#finishObsoleteRequest(requestId);
        return;
      }
      await this.#persist();
      if (this.#active === requestId && !this.#storageFailed)
        this.database.send({ query: this.#question }, requestId);
    } catch (error) {
      if (this.#active !== requestId) return;
      this.#runtimeFailed = true;
      this.#fail(error);
    }
  }

  #finishObsoleteRequest(requestId: string): void {
    if (this.#lease === requestId) return;
    this.runtime?.finish(requestId);
  }

  cancel = (): void => {
    this.#lifecycle.emit('invalidate');
    if (!this.#active) return;
    const requestId = this.#active;
    this.#active = undefined;
    this.#cancelWork(requestId);
    this.#interrupt('Response interrupted.');
  };

  reset = (): void => {
    this.#lifecycle.emit('invalidate');
    const requestId = this.#lease;
    const failure = this.stateSubscription.getValue();
    const active = this.#active;
    this.#active = undefined;
    if (active) this.#cancelWork(active);
    this.#revision++;
    const revision = this.#revision;
    this.#question = undefined;
    this.#messages = [];
    this.chatModel.reset();
    this.#clearing = true;
    this.#storageFailed = false;
    this.#storageRecovery = false;
    this.#publish();
    this.stateSubscription.emit(
      this.#failedResources.size > 0 && failure ? failure : { status: 'initializing' },
    );
    void this.#persist(true).then(() => {
      if (revision !== this.#revision || this.#storageFailed) return;
      this.#historyReady = true;
      this.#clearing = false;
      this.#finishResponse(requestId);
      this.#ready();
    });
  };

  retry = (): void => {
    if (this.stateSubscription.getValue()?.status !== 'error') return;
    if (this.#storageFailed) {
      void this.#retrySaving();
      return;
    }
    if (this.#lease) {
      void this.#writes.then(() => this.retry());
      return;
    }
    if (this.#runtimeFailed) {
      void this.reconnect();
      return;
    }
    this.#retryGeneration();
  };

  #retryGeneration(): void {
    if (!this.#chatReady || !this.#databaseReady) {
      this.#retryFailedResources();
      this.#ready();
      return;
    }
    if (!this.#question) {
      this.#failedResources.clear();
      this.#ready();
      return;
    }
    this.#messages[this.#messages.length - 1] = { role: 'assistant', content: '' };
    this.#start();
  }

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
      await this.whenSettled();
      await this.runtime.reconnect();
      this.#runtimeFailed = false;
      this.#failedResources.clear();
      this.#ready();
    } catch {
      this.#runtimeFailed = true;
      this.#interrupt('Something went wrong');
    }
  };

  readonly #cancelWork = (requestId: string): void => {
    try {
      this.chat.cancel(requestId);
    } catch {
      /* Transport failure is already reported. */
    }
    try {
      this.database.send({}, requestId, 'cancel');
    } catch {
      /* Transport failure is already reported. */
    }
  };

  #retryFailedResources(): void {
    const failed = [...this.#failedResources];
    this.#failedResources.clear();
    for (const worker of failed) {
      if (worker === 'chat') this.chat.initialize();
      else this.database.initialize();
    }
  }

  readonly #ready = (): void => {
    if (this.#lease || this.#storageFailed) return;
    const failure = this.#resourceFailure();
    if (failure) {
      this.stateSubscription.emit(failure);
      return;
    }
    this.stateSubscription.emit({
      status:
        this.#available && this.#storageReady() && this.#runtimeAvailable && this.#resourcesReady()
          ? 'ready'
          : 'initializing',
    });
  };

  #resourceFailure(): ChatState | undefined {
    if (this.#runtimeFailed)
      return { status: 'error', error: 'Something went wrong', runtimeFailure: true };
    if (this.#failedResources.size === 0) return;
    const current = this.stateSubscription.getValue();
    const message = 'Model initialization failed. Retry.';
    return {
      status: 'error',
      error: current?.storageFailure ? message : (current?.error ?? message),
    };
  }

  #storageReady(): boolean {
    return this.#historyReady && !this.#storageFailed && !this.#clearing && !this.#storageRecovery;
  }

  #resourcesReady(): boolean {
    return this.#chatReady && this.#databaseReady && !this.#configuring;
  }

  readonly #publish = (): void => {
    this.chatMessagesSubscription.emit(this.#messages.map((message) => ({ ...message })));
  };

  readonly #interrupt = (error: string): void => {
    if (this.#storageFailed) {
      this.#storageFailure();
      return;
    }
    const revision = this.#revision;
    const requestId = this.#lease;
    const answer = this.#messages.at(-1);
    if (answer?.role === 'assistant') answer.interrupted = true;
    this.stateSubscription.emit({
      status: 'error',
      error,
      ...(this.#runtimeFailed ? { runtimeFailure: true } : {}),
    });
    if (!this.#historyReady) return;
    void this.#persist()
      .then(() => this.whenSettled())
      .then(() => {
        if (revision === this.#revision && !this.#storageFailed) this.#finishResponse(requestId);
      });
  };

  readonly #fail = (error: unknown): void => {
    this.#lifecycle.emit('invalidate');
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
    if (data.requestId !== undefined && data.requestId !== this.#active) return;
    if (data.runtimeFailure === true && data.error) this.#runtimeFailed = true;
  }
  #handleResponseError(data: Record<string, unknown>, current: boolean): boolean {
    if (!data.error || (!current && data.requestId)) return false;
    this.#fail(data.error);
    return true;
  }

  #handleLoading(task: unknown): boolean {
    if (task !== 'vectordb:loading') return false;
    this.#databaseReady = false;
    if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
    return true;
  }

  #handleInitializationError(data: Record<string, unknown>): boolean {
    if (!data.error || data.task !== 'vectordb:init') return false;
    this.#failedResources.add('database');
    this.#databaseReady = false;
    this.#fail(data.error);
    return true;
  }

  #handleReady(task: unknown): boolean {
    if (task !== 'vectordb:ready') return false;
    this.#failedResources.delete('database');
    this.#databaseReady = true;
    if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
    return true;
  }

  readonly #handleChatState = (state: ChatGenerationState): void => {
    this.#chatReady = state.ready;
    if (state.error) {
      this.#failedResources.add('chat');
      if (state.runtimeFailure) this.#runtimeFailed = true;
      this.#fail(new Error(state.error));
      return;
    }
    if (state.ready) this.#failedResources.delete('chat');
    if (!this.#active && this.stateSubscription.getValue()?.status !== 'error') this.#ready();
  };

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
    if (!requestId) return;
    const chunks = await this.repo.getChunksAsync('/content-data/chunks.json');
    if (this.#active !== requestId) return;
    if (this.#question === undefined) return;
    const context = this.#context(data.payload.response, chunks);
    this.#prepareMessages(context, this.#question);
    void this.#generate(this.chatModel.getMsg(), requestId);
  }

  #prepareMessages(context: Chunk[], question: string): void {
    this.chatModel.reset();
    for (const message of this.#messages.slice(0, -2)) {
      if (!message.interrupted) this.chatModel.populate(message);
    }
    this.chatModel.createNewUserEntry(context, question);
  }

  async #generate(messages: readonly ChatMessage[], requestId: string): Promise<void> {
    try {
      const text = await this.chat.generate(
        messages,
        (chunk) => this.#appendText(chunk, requestId),
        requestId,
      );
      await this.#completeGeneration(text, requestId);
    } catch (error) {
      if (this.#active !== requestId) return;
      if (isRecord(error) && error.runtimeFailure === true) this.#runtimeFailed = true;
      this.#fail(error);
    }
  }

  #appendText(chunk: string, requestId: string): void {
    if (this.#active !== requestId || this.#storageFailed) return;
    const answer = this.#messages.at(-1);
    if (!answer) return;
    answer.content += chunk;
    void this.#persist();
  }

  async #completeGeneration(text: string, requestId: string): Promise<void> {
    if (this.#active !== requestId) return;
    const answer = this.#messages.at(-1);
    if (!answer) return;
    const revision = this.#revision;
    answer.content = text;
    this.#active = undefined;
    await this.#persist();
    await this.whenSettled();
    if (revision !== this.#revision || this.#storageFailed) return;
    this.#finishResponse(requestId);
    if (this.stateSubscription.getValue()?.status === 'responding') this.#ready();
  }

  readonly #finishResponse = (requestId: string | undefined): void => {
    if (!requestId) return;
    this.runtime?.finish(requestId);
    if (this.#lease === requestId) this.#lease = undefined;
  };

  async #restore(): Promise<void> {
    if (this.#restoring) return;
    this.#restoring = true;
    const revision = this.#revision;
    try {
      const messages = await this.session.history.load(this.session.conversationId);
      if (revision !== this.#revision) return;
      this.#messages = messages;
      this.#historyReady = true;
      this.#storageFailed = false;
      this.#publish();
      if (this.#failedResources.size === 0 && !this.#runtimeFailed) this.#ready();
    } catch {
      if (revision === this.#revision) this.#storageFailure();
    } finally {
      this.#restoring = false;
    }
  }

  #persist(clear = false): Promise<void> {
    const revision = this.#revision;
    const snapshot = this.#messages.map((message) => ({ ...message }));
    const stored = structuredClone(snapshot);
    const last = stored.at(-1);
    if (this.#active && last?.role === 'assistant') last.interrupted = true;
    this.#writes = this.#writes
      .then(async () => {
        if (revision !== this.#revision || this.#storageFailed) return;
        await (clear
          ? this.session.history.clear(this.session.conversationId)
          : this.session.history.save(this.session.conversationId, stored));
        if (revision === this.#revision) this.chatMessagesSubscription.emit(snapshot);
      })
      .catch(() => {
        if (revision === this.#revision) this.#storageFailure();
      });
    return this.#writes;
  }

  #storageFailure(): void {
    this.#lifecycle.emit('invalidate');
    this.#storageFailed = true;
    const active = this.#active;
    this.#active = undefined;
    if (active) this.#cancelWork(active);
    const answer = this.#messages.at(-1);
    if (answer?.role === 'assistant') answer.interrupted = true;
    this.stateSubscription.emit({
      status: 'error',
      error: 'Could not save conversation. Retry saving before continuing.',
      storageFailure: true,
      ...(this.#runtimeFailed ? { runtimeFailure: true } : {}),
    });
  }

  async #retrySaving(): Promise<void> {
    if (this.#storageRecovery) return;
    const revision = this.#revision;
    const requestId = this.#lease;
    this.#storageRecovery = true;
    try {
      await this.#recoverStorage(revision);
      if (revision !== this.#revision || this.#storageFailed) return;
      this.#clearing = false;
      this.#historyReady = true;
      this.#finishResponse(requestId);
    } finally {
      if (revision === this.#revision) {
        this.#storageRecovery = false;
        this.#ready();
      }
    }
  }

  async #recoverStorage(revision: number): Promise<void> {
    if (!this.#historyReady && !this.#clearing) {
      await this.#restore();
      return;
    }
    await this.#writes;
    if (revision !== this.#revision) return;
    this.#storageFailed = false;
    await this.#persist(this.#clearing);
  }
}
