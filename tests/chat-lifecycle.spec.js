import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ContentRepository } from '@/layers/data/content-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/rag.service';

import { createChatGenerationFixture } from './chat-generation.fixture.js';

const settled = () => new Promise((resolve) => setImmediate(resolve));
const completeRetrieval = async (database, requestId) => {
  database.emit({
    task: 'vectordb:query:response',
    requestId,
    payload: { response: { neighbors: [0] } },
  });
  await settled();
};
const createService = (chat, database, repo, model, runtime) =>
  new RagService(chat, database, repo, model, {
    runtime,
    conversationId: 'test-conversation',
    history: { load: async () => [], save: async () => {}, clear: async () => {} },
  });
const disconnect = () => {};

const transport = () => {
  const listeners = new Set();
  let ready;
  return {
    sent: [],
    onData(listener) {
      listeners.add(listener);
      if (ready) listener(ready);
      return () => listeners.delete(listener);
    },
    send(payload, requestId, action = 'query') {
      this.sent.push({ payload, requestId, action });
    },
    emit(message) {
      if (message.task.endsWith(':ready')) ready = message;
      for (const listener of listeners) listener(message);
    },
    get listeners() {
      return listeners.size;
    },
  };
};

const setup = async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [{ text: 'Résumé evidence', index: 0 }] },
    new ChatMessageModel({ role: 'system', content: 'Answer using evidence.' }),
  );
  service.init();
  await settled();
  chat.emit({ task: 'llm:ready' });
  await settled();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  return { chat, database, service };
};

test('retrieved content loads and validates real JSON through the repository interface', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json([{ text: 'Evidence', index: 0 }]),
  );
  const repository = new ContentRepository('/');
  assert.deepEqual(await repository.getChunksAsync('/chunks.json'), [
    { text: 'Evidence', index: 0 },
  ]);
});

test('a retrieved question streams one answer and final text does not duplicate it', async () => {
  const { chat, database, service } = await setup();
  service.send('Who is Rasmus?');
  await settled();
  const { requestId } = database.sent[0];
  database.emit({
    task: 'vectordb:query:response',
    requestId,
    payload: { query: 'Who is Rasmus?', response: { neighbors: [0] } },
  });
  await settled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(chat.sent[0].payload.message.at(-1).content, /Résumé evidence/);
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'A developer' });
  await settled();
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: [{ role: 'assistant', content: 'A developer.' }] },
  });
  await settled();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), [
    { role: 'user', content: 'Who is Rasmus?' },
    { role: 'assistant', content: 'A developer.' },
  ]);
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('cancel retains partial text; retry replaces the attempt and reset rejects stale callbacks', async () => {
  const { chat, database, service } = await setup();
  service.send('Question');
  await settled();
  const first = database.sent[0].requestId;
  await completeRetrieval(database, first);
  chat.emit({ task: 'llm:stream:response', requestId: first, payload: 'Partial' });
  await settled();
  service.send('Must not send twice');
  await settled();
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  service.cancel();
  await settled();
  assert.equal(chat.sent.at(-1).action, 'cancel');
  assert.equal(service.chatMessagesSubscription.getValue()[1].interrupted, true);
  service.retry();
  await settled();
  assert.equal(service.chatMessagesSubscription.getValue().length, 2);
  const second = database.sent.filter(({ action }) => action === 'query')[1].requestId;
  assert.notEqual(second, first);
  chat.emit({ task: 'llm:stream:response', requestId: first, payload: 'stale' });
  await settled();
  assert.equal(service.chatMessagesSubscription.getValue()[1].content, '');
  service.reset();
  await settled();
  chat.emit({
    task: 'llm:message:response',
    requestId: second,
    payload: { generated_text: 'late' },
  });
  await settled();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
});

test('attachment releases only its own ownership and can reconnect without duplicate listeners', async () => {
  const { chat, database, service } = await setup();
  const first = service.attach();
  const second = service.attach();
  service.init();
  await settled();
  assert.equal(chat.listeners, 1);
  first();
  first();
  service.dispose();
  assert.equal(chat.listeners, 1);
  second();
  assert.equal(chat.listeners, 0);
  assert.equal(database.listeners, 0);
  const release = service.attach();
  assert.equal(chat.listeners, 1);
  release();
});

test('reset during retrieval does not send a late model query', async () => {
  const { chat, database, service } = await setup();
  service.send('Question');
  await settled();
  const { requestId } = database.sent[0];
  database.emit({
    task: 'vectordb:query:response',
    requestId,
    payload: { response: { neighbors: [0] } },
  });
  service.reset();
  await settled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(chat.sent.filter(({ action }) => action === 'query').length, 0);
});

test('a failed partial answer remains visible until explicit retry', async () => {
  const { chat, database, service } = await setup();
  service.send('Question');
  await settled();
  const { requestId } = database.sent[0];
  await completeRetrieval(database, requestId);
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Partial' });
  await settled();
  chat.emit({ task: 'llm:query', requestId, error: { message: 'Generation failed' } });
  await settled();
  assert.equal(service.stateSubscription.getValue().error, 'Generation failed');
  assert.deepEqual(service.chatMessagesSubscription.getValue()[1], {
    role: 'assistant',
    content: 'Partial',
    interrupted: true,
  });
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  chat.emit({ task: 'llm:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'error');
  service.retry();
  await settled();
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 2);
});

test('reset preserves a failed initialization and retry restarts only the failed worker', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  await settled();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  chat.emit({ task: 'llm:init', error: { message: 'Model initialization failed' } });
  await settled();
  service.reset();
  await settled();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
  assert.deepEqual(service.stateSubscription.getValue(), {
    status: 'error',
    error: 'Model initialization failed',
  });
  service.retry();
  await settled();
  assert.deepEqual(initialized, ['chat']);
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  chat.emit({ task: 'llm:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('retry after both workers fail requires fresh readiness from both', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  await settled();
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  await settled();
  database.emit({ task: 'vectordb:init', error: { message: 'Retrieval failed' } });
  await settled();
  service.retry();
  await settled();
  chat.emit({ task: 'llm:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  database.emit({ task: 'vectordb:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.deepEqual(initialized, ['chat', 'database']);
});

test('initialization retry preserves a healthy worker that is still loading', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  await settled();
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  await settled();
  service.retry();
  await settled();
  assert.deepEqual(initialized, ['chat']);
  chat.emit({ task: 'llm:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  database.emit({ task: 'vectordb:ready' });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('a cached client recovers on retry after another client repairs its worker', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  const release = service.attach();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  await settled();
  release();
  chat.emit({ task: 'llm:ready' });
  await settled();
  const detach = service.attach();
  await settled();
  service.retry();
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  service.send('Question after recovery');
  await settled();
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  detach();
});

test('runtime reconnect preserves partial history, coalesces attempts and never replays the interrupted question', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  let complete;
  let recoveries = 0;
  const finished = [];
  const lifecycle = {
    begin: async () => {},
    finish: (id) => finished.push(id),
    reconnect: () => {
      recoveries++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
    lifecycle,
  );
  service.init();
  await settled();
  chat.emit({ task: 'llm:ready' });
  await settled();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  service.send('Question');
  await settled();
  await new Promise((resolve) => setImmediate(resolve));
  const { requestId } = database.sent[0];
  await completeRetrieval(database, requestId);
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Partial' });
  await settled();
  chat.emit({ task: 'llm:init', error: { message: 'Something went wrong' }, runtimeFailure: true });
  await settled();
  const a = service.reconnect();
  const b = service.reconnect();
  await settled();
  assert.equal(recoveries, 1);
  chat.emit({ task: 'llm:ready' });
  await settled();
  complete();
  await Promise.all([a, b]);
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.deepEqual(service.chatMessagesSubscription.getValue()[1], {
    role: 'assistant',
    content: 'Partial',
    interrupted: true,
  });
  assert.equal(database.sent.filter((entry) => entry.action === 'query').length, 1);
  assert.deepEqual(finished, [requestId]);
});

test('detaching and remounting a runtime-backed service releases all subscriptions and restores answer delivery', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  const runtimeListeners = new Set();
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
    {
      begin: async () => {},
      finish() {},
      reconnect: async () => {},
      onData: (listener) => {
        runtimeListeners.add(listener);
        return () => runtimeListeners.delete(listener);
      },
    },
  );
  const detach = service.attach();
  await settled();
  chat.emit({ task: 'llm:ready' });
  await settled();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  detach();
  assert.equal(runtimeListeners.size, 0);
  assert.equal(chat.listeners, 0);
  assert.equal(database.listeners, 0);
  const release = service.attach();
  assert.equal(runtimeListeners.size, 1);
  assert.equal(chat.listeners, 1);
  assert.equal(database.listeners, 1);
  service.send('After remount');
  await settled();
  await new Promise((resolve) => setImmediate(resolve));
  const requestId = database.sent.find((entry) => entry.action === 'query').requestId;
  await completeRetrieval(database, requestId);
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: 'Remounted answer' },
  });
  await settled();
  assert.equal(service.chatMessagesSubscription.getValue().at(-1).content, 'Remounted answer');
  release();
  assert.equal(runtimeListeners.size, 0);
});

test('settings availability blocks new questions without cancelling accepted work or clearing history', async () => {
  const { service, chat, database } = await setup();
  service.send('Keep this question');
  await settled();
  const { requestId } = database.sent[0];
  await completeRetrieval(database, requestId);
  service.setAvailable(false);
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'responding');
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: 'Kept answer' },
  });
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  service.send('Blocked question');
  await settled();
  assert.equal(database.sent.length, 1);
  service.setAvailable(true);
  await settled();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(service.chatMessagesSubscription.getValue()[0].content, 'Keep this question');
  assert.equal(service.chatMessagesSubscription.getValue()[1].content, 'Kept answer');
});

test('shared ready snapshots cannot override the application availability gate', async () => {
  const chat = createChatGenerationFixture();
  const database = transport();
  let observe;
  const runtime = {
    onData(callback) {
      observe = callback;
      return disconnect;
    },
  };
  const service = createService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'System' }),
    runtime,
  );
  service.init();
  await settled();
  chat.emit({ task: 'llm:ready' });
  await settled();
  database.emit({ task: 'vectordb:ready' });
  await settled();
  service.setAvailable(false);
  await settled();
  observe({
    task: 'runtime:state',
    payload: { configuring: false, activeSelection: { enabled: true } },
  });
  assert.notEqual(service.stateSubscription.getValue().status, 'ready');
  service.setAvailable(true);
  await settled();
  observe({
    task: 'runtime:state',
    payload: { configuring: false, activeSelection: { enabled: false } },
  });
  assert.notEqual(service.stateSubscription.getValue().status, 'ready');
  observe({
    task: 'runtime:state',
    payload: { configuring: false, activeSelection: { enabled: true } },
  });
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  service.dispose();
});

test('explicit configuration recovery enables Send after a failed model reports fresh readiness', async () => {
  const { service, chat } = await setup();
  chat.emit({ task: 'llm:init', error: { message: 'WebGPU failed' }, runtimeFailure: true });
  await settled();
  service.setAvailable(false);
  chat.emit({ task: 'llm:loading' });
  chat.emit({ task: 'llm:ready' });
  service.setAvailable(true);
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});
