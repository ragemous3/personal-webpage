import { MessagingBaseContract } from '../../shared/contracts/message-base.contract';
import { MessageBase } from '../workers/models';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export abstract class MessagingBase<
  Carrier,
  To extends MessageBase<unknown>,
  From,
> implements MessagingBaseContract<Carrier, To, From> {
  carrier: Carrier | undefined;
  isTerminating: boolean | undefined = false;
  protected listeners = new Set<(data: MessageBase<From>) => void>();

  constructor(protected name: string) {}

  listen = (func: (data: MessageBase<From>) => void): (() => void) => {
    this.listeners.add(func);
    return () => this.listeners.delete(func);
  };

  abstract initialize(wm: To): void;
  abstract send(message: To): void;
  abstract terminate(): void;
  protected emit = (data: MessageBase<From>) => {
    for (const listener of this.listeners) {
      listener(data);
    }
  };
  protected abstract setupEventListeners(): void | null;

  protected handleMessage = (event: MessageEvent<MessageBase<From>>): void => this.emit(event.data);

  protected handleError = (error: ErrorEvent | MessageEvent<unknown>): void => {
    console.error(`${this.name}: error:`, error);
    this.terminate();
  };
}
