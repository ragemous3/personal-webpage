import { MessageBase } from '../../data/workers/models';
import { MessagingBaseContract } from './message-base.contract';

export interface StateMachineContract<
  Carrier,
  To extends MessageBase<unknown>,
  From = unknown,
> extends MessagingBaseContract<Carrier, To, From> {}
