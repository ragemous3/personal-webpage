import { type MessageBase } from '@/layers/data/workers/models';
import { type MessagingBaseContract } from '@/layers/shared/contracts/message-base.contract';

export abstract class MessagingBase<
  Carrier,
  To extends MessageBase<unknown>,
  From,
> implements MessagingBaseContract<Carrier, To, From> {
  carrier: Carrier | undefined;
  isTerminating: boolean | undefined = false;
  protected listeners = new Set<(data: MessageBase<From>) => void>();

  constructor(protected name: string) {}

  listen = (function_: (data: MessageBase<From>) => void): (() => boolean) => {
    this.listeners.add(function_);
    return (): boolean => this.listeners.delete(function_);
  };

  abstract initialize(wm: To): void;
  abstract send(message: To): void;
  abstract terminate(): void;

  protected emit = (data: MessageBase<From>): void => {
    for (const listener of this.listeners) {
      listener(data);
    }
  };

  protected abstract setupEventListeners(): void | null;
  protected handleMessage = (event: MessageEvent<MessageBase<From>>): void => { this.emit(event.data); };

  protected handleError = (error: ErrorEvent | MessageEvent<unknown>): void => {
    console.error(`${this.name}: error:`, error);
    this.terminate();
  };
}
