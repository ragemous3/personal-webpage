import { type MessageBase } from '@/layers/data/workers/models';

export type RuntimeRole = 'llm' | 'vectordb';
export type RuntimeResourceStatus =
  | 'uninitialized'
  | 'connecting'
  | 'loading'
  | 'ready'
  | 'busy'
  | 'stopping'
  | 'failed';
export interface RuntimePolicy {
  connectionMs: number;
  initializationMs: number;
  requestMs: number;
  silenceMs: number;
  stoppingMs: number;
}
export const defaultRuntimePolicy: RuntimePolicy = {
  connectionMs: 10_000,
  initializationMs: 600_000,
  requestMs: 900_000,
  silenceMs: 120_000,
  stoppingMs: 30_000,
};
export interface RuntimeResourceSnapshot {
  role: RuntimeRole;
  status: RuntimeResourceStatus;
  instanceId?: string;
  error?: string;
}
export interface RuntimeSelection {
  selectionId?: string;
  enabled: boolean;
  settings: unknown;
}
export interface RuntimeSnapshot {
  selection?: RuntimeSelection;
  activeSelection?: RuntimeSelection;
  runtimeId: string;
  resources: RuntimeResourceSnapshot[];
  configuring: boolean;
  responding: boolean;
  configurationLoading: boolean;
}
export type RuntimeMessage = MessageBase<unknown>;
export const isRuntimeRole = (value: unknown): value is RuntimeRole =>
  value === 'llm' || value === 'vectordb';
