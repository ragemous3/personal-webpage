import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SharedModelRuntime } from '@/layers/data/workers/shared-model-runtime.data';

const until = async (predicate) => {
  const end = Date.now() + 1500;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Expected model protocol observation');
};

test('model runtime reports its real instance, shares loaded state and routes replies through the bound port', async (context) => {
  let loads = 0;
  const runtime = new SharedModelRuntime('llm', (publish) => ({
    handle: async ({ data }) => {
      if (data.task === 'llm:init') {
        loads++;
        publish({ ...data, task: 'llm:ready', payload: null });
      }
      if (data.task === 'llm:query')
        publish({ ...data, task: 'llm:message:response', payload: { generated_text: 'Answer' } });
    },
    dispose: async () => {},
  }));
  const { port1, port2 } = new MessageChannel();
  const messages = [];
  port2.addEventListener('message', ({ data }) => messages.push(data));
  port2.start();
  runtime.connect(port1);
  context.after(() => {
    runtime.close();
    port2.close();
  });
  await until(() => messages.some((message) => message.task === 'runtime:state'));
  const instance = messages[0].payload.instanceId;
  const id = crypto.randomUUID();
  port2.postMessage({
    id,
    name: 'llm',
    task: 'runtime:bind',
    payload: null,
    runtimeEpoch: 'epoch-one',
  });
  await until(() => messages.some((message) => message.task === 'runtime:bound'));
  port2.postMessage({
    id,
    name: 'llm',
    task: 'llm:init',
    payload: { model: 'test' },
    runtimeEpoch: 'epoch-one',
  });
  await until(() => messages.some((message) => message.task === 'llm:ready'));
  port2.postMessage({
    id,
    name: 'llm',
    task: 'llm:query',
    payload: {},
    requestId: 'a',
    runtimeEpoch: 'epoch-one',
  });
  await until(() => messages.some((message) => message.task === 'llm:message:response'));
  const final = messages.find((message) => message.task === 'llm:message:response');
  assert.equal(final.instanceId, instance);
  assert.equal(final.runtimeEpoch, 'epoch-one');
  assert.equal(final.requestId, 'a');
  assert.equal(loads, 1);
});

test('rebinding cancels stale work and waits for stopping while retaining the loaded pipeline', async (context) => {
  let publish;
  let finish;
  let cancellations = 0;
  let loads = 0;
  const runtime = new SharedModelRuntime('llm', (send) => {
    publish = send;
    return {
      handle: async ({ data }) => {
        if (data.task === 'llm:init') {
          loads++;
          send({ ...data, task: 'llm:ready', payload: null });
        }
        if (data.task === 'llm:cancel') cancellations++;
        if (data.task === 'llm:query' && data.requestId === 'old')
          await new Promise((resolve) => {
            finish = resolve;
          });
        if (data.task === 'llm:query' && data.requestId === 'new')
          send({
            ...data,
            task: 'llm:message:response',
            payload: { generated_text: 'New answer' },
          });
      },
      dispose: async () => {},
    };
  });
  const connect = () => {
    const { port1, port2 } = new MessageChannel();
    const messages = [];
    port2.addEventListener('message', ({ data }) => messages.push(data));
    port2.start();
    runtime.connect(port1);
    context.after(() => port2.close());
    return { port: port2, messages };
  };
  const a = connect();
  const id = crypto.randomUUID();
  const send = (peer, task, epoch, requestId) =>
    peer.port.postMessage({
      id,
      name: 'llm',
      task,
      payload: {},
      runtimeEpoch: epoch,
      ...(requestId ? { requestId } : {}),
    });
  context.after(() => runtime.close());
  send(a, 'runtime:bind', 'old-epoch');
  await until(() => a.messages.some((message) => message.task === 'runtime:bound'));
  send(a, 'llm:init', 'old-epoch');
  await until(() => a.messages.some((message) => message.task === 'llm:ready'));
  send(a, 'llm:query', 'old-epoch', 'old');
  await until(() => finish);
  const b = connect();
  send(b, 'runtime:bind', 'new-epoch');
  await until(() => cancellations === 1);
  assert.equal(
    b.messages.some((message) => message.task === 'runtime:bound'),
    false,
  );
  publish({ id, name: 'llm', task: 'llm:stream:response', requestId: 'old', payload: 'stale' });
  finish();
  await until(() => b.messages.some((message) => message.task === 'runtime:bound'));
  assert.equal(b.messages.find((message) => message.task === 'runtime:bound').payload.loaded, true);
  send(b, 'llm:query', 'new-epoch', 'new');
  await until(() => b.messages.some((message) => message.task === 'llm:message:response'));
  assert.equal(
    a.messages.some((message) => message.payload === 'stale'),
    false,
  );
  assert.equal(loads, 1);
});

test('an unbound surplus model port is closed after its one-time registration deadline', async (context) => {
  const runtime = new SharedModelRuntime(
    'llm',
    () => ({ handle: async () => {}, dispose: async () => {} }),
    25,
  );
  const { port1, port2 } = new MessageChannel();
  let closed = false;
  port2.addEventListener('close', () => {
    closed = true;
  });
  port2.start();
  runtime.connect(port1);
  context.after(async () => {
    await runtime.close();
    port2.close();
  });
  await until(() => closed);
});

test('failed disposal cannot advertise a partially disposed pipeline as ready on recovery', async (context) => {
  let failDisposal = true;
  const runtime = new SharedModelRuntime('llm', (publish) => ({
    handle: async ({ data }) => {
      if (data.task === 'llm:init') publish({ ...data, task: 'llm:ready' });
    },
    dispose: async () => {
      if (failDisposal) {
        failDisposal = false;
        throw new Error('disposal failed');
      }
    },
  }));
  const { port1, port2 } = new MessageChannel();
  const messages = [];
  port2.addEventListener('message', ({ data }) => messages.push(data));
  port2.start();
  runtime.connect(port1);
  context.after(async () => {
    await runtime.close();
    port2.close();
  });
  const send = (task, runtimeEpoch) =>
    port2.postMessage({ id: crypto.randomUUID(), name: 'llm', task, runtimeEpoch, payload: {} });
  send('runtime:bind', 'first');
  await until(() => messages.some((message) => message.task === 'runtime:bound'));
  send('llm:init', 'first');
  await until(() => messages.some((message) => message.task === 'llm:ready'));
  send('runtime:dispose', 'second');
  await until(() => messages.some((message) => message.error));
  send('runtime:bind', 'third');
  await until(() => messages.some((message) => message.runtimeEpoch === 'third'));
  const recovery = messages.find((message) => message.runtimeEpoch === 'third');
  assert.match(recovery.error?.message ?? '', /disposal failed/);
  assert.notEqual(recovery.task, 'runtime:bound');
});

test('recovery binding waits for in-flight disposal before any new initialization', async (context) => {
  let finishDisposal;
  let loads = 0;
  let disposed = false;
  let disposals = 0;
  const runtime = new SharedModelRuntime('llm', (publish) => ({
    handle: async ({ data }) => {
      if (data.task === 'llm:init') {
        loads++;
        publish({ ...data, task: 'llm:ready' });
      }
    },
    dispose: async () => {
      if (++disposals === 1)
        await new Promise((resolve) => {
          finishDisposal = () => {
            disposed = true;
            resolve();
          };
        });
    },
  }));
  const connect = () => {
    const { port1, port2 } = new MessageChannel();
    const messages = [];
    port2.addEventListener('message', ({ data }) => messages.push(data));
    port2.start();
    runtime.connect(port1);
    context.after(() => port2.close());
    return {
      messages,
      send: (task, runtimeEpoch) =>
        port2.postMessage({
          id: crypto.randomUUID(),
          name: 'llm',
          task,
          runtimeEpoch,
          payload: {},
        }),
    };
  };
  context.after(async () => {
    finishDisposal?.();
    await runtime.close();
  });
  const a = connect();
  a.send('runtime:bind', 'first');
  await until(() => a.messages.some((message) => message.task === 'runtime:bound'));
  a.send('llm:init', 'first');
  await until(() => loads === 1);
  a.send('runtime:dispose', 'replacement');
  await until(() => finishDisposal);
  const b = connect();
  b.send('runtime:bind', 'recovery');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(
    b.messages.some((message) => message.task === 'runtime:bound'),
    false,
  );
  assert.equal(loads, 1);
  assert.equal(disposed, false);
  finishDisposal();
  await until(() => b.messages.some((message) => message.task === 'runtime:bound'));
  b.send('llm:init', 'recovery');
  await until(() => loads === 2);
  assert.equal(disposed, true);
});
