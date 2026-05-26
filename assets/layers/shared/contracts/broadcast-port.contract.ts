import { type MessageBase } from '../../data/workers/models';
import { type BroadcastBaseContract } from './broadcast.contract';

export interface BroadcastContract<
  To extends MessageBase<unknown>,
  From,
> extends BroadcastBaseContract<BroadcastChannel, To, From> {}
