import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OwnedBotRuntime } from '@/layers/data/configuration-runtime.data';
import { defaultAssistantSettings } from '@/layers/services/configuration.service';

class BrowserWorker extends EventTarget {
  sent = [];
  terminated = false;
  postMessage(message) {
    this.sent.push(message);
    if (message.task.endsWith(':init'))
      queueMicrotask(() => {
        this.dispatchEvent(
          new MessageEvent('message', {
            data: { ...message, task: message.task.replace(':init', ':ready') },
          }),
        );
      });
  }
  terminate() {
    this.terminated = true;
  }
}

test('Auto reaches both worker initializations unchanged', async () => {
  const workers = [];
  const runtime = new OwnedBotRuntime(
    { source: 'llm.js' },
    { source: 'db.js' },
    () => {
      const worker = new BrowserWorker();
      workers.push(worker);
      return worker;
    },
  );
  await runtime.apply(defaultAssistantSettings);
  assert.equal(workers.length, 2);
  assert.equal(workers[0].sent[0].payload.device, 'auto');
  assert.equal(workers[1].sent[0].payload.device, 'auto');
  runtime.dispose();
});

test('generation-only changes reuse both pipelines; precision replaces only the model', async () => {
  const workers = [];
  const runtime = new OwnedBotRuntime(
    { source: 'llm.js' },
    { source: 'db.js' },
    () => {
      const worker = new BrowserWorker();
      workers.push(worker);
      return worker;
    },
  );
  await runtime.apply(defaultAssistantSettings);
  await runtime.apply({ ...defaultAssistantSettings, maxNewTokens: 64 });
  assert.equal(workers.length, 2);
  runtime.chat.send({ message: [] }, 'question');
  assert.deepEqual(workers[0].sent.at(-1).payload.generation, {
    max_new_tokens: 64,
    do_sample: false,
  });
  await runtime.apply({ ...defaultAssistantSettings, precision: 'auto' });
  assert.equal(workers.length, 3);
  assert.equal(workers[0].terminated, true);
  assert.equal(workers[1].terminated, false);
  await runtime.apply({ ...defaultAssistantSettings, mode: 'online' });
  assert.equal(
    workers.every((worker) => worker.terminated),
    true,
  );
  runtime.dispose();
});

test('a released owner engine does not forward retired worker callbacks', async () => {
  const workers = [];
  const make = () =>
    new OwnedBotRuntime(
      { source: 'llm.js' },
      { source: 'db.js' },
      () => {
        const worker = new BrowserWorker();
        workers.push(worker);
        return worker;
      },
    );
  const first = make();
  const second = make();
  await first.apply(defaultAssistantSettings);
  await second.apply(defaultAssistantSettings);
  const received = [];
  first.chat.onData((message) => received.push(message));
  first.dispose();
  workers[0].dispatchEvent(new MessageEvent('message', { data: { task: 'llm:ready' } }));
  assert.equal(received.length, 1);
  assert.equal(workers[2].terminated, false);
  assert.equal(workers[3].terminated, false);
  second.dispose();
});
