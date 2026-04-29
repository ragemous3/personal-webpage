import { MessageBase } from '../../data/workers/models';
import { WritableStatefulConnections } from '../utils/subscribable';
import { MessagingBaseContract } from './message-base.contract';

export interface BroadcastBaseContract<
  Carrier,
  To extends MessageBase<unknown>,
  From,
> extends MessagingBaseContract<Carrier, To, From> {
  subscribable: WritableStatefulConnections<From>;
  name: string;
}
