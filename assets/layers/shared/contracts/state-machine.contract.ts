import { type MessageBase } from '@/layers/data/workers/models';

import { type MessagingBaseContract } from './message-base.contract';

export type StateMachineContract<
  Carrier,
  To extends MessageBase<unknown>,
  From = unknown,
> = {} & MessagingBaseContract<Carrier, To, From>;
