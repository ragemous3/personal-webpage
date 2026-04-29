import { MessageBase } from '../../data/workers/models';
import { StateMachineContract } from './state-machine.contract';

export interface StateMachineConnectionContract<
  To extends MessageBase<unknown>,
  From = unknown,
> extends StateMachineContract<unknown, To, From> {}
