import { isRuntimeMessage } from '@/layers/data/guards/is-runtime-message.guard';
import { type MessageBase } from '@/layers/data/workers/models';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';
import { createSubscribable } from '@/layers/shared/utils/subscribable';

import { StandardCommunicationBaseAbstract } from './standard-communication-base.abstract';

export abstract class StandardCommunication<
  TConfig = unknown,
> extends StandardCommunicationBaseAbstract {
  readonly #data = createSubscribable<unknown>();
  #status: MessageBase<unknown> | undefined;
  constructor(
    protected readonly coordinator: RuntimeCoordinatorContract,
    readonly configuration: RagConfigBase<TConfig>,
    autoStart = true,
  ) {
    super(configuration.name);
    this.connections.push(
      coordinator.onData((data) => {
        if (!isRuntimeMessage(data) || data.id !== this.channelId) return;
        if (
          data.task.endsWith(':ready') ||
          data.task.endsWith(':loading') ||
          (data.error && !data.requestId)
        )
          this.#status = data;
        this.#data.emit(data);
      }),
    );
    if (autoStart) this.initialize();
  }
  onData = (listener: (data: unknown) => void): (() => void) => {
    const disconnect = this.#data.connect(listener);
    if (this.#status) listener(this.#status);
    return disconnect;
  };
  initialize = (): void =>
    this.coordinator.host({
      id: this.channelId,
      name: this.name,
      task: `${this.name}:init`,
      payload: this.configuration.payload,
    });
  send = (payload: unknown, requestId?: string, action: 'query' | 'cancel' = 'query'): void =>
    this.coordinator.send({
      id: this.channelId,
      name: this.name,
      task: `${this.name}:${action}`,
      payload,
      ...(requestId ? { requestId } : {}),
    });
  dispose = (): void => {
    super.dispose();
    this.coordinator.release(this.channelId, this.name);
    this.#data.disconnect();
  };
}
