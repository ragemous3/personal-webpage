import { type OwnedBotRuntime } from '@/layers/data/configuration-runtime.data';
import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type BotConfiguration, type BotEnvelope, type BotWireMessage, isBotWireMessage,type SharedBotState } from '@/layers/data/models/shared-bot.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type AssistantSettings, type ConfigurationRuntimeContract, type ConfigurationRuntimeState } from '@/layers/shared/contracts/configuration-service.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import { createStatefulSubscribable, createSubscribable, type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export interface SharedRuntimeDependencies {
  port: Pick<MessagePort, 'postMessage' | 'addEventListener' | 'removeEventListener' | 'start' | 'close'>;
  holdOwnership(signal: AbortSignal, hold: () => Promise<void>): Promise<void>;
  createOwner(configuration: BotConfiguration): OwnedBotRuntime;
}

class SharedTransport implements StandardCommunicationContract {
  readonly #messages = createSubscribable<unknown>();
  #ready: BotEnvelope | undefined;
  constructor(readonly name: 'llm' | 'vectordb', private readonly dispatch: (channel: 'llm' | 'vectordb', message: BotEnvelope) => void) {}
  onData(listener: (message: unknown) => void): () => void {
    const disconnect = this.#messages.connect(listener);
    if (this.#ready) listener(this.#ready);
    return disconnect;
  }
  emit(message: BotEnvelope): void {
    if (message.task === `${this.name}:ready`) this.#ready = message;
    this.#messages.emit(message);
  }
  initialize(): void { if (this.#ready) this.#messages.emit(this.#ready); }
  send(payload: unknown, requestId?: string, action = 'query'): void {
    this.dispatch(this.name, { task: `${this.name}:${action}`, payload, requestId });
  }
  dispose(): void { this.#messages.disconnect(); this.#ready = undefined; }
}

interface PendingApplication {
  settings: AssistantSettings;
  resolve(): void;
  reject(error: Error): void;
}

export class SharedConfigurationRuntime implements ConfigurationRuntimeContract {
  readonly chat: SharedTransport;
  readonly database: SharedTransport;
  readonly #state = createStatefulSubscribable<ConfigurationRuntimeState>({ responding: false });
  readonly stateSubscription = { connect: this.#state.connect, getValue: this.#state.getValue };
  readonly #client = crypto.randomUUID();
  readonly #abort = new AbortController();
  #owner: OwnedBotRuntime | undefined;
  #ownsLock = false;
  #releaseOwnership: (() => void) | undefined;
  #selected: AssistantSettings | undefined;
  #snapshot: SharedBotState | undefined;
  #requestedAvailable = false;
  #disposed = false;
  #activeRequest: string | undefined;
  #applications: PendingApplication[] = [];
  readonly #disconnectState: () => void;
  readonly #handlers: Partial<Record<BotWireMessage['action'], (message: BotWireMessage) => void>> = {
    state: (message) => { if (message.state) this.#stateChanged(message.state); },
    event: (message) => { if (message.channel && message.message) this.#transport(message.channel).emit(message.message); },
    load: (message) => { void this.#load(message); },
    run: (message) => this.#run(message),
  };

  constructor(
    private readonly model: LmConfig,
    private readonly databaseConfig: DatabaseConfig,
    private readonly dependencies: SharedRuntimeDependencies,
    localState: ReadonlyStatefulConnections<{ responding: boolean }>,
    private readonly gate: (available: boolean) => void,
  ) {
    this.chat = new SharedTransport('llm', this.#dispatch);
    this.database = new SharedTransport('vectordb', this.#dispatch);
    dependencies.port.addEventListener('message', this.#receive);
    dependencies.port.start();
    this.#send({ action: 'register' });
    this.#disconnectState = localState.connect((state) => {
      if (!state.responding && this.#activeRequest) {
        this.#send({ action: 'finish', message: { task: 'finish', requestId: this.#activeRequest } });
        this.#activeRequest = undefined;
      }
      this.#state.emit({ ...this.#state.getValue(), responding: state.responding });
    });
    void dependencies.holdOwnership(this.#abort.signal, async () => {
      if (this.#disposed) return;
      this.#ownsLock = true;
      this.#send({ action: 'claim' });
      await new Promise<void>((resolve) => { this.#releaseOwnership = resolve; });
      this.#ownsLock = false;
    }).catch((error: unknown) => {
      if (!this.#disposed) this.#failApplications(error instanceof Error ? error : new Error(String(error)));
    });
  }

  select(settings: AssistantSettings): void {
    if (this.#disposed) return;
    if (this.#selected && !areValuesEqual(settings, this.#selected)) this.#failApplications(new Error(`[${SeverityLevelCodes.ERROR}] - Settings superseded`));
    this.#selected = settings;
    this.#send({ action: 'configure', configuration: { settings, model: this.model, database: this.databaseConfig } });
  }

  apply(settings: AssistantSettings): Promise<void> {
    this.select(settings);
    return new Promise<void>((resolve, reject) => {
      this.#applications.push({ settings, resolve, reject });
      this.#settleApplications();
    });
  }

  setAvailable(available: boolean): void {
    this.#requestedAvailable = available;
    this.#updateGate();
  }

  readonly #dispatch = (channel: 'llm' | 'vectordb', message: BotEnvelope): void => {
    if (channel === 'vectordb') this.#activeRequest = message.requestId;
    this.#send({ action: 'request', channel, message });
  };

  readonly #receive = (event: Event): void => {
    if (this.#disposed) return;
    const value: unknown = (event as MessageEvent).data;
    if (!isBotWireMessage(value)) return;
    const message = value;
    if (message.client !== this.#client) return;
    this.#handlers[message.action]?.(message);
  };

  #run(message: BotWireMessage): void {
    if (message.message && message.channel) {
      this.#ownerTransport(message.channel)?.send(message.message.payload, message.message.requestId,
        message.message.task === 'llm:cancel' ? 'cancel' : 'query');
    }
  }

  async #load(message: BotWireMessage): Promise<void> {
    if (!this.#ownsLock || !message.configuration) return;
    const epoch = message.epoch;
    const owner = this.#installOwner(message.configuration, epoch);
    try {
      await owner.apply(message.configuration.settings);
      if (!this.#disposed) this.#send({ action: 'loaded', epoch, revision: message.revision });
    } catch (error) {
      if (!this.#disposed) this.#send({ action: 'loaded', epoch, revision: message.revision,
        error: error instanceof Error ? error.message : String(error) });
    }
  }

  #installOwner(configuration: BotConfiguration, epoch: number | undefined): OwnedBotRuntime {
    if (!this.#owner) {
      this.#owner = this.dependencies.createOwner(configuration);
      for (const channel of ['llm', 'vectordb'] as const) this.#ownerTransport(channel)?.onData((value) => {
        const response = value as BotEnvelope;
        if (response.requestId || response.error) this.#send({ action: 'reply', epoch, channel, message: response });
        if (response.error && !response.requestId) {
          const failed = this.#owner;
          this.#owner = undefined;
          failed?.dispose();
        }
      });
    }
    return this.#owner;
  }

  #stateChanged(state: SharedBotState): void {
    this.#snapshot = state;
    if (state.ready) {
      this.chat.emit({ task: 'llm:ready' });
      this.database.emit({ task: 'vectordb:ready' });
    }
    this.#state.emit({ responding: this.#state.getValue()?.responding ?? false, runtime: state });
    this.#updateGate();
    this.#settleApplications();
  }

  #updateGate(): void {
    this.gate(Boolean(this.#requestedAvailable && this.#snapshot?.ready && !this.#snapshot.pending && areValuesEqual(this.#snapshot.active, this.#selected)));
  }

  #settleApplications(): void {
    const state = this.#snapshot;
    if (!state) return;
    this.#applications = this.#applications.filter((application) => {
      if (state.error && areValuesEqual(state.selected, application.settings)) {
        application.reject(new Error(state.error));
        return false;
      }
      if (!state.pending && areValuesEqual(state.active, application.settings)) {
        application.resolve();
        return false;
      }
      return true;
    });
  }

  #failApplications(error: Error): void {
    for (const application of this.#applications) application.reject(error);
    this.#applications = [];
  }

  #transport(channel: 'llm' | 'vectordb'): SharedTransport { return channel === 'llm' ? this.chat : this.database; }
  #ownerTransport(channel: 'llm' | 'vectordb'): StandardCommunicationContract | undefined { return channel === 'llm' ? this.#owner?.chat : this.#owner?.database; }
  #send(message: Partial<BotWireMessage>): void {
    this.dependencies.port.postMessage({ kind: 'assistant', client: this.#client, ...message });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#send({ action: 'disconnect' });
    this.#disposed = true;
    this.#owner?.dispose();
    this.#releaseOwnership?.();
    this.#abort.abort();
    this.#disconnectState();
    this.dependencies.port.removeEventListener('message', this.#receive);
    this.dependencies.port.close();
    this.#failApplications(new Error(`[${SeverityLevelCodes.ERROR}] - Runtime released`));
    this.chat.dispose();
    this.database.dispose();
  }
}
