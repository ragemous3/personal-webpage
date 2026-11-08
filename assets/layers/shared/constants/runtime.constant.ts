export const RuntimeStatuses = {
  UNINITIALIZED: 'uninitialized',
  CONNECTING: 'connecting',
  LOADING: 'loading',
  READY: 'ready',
  BUSY: 'busy',
  STOPPING: 'stopping',
  FAILED: 'failed',
} as const;

export const ActiveRuntimeStatuses: ReadonlySet<string> = new Set([
  RuntimeStatuses.READY,
  RuntimeStatuses.BUSY,
  RuntimeStatuses.STOPPING,
]);

export const InitializingRuntimeStatuses: ReadonlySet<string> = new Set([
  RuntimeStatuses.LOADING,
  RuntimeStatuses.CONNECTING,
]);
