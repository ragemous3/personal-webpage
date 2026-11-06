import { isRuntimeMessage as isMessage } from '@/layers/data/guards/is-runtime-message.guard';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  defaultRuntimePolicy,
  isRuntimeRole,
  type RuntimeMessage,
  type RuntimePolicy,
  type RuntimeResourceSnapshot,
  type RuntimeRole,
  type RuntimeSelection,
  type RuntimeSnapshot,
} from '@/layers/shared/models/runtime.model';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

interface RuntimeClient {
  id: ReturnType<typeof crypto.randomUUID>;
  attached: boolean;
  port: MessagePort;
  channels: Map<RuntimeRole, Set<ReturnType<typeof crypto.randomUUID>>>;
}
type RuntimeRequestMessage = RuntimeMessage & { requestId: string };
interface RuntimeRequest {
  key: string;
  client: RuntimeClient;
  message: RuntimeRequestMessage;
  timer: ReturnType<typeof setTimeout>;
  cancelled: boolean;
  activityTimer: ReturnType<typeof setTimeout> | undefined;
}
interface RuntimeResource {
  deferConfiguration?: boolean;
  role: RuntimeRole;
  status: RuntimeResourceSnapshot['status'];
  epoch: string;
  port?: MessagePort;
  instanceId?: string;
  configuration?: unknown;
  activeConfiguration?: unknown;
  error?: string;
  progress?: RuntimeMessage;
  active: RuntimeRequest | undefined;
  queue: RuntimeRequest[];
  phaseTimer: ReturnType<typeof setTimeout> | undefined;
}
const resource = (role: RuntimeRole): RuntimeResource => ({
  role,
  status: 'uninitialized',
  epoch: crypto.randomUUID(),
  active: undefined,
  queue: [],
  phaseTimer: undefined,
});
interface RuntimeLease {
  client: RuntimeClient;
  requestId: string;
  timer: ReturnType<typeof setTimeout>;
  lastMessage?: RuntimeMessage;
}
interface RuntimeCommand {
  selection?: RuntimeSelection;
  client: RuntimeClient;
  requestId: string;
  timer: ReturnType<typeof setTimeout>;
  configurations: Partial<Record<RuntimeRole, unknown>>;
}
const withoutGeneration = (value: unknown): unknown =>
  isRecord(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'generation'))
    : value;

export class RuntimeCoordinatorStateMachine {
  readonly runtimeId = crypto.randomUUID();
  readonly #clients = new Map<MessagePort, RuntimeClient>();
  readonly #resources: Record<RuntimeRole, RuntimeResource> = {
    llm: resource('llm'),
    vectordb: resource('vectordb'),
  };
  readonly #policy: RuntimePolicy;
  readonly #requests = new Map<string, RuntimeRequest>();
  readonly #leases = new Map<string, RuntimeLease>();
  readonly #configurationQueue: RuntimeCommand[] = [];
  readonly #recoveries = new Map<string, RuntimeCommand>();
  #configuration: RuntimeCommand | undefined;
  #selection: RuntimeSelection | undefined;
  #activeSelection: RuntimeSelection | undefined;

  constructor(policy: Partial<RuntimePolicy> = {}) {
    this.#policy = { ...defaultRuntimePolicy, ...policy };
  }

  connect = (port: MessagePort): void => {
    const client: RuntimeClient = {
      id: crypto.randomUUID(),
      attached: false,
      port,
      channels: new Map(),
    };
    this.#clients.set(port, client);
    port.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
      if (isMessage(data)) this.#handle(client, data);
    });
    if ('onclose' in port) port.addEventListener('close', () => this.#detach(client));
    port.start();
  };

  dispose = (): void => {
    for (const request of this.#requests.values()) {
      clearTimeout(request.timer);
      clearTimeout(request.activityTimer);
    }
    this.#requests.clear();
    for (const lease of this.#leases.values()) clearTimeout(lease.timer);
    for (const command of [...this.#configurationQueue, ...this.#recoveries.values()])
      clearTimeout(command.timer);
    if (this.#configuration) clearTimeout(this.#configuration.timer);
    this.#leases.clear();
    this.#configurationQueue.length = 0;
    this.#recoveries.clear();
    for (const client of this.#clients.values()) client.port.close();
    for (const model of Object.values(this.#resources)) {
      model.port?.close();
      clearTimeout(model.phaseTimer);
    }
    this.#clients.clear();
  };

  readonly #handle = (client: RuntimeClient, message: RuntimeMessage): void => {
    if (!this.#clients.has(client.port)) return;
    if (message.task === 'runtime:attach') {
      this.#attach(client, message);
      return;
    }
    if (!client.attached || message.id !== client.id) return;
    const handlers: Partial<Record<RuntimeMessage['task'], () => void>> = {
      'runtime:register': () => this.#register(message.payload),
      'runtime:host': () => this.#host(client, message.payload),
      'runtime:send': () => this.#route(client, message.payload),
      'runtime:detach': () => this.#detach(client),
      'runtime:failed': () => this.#nativeFailure(message.payload),
      'runtime:begin': () => this.#begin(client, message),
      'runtime:release': () => this.#release(client, message.payload),
      'runtime:finish': () => this.#end(client, message.payload),
      'runtime:configure': () => this.#configure(client, message),
      'runtime:recover': () => this.#recover(client, message),
    };
    handlers[message.task]?.();
    this.#advance();
  };

  readonly #attach = (client: RuntimeClient, message: RuntimeMessage): void => {
    for (const previous of this.#clients.values()) {
      if (previous !== client && previous.id === message.id && previous.attached)
        this.#detach(previous);
    }
    this.#configurePolicy(message.payload);
    client.id = message.id;
    client.attached = true;
    this.#sendSnapshot(client);
  };

  readonly #configurePolicy = (payload: unknown): void => {
    if ([...this.#clients.values()].some((entry) => entry.attached)) return;
    if (!Object.values(this.#resources).every((model) => model.status === 'uninitialized')) return;
    if (!isRecord(payload) || !isRecord(payload.policy)) return;
    for (const key of Object.keys(defaultRuntimePolicy) as Array<keyof RuntimePolicy>)
      this.#setPolicy(key, payload.policy[key]);
  };
  readonly #setPolicy = (key: keyof RuntimePolicy, value: unknown): void => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) this.#policy[key] = value;
  };

  readonly #nativeFailure = (payload: unknown): void => {
    if (!isRecord(payload) || !isRuntimeRole(payload.role)) return;
    const model = this.#resources[payload.role];
    if (typeof payload.instanceId !== 'string' || payload.instanceId !== model.instanceId) return;
    this.#failResource(
      model,
      typeof payload.reason === 'string' ? payload.reason : 'Model transport failed',
    );
  };

  readonly #detach = (client: RuntimeClient): void => {
    if (!this.#clients.has(client.port)) return;
    client.attached = false;
    this.#clients.delete(client.port);
    this.#cancelRequests((request) => request.client === client);
    for (const lease of this.#leases.values()) {
      if (lease.client === client) this.#end(client, { requestId: lease.requestId });
    }
    this.#discardCommands(client);
    client.channels.clear();
    client.port.close();
    this.#advance();
    this.#broadcastState();
  };

  readonly #cancelRequests = (matches: (request: RuntimeRequest) => boolean): void => {
    for (const request of this.#requests.values())
      if (matches(request) && isRuntimeRole(request.message.name))
        this.#cancel(this.#resources[request.message.name], request.key);
  };
  readonly #discardCommands = (client: RuntimeClient): void => {
    for (const [key, command] of this.#recoveries)
      if (command.client === client) {
        clearTimeout(command.timer);
        this.#recoveries.delete(key);
      }
    for (let index = this.#configurationQueue.length - 1; index >= 0; index--)
      if (this.#configurationQueue[index]?.client === client) {
        clearTimeout(this.#configurationQueue[index]?.timer);
        this.#configurationQueue.splice(index, 1);
      }
  };

  readonly #send = (
    client: RuntimeClient,
    task: RuntimeMessage['task'],
    payload: unknown,
    requestId?: string,
  ): void => {
    if (client.attached)
      client.port.postMessage({
        id: client.id,
        name: 'coordinator',
        task,
        payload,
        ...(requestId ? { requestId } : {}),
      });
  };

  readonly #sendSnapshot = (client: RuntimeClient): void => {
    const mountSelection = this.#configuration?.selection ?? this.#activeSelection;
    const snapshot: RuntimeSnapshot = {
      ...(mountSelection ? { mountSelection } : {}),
      ...(this.#selection ? { selection: this.#selection } : {}),
      ...(this.#activeSelection ? { activeSelection: this.#activeSelection } : {}),
      responding: this.#leases.size > 0 || this.#requests.size > 0,
      configurationLoading: Boolean(this.#configuration),
      runtimeId: this.runtimeId,
      configuring: Boolean(this.#configuration) || this.#configurationQueue.length > 0,
      resources: Object.values(this.#resources).map(
        ({ role, status, instanceId, error, configuration }) => ({
          role,
          status,
          ...(isRecord(configuration) && typeof configuration.revision === 'string'
            ? { revision: configuration.revision }
            : {}),
          ...(instanceId ? { instanceId } : {}),
          ...(error ? { error } : {}),
        }),
      ),
    };
    this.#send(client, 'runtime:state', snapshot);
  };

  readonly #broadcastState = (): void => {
    for (const client of this.#clients.values()) {
      if (client.attached) this.#sendSnapshot(client);
    }
  };

  readonly #register = (payload: unknown): void => {
    if (
      !isRecord(payload) ||
      !isRuntimeRole(payload.role) ||
      !(payload.port instanceof MessagePort) ||
      typeof payload.instanceId !== 'string'
    )
      return;
    const model = this.#resources[payload.role];
    if (model.port && model.status !== 'failed') {
      payload.port.close();
      return;
    }
    this.#registerPort(
      model,
      payload.port,
      payload.instanceId,
      payload.deferConfiguration === true,
    );
  };

  readonly #registerPort = (
    model: RuntimeResource,
    port: MessagePort,
    instanceId: string,
    deferConfiguration: boolean,
  ): void => {
    model.port?.close();
    model.deferConfiguration = deferConfiguration;
    if (model.deferConfiguration) model.configuration = undefined;
    model.port = port;
    model.instanceId = instanceId;
    model.epoch = crypto.randomUUID();
    model.status = 'connecting';
    clearTimeout(model.phaseTimer);
    model.phaseTimer = setTimeout(
      () => this.#failResource(model, 'Model connection deadline exceeded'),
      this.#policy.connectionMs,
    );
    model.port.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
      if (model.port === port && isMessage(data) && data.runtimeEpoch === model.epoch)
        this.#modelMessage(model, data);
    });
    model.port.start();
    model.port.postMessage({
      id: this.runtimeId,
      name: model.role,
      task: 'runtime:bind',
      payload: null,
      runtimeEpoch: model.epoch,
    });
    this.#broadcastState();
  };

  readonly #host = (client: RuntimeClient, payload: unknown): void => {
    if (!isMessage(payload) || !isRuntimeRole(payload.name)) return;
    let channels = client.channels.get(payload.name);
    if (!channels) {
      channels = new Set();
      client.channels.set(payload.name, channels);
    }
    channels.add(payload.id);
    const model = this.#resources[payload.name];
    model.configuration ??= payload.payload;
    this.#waitForRegistration(model);
    if (model.status === 'failed') this.#roleFailure(client, model, payload.id);
    else if (['ready', 'busy', 'stopping'].includes(model.status))
      this.#ready(client, model.role, payload.id);
    else this.#initialize(model);
    if (model.progress) this.#send(client, 'runtime:event', { ...model.progress, id: payload.id });
  };

  readonly #waitForRegistration = (model: RuntimeResource): void => {
    if (!model.port && !model.phaseTimer)
      model.phaseTimer = setTimeout(
        () => this.#failResource(model, 'Model registration deadline exceeded'),
        this.#policy.connectionMs,
      );
  };
  readonly #initialize = (model: RuntimeResource): void => {
    if (model.status !== 'uninitialized' || model.configuration === undefined || !model.port)
      return;
    model.status = 'loading';
    delete model.progress;
    clearTimeout(model.phaseTimer);
    model.phaseTimer = setTimeout(
      () => this.#failResource(model, 'Model initialization deadline exceeded'),
      this.#policy.initializationMs,
    );
    model.port.postMessage({
      id: this.runtimeId,
      name: model.role,
      task: `${model.role}:init`,
      payload: model.configuration,
      runtimeEpoch: model.epoch,
    });
    this.#broadcastState();
  };

  readonly #ready = (
    client: RuntimeClient,
    role: RuntimeRole,
    id: ReturnType<typeof crypto.randomUUID>,
  ): void => {
    this.#send(client, 'runtime:event', { id, name: role, task: `${role}:ready`, payload: null });
  };

  readonly #route = (client: RuntimeClient, payload: unknown): void => {
    if (!isMessage(payload) || !isRuntimeRole(payload.name)) return;
    if (!client.channels.get(payload.name)?.has(payload.id)) return;
    const role = payload.name;
    const message = { ...payload, requestId: payload.requestId ?? crypto.randomUUID() };
    const key = `${client.id}:${role}:${message.requestId}`;
    const model = this.#resources[role];
    if (message.task === `${role}:cancel`) {
      this.#cancel(model, key);
      return;
    }
    if (message.task === `${role}:query`) this.#routeQuery(model, client, message, key);
  };

  readonly #routeQuery = (
    model: RuntimeResource,
    client: RuntimeClient,
    message: RuntimeRequestMessage,
    key: string,
  ): void => {
    if (this.#validOperation(client, message)) this.#enqueue(model, client, message, key);
  };

  readonly #validOperation = (client: RuntimeClient, message: RuntimeRequestMessage): boolean => {
    if (message.operationId === undefined) return true;
    if (
      message.operationId === message.requestId &&
      this.#leases.has(`${client.id}:${message.operationId}`)
    )
      return true;
    this.#send(client, 'runtime:event', {
      ...message,
      error: { message: 'Something went wrong' },
      runtimeFailure: true,
    });
    return false;
  };

  readonly #enqueue = (
    model: RuntimeResource,
    client: RuntimeClient,
    message: RuntimeRequestMessage,
    key: string,
  ): void => {
    if (this.#requests.has(key)) return;
    if (
      (this.#configuration || this.#configurationQueue.length > 0) &&
      !this.#leases.has(`${client.id}:${message.requestId}`)
    ) {
      this.#send(client, 'runtime:event', {
        ...message,
        error: { message: 'Runtime configuration is changing' },
      });
      return;
    }
    const request: RuntimeRequest = {
      key,
      client,
      message,
      cancelled: false,
      activityTimer: undefined,
      timer: setTimeout(() => this.#expire(model, key), this.#policy.requestMs),
    };
    this.#requests.set(key, request);
    const lease = this.#leases.get(`${client.id}:${message.requestId}`);
    if (lease) lease.lastMessage = message;
    if (model.status === 'failed') {
      this.#finish(model, request, {
        ...message,
        error: { message: 'Something went wrong' },
        runtimeFailure: true,
      });
      return;
    }
    model.queue.push(request);
    this.#pump(model);
  };

  readonly #pump = (model: RuntimeResource): void => {
    if (model.active || model.status !== 'ready' || !model.port) return;
    const request = model.queue.shift();
    if (!request) return;
    model.active = request;
    model.status = 'busy';
    request.activityTimer = setTimeout(
      () => this.#expire(model, request.key),
      this.#policy.connectionMs,
    );
    model.port.postMessage({ ...request.message, runtimeEpoch: model.epoch });
    this.#broadcastState();
  };

  readonly #cancel = (model: RuntimeResource, key: string): void => {
    const request = this.#requests.get(key);
    if (!request) return;
    request.cancelled = true;
    if (request === model.active) {
      model.status = 'stopping';
      clearTimeout(request.activityTimer);
      request.activityTimer = setTimeout(
        () => this.#failResource(model, 'Cancellation stop deadline exceeded'),
        this.#policy.stoppingMs,
      );
      model.port?.postMessage({
        ...request.message,
        task: `${model.role}:cancel`,
        payload: {},
        runtimeEpoch: model.epoch,
      });
    } else
      this.#finish(model, request, {
        ...request.message,
        task: `${model.role}:stopped`,
        payload: null,
      });
  };

  readonly #finish = (
    model: RuntimeResource,
    request: RuntimeRequest,
    response: RuntimeMessage,
  ): void => {
    clearTimeout(request.timer);
    clearTimeout(request.activityTimer);
    this.#requests.delete(request.key);
    model.queue = model.queue.filter((entry) => entry !== request);
    this.#send(request.client, 'runtime:event', {
      ...response,
      id: request.message.id,
      requestId: request.message.requestId,
    });
    if (model.active !== request) return;
    model.active = undefined;
    if (model.status !== 'failed') model.status = 'ready';
    this.#pump(model);
  };

  readonly #expire = (model: RuntimeResource, key: string): void => {
    const request = this.#requests.get(key);
    if (!request) return;
    if (request === model.active) {
      this.#failResource(model, 'Request deadline exceeded');
      return;
    }
    this.#finish(model, request, {
      ...request.message,
      error: { message: 'Something went wrong' },
      runtimeFailure: true,
    });
    this.#advance();
    this.#broadcastState();
  };

  readonly #observeActivity = (model: RuntimeResource, request: RuntimeRequest): void => {
    if (!request.cancelled) {
      clearTimeout(request.activityTimer);
      request.activityTimer = setTimeout(
        () => this.#expire(model, request.key),
        this.#policy.silenceMs,
      );
    }
  };

  readonly #receiveWork = (model: RuntimeResource, message: RuntimeMessage): void => {
    const request = model.active;
    if (
      !request ||
      message.requestId !== request.message.requestId ||
      message.id !== request.message.id
    )
      return;
    this.#observeActivity(model, request);
    const terminal =
      Boolean(message.error) ||
      [
        `${model.role}:message:response`,
        `${model.role}:query:response`,
        `${model.role}:stopped`,
      ].includes(message.task);
    if (terminal) {
      this.#finish(
        model,
        request,
        request.cancelled ? { ...message, task: `${model.role}:stopped`, payload: null } : message,
      );
      return;
    }
    if (!request.cancelled) this.#send(request.client, 'runtime:event', message);
  };

  readonly #roleFailure = (
    client: RuntimeClient,
    model: RuntimeResource,
    id: ReturnType<typeof crypto.randomUUID>,
  ): void => {
    this.#send(client, 'runtime:event', {
      id,
      name: model.role,
      task: `${model.role}:init`,
      payload: { diagnostic: model.error },
      error: { message: 'Something went wrong' },
      runtimeFailure: true,
    });
  };

  readonly #publishFailure = (model: RuntimeResource): void => {
    for (const client of this.#clients.values())
      for (const id of client.channels.get(model.role) ?? []) this.#roleFailure(client, model, id);
  };
  readonly #cancelLease = (lease: RuntimeLease): void => {
    this.#cancelRequests(
      (request) => request.client === lease.client && request.message.requestId === lease.requestId,
    );
    this.#end(lease.client, { requestId: lease.requestId });
  };
  readonly #failResource = (model: RuntimeResource, reason: string): void => {
    if (model.status === 'failed') return;
    model.status = 'failed';
    model.error = reason;
    clearTimeout(model.phaseTimer);
    if (model.active)
      model.port?.postMessage({
        ...model.active.message,
        task: `${model.role}:cancel`,
        payload: {},
        runtimeEpoch: model.epoch,
      });
    model.epoch = crypto.randomUUID();
    model.port?.close();
    delete model.port;
    for (const request of [...this.#requests.values()].filter(
      (entry) => entry.message.name === model.role,
    )) {
      this.#finish(model, request, {
        ...request.message,
        error: { message: 'Something went wrong' },
        payload: { diagnostic: reason },
        runtimeFailure: true,
      });
    }
    this.#publishFailure(model);
    if (this.#requiredRole(model.role))
      for (const lease of this.#leases.values()) this.#cancelLease(lease);
    this.#advance();
    this.#broadcastState();
  };

  readonly #cannotBegin = (): boolean =>
    this.#activeSelection?.enabled === false ||
    Boolean(this.#configuration) ||
    this.#configurationQueue.length > 0 ||
    Object.values(this.#resources).some(
      (model) => model.configuration !== undefined && model.status === 'failed' && this.#requiredRole(model.role),
    );

  #requiredRole(role: RuntimeRole): boolean {
    const settings = this.#activeSelection?.settings;
    return role !== 'llm' || !isRecord(settings) || settings.mode !== 'online';
  }

  readonly #begin = (client: RuntimeClient, message: RuntimeMessage): void => {
    const payload = message.payload;
    if (!isRecord(payload) || typeof payload.requestId !== 'string') return;
    if (this.#cannotBegin()) {
      this.#send(client, 'runtime:failed', { message: 'Something went wrong' }, message.requestId);
      return;
    }
    const key = `${client.id}:${payload.requestId}`;
    if (!this.#leases.has(key)) {
      const requestId = payload.requestId;
      this.#leases.set(key, {
        client,
        requestId,
        timer: setTimeout(() => this.#expireLease(key), this.#policy.requestMs),
      });
    }
    this.#send(client, 'runtime:accepted', null, message.requestId);
  };

  readonly #release = (client: RuntimeClient, payload: unknown): void => {
    if (!isRecord(payload) || !isRuntimeRole(payload.role) || typeof payload.id !== 'string')
      return;
    client.channels.get(payload.role)?.delete(payload.id as ReturnType<typeof crypto.randomUUID>);
    this.#cancelRequests(
      (request) => request.client === client && request.message.id === payload.id,
    );
  };

  readonly #end = (client: RuntimeClient, payload: unknown): void => {
    if (!isRecord(payload) || typeof payload.requestId !== 'string') return;
    const key = `${client.id}:${payload.requestId}`;
    const lease = this.#leases.get(key);
    if (!lease) return;
    clearTimeout(lease.timer);
    this.#leases.delete(key);
  };

  readonly #expireLease = (key: string): void => {
    const lease = this.#leases.get(key);
    if (!lease) return;
    this.#cancelLease(lease);
    if (lease.lastMessage)
      this.#send(lease.client, 'runtime:event', {
        ...lease.lastMessage,
        error: { message: 'Something went wrong' },
        runtimeFailure: true,
      });
    this.#end(lease.client, { requestId: lease.requestId });
    this.#advance();
  };

  readonly #command = (
    client: RuntimeClient,
    message: RuntimeMessage,
    configurations: RuntimeCommand['configurations'],
  ): RuntimeCommand | undefined => {
    if (!message.requestId) return undefined;
    const requestId = message.requestId;
    const command: RuntimeCommand = {
      client,
      requestId,
      configurations,
      timer: setTimeout(() => this.#expireCommand(command), this.#policy.initializationMs),
    };
    return command;
  };

  readonly #expireCommand = (command: RuntimeCommand): void => {
    this.#recoveries.delete(`${command.client.id}:${command.requestId}`);
    const index = this.#configurationQueue.indexOf(command);
    if (index !== -1) this.#configurationQueue.splice(index, 1);
    if (this.#configuration === command) this.#failConfiguration(command);
    this.#replyCommand(command, 'runtime:failed', 'Operation deadline exceeded');
    this.#advance();
    this.#broadcastState();
  };
  readonly #failConfiguration = (command: RuntimeCommand): void => {
    this.#configuration = undefined;
    for (const role of ['llm', 'vectordb'] as const)
      if (command.configurations[role] !== undefined)
        this.#failResource(this.#resources[role], 'Configuration deadline exceeded');
  };

  readonly #configure = (client: RuntimeClient, message: RuntimeMessage): void => {
    if (!isRecord(message.payload) || !isRecord(message.payload.configurations)) return;
    const configurations: RuntimeCommand['configurations'] = {};
    for (const role of ['llm', 'vectordb'] as const) {
      if (message.payload.configurations[role] !== undefined)
        configurations[role] = message.payload.configurations[role];
    }
    const command = this.#command(client, message, configurations);
    if (!command) return;
    this.#selectCommand(command, message.payload.selection);
    this.#supersedeLocalInitialization(command);
    this.#configurationQueue.push(command);
    this.#broadcastState();
  };

  #supersedeLocalInitialization(command: RuntimeCommand): void {
    const current = this.#configuration;
    if (!current || !isRecord(command.selection?.settings)) return;
    if (command.selection.settings.mode !== 'online' || current.configurations.llm === undefined) return;
    this.#replyCommand(current, 'runtime:failed', 'Configuration superseded by Online selection');
    this.#configuration = undefined;
  }

  readonly #selectCommand = (command: RuntimeCommand, selection: unknown): void => {
    if (!isRecord(selection) || typeof selection.enabled !== 'boolean') return;
    command.selection = {
      enabled: selection.enabled,
      settings: selection.settings,
      selectionId: crypto.randomUUID(),
    };
    this.#selection = command.selection;
    for (const queued of this.#configurationQueue) {
      if (!queued.selection) continue;
      queued.configurations = command.configurations;
      queued.selection = command.selection;
    }
  };

  readonly #recover = (client: RuntimeClient, message: RuntimeMessage): void => {
    const command = this.#command(client, message, {});
    if (command) this.#recoveries.set(`${client.id}:${command.requestId}`, command);
  };

  readonly #replyCommand = (
    command: RuntimeCommand,
    task: RuntimeMessage['task'],
    error?: string,
  ): void => {
    clearTimeout(command.timer);
    this.#send(
      command.client,
      task,
      { ...(error ? { error, message: 'Something went wrong' } : {}) },
      command.requestId,
    );
  };

  readonly #advance = (): void => {
    this.#startConfiguration();
    this.#checkConfiguration();
    const configured = Object.values(this.#resources).filter(
      (model) => model.configuration !== undefined && this.#requiredRole(model.role),
    );
    for (const [key, command] of this.#recoveries) {
      if (configured.every((model) => ['ready', 'busy', 'stopping'].includes(model.status))) {
        this.#replyCommand(command, 'runtime:recovered');
        this.#recoveries.delete(key);
      }
    }
  };

  readonly #startConfiguration = (): void => {
    if (this.#configuration || this.#leases.size > 0 || this.#requests.size > 0) return;
    const command = this.#configurationQueue.shift();
    if (!command) return;
    this.#configuration = command;
    for (const role of ['llm', 'vectordb'] as const) {
      if (command.configurations[role] !== undefined)
        this.#changeConfiguration(this.#resources[role], command.configurations[role]);
    }
    this.#broadcastState();
    this.#checkConfiguration();
  };

  readonly #changeConfiguration = (model: RuntimeResource, configuration: unknown): void => {
    if (!model.port && model.status === 'failed') return;
    if (['loading', 'connecting'].includes(model.status) && areValuesEqual(configuration, model.configuration)) return;
    model.configuration = configuration;
    if (areValuesEqual(configuration, model.activeConfiguration) && model.status === 'ready')
      return;
    if (!model.port) {
      model.status = 'uninitialized';
      this.#waitForRegistration(model);
      return;
    }
    model.epoch = crypto.randomUUID();
    model.status = 'connecting';
    clearTimeout(model.phaseTimer);
    model.phaseTimer = setTimeout(
      () => this.#failResource(model, 'Configuration binding deadline exceeded'),
      this.#policy.connectionMs,
    );
    model.port.postMessage({
      id: this.runtimeId,
      name: model.role,
      task: 'runtime:bind',
      payload: null,
      runtimeEpoch: model.epoch,
    });
  };

  readonly #checkConfiguration = (): void => {
    const command = this.#configuration;
    if (!command) return;
    const changed = (['llm', 'vectordb'] as const)
      .filter((role) => command.configurations[role] !== undefined)
      .map((role) => this.#resources[role]);
    const failed = changed.some((model) => model.status === 'failed');
    if (!failed && !changed.every((model) => model.status === 'ready')) return;
    if (!failed && command.selection) this.#activeSelection = command.selection;
    this.#replyCommand(
      command,
      failed ? 'runtime:failed' : 'runtime:configured',
      failed ? 'Configuration failed' : undefined,
    );
    this.#configuration = undefined;
    this.#broadcastState();
    this.#startConfiguration();
  };

  readonly #bound = (model: RuntimeResource, message: RuntimeMessage): void => {
    clearTimeout(model.phaseTimer);
    if (!isRecord(message.payload) || message.payload.instanceId !== model.instanceId) {
      this.#failResource(model, 'Model instance does not match its registered connection');
      return;
    }
    model.activeConfiguration = message.payload.configuration;
    if (model.deferConfiguration && model.configuration === undefined) {
      model.status = 'uninitialized';
      return;
    }
    delete model.deferConfiguration;
    model.configuration ??= model.activeConfiguration;
    this.#resumeModel(model, message.payload.loaded === true);
  };

  readonly #resumeModel = (model: RuntimeResource, loaded: boolean): void => {
    if (!loaded) {
      model.status = 'uninitialized';
      this.#initialize(model);
      return;
    }
    if (areValuesEqual(model.configuration, model.activeConfiguration)) {
      model.status = 'ready';
      delete model.error;
      return;
    }
    if (
      areValuesEqual(
        withoutGeneration(model.configuration),
        withoutGeneration(model.activeConfiguration),
      )
    ) {
      model.status = 'uninitialized';
      this.#initialize(model);
      return;
    }
    model.status = 'loading';
    model.phaseTimer = setTimeout(
      () => this.#failResource(model, 'Model disposal deadline exceeded'),
      this.#policy.stoppingMs,
    );
    model.port?.postMessage({
      id: this.runtimeId,
      name: model.role,
      task: 'runtime:dispose',
      payload: null,
      runtimeEpoch: model.epoch,
    });
  };

  readonly #publishReadiness = (model: RuntimeResource): void => {
    if (model.status !== 'ready') return;
    for (const client of this.#clients.values()) {
      for (const id of client.channels.get(model.role) ?? []) this.#ready(client, model.role, id);
    }
  };

  readonly #publishProgress = (model: RuntimeResource, message: RuntimeMessage): void => {
    model.progress = message;
    for (const client of this.#clients.values()) this.#replayProgress(client, model, message);
  };
  readonly #replayProgress = (
    client: RuntimeClient,
    model: RuntimeResource,
    message: RuntimeMessage,
  ): void => {
    for (const id of client.channels.get(model.role) ?? [])
      this.#send(client, 'runtime:event', { ...message, id });
  };
  readonly #modelMessage = (model: RuntimeResource, message: RuntimeMessage): void => {
    if (message.error && !message.requestId) {
      this.#failResource(
        model,
        typeof message.error === 'string' ? message.error : message.error.message,
      );
      return;
    }
    if (message.task.includes(':progress')) {
      this.#publishProgress(model, message);
      return;
    }
    switch (message.task) {
      case 'runtime:bound': {
        this.#bound(model, message);
        break;
      }
      case `${model.role}:ready`: {
        clearTimeout(model.phaseTimer);
        delete model.error;
        model.status = 'ready';
        model.activeConfiguration = model.configuration;

        break;
      }
      case 'runtime:disposed': {
        clearTimeout(model.phaseTimer);
        model.activeConfiguration = undefined;
        model.status = 'uninitialized';
        this.#initialize(model);

        break;
      }
      default: {
        this.#receiveWork(model, message);
      }
    }
    this.#publishReadiness(model);
    this.#pump(model);
    this.#advance();
    this.#broadcastState();
  };
}
