import { type MessageBase } from '@/layers/data/workers/models';

export interface MessagingBaseContract<Carrier, To extends MessageBase<unknown>, From> {
  carrier: Carrier | undefined;
  listen(function_: (data: MessageBase<From>) => void): () => boolean;
  initialize(wm?: To): void;
  send(message: To): void;
  terminate(): void;
}
