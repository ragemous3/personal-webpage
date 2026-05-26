import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { type StateMachineStatesEnum } from '@/layers/data/contants/constants';
import { type ChatMessage } from '@/layers/data/models/models';
import { type Nullable } from '@/layers/shared/models';

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
}

export type StateMachineTask = 'check' | 'set' | 'transfer';
export type StateMachineStates = keyof typeof StateMachineStatesEnum;
export type StateMachineName = string;
export type StateMachineProtocol = `${StateMachineName}:${StateMachineTask}`;

// announcement is be the global broadcast one.
export interface StateMachineStatusLog {
  initiator: ReturnType<typeof crypto.randomUUID> | 'announcement';
  entity: StateMachineName;
  status: StateMachineStatesEnum;
}

export type SharedWorkerMessage = MessageBase<Nullable<unknown>, StateMachineProtocol>;
export type WorkerMessageHub = MessageBase<MessageBase<unknown>>;

export interface LlmDTO {
  message: ChatMessage[];
}

export type VectorDatabaseDTO = MessageBase<
  Nullable<{
    topK?: number;
    query: string;
  }>
>;

export interface VectorDatabaseResponse {
  query: string;
  response: SearchResult;
}
