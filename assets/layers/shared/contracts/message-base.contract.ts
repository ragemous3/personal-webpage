import { MessageBase } from '../../data/workers/models';

export interface MessagingBaseContract<Carrier, To extends MessageBase<unknown>, From> {
  carrier: Carrier | undefined;
  isTerminating: boolean | undefined;
  listen(func: (data: MessageBase<From>) => void): Set<(data: MessageBase<From>) => void>;
  initialize(wm?: To): void;
  send(message: To): void;
  terminate(): void;
}
