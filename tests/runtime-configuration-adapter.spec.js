import assert from 'node:assert/strict';
import test from 'node:test';

import { RuntimeConfigurationAdapter } from '@/layers/data/runtime-configuration.adapter';
import { defaultAssistantSettings } from '@/layers/shared/models/assistant-settings.model';

import { modelDescriptors } from './model-metadata.fixture.js';

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
  const runtime = new RuntimeConfigurationAdapter(
    coordinator,
    chat,
    database,
    (value) => availability.push(value),
    modelDescriptors,
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

test('Local settings map Auto unchanged, retain retrieval precision and leave generation hosting to the mode composition', async () => {
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
  assert.equal(chat.initialized, 0);
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

test('a superseded initial Local selection never hosts channels after Online is selected', async () => {
  const { runtime, coordinator, chat, database } = fixture();
  const complete = [];
  coordinator.configure = () => new Promise((resolve) => complete.push(resolve));
  runtime.select(defaultAssistantSettings);
  const online = { ...defaultAssistantSettings, mode: 'online' };
  runtime.select(online);
  complete[0]();
  complete[1]();
  await runtime.apply(online);
  assert.equal(chat.initialized, 0);
  assert.equal(database.initialized, 0);
});

test('a delayed Local connection cannot submit configuration after a newer Online request', async () => {
  const { RuntimeCoordinatorAbstract } =
    await import('@/layers/data/abstracts/runtime-coordinator.abstract');
  class Coordinator extends RuntimeCoordinatorAbstract {}
  let receive;
  let release;
  const dispatched = [];
  const connection = {
    policy: {},
    carrier: {},
    listen(callback) {
      receive = callback;
    },
    ensureModels: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    control(task, payload, requestId) {
      dispatched.push(payload.selection.settings.mode);
      queueMicrotask(() =>
        receive({
          id: 'client',
          name: 'coordinator',
          task: 'runtime:configured',
          payload: null,
          requestId,
        }),
      );
    },
  };
  const coordinator = new Coordinator(connection);
  const old = coordinator.configure({ llm: {} }, { enabled: true, settings: { mode: 'local' } });
  const latest = coordinator.configure({}, { enabled: false, settings: { mode: 'online' } });
  release();
  await Promise.all([old, latest]);
  assert.deepEqual(dispatched, ['online']);
});

test('cancelling before the response lease acknowledgement cannot create a later local timeout', async () => {
  const { RuntimeCoordinatorAbstract } = await import('@/layers/data/abstracts/runtime-coordinator.abstract');
  class Coordinator extends RuntimeCoordinatorAbstract {}
  let receive;
  let acknowledge;
  const connection = {
    policy: { requestMs: 20 }, carrier: {},
    ensureModels: async () => {},
    listen(listener) { receive = listener; },
    control(task, _payload, requestId) {
      if (task === 'runtime:begin') acknowledge = () => receive({ id: 'client', name: 'coordinator', task: 'runtime:begun', requestId });
    },
  };
  const coordinator = new Coordinator(connection);
  coordinator.host({ id: 'chat', name: 'llm', task: 'llm:init', payload: {} });
  const messages = [];
  coordinator.onData((message) => messages.push(message));
  const beginning = coordinator.begin('cancel-before-ack');
  coordinator.finish('cancel-before-ack');
  acknowledge();
  await beginning;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(messages.some((message) => message.runtimeFailure), false);
});

test('shared model recovery remains pending and unavailable until resource readiness returns', () => {
  const { runtime, publish } = fixture();
  publish({
    selection: { settings: defaultAssistantSettings },
    activeSelection: { settings: defaultAssistantSettings },
    configuring: false,
    configurationLoading: false,
    resources: [
      { role: 'llm', status: 'loading' },
      { role: 'vectordb', status: 'ready' },
    ],
  });
  const state = runtime.stateSubscription.getValue().runtime;
  assert.equal(state.pending, true);
  assert.equal(state.loading, true);
  assert.equal(state.ready, false);
});

test('channel reattachment uses the latest settings rather than the initial startup configuration', async () => {
  const { RuntimeCoordinatorAbstract } =
    await import('@/layers/data/abstracts/runtime-coordinator.abstract');
  const { Chat } = await import('@/layers/data/local-chat-lm.data');
  const { DB } = await import('@/layers/data/local-vector-database.data');
  class Coordinator extends RuntimeCoordinatorAbstract {}
  let receive;
  const hosted = [];
  const connection = {
    policy: {},
    carrier: {},
    attachmentVersion: 0,
    listen(callback) {
      receive = callback;
    },
    async ensureModels() {},
    reconnect() {
      this.attachmentVersion++;
      receive({
        id: 'client',
        name: 'coordinator',
        task: 'runtime:state',
        payload: { resources: [], configuring: false },
      });
    },
    control(task, payload, requestId) {
      if (task === 'runtime:host') hosted.push(payload);
      if (requestId)
        queueMicrotask(() =>
          receive({
            id: 'client',
            name: 'coordinator',
            task: task === 'runtime:recover' ? 'runtime:recovered' : 'runtime:configured',
            payload: null,
            requestId,
          }),
        );
    },
  };
  const coordinator = new Coordinator(connection);
  const chat = new Chat(coordinator, { name: 'llm', payload: { generation: {} } }, false);
  const database = new DB(coordinator, { name: 'vectordb', payload: {} }, false);
  const runtime = new RuntimeConfigurationAdapter(
    coordinator,
    chat,
    database,
    disconnect,
    modelDescriptors,
  );
  runtime.select(defaultAssistantSettings);
  await runtime.apply(defaultAssistantSettings);
  chat.initialize();
  const latest = { ...defaultAssistantSettings, execution: 'wasm', maxNewTokens: 48 };
  runtime.select(latest);
  await runtime.apply(latest);
  await coordinator.reconnect();
  assert.equal(hosted.find((m) => m.name === 'llm').payload.device, 'wasm');
  assert.equal(hosted.find((m) => m.name === 'llm').payload.generation.max_new_tokens, 48);
});

test('Online configures retrieval alone and ignores a failed Local generation resource', async () => {
  const { runtime, calls, chat, publish } = fixture();
  const settings = { ...defaultAssistantSettings, mode: 'online', onlineModel: 'gpt-6-luna' };
  runtime.select(settings);
  await runtime.apply(settings);
  assert.deepEqual(Object.keys(calls[0].configurations), ['vectordb']);
  assert.equal(chat.initialized, 0);
  publish({ selection: { settings }, activeSelection: { settings }, mountSelection: { settings }, configuring: false,
    resources: [{ role: 'llm', status: 'failed' }, { role: 'vectordb', status: 'ready' }] });
  assert.equal(runtime.stateSubscription.getValue().runtime.ready, true);
  assert.deepEqual(runtime.stateSubscription.getValue().mounted, settings);
});

test('a tab cannot report ready against another model revision held by the shared runtime', () => {
  const { runtime, publish } = fixture();
  publish({
    selection: { settings: defaultAssistantSettings },
    activeSelection: { settings: defaultAssistantSettings },
    configuring: false,
    resources: [
      { role: 'llm', status: 'ready', revision: '0'.repeat(40) },
      { role: 'vectordb', status: 'ready' },
    ],
  });
  const state = runtime.stateSubscription.getValue();
  assert.equal(state.runtime.ready, false);
  assert.match(state.runtime.error, /revision/);
});

test('an accepted response draining on the previous revision remains pending without a failure', () => {
  const { runtime, publish } = fixture();
  publish({
    selection: { settings: defaultAssistantSettings },
    activeSelection: { settings: defaultAssistantSettings },
    configuring: true,
    configurationLoading: false,
    responding: true,
    resources: [
      { role: 'llm', status: 'busy', revision: '0'.repeat(40) },
      { role: 'vectordb', status: 'ready' },
    ],
  });
  const state = runtime.stateSubscription.getValue();
  assert.equal(state.responding, true);
  assert.equal(state.runtime.pending, true);
  assert.equal(state.runtime.loading, false);
  assert.equal(state.runtime.ready, false);
  assert.equal(state.runtime.error, undefined);
});

test('selecting a replacement clears the cached idle mismatch while its command is pending', async () => {
  const { runtime, coordinator, publish } = fixture();
  const previous = {
    selection: { settings: defaultAssistantSettings },
    activeSelection: { settings: defaultAssistantSettings },
    configuring: false,
    resources: [
      { role: 'llm', status: 'ready', revision: '0'.repeat(40) },
      { role: 'vectordb', status: 'ready' },
    ],
  };
  publish(previous);
  assert.match(runtime.stateSubscription.getValue().runtime.error, /revision/);
  let complete;
  coordinator.configure = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  runtime.select(defaultAssistantSettings);
  assert.equal(runtime.stateSubscription.getValue().runtime?.error, undefined);
  publish(previous);
  assert.equal(runtime.stateSubscription.getValue().runtime.error, undefined);
  assert.equal(runtime.stateSubscription.getValue().runtime.ready, false);
  complete();
  await runtime.apply(defaultAssistantSettings);
});
