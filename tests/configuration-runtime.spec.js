import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfigurationRuntime } from '@/layers/data/configuration-runtime.data';
import { defaultAssistantSettings } from '@/layers/shared/models/assistant-settings.model';

const disconnect = () => {};
const channel = (payload) => ({
  configuration: { payload },
  initialized: 0,
  initialize() {
    this.initialized++;
  },
});
const fixture = () => {
  const calls = [];
  let listener;
  const coordinator = {
    onData(callback) {
      listener = callback;
      return disconnect;
    },
    async configure(configurations, selection) {
      calls.push({ configurations, selection });
    },
  };
  const chat = channel({ model: 'original', generation: {} });
  const database = channel({ model: 'MiniLM', dtype: 'uint8', dim: 384 });
  const availability = [];
  const runtime = new ConfigurationRuntime(coordinator, chat, database, (value) =>
    availability.push(value),
  );
  return {
    runtime,
    coordinator,
    calls,
    chat,
    database,
    availability,
    publish: (payload) => listener({ task: 'runtime:state', payload }),
  };
};

test('saved Online mode configures shared availability without hosting model channels', async () => {
  const { runtime, calls, chat, database } = fixture();
  const selected = { ...defaultAssistantSettings, mode: 'online' };
  runtime.select(selected);
  await runtime.apply(selected);
  assert.equal(chat.initialized, 0);
  assert.equal(database.initialized, 0);
  assert.deepEqual(calls[0].configurations, {});
  assert.equal(calls[0].selection.enabled, false);
});

test('Local settings map Auto unchanged, retain retrieval precision and host channels only once', async () => {
  const { runtime, calls, chat, database } = fixture();
  runtime.select(defaultAssistantSettings);
  await runtime.apply(defaultAssistantSettings);
  assert.equal(calls[0].configurations.llm.device, 'auto');
  assert.equal(calls[0].configurations.vectordb.device, 'auto');
  assert.equal(calls[0].configurations.vectordb.dtype, 'uint8');
  assert.deepEqual(calls[0].configurations.llm.generation, {
    max_new_tokens: 256,
    do_sample: false,
  });
  runtime.select({ ...defaultAssistantSettings, sampling: true, maxNewTokens: 32 });
  await runtime.apply({ ...defaultAssistantSettings, sampling: true, maxNewTokens: 32 });
  assert.equal(calls[1].configurations.llm.generation.temperature, 0.7);
  assert.equal(chat.initialized, 1);
  assert.equal(database.initialized, 1);
});

test('a superseded configuration failure cannot cause the latest selection to be retried', async () => {
  const { runtime, coordinator, calls } = fixture();
  let rejectOld;
  coordinator.configure = () => {
    calls.push('configuration');
    if (calls.length === 1)
      return new Promise((resolve, reject) => {
        rejectOld = reject;
      });
    return Promise.resolve();
  };
  runtime.select(defaultAssistantSettings);
  const latest = { ...defaultAssistantSettings, maxNewTokens: 48 };
  runtime.select(latest);
  rejectOld(new Error('Old settings failed'));
  await new Promise((resolve) => setImmediate(resolve));
  await runtime.apply(latest);
  assert.equal(calls.length, 2);
});
