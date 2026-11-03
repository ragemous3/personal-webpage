import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

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
  | 'cancel'
  | 'ready'
  | 'cleanup'
  | 'accepted'
  | 'attach'
  | 'detach'
  | 'register'
  | 'bind'
  | 'bound'
  | 'state'
  | 'event'
  | 'begin'
  | 'finish'
  | 'send'
  | 'started'
  | 'stopped'
  | 'closing'
  | 'failed'
  | 'recovered'
  | 'release'
  | 'loading'
  | 'recover'
  | 'configure'
  | 'configured'
  | 'dispose'
  | 'disposed';

export type Task = `${string}:${Action}`;
export type TaskResponse = `${string}:${Action}:response`;
export interface MessageBase<T, Y = Task | TaskResponse> {
  id: ReturnType<typeof crypto.randomUUID>;
  name: string;
  task: Y;
  payload: T;
  requestId?: string;
  operationId?: string;
  error?: string | { message: string; name?: string; stack?: string };
  runtimeEpoch?: string;
  instanceId?: string;
  runtimeFailure?: boolean;
}

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
