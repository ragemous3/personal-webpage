import { type BotConfiguration, type BotEnvelope, type BotPort, type BotWireMessage, isBotWireMessage,type SharedBotState } from '@/layers/data/models/shared-bot.model';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

interface RoutedRequest {
  client: string;
  original: string;
  databasePending: boolean;
  modelPending: boolean;
  terminal: boolean;
}

export class SharedBotCoordinator {
  readonly #clients = new Map<string, BotPort>();
  #owner: string | undefined;
  #epoch = 0;
  #revision = 0;
  #configuration: BotConfiguration | undefined;
  #loadingRevision: number | undefined;
  #state: SharedBotState = { ready: false, loading: false, pending: false };
  readonly #requests = new Map<string, RoutedRequest>();
  readonly #handlers: Partial<Record<BotWireMessage['action'], (message: BotWireMessage) => void>> = {
    claim: (message) => this.#claim(message.client),
    configure: (message) => { if (message.configuration) this.#configure(message.configuration); },
    loaded: (message) => this.#loaded(message),
    request: (message) => this.#request(message),
    reply: (message) => this.#reply(message),
    finish: (message) => this.#finish(message),
    disconnect: (message) => this.#disconnect(message.client),
  };

  receive(port: BotPort, value: unknown): boolean {
    if (!isBotWireMessage(value)) return false;
    const message = value;
    if (message.action === 'register') {
      this.#clients.set(message.client, port);
      this.#send(message.client, { action: 'state', state: this.#state });
      return true;
    }
    if (this.#clients.get(message.client) !== port) return true;
    this.#handlers[message.action]?.(message);
    return true;
  }

  #claim(client: string): void {
    this.#failRequests();
    this.#owner = client;
    this.#epoch++;
    this.#loadingRevision = undefined;
    this.#state = { ready: false, loading: false, pending: Boolean(this.#configuration),
      ...(this.#configuration ? { selected: this.#configuration.settings } : {}) };
    this.#load();
  }

  #configure(configuration: BotConfiguration): void {
    if (areValuesEqual(configuration.settings, this.#configuration?.settings) && !this.#state.error) {
      this.#broadcast();
      return;
    }
    this.#configuration = configuration;
    this.#revision++;
    this.#state = { ...this.#state, selected: configuration.settings, ready: false, pending: true, error: undefined };
    this.#load();
  }

  #load(): void {
    if (!this.#owner || !this.#configuration || this.#loadingRevision !== undefined || !this.#state.pending || this.#requests.size > 0) {
      this.#broadcast();
      return;
    }
    this.#loadingRevision = this.#revision;
    this.#state = { ...this.#state, loading: true };
    this.#send(this.#owner, { action: 'load', configuration: this.#configuration, revision: this.#revision });
    this.#broadcast();
  }

  #request(command: BotWireMessage): void {
    const { message, channel, client } = command;
    if (!message?.requestId || !channel) return;
    const key = JSON.stringify([client, message.requestId]);
    const request = this.#requestRecord(client, message.requestId, channel, message, key);
    if (!request || !this.#owner) return;
    if (channel === 'llm' && message.task === 'llm:query') request.modelPending = true;
    this.#send(this.#owner, { action: 'run', channel, message: { ...message, requestId: key } });
  }

  #requestRecord(client: string, original: string, channel: string, message: BotEnvelope, key: string): RoutedRequest | undefined {
    const existing = this.#requests.get(key);
    if (existing) return existing;
    if (channel !== 'vectordb' || message.task !== 'vectordb:query') return;
    return this.#admit(client, original, message, key);
  }

  #admit(client: string, original: string, message: BotEnvelope, key: string): RoutedRequest | undefined {
    if (!this.#state.ready || this.#state.pending) {
      this.#send(client, { action: 'event', channel: 'vectordb', message: { ...message, error: { message: 'Settings are changing. Wait for the shared bot to be ready.' } } });
      return;
    }
    const request = { client, original, databasePending: true, modelPending: false, terminal: false };
    this.#requests.set(key, request);
    return request;
  }

  #reply(command: BotWireMessage): void {
    if (!this.#isOwner(command)) return;
    if (!command.message) return;
    const { message, channel } = command;
    if (message.error && !message.requestId) {
      this.#fault(message.error);
      return;
    }
    if (!message.requestId || !channel) return;
    const request = this.#requests.get(message.requestId);
    if (!request) return;
    this.#processReply(request, channel, message);
    this.#release(message.requestId, request);
  }

  #isOwner(command: BotWireMessage): boolean {
    return command.client === this.#owner && command.epoch === this.#epoch;
  }

  #processReply(request: RoutedRequest, channel: 'llm' | 'vectordb', message: BotEnvelope): void {
    if (channel === 'vectordb') request.databasePending = false;
    if (message.task === 'llm:message:response' || message.task === 'llm:cancel:response' || message.error) {
      request.modelPending = false;
      request.terminal = true;
    }
    if (!request.terminal || message.task === 'llm:message:response' || message.error)
      this.#send(request.client, { action: 'event', channel, message: { ...message, requestId: request.original } });
  }

  #finish(command: BotWireMessage): void {
    const requestId = command.message?.requestId;
    if (!requestId) return;
    const key = JSON.stringify([command.client, requestId]);
    const request = this.#requests.get(key);
    if (!request) return;
    request.terminal = true;
    if (request.modelPending && this.#owner) this.#send(this.#owner, { action: 'run', channel: 'llm', message: { task: 'llm:cancel', requestId: key, payload: {} } });
    this.#release(key, request);
  }

  #release(key: string, request: RoutedRequest): void {
    if (!request.terminal || request.databasePending || request.modelPending) return;
    this.#requests.delete(key);
    this.#load();
  }

  #disconnect(client: string): void {
    this.#clients.delete(client);
    if (client === this.#owner) {
      this.#owner = undefined;
      this.#loadingRevision = undefined;
      this.#failRequests();
      this.#state = { ...this.#state, ready: false, pending: true, loading: false };
      this.#broadcast();
      return;
    }
    for (const request of this.#requests.values()) {
      if (request.client === client) this.#finish({ ...commandForFinish(client, request.original) });
    }
  }

  #fault(error: unknown): void {
    const diagnostic = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
    this.#loadingRevision = undefined;
    this.#failRequests(diagnostic);
    this.#state = { ...this.#state, ready: false, pending: true, loading: false, error: diagnostic };
    this.#broadcast();
  }

  #failRequests(error = 'The shared bot owner closed. Retry the response explicitly after initialization.'): void {
    for (const request of this.#requests.values()) this.#send(request.client, {
      action: 'event', channel: 'llm', message: { task: 'llm:query', requestId: request.original,
        error: { message: error } },
    });
    this.#requests.clear();
  }

  #loaded(message: BotWireMessage): void {
    if (message.client !== this.#owner || message.epoch !== this.#epoch || message.revision !== this.#loadingRevision) return;
    this.#loadingRevision = undefined;
    if (message.revision !== this.#revision) {
      this.#load();
      return;
    }
    this.#publishLoaded(message.error);
  }

  #publishLoaded(error: string | undefined): void {
    const settings = this.#configuration?.settings;
    this.#state = { ...this.#state, loading: false, pending: Boolean(error), error,
      ready: !error && settings?.mode === 'local',
      ...(error || !settings ? {} : { active: settings }) };
    this.#broadcast();
  }

  #send(client: string, message: Partial<BotWireMessage>): void {
    this.#clients.get(client)?.postMessage({ kind: 'assistant', client, epoch: this.#epoch, ...message });
  }

  #broadcast(): void {
    for (const client of this.#clients.keys()) this.#send(client, { action: 'state', state: this.#state });
  }
}

const commandForFinish = (client: string, requestId: string): BotWireMessage => ({ kind: 'assistant', client, action: 'finish', message: { task: 'finish', requestId } });
