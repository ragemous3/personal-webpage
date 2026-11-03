export enum WorkerKeys {
  COORDINATOR = 'coordinator',
  LLM = 'llm',
  VECTORDB = 'vectordb',
}
export enum BroadcastKeys {
  LLM = 'llm',
  VECTORDB = 'vectordb',
}
export const WorkerFileNames = {
  coordinator: 'runtime-coordinator.shared-worker.ts',
  llm: 'llm.shared-worker.ts',
  vectordb: 'vectordb.shared-worker.ts',
} as const;

export const SharedWorkerNames = {
  coordinator: 'RuntimeCoordinator',
  llm: 'Runtime-llm',
  vectordb: 'Runtime-vectordb',
} as const;
