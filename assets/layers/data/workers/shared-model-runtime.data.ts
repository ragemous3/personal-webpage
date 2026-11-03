import { isRuntimeMessage } from '@/layers/data/guards/is-runtime-message.guard';
import { type RuntimeMessage, type RuntimeRole } from '@/layers/shared/models/runtime.model';

export interface SharedModelDriver {
  handle(event: MessageEvent<RuntimeMessage>): Promise<void>;
  dispose(): Promise<void>;
}
type DriverFactory = (publish: (message: unknown) => void) => SharedModelDriver;
interface ModelWork {
  port: MessagePort;
  message: RuntimeMessage;
  generation: number;
  cancelled: boolean;
  promise: Promise<void>;
}
const requestKey = (message: RuntimeMessage): string =>
  `${message.id}:${message.requestId ?? 'initialization'}`;

const describeFailure = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  return error.cause === undefined
    ? error.message
    : `${error.message}: ${describeFailure(error.cause)}`;
};

export class SharedModelRuntime {
  readonly instanceId = crypto.randomUUID();
  readonly #ports = new Set<MessagePort>();
  readonly #unbound = new Map<MessagePort, ReturnType<typeof setTimeout>>();
  readonly #work = new Map<string, ModelWork>();
  #driver: SharedModelDriver;
  #generation = 0;
  #binding = 0;
  #bound: MessagePort | undefined;
  #epoch: string | undefined;
  #loaded = false;
  #disposalFailure: string | undefined;
  #disposal: Promise<void> | undefined;
  #configuration: unknown;

  constructor(
    readonly role: RuntimeRole,
    private readonly create: DriverFactory,
    private readonly registrationMs = 10_000,
  ) {
    this.#driver = this.#newDriver();
  }

  connect = (port: MessagePort): void => {
    this.#ports.add(port);
    this.#unbound.set(
      port,
      setTimeout(() => this.#drop(port), this.registrationMs),
    );
    port.addEventListener('close', () => this.#drop(port));
    port.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
      if (isRuntimeMessage(data))
        void this.#receive(port, data).catch((error: unknown) => this.#error(port, data, error));
    });
    port.start();
    port.postMessage({
      id: this.instanceId,
      name: this.role,
      task: 'runtime:state',
      payload: { role: this.role, instanceId: this.instanceId, loaded: this.#loaded },
    });
  };

  close = async (): Promise<void> => {
    this.#binding++;
    await this.#stopAll();
    await this.#disposal;
    await this.#driver.dispose();
    for (const port of this.#ports) this.#drop(port);
    this.#ports.clear();
  };

  readonly #drop = (port: MessagePort): void => {
    if (!this.#ports.has(port)) return;
    clearTimeout(this.#unbound.get(port));
    this.#unbound.delete(port);
    this.#ports.delete(port);
    port.close();
  };

  readonly #newDriver = (): SharedModelDriver => {
    const generation = ++this.#generation;
    return this.create((message: unknown) => this.#publish(message, generation));
  };

  readonly #reply = (
    port: MessagePort,
    message: RuntimeMessage,
    task: RuntimeMessage['task'],
    payload: unknown,
  ): void => {
    port.postMessage({ ...message, name: this.role, task, payload, instanceId: this.instanceId });
  };

  readonly #error = (port: MessagePort, message: RuntimeMessage, error: unknown): void => {
    port.postMessage({
      ...message,
      instanceId: this.instanceId,
      error: { message: describeFailure(error) },
    });
  };

  readonly #receive = async (port: MessagePort, message: RuntimeMessage): Promise<void> => {
    if (message.task === 'runtime:detach') {
      this.#drop(port);
      return;
    }
    if (message.task === 'runtime:bind') {
      await this.#bind(port, message);
      return;
    }
    if (port !== this.#bound) return;
    if (message.task === 'runtime:dispose') {
      await this.#disposeDriver(port, message);
      return;
    }
    await this.#receiveTask(port, message);
  };
  readonly #receiveTask = async (port: MessagePort, message: RuntimeMessage): Promise<void> => {
    if (message.runtimeEpoch !== this.#epoch || message.name !== this.role) return;
    if (this.#disposal) throw new Error('Model disposal is still in progress');
    if (message.task === `${this.role}:cancel`) await this.#cancel(message);
    else if (message.task === `${this.role}:init` || message.task === `${this.role}:query`)
      this.#start(port, message);
  };

  readonly #bind = async (port: MessagePort, message: RuntimeMessage): Promise<void> => {
    if (this.#disposalFailure) throw new Error(this.#disposalFailure);
    const binding = ++this.#binding;
    clearTimeout(this.#unbound.get(port));
    this.#unbound.delete(port);
    const previous = this.#bound;
    this.#bound = undefined;
    this.#epoch = message.runtimeEpoch;
    await this.#disposal;
    await this.#stopAll();
    if (binding !== this.#binding) return;
    if (previous && previous !== port) this.#drop(previous);
    this.#bound = port;
    this.#reply(port, message, 'runtime:bound', {
      instanceId: this.instanceId,
      loaded: this.#loaded,
      configuration: this.#configuration,
    });
  };

  readonly #stopAll = async (): Promise<void> => {
    const pending = [...this.#work.values()];
    for (const work of pending) {
      if (work.message.task === `${this.role}:query`) await this.#cancel(work.message);
    }
    await Promise.allSettled(pending.map((work) => work.promise));
  };

  readonly #cancel = async (message: RuntimeMessage): Promise<void> => {
    const work = this.#work.get(requestKey(message));
    if (!work || work.cancelled) return;
    work.cancelled = true;
    await this.#driver.handle(
      new MessageEvent('message', {
        data: { ...message, task: `${this.role}:cancel`, payload: {} },
      }),
    );
  };

  readonly #start = (port: MessagePort, message: RuntimeMessage): void => {
    const key = requestKey(message);
    if (this.#work.has(key)) return;
    const work: ModelWork = {
      port,
      message,
      generation: this.#generation,
      cancelled: false,
      promise: Promise.resolve(),
    };
    this.#work.set(key, work);
    if (message.task === `${this.role}:query`)
      this.#reply(port, message, `${this.role}:started`, null);
    work.promise = this.#run(work);
  };

  readonly #run = async (work: ModelWork): Promise<void> => {
    try {
      await this.#driver.handle(new MessageEvent('message', { data: work.message }));
    } catch (error) {
      if (!work.cancelled) this.#error(work.port, work.message, error);
    } finally {
      if (work.cancelled) this.#reply(work.port, work.message, `${this.role}:stopped`, null);
      if (this.#work.get(requestKey(work.message)) === work)
        this.#work.delete(requestKey(work.message));
    }
  };

  readonly #publish = (value: unknown, generation: number): void => {
    if (!isRuntimeMessage(value)) return;
    const work = this.#work.get(requestKey(value));
    if (work?.generation !== generation || work.cancelled) return;
    if (value.task === `${this.role}:ready`) {
      this.#loaded = true;
      this.#configuration = work.message.payload;
    }
    if (value.error && work.message.task === `${this.role}:init`) this.#loaded = false;
    work.port.postMessage({
      ...value,
      instanceId: this.instanceId,
      runtimeEpoch: work.message.runtimeEpoch,
    });
  };

  readonly #disposeDriver = async (port: MessagePort, message: RuntimeMessage): Promise<void> => {
    const binding = ++this.#binding;
    this.#epoch = message.runtimeEpoch;
    const disposal = (this.#disposal ??= this.#resetDriver());
    try {
      await disposal;
    } finally {
      if (this.#disposal === disposal) this.#disposal = undefined;
    }
    if (binding !== this.#binding) return;
    this.#reply(port, message, 'runtime:disposed', { instanceId: this.instanceId, loaded: false });
  };
  readonly #resetDriver = async (): Promise<void> => {
    await this.#stopAll();
    this.#loaded = false;
    try {
      await this.#driver.dispose();
    } catch (error) {
      this.#disposalFailure = describeFailure(error);
      throw error;
    }
    this.#configuration = undefined;
    this.#driver = this.#newDriver();
  };
}
