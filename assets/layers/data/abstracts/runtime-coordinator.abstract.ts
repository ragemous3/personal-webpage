import { isRuntimeMessage } from '@/layers/data/guards/is-runtime-message.guard';
import { type RuntimeCoordinatorConnection } from '@/layers/data/runtime-coordinator.connection';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  defaultRuntimePolicy,
  type RuntimeMessage,
  type RuntimeRole,
} from '@/layers/shared/models/runtime.model';
import { createStatefulSubscribable, createSubscribable } from '@/layers/shared/utils/subscribable';

export abstract class RuntimeCoordinatorAbstract implements RuntimeCoordinatorContract {
  readonly $isReady = createStatefulSubscribable(false);
  readonly #data = createSubscribable<unknown>();
  readonly #channels = new Map<string, RuntimeMessage>();
  readonly #replay = new Map<string, RuntimeMessage>();
  readonly #pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  readonly #operations = new Map<string, ReturnType<typeof setTimeout>>();
  #attachmentTimer: ReturnType<typeof setTimeout> | undefined;
  #terminalFailure = false;
  #hostingVersion = 0;
  #recovery: Promise<void> | undefined;
  constructor(protected readonly connection: RuntimeCoordinatorConnection) {
    connection.listen(this.#receive);
  }
  initialize = (): void => {
    this.#startAttachment();
    try {
      this.connection.connect();
    } catch (error) {
      this.#failure(String(error));
    }
  };
  onData = (listener: (data: unknown) => void): (() => void) => {
    const disconnect = this.#data.connect(listener);
    for (const message of this.#replay.values()) listener(message);
    return disconnect;
  };
  host = (message: RuntimeMessage): void => {
    this.#channels.set(message.id, message);
    if (this.#terminalFailure || !this.connection.carrier) {
      this.#channelFailure(message);
      return;
    }
    if (this.$isReady.getValue()) this.connection.control('runtime:host', message);
  };
  send = (message: RuntimeMessage): void => {
    if (!this.$isReady.getValue()) throw new Error('Something went wrong');
    const operation =
      message.requestId && this.#operations.has(message.requestId)
        ? { operationId: message.requestId }
        : {};
    this.connection.control('runtime:send', { ...message, ...operation });
  };
  release = (id: string, role: string): void => {
    this.#channels.delete(id);
    this.#replay.delete(`${id}:status`);
    if (this.connection.carrier) this.connection.control('runtime:release', { id, role });
  };
  begin = async (requestId: string): Promise<void> => {
    await this.#command('runtime:begin', { requestId });
    clearTimeout(this.#operations.get(requestId));
    this.#operations.set(
      requestId,
      setTimeout(
        () => this.#failure('Accepted response deadline exceeded'),
        this.connection.policy.requestMs ?? defaultRuntimePolicy.requestMs,
      ),
    );
  };
  finish = (requestId: string): void => {
    clearTimeout(this.#operations.get(requestId));
    this.#operations.delete(requestId);
    if (this.connection.carrier) this.connection.control('runtime:finish', { requestId });
  };
  configure = (configurations: Partial<Record<RuntimeRole, unknown>>): Promise<void> =>
    this.#command(
      'runtime:configure',
      { configurations },
      this.connection.policy.initializationMs ?? defaultRuntimePolicy.initializationMs,
    );
  reconnect = (): Promise<void> => {
    this.#recovery ??= this.#recover().finally(() => {
      this.#recovery = undefined;
    });
    return this.#recovery;
  };
  readonly #recover = async (): Promise<void> => {
    this.$isReady.emit(false);
    this.#rejectPending();
    this.#replay.clear();
    this.#terminalFailure = false;
    this.#startAttachment();
    this.connection.reconnect();
    this.#rehost();
    await this.#command(
      'runtime:recover',
      null,
      this.connection.policy.initializationMs ?? defaultRuntimePolicy.initializationMs,
    );
  };
  readonly #command = (
    task: RuntimeMessage['task'],
    payload: unknown,
    timeoutMs = this.connection.policy.connectionMs ?? defaultRuntimePolicy.connectionMs,
  ): Promise<void> => {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        this.#failure('Coordinator response deadline exceeded');
        reject(new Error('Something went wrong'));
      }, timeoutMs);
      this.#pending.set(requestId, { resolve, reject, timer });
      try {
        this.connection.control(task, payload, requestId);
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  readonly #startAttachment = (): void => {
    clearTimeout(this.#attachmentTimer);
    this.#attachmentTimer = setTimeout(
      () => this.#failure('Coordinator attachment deadline exceeded'),
      this.connection.policy.connectionMs ?? defaultRuntimePolicy.connectionMs,
    );
  };
  readonly #receive = (message: RuntimeMessage): void => {
    this.#observeTransport(message);
    if (message.requestId && message.name === 'coordinator') this.#receiveCommand(message);
    if (message.task === 'runtime:failed' && !message.requestId) {
      this.#failure('Coordinator transport failed');
      return;
    }
    if (message.task === 'runtime:state') this.#receiveState(message);
    if (message.task === 'runtime:event' && isRuntimeMessage(message.payload))
      this.#emit(message.payload);
  };
  readonly #observeTransport = (message: RuntimeMessage): void => {
    if (message.task === 'runtime:attach') {
      this.$isReady.emit(false);
      this.#startAttachment();
    }
    if (message.task !== 'runtime:detach') return;
    this.$isReady.emit(false);
    clearTimeout(this.#attachmentTimer);
    if (this.#operations.size > 0) this.#failure('Client departed during accepted work');
  };
  readonly #rehost = (): void => {
    if (this.#hostingVersion === this.connection.attachmentVersion) return;
    this.#hostingVersion = this.connection.attachmentVersion;
    for (const message of this.#channels.values()) this.connection.control('runtime:host', message);
  };
  readonly #receiveCommand = (message: RuntimeMessage): void => {
    const pending = this.#pending.get(message.requestId ?? '');
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(message.requestId ?? '');
    if (message.task === 'runtime:failed') pending.reject(new Error('Something went wrong'));
    else pending.resolve();
  };
  readonly #receiveState = (message: RuntimeMessage): void => {
    clearTimeout(this.#attachmentTimer);
    this.#terminalFailure = false;
    this.#rehost();
    this.$isReady.emit(true);
    this.#replay.set('state', message);
    this.#data.emit(message);
    if (!isRecord(message.payload) || !Array.isArray(message.payload.resources)) return;
    for (const model of message.payload.resources) this.#receiveResource(model);
  };
  readonly #receiveResource = (model: unknown): void => {
    if (
      !isRecord(model) ||
      !['connecting', 'loading', 'uninitialized'].includes(String(model.status))
    )
      return;
    for (const channel of this.#channels.values())
      if (channel.name === model.role)
        this.#emit({ ...channel, task: `${channel.name}:loading`, payload: null });
  };
  readonly #emit = (message: RuntimeMessage): void => {
    this.#diagnostic(message);
    if (
      message.task.endsWith(':ready') ||
      message.task.endsWith(':loading') ||
      (message.error && !message.requestId)
    )
      this.#replay.set(`${message.id}:status`, message);
    else if (message.task.includes(':progress'))
      this.#replay.set(`${message.name}:progress`, message);
    this.#data.emit(message);
  };
  readonly #diagnostic = (message: RuntimeMessage): void => {
    if (
      message.error &&
      isRecord(message.payload) &&
      typeof message.payload.diagnostic === 'string'
    )
      console.error('Runtime resource failure:', message.name, message.payload.diagnostic);
  };
  readonly #channelFailure = (channel: RuntimeMessage): void => {
    this.#emit({ ...channel, error: { message: 'Something went wrong' }, runtimeFailure: true });
  };
  readonly #rejectPending = (): void => {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Something went wrong'));
    }
    this.#pending.clear();
  };
  readonly #failure = (_reason: string): void => {
    clearTimeout(this.#attachmentTimer);
    this.#terminalFailure = true;
    this.$isReady.emit(false);
    this.#rejectPending();
    for (const timer of this.#operations.values()) clearTimeout(timer);
    this.#operations.clear();
    for (const channel of this.#channels.values()) this.#channelFailure(channel);
  };
}
