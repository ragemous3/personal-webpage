import { type TextGenerationConfig } from '@huggingface/transformers';

import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import {
  type AssistantSettings,
} from '@/layers/shared/contracts/configuration-service.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import {
  createSubscribable,
} from '@/layers/shared/utils/subscribable';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

type OwnedWorker = Pick<
  Worker,
  'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'
>;

const describeFailure = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return 'Worker request failed';
};

class RuntimeTransport implements StandardCommunicationContract {
  readonly #messages = createSubscribable<unknown>();
  #worker: OwnedWorker | undefined;
  #ready: unknown;
  #config: unknown;
  #reject: ((error: Error) => void) | undefined;
  generation: Partial<TextGenerationConfig> | undefined;

  constructor(
    readonly name: string,
    private readonly createWorker: (source: string) => OwnedWorker,
  ) {}

  onData(listener: (data: unknown) => void): () => void {
    const disconnect = this.#messages.connect(listener);
    if (this.#ready) listener(this.#ready);
    return disconnect;
  }

  async replace(config: LmConfig | DatabaseConfig): Promise<void> {
    if (this.#ready && areValuesEqual(config, this.#config)) return;
    this.dispose();
    this.#config = config;
    const worker = this.createWorker(config.source);
    this.#worker = worker;
    await new Promise<void>((resolve, reject) => {
      this.#reject = reject;
      worker.addEventListener('message', (event) => {
        this.#receive(worker, event.data, resolve, reject);
      });
      worker.addEventListener('error', (event) => {
        if (this.#worker !== worker) return;
        this.#ready = undefined;
        const error = new Error(`[${SeverityLevelCodes.ERROR}] - Worker failed: ${event.message}`);
        reject(error);
        this.#messages.emit({ task: `${this.name}:init`, error: { message: error.message } });
      });
      worker.postMessage({
        id: this.name,
        name: this.name,
        task: `${this.name}:init`,
        payload: config,
      });
    });
  }

  #receive(
    worker: OwnedWorker,
    data: unknown,
    ready: () => void,
    fail: (error: Error) => void,
  ): void {
    if (this.#worker !== worker || typeof data !== 'object' || data === null) return;
    if ('error' in data && data.error)
      fail(new Error(`[${SeverityLevelCodes.ERROR}] - ${describeFailure(data.error)}`));
    if ('task' in data && data.task === `${this.name}:ready`) {
      this.#ready = data;
      this.#reject = undefined;
      ready();
    }
    this.#messages.emit(data);
  }

  initialize(): void {
    if (this.#ready) this.#messages.emit(this.#ready);
  }

  send(payload: unknown, requestId?: string, action = 'query'): void {
    this.#worker?.postMessage({
      id: this.name,
      name: this.name,
      task: `${this.name}:${action}`,
      requestId,
      payload:
        this.generation && action === 'query' && typeof payload === 'object' && payload !== null
          ? { ...payload, generation: this.generation }
          : payload,
    });
  }

  dispose(): void {
    this.#reject?.(new Error(`[${SeverityLevelCodes.ERROR}] - Runtime released`));
    this.#reject = undefined;
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#ready = undefined;
  }
}

export class OwnedBotRuntime {
  readonly chat: RuntimeTransport;
  readonly database: RuntimeTransport;

  constructor(
    private readonly modelConfig: LmConfig,
    private readonly databaseConfig: DatabaseConfig,
    createWorker: (source: string) => OwnedWorker,
  ) {
    this.chat = new RuntimeTransport('llm', createWorker);
    this.database = new RuntimeTransport('vectordb', createWorker);
  }

  async apply(settings: AssistantSettings): Promise<void> {
    if (settings.mode === 'online') {
      this.chat.dispose();
      this.database.dispose();
      return;
    }
    await Promise.all([
      this.chat.replace({
        ...this.modelConfig,
        model: settings.model,
        device: settings.execution,
        dtype: settings.precision,
        generation: {},
      }),
      this.database.replace({ ...this.databaseConfig, device: settings.execution }),
    ]);
    this.chat.generation = {
      max_new_tokens: settings.maxNewTokens,
      do_sample: settings.sampling,
      ...(settings.sampling ? { temperature: settings.temperature, top_p: settings.topP } : {}),
    };
  }

  dispose(): void {
    this.chat.dispose();
    this.database.dispose();
  }
}
