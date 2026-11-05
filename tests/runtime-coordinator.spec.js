import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RuntimeCoordinatorStateMachine } from '@/layers/data/workers/runtime-coordinator-state-machine.data';

const client = (runtime, context) => {
  const { port1, port2 } = new MessageChannel();
  const id = crypto.randomUUID();
  const messages = [];
  port2.addEventListener('message', ({ data }) => messages.push(data));
  port2.start();
  runtime.connect(port1);
  context.after(() => {
    port1.close();
    port2.close();
  });
  const send = (task, payload = null, requestId) =>
    port2.postMessage(
      { id, name: 'coordinator', task, payload, ...(requestId ? { requestId } : {}) },
      payload?.port ? [payload.port] : [],
    );
  send('runtime:attach');
  return { id, messages, send };
};
const waitFor = async (predicate) => {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Expected runtime observation before deadline');
};

test('joining tabs observe one model initialization and their own readiness', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const { port1, port2 } = new MessageChannel();
  let loads = 0;
  const instanceId = crypto.randomUUID();
  port2.addEventListener('message', ({ data }) => {
    if (data.task === 'runtime:bind')
      port2.postMessage({
        ...data,
        task: 'runtime:bound',
        payload: { instanceId, loaded: false },
        runtimeEpoch: data.runtimeEpoch,
      });
    if (data.task === 'llm:init') {
      loads++;
      port2.postMessage({ ...data, task: 'llm:ready', payload: null });
    }
  });
  port2.start();
  context.after(() => port2.close());
  a.send('runtime:register', { role: 'llm', port: port1, instanceId });
  const aChannel = crypto.randomUUID();
  a.send('runtime:host', {
    id: aChannel,
    name: 'llm',
    task: 'llm:init',
    payload: { model: 'test' },
  });
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  const b = client(runtime, context);
  const bChannel = crypto.randomUUID();
  b.send('runtime:host', {
    id: bChannel,
    name: 'llm',
    task: 'llm:init',
    payload: { model: 'test' },
  });
  await waitFor(() => b.messages.some((message) => message.payload?.task === 'llm:ready'));
  assert.equal(loads, 1);
  assert.equal(
    a.messages.find((message) => message.payload?.task === 'llm:ready').payload.id,
    aChannel,
  );
  assert.equal(
    b.messages.find((message) => message.payload?.task === 'llm:ready').payload.id,
    bChannel,
  );
});

const attachModel = (a, context) => {
  const { port1, port2 } = new MessageChannel();
  const queries = [];
  const cancellations = [];
  const instanceId = crypto.randomUUID();
  port2.addEventListener('message', ({ data }) => {
    if (data.task === 'runtime:bind')
      port2.postMessage({ ...data, task: 'runtime:bound', payload: { instanceId, loaded: false } });
    if (data.task === 'llm:init') port2.postMessage({ ...data, task: 'llm:ready', payload: null });
    if (data.task === 'llm:cancel') cancellations.push(data);
    if (data.task === 'llm:query') {
      queries.push(data);
      port2.postMessage({ ...data, task: 'llm:started', payload: null });
    }
  });
  port2.start();
  context.after(() => port2.close());
  a.send('runtime:register', { role: 'llm', port: port1, instanceId });
  return {
    queries,
    cancellations,
    instanceId,
    emit: (message) => port2.postMessage(message),
    complete: (index, text) =>
      port2.postMessage({
        ...queries[index],
        task: 'llm:message:response',
        payload: { generated_text: text },
      }),
  };
};
const host = (a) => {
  const channel = crypto.randomUUID();
  a.send('runtime:host', {
    id: channel,
    name: 'llm',
    task: 'llm:init',
    payload: { model: 'test' },
  });
  return channel;
};

test('generation runs FIFO across tabs and sends final responses only to the requesting channel', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const b = client(runtime, context);
  const model = attachModel(a, context);
  const aChannel = host(a);
  const bChannel = host(b);
  await waitFor(() => b.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:send', {
    id: aChannel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'first',
    payload: { message: [] },
  });
  await waitFor(() => model.queries.length === 1);
  b.send('runtime:send', {
    id: bChannel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'second',
    payload: { message: [] },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(model.queries.length, 1);
  model.complete(0, 'First answer');
  await waitFor(() => model.queries.length === 2);
  model.complete(1, 'Second answer');
  await waitFor(() =>
    b.messages.some((message) => message.payload?.payload?.generated_text === 'Second answer'),
  );
  assert.equal(model.queries[0].requestId, 'first');
  assert.equal(model.queries[1].requestId, 'second');
  assert.equal(
    a.messages.some((message) => message.payload?.requestId === 'second'),
    false,
  );
  assert.equal(
    b.messages.some((message) => message.payload?.requestId === 'first'),
    false,
  );
});

test('queued cancellation never starts and active cancellation waits for a real stop before releasing the next request', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const model = attachModel(a, context);
  const channel = host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  const send = (requestId, action = 'query') =>
    a.send('runtime:send', {
      id: channel,
      name: 'llm',
      task: `llm:${action}`,
      requestId,
      payload: {},
    });
  send('active');
  await waitFor(() => model.queries.length === 1);
  send('queued');
  send('queued', 'cancel');
  await waitFor(() =>
    a.messages.some(
      (message) =>
        message.payload?.task === 'llm:stopped' && message.payload.requestId === 'queued',
    ),
  );
  send('next');
  send('active', 'cancel');
  await waitFor(() => model.cancellations.length === 1);
  assert.equal(model.queries.length, 1);
  model.emit({ ...model.queries[0], task: 'llm:stream:response', payload: 'late chunk' });
  model.emit({ ...model.queries[0], task: 'llm:stopped', payload: null });
  await waitFor(() => model.queries.length === 2);
  assert.equal(model.queries[1].requestId, 'next');
  assert.equal(
    a.messages.some((message) => message.payload?.payload === 'late chunk'),
    false,
  );
});

test('a model that does not confirm cancellation fails boundedly and cannot start more inference', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine({ stoppingMs: 25, requestMs: 10_000 });
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const model = attachModel(a, context);
  const channel = host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:send', {
    id: channel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'stuck',
    payload: {},
  });
  await waitFor(() => model.queries.length === 1);
  a.send('runtime:send', {
    id: channel,
    name: 'llm',
    task: 'llm:cancel',
    requestId: 'stuck',
    payload: {},
  });
  a.send('runtime:send', {
    id: channel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'later',
    payload: {},
  });
  await waitFor(() =>
    a.messages.some(
      (message) => message.payload?.requestId === 'stuck' && message.payload.runtimeFailure,
    ),
  );
  assert.equal(model.queries.length, 1);
});

test('explicit tab departure cancels its active work without stopping another tab model use', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const b = client(runtime, context);
  const model = attachModel(a, context);
  const aChannel = host(a);
  const bChannel = host(b);
  await waitFor(() => b.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:send', {
    id: aChannel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'departing',
    payload: {},
  });
  await waitFor(() => model.queries.length === 1);
  b.send('runtime:send', {
    id: bChannel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'surviving',
    payload: {},
  });
  a.send('runtime:detach');
  await waitFor(() => model.cancellations.length === 1);
  model.emit({ ...model.queries[0], task: 'llm:stopped', payload: null });
  await waitFor(() => model.queries.length === 2);
  model.complete(1, 'Surviving answer');
  await waitFor(() =>
    b.messages.some((message) => message.payload?.payload?.generated_text === 'Surviving answer'),
  );
});

test('model failure is replayed to late joiners and stale ready events cannot resurrect it', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const model = attachModel(a, context);
  const channel = host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:send', {
    id: channel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'lost',
    payload: {},
  });
  await waitFor(() => model.queries.length === 1);
  a.send('runtime:failed', { role: 'llm', instanceId: model.instanceId, reason: 'Worker failed' });
  await waitFor(() =>
    a.messages.some(
      (message) => message.payload?.requestId === 'lost' && message.payload.runtimeFailure,
    ),
  );
  model.emit({ ...model.queries[0], task: 'llm:ready', payload: null });
  const b = client(runtime, context);
  host(b);
  await waitFor(() => b.messages.some((message) => message.payload?.runtimeFailure));
  assert.equal(
    b.messages.some((message) => message.payload?.task === 'llm:ready'),
    false,
  );
});

test('configuration waits for the whole accepted response including the retrieval-to-generation gap', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const model = attachModel(a, context);
  host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:begin', { requestId: 'full-response' });
  a.send(
    'runtime:configure',
    { configurations: { llm: { model: 'test', generation: { max_new_tokens: 12 } } } },
    'configuration',
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(
    a.messages.some((message) => message.task === 'runtime:configured'),
    false,
  );
  a.send('runtime:finish', { requestId: 'full-response' });
  await waitFor(() => a.messages.some((message) => message.task === 'runtime:configured'));
  assert.equal(model.queries.length, 0);
});

test('a pending configuration is shared immediately and rejects new whole-response leases while accepted work drains', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  attachModel(a, context);
  host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:begin', { requestId: 'accepted' }, 'accepted-command');
  a.send(
    'runtime:configure',
    { configurations: { llm: { model: 'test', generation: {} } } },
    'configuration',
  );
  await waitFor(() =>
    a.messages.some((message) => message.task === 'runtime:state' && message.payload.configuring),
  );
  a.send('runtime:begin', { requestId: 'new' }, 'new-command');
  await waitFor(() =>
    a.messages.some(
      (message) => message.task === 'runtime:failed' && message.requestId === 'new-command',
    ),
  );
});

test('an expired whole-response lease cannot start late inference after another configuration can drain', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine({ requestMs: 25 });
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const model = attachModel(a, context);
  const channel = host(a);
  await waitFor(() => a.messages.some((message) => message.payload?.task === 'llm:ready'));
  a.send('runtime:begin', { requestId: 'expired' }, 'begin-expired');
  await new Promise((resolve) => setTimeout(resolve, 40));
  a.send('runtime:send', {
    id: channel,
    name: 'llm',
    task: 'llm:query',
    requestId: 'expired',
    operationId: 'expired',
    payload: {},
  });
  await waitFor(() =>
    a.messages.some(
      (message) => message.payload?.requestId === 'expired' && message.payload.runtimeFailure,
    ),
  );
  assert.equal(model.queries.length, 0);
});

test('resource failure releases the stale model port before a replacement can register', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const { port1, port2 } = new MessageChannel();
  const instanceId = crypto.randomUUID();
  let closed = false;
  port2.addEventListener('close', () => {
    closed = true;
  });
  port2.addEventListener('message', ({ data }) => {
    if (data.task === 'runtime:bind')
      port2.postMessage({ ...data, task: 'runtime:bound', payload: { instanceId, loaded: false } });
  });
  port2.start();
  context.after(() => port2.close());
  a.send('runtime:register', { role: 'llm', instanceId, port: port1 });
  await waitFor(() =>
    a.messages.some((message) =>
      message.payload?.resources?.some((resource) => resource.instanceId === instanceId),
    ),
  );
  a.send('runtime:failed', { role: 'llm', instanceId, reason: 'Stopped worker' });
  await waitFor(() => closed);
});

test('shared mode changes drain accepted responses and reject new work while Online is active', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  const b = client(runtime, context);
  const accepted = crypto.randomUUID();
  a.send('runtime:begin', { requestId: accepted }, accepted);
  await waitFor(() =>
    a.messages.some((m) => m.requestId === accepted && m.task === 'runtime:accepted'),
  );
  const change = crypto.randomUUID();
  b.send(
    'runtime:configure',
    { configurations: {}, selection: { enabled: false, settings: { mode: 'online' } } },
    change,
  );
  await waitFor(() =>
    a.messages.some(
      (m) => m.payload?.selection?.settings?.mode === 'online' && m.payload.configuring,
    ),
  );
  assert.equal(
    b.messages.some((m) => m.requestId === change && m.task === 'runtime:configured'),
    false,
  );
  const waiting = a.messages.findLast((m) => m.task === 'runtime:state').payload;
  assert.equal(waiting.responding, true);
  assert.equal(waiting.configurationLoading, false);
  a.send('runtime:finish', { requestId: accepted });
  await waitFor(() =>
    b.messages.some((m) => m.requestId === change && m.task === 'runtime:configured'),
  );
  const blocked = crypto.randomUUID();
  a.send('runtime:begin', { requestId: blocked }, blocked);
  await waitFor(() => a.messages.some((m) => m.requestId === blocked));
  assert.equal(a.messages.find((m) => m.requestId === blocked).task, 'runtime:failed');
  assert.ok(a.messages.some((m) => m.payload?.activeSelection?.enabled === false));
});

test('queued settings edits coalesce to the latest mode before an accepted response drains', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine();
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  a.send('runtime:begin', { requestId: 'response' }, 'begin');
  await waitFor(() => a.messages.some((m) => m.task === 'runtime:accepted'));
  a.send(
    'runtime:configure',
    { configurations: {}, selection: { enabled: false, settings: { mode: 'online' } } },
    'old',
  );
  a.send(
    'runtime:configure',
    { configurations: {}, selection: { enabled: true, settings: { mode: 'local' } } },
    'latest',
  );
  await waitFor(() => a.messages.some((m) => m.payload?.selection?.settings?.mode === 'local'));
  a.send('runtime:finish', { requestId: 'response' });
  await waitFor(() =>
    a.messages.some((m) => m.requestId === 'latest' && m.task === 'runtime:configured'),
  );
  assert.equal(
    a.messages.some((m) => m.payload?.activeSelection?.settings?.mode === 'online'),
    false,
  );
});

test('configuration before channel hosting retains the model registration deadline', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine({ connectionMs: 10, initializationMs: 1000 });
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  a.send(
    'runtime:configure',
    {
      configurations: { llm: { model: 'test' } },
      selection: { enabled: true, settings: { mode: 'local' } },
    },
    'missing-model',
  );
  await waitFor(() =>
    a.messages.some((m) => m.task === 'runtime:failed' && m.requestId === 'missing-model'),
  );
  const failed = a.messages.find((m) =>
    m.payload?.resources?.some((r) => r.role === 'llm' && r.status === 'failed'),
  );
  assert.equal(
    failed.payload.resources.find((r) => r.role === 'llm').error,
    'Model registration deadline exceeded',
  );
});

test('a configuration-repair port waits for the new command instead of restarting failed settings', async (context) => {
  const runtime = new RuntimeCoordinatorStateMachine({ connectionMs: 10, initializationMs: 1000 });
  context.after(() => runtime.dispose());
  const a = client(runtime, context);
  a.send('runtime:configure', { configurations: { llm: { device: 'webgpu' } } }, 'failed');
  await waitFor(() =>
    a.messages.some((m) => m.task === 'runtime:failed' && m.requestId === 'failed'),
  );
  const { port1, port2 } = new MessageChannel();
  context.after(() => port2.close());
  const instanceId = crypto.randomUUID();
  const initialized = [];
  port2.addEventListener('message', ({ data }) => {
    if (data.task === 'runtime:bind')
      port2.postMessage({ ...data, task: 'runtime:bound', payload: { instanceId, loaded: false } });
    if (data.task === 'llm:init') {
      initialized.push(data.payload);
      port2.postMessage({ ...data, task: 'llm:ready', payload: null });
    }
  });
  port2.start();
  a.send('runtime:register', { role: 'llm', port: port1, instanceId, deferConfiguration: true });
  await waitFor(() =>
    a.messages.some((m) =>
      m.payload?.resources?.some(
        (r) => r.role === 'llm' && r.status === 'uninitialized' && r.instanceId === instanceId,
      ),
    ),
  );
  assert.equal(initialized.length, 0);
  a.send('runtime:configure', { configurations: { llm: { device: 'wasm' } } }, 'replacement');
  await waitFor(() =>
    a.messages.some((m) => m.task === 'runtime:configured' && m.requestId === 'replacement'),
  );
  assert.deepEqual(initialized, [{ device: 'wasm' }]);
});
