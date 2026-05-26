import { type SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { type ChatMessage } from '../models/models';
import {
  type Action,
  type MessageBase,
  type Task,
  type TaskResponse,
  type VectorDatabaseResponse as VectorDatabaseResponse,
} from '../workers/models';
const ACTIONS = new Set<Action>([
  'host',
  'ping',
  'init',
  'check',
  'chat',
  'progress',
  'query',
  'cleanup',
]);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isAction = (value: unknown): value is Action =>
  typeof value === 'string' && ACTIONS.has(value as Action);

export const isTask = (value: unknown): value is Task => {
  if (typeof value !== 'string') return false;

  const taskResp: string[] = value.split(':');
  if (taskResp.length !== 2) return false;

  const prefix = taskResp[0];
  const action = taskResp[1];

  return Boolean(prefix) && Boolean(action);
};

export const isTaskResponse = (value: unknown): value is TaskResponse => {
  if (typeof value !== 'string') return false;

  const taskResp: string[] = value.split(':');
  if (taskResp.length !== 3) return false;

  const prefix = taskResp[0];
  const action = taskResp[1];
  const response = taskResp[2];

  return Boolean(prefix) && Boolean(action) && response === 'response';
};

const CHAT_ROLES = new Set(['system', 'user', 'assistant']);
export const isChatMessage = (value: unknown): value is ChatMessage =>
  isObject(value) &&
  typeof value.role === 'string' &&
  CHAT_ROLES.has(value.role) &&
  typeof value.content === 'string';

export const isSearchResults = (value: unknown): value is SearchResult =>
  typeof value === 'object' &&
  value !== null &&
  'distances' in value &&
  'neighbors' in value &&
  Array.isArray(value.distances) &&
  Array.isArray(value.neighbors);

//TODO: Need to move somewhere more fitting - BUSINESS
export const isVectorDbResponse = (value: unknown): value is VectorDatabaseResponse =>
  typeof value === 'object' &&
  value !== null &&
  'query' in value &&
  'response' in value &&
  isSearchResults(value.response) &&
  typeof value.query === 'string'
    ? true
    : false;

//TODO: MOVE SINCE ITS BUSINESS
export const isChatPayload = (value: unknown): value is ChatMessage[] =>
  Array.isArray(value) && value.every(isChatMessage);

export const isNullPayload = (value: unknown): value is null => (value === null ? true : false);

export const isMessageBase = <T, Y = Task>(
  value: unknown,
  isPayload: (payload: unknown) => payload is T,
  isTaskGuard?: (task: unknown) => task is Y,
): value is MessageBase<T, Y> => {
  if (!isObject(value)) return false;

  if (typeof value.id !== 'string') return false;
  if (typeof value.name !== 'string') return false;
  if (!('payload' in value) || !isPayload(value.payload)) return false;

  if (!('task' in value)) return false;
  if (isTaskGuard) {
    if (!isTaskGuard(value.task)) return false;
  } else {
    if (!isTask(value.task)) return false;
  }

  if ('error' in value && value.error !== undefined && typeof value.error !== 'string') {
    return false;
  }

  return true;
};
