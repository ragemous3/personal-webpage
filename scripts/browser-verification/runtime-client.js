import { RuntimeCoordinatorConnection } from '@/layers/data/runtime-coordinator.connection';
import { RuntimeCoordinator } from '@/layers/data/runtime-coordinator.data';

const response = await fetch('/data/workers.json');
const { workers } = await response.json();
const connection = new RuntimeCoordinatorConnection(
  workers['runtime-coordinator.shared-worker.ts'],
  {
    llm: workers['llm.shared-worker.ts'],
    vectordb: workers['vectordb.shared-worker.ts'],
  },
  {
    connectionMs: 1000,
    initializationMs: 4000,
    requestMs: 6000,
    silenceMs: 1500,
    stoppingMs: 1000,
  },
);
const runtime = new RuntimeCoordinator(connection);
const channels = { llm: crypto.randomUUID(), vectordb: crypto.randomUUID() };
const events = [];
runtime.onData((data) => events.push({ channel: 'runtime', data, at: Date.now() }));
globalThis.probe = {
  client: channels.llm,
  attached: () => runtime.$isReady.getValue(),
  events,
  host: (fail = false, name = 'llm') =>
    runtime.host({ id: channels[name], name, task: `${name}:init`, payload: { fail } }),
  query: (requestId, payload = {}, name = 'llm') =>
    runtime.send({ id: channels[name], name, task: `${name}:query`, requestId, payload }),
  cancel: (requestId, name = 'llm') =>
    runtime.send({ id: channels[name], name, task: `${name}:cancel`, requestId, payload: {} }),
  reconnect: () => runtime.reconnect(),
  begin: (requestId) => runtime.begin(requestId),
  finish: (requestId) => runtime.finish(requestId),
  configure: (configurations) => runtime.configure(configurations),
};
