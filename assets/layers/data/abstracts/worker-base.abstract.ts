import { MessagingBaseContract } from '../../shared/contracts/message-base.contract';
import { MessageBase } from '../workers/models';
// https://medium.com/@artemkhrenov/web-workers-parallel-processing-in-the-browser-e4c89e6cad77 - Mostly reworked edition of the example found here.

export abstract class WorkerBase<
  Carrier,
  To extends MessageBase<unknown>,
  From,
> implements MessagingBaseContract<Carrier, To, From> {
  carrier: Carrier | undefined;
  isTerminating: boolean | undefined = false;
  protected listeners: Set<(data: MessageBase<From>) => void> = new Set<
    (data: MessageBase<From>) => void
  >();

  constructor(
    protected scriptPath: string,
    protected carrierName: string,
  ) {}

  listen = (func: (data: MessageBase<From>) => void): Set<(data: MessageBase<From>) => void> => {
    this.listeners.add(func);
    return this.listeners;
  };
  //TODO:// fix this check - should check if actual Path to a script
  isScriptPath = (scriptPath: string | undefined): scriptPath is string =>
    typeof scriptPath === 'string' ? true : false;

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
    console.error(`${this.carrierName}: error:`, error);
    this.terminate();
  };
}
