export type Action = 'init' | 'query' | 'cleanup';
export type Task = `${string}:${Action}`;

interface WorkerMessageBase {
  task: Task;
}

export interface WorkerMessageTo extends WorkerMessageBase {
  id: string;
}

export interface WorkerMessageFrom extends WorkerMessageBase {
  id: string;
  paytload: unknown;
  error: string;
}

export type PendingEntry<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: Error) => void;
  timeout: number;
};

export type WorkerRequest = {
  [key: string]: unknown;
};
