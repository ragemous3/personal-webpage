import { SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { Nullable } from '../../shared/models';
import { StateMachineStatesEnum } from '../contants/constants';
import { ChatMessage } from '../models/models';

export type Action =
  | 'host'
  | 'ping'
  | 'init'
  | 'check'
  | 'message'
  | 'stream'
  | 'progress'
  | 'query'
  | 'cleanup';

export type Task = `${string}:${Action}`;
export type TaskResponse = `${string}:${Action}:response`;
export interface MessageBase<T, Y = Task | TaskResponse> {
  id: ReturnType<typeof crypto.randomUUID>;
  name: string;
  task: Y;
  payload: T;
  error?: string;
  source?: string;
}

//TODO:// Shared Worker types have bad names...
export type StateMachineTask = 'check' | 'set' | 'transfer';
export type StateMachineStates = keyof typeof StateMachineStatesEnum;
export type StateMachineName = string;
export type StateMachineProtocol = `${StateMachineName}:${StateMachineTask}`;

// announcement would be the global broadcast one.
export type StateMachineStatusLog = {
  initiator: ReturnType<typeof crypto.randomUUID> | 'announcement';
  entity: StateMachineName;
  status: StateMachineStatesEnum;
};

export type SharedWorkerMessage = MessageBase<Nullable<unknown>, StateMachineProtocol>;
export type WorkerMessageHub = MessageBase<MessageBase<unknown>>;

export interface LlmDTO {
  message: ChatMessage[];
}

export interface VectorDbDto extends MessageBase<
  Nullable<{
    topK?: number;
    query: string;
  }>
> {}

export type VectorDbResponse = {
  query: string;
  response: SearchResult;
};
