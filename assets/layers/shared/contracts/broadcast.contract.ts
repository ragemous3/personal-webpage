import { type MessageBase } from '../../data/workers/models';
import { type MessagingBaseContract } from './message-base.contract';

export interface BroadcastBaseContract<
  Carrier,
  To extends MessageBase<unknown>,
  From,
> extends MessagingBaseContract<Carrier, To, From> {
  name: string;
}
