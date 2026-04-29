export enum StateMachineStatesEnum {
  UNINITIALIZED = 'UNINITIALIZED',
  BUSY = 'BUSY',
}
export enum WorkerKeys {
  STATE_MACHINE = 'statemachine',
  HUB = 'hub',
  LLM = 'llm',
  VECTORDB = 'vectordb',
}
export enum BroadcastKeys {
  LLM = WorkerKeys.LLM,
  VECTORDB = WorkerKeys.VECTORDB,
}
export const WorkerFileNames = {
  stateMachine: 'state-machine.shared-worker.ts',
  hub: 'hub.worker.ts',
  llm: 'llm.worker.ts',
  vectordb: 'vectordb.worker.ts',
} as const;
