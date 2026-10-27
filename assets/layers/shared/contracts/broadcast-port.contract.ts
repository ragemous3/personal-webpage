import { type MessageBase } from '@/layers/data/workers/models';

import { type BroadcastBaseContract } from './broadcast.contract';

export type BroadcastContract<To extends MessageBase<unknown>, From> = BroadcastBaseContract<
  BroadcastChannel,
  To,
  From
>;
