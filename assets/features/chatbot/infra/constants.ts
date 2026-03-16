export const WorkerFileNames = {
  broadcaster: 'broadcaster.shared-worker.ts',
  hub: 'hub.worker.ts',
  llm: 'llm.worker.ts',
  vectordb: 'vectordb.worker.ts',
} as const;

export const WorkerKeys = Object.keys(WorkerFileNames).map((key) => [key, key]));
