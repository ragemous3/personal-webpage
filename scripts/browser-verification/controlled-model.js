const instance = crypto.randomUUID();
const pending = new Map();
const trace = (event) =>
  fetch('/__verify/events', {
    method: 'POST',
    body: JSON.stringify({ instance, role: globalThis.verificationRole, at: Date.now(), ...event }),
  });
void trace({ type: 'created' });
const reply = (request, suffix, payload) =>
  globalThis.postMessage({ ...request, task: `${request.name}:${suffix}`, payload });
const initialize = (request) => {
  void trace({ type: 'initialized', client: request.id });
  if (request.payload?.fail)
    globalThis.postMessage({ ...request, error: { message: 'Controlled initialization failure' } });
  else reply(request, 'ready', null);
};
const cancel = (request) => {
  clearTimeout(pending.get(request.requestId));
  pending.delete(request.requestId);
  void trace({ type: 'stopped', client: request.id, requestId: request.requestId });
};
const query = (request) => {
  const { payload, requestId, id } = request;
  void trace({ type: 'accepted', client: id, requestId });
  if (payload?.stopWorker) {
    void trace({ type: 'closing' }).finally(() => globalThis.close());
    return;
  }
  if (payload?.hold) return;
  if (request.name === 'vectordb') {
    reply(request, 'query:response', {
      response: { neighbors: [0], distances: [0.1] },
      query: payload.query,
    });
    void trace({ type: 'answer', client: id, requestId });
    return;
  }
  generate(request);
};
const generate = (request) => {
  const { payload, requestId, id } = request;
  reply(request, 'stream:response', `Controlled ${payload?.question ?? 'answer'}`);
  const timer = setTimeout(() => {
    reply(request, 'message:response', {
      generated_text: `Controlled ${payload?.question ?? 'answer'}`,
    });
    void trace({ type: 'answer', client: id, requestId });
    pending.delete(requestId);
  }, payload?.delay ?? 20);
  pending.set(requestId, timer);
};
globalThis.addEventListener('message', ({ data }) =>
  ({ init: initialize, cancel, query })[data.task.split(':').at(-1)]?.(data),
);
