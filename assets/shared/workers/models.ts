import { Nullable } from '../models';
import { EntityStatusTypes } from './constants';

export type Action = 'init' | 'chat' | 'progress' | 'query' | 'cleanup';
export type Task = `${string}:${Action}`;

export interface WorkerMessageBase<T, Y = Task> {
  id: ReturnType<typeof crypto.randomUUID>;
  task: Y;
  error?: string;
  payload: T;
}
export type EntityTask = 'check' | 'set' | 'transfer';
export type EntityStatus = keyof typeof EntityStatusTypes;
export type EntityName = string;
export type EntityProtocol = `${EntityName}:${EntityTask}`;
// announcement would be the global broadcast one.
export type EntityStatusLog = {
  initiator: ReturnType<typeof crypto.randomUUID> | 'announcement';
  entity: EntityName;
  status: EntityStatus;
};

export type SharedWorkerMessage = WorkerMessageBase<Nullable<unknown>, EntityProtocol>;
