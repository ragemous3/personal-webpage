import { type MessageBase } from '@/layers/data/workers/models';

import { type StateMachineContract } from './state-machine.contract';

export type StateMachineConnectionContract<
  To extends MessageBase<unknown>,
  From = unknown,
> = {} & StateMachineContract<unknown, To, From>;
