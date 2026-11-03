import { SharedModelRuntime } from '@/layers/data/workers/shared-model-runtime.data';

const pending = new Map();
let attempts = 0;
const role = globalThis.verificationRole;
const trace = (event) =>
  fetch('/__verify/events', {
    method: 'POST',
    body: JSON.stringify({ instance: runtime.instanceId, role, at: Date.now(), ...event }),
  });
const createDriver = (publish) => {
  const reply = (request, suffix, payload) =>
    publish({ ...request, task: `${role}:${suffix}`, payload });
  const initialize = (request) => {
    attempts++;
    void trace({ type: 'initialization-attempt', attempt: attempts });
    if (request.payload?.fail && attempts === 1)
      throw new Error('Controlled initialization failure');
    void trace({ type: 'initialized', client: request.id });
    reply(request, 'progress', {
      status: 'progress',
      name: role,
      file: 'controlled',
      progress: 100,
      loaded: 1,
      total: 1,
    });
    reply(request, 'ready', null);
  };
  const cancel = async (request) => {
    const work = pending.get(request.requestId);
    if (!work) return;
    clearTimeout(work.timer);
    await new Promise((resolve) => setTimeout(resolve, work.stopDelay));
    reply(request, 'stream:response', 'deliberately late chunk');
    work.resolve();
    pending.delete(request.requestId);
    void trace({ type: 'stopped', requestId: request.requestId });
  };
  const generate = async (request) => {
    const answer = `Controlled ${request.payload?.question ?? 'answer'}`;
    reply(request, 'stream:response', answer);
    const hold =
      request.payload?.hold ||
      request.payload?.message?.at(-1)?.content.includes('hold-for-failure');
    await new Promise((resolve) => {
      const work = { resolve, stopDelay: request.payload?.stopDelay ?? 20 };
      if (!hold)
        work.timer = setTimeout(() => {
          reply(request, 'message:response', { generated_text: answer });
          void trace({ type: 'answer', client: request.id, requestId: request.requestId });
          pending.delete(request.requestId);
          resolve();
        }, request.payload?.delay ?? 150);
      pending.set(request.requestId, work);
    });
  };
  const query = async (request) => {
    void trace({ type: 'accepted', client: request.id, requestId: request.requestId });
    if (request.payload?.stopWorker) {
      await trace({ type: 'closing' });
      globalThis.close();
      return await new Promise(() => {});
    }
    if (role === 'vectordb') {
      reply(request, 'query:response', {
        response: { neighbors: [0], distances: [0.1] },
        query: request.payload.query,
      });
      return;
    }
    await generate(request);
  };
  return {
    handle: async ({ data: request }) => {
      if (request.task === `${role}:init`) initialize(request);
      if (request.task === `${role}:cancel`) await cancel(request);
      if (request.task === `${role}:query`) await query(request);
    },
    dispose: async () => {
      void trace({ type: 'disposed' });
    },
  };
};
const runtime = new SharedModelRuntime(role, createDriver);
void trace({ type: 'created' });
globalThis.addEventListener('connect', (event) => runtime.connect(event.ports[0]));
