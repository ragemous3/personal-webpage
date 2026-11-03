import { RuntimeCoordinatorStateMachine } from '@/layers/data/workers/runtime-coordinator-state-machine';

const runtime = new RuntimeCoordinatorStateMachine();
globalThis.addEventListener('connect', (event: Event) => {
  const port = (event as MessageEvent).ports[0];
  if (port) runtime.connect(port);
});
