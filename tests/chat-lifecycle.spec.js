import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ContentRepository } from '@/layers/data/content-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/chatbot.service';

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

const setup = () => {
  const chat = transport();
  const database = transport();
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [{ text: 'Résumé evidence', index: 0 }] },
    new ChatMessageModel({ role: 'system', content: 'Answer using evidence.' }),
  );
  service.init();
  chat.emit({ task: 'llm:ready' });
  database.emit({ task: 'vectordb:ready' });
  return { chat, database, service };
};

test('configuration loading gates Send without clearing the conversation', () => {
  const { service } = setup();
  service.send('Retained question');
  service.cancel();
  service.setAvailable(false);
  service.send('Must wait');
  assert.equal(service.chatMessagesSubscription.getValue().length, 2);
  assert.equal(service.stateSubscription.getValue().status, 'error');
  service.setAvailable(true);
  assert.equal(service.stateSubscription.getValue().status, 'error');
  service.retry();
  assert.equal(service.stateSubscription.getValue().status, 'responding');
  assert.equal(service.chatMessagesSubscription.getValue()[0].content, 'Retained question');
});

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
  const { chat, database, service } = setup();
  service.send('Who is Rasmus?');
  const { requestId } = database.sent[0];
  database.emit({
    task: 'vectordb:query:response',
    requestId,
    payload: { query: 'Who is Rasmus?', response: { neighbors: [0] } },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(chat.sent[0].payload.message.at(-1).content, /Résumé evidence/);
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'A developer' });
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: [{ role: 'assistant', content: 'A developer.' }] },
  });
  assert.deepEqual(service.chatMessagesSubscription.getValue(), [
    { role: 'user', content: 'Who is Rasmus?' },
    { role: 'assistant', content: 'A developer.' },
  ]);
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('cancel retains partial text; retry replaces the attempt and reset rejects stale callbacks', () => {
  const { chat, database, service } = setup();
  service.send('Question');
  const first = database.sent[0].requestId;
  chat.emit({ task: 'llm:stream:response', requestId: first, payload: 'Partial' });
  service.send('Must not send twice');
  assert.equal(database.sent.length, 1);
  service.cancel();
  assert.equal(chat.sent.at(-1).action, 'cancel');
  assert.equal(service.chatMessagesSubscription.getValue()[1].interrupted, true);
  service.retry();
  assert.equal(service.chatMessagesSubscription.getValue().length, 2);
  const second = database.sent[1].requestId;
  assert.notEqual(second, first);
  chat.emit({ task: 'llm:stream:response', requestId: first, payload: 'stale' });
  assert.equal(service.chatMessagesSubscription.getValue()[1].content, '');
  service.reset();
  chat.emit({
    task: 'llm:message:response',
    requestId: second,
    payload: { generated_text: 'late' },
  });
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
});

test('attachment releases only its own ownership and can reconnect without duplicate listeners', () => {
  const { chat, database, service } = setup();
  const first = service.attach();
  const second = service.attach();
  service.init();
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
  const { chat, database, service } = setup();
  service.send('Question');
  const { requestId } = database.sent[0];
  database.emit({
    task: 'vectordb:query:response',
    requestId,
    payload: { response: { neighbors: [0] } },
  });
  service.reset();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(chat.sent.filter(({ action }) => action === 'query').length, 0);
});

test('a failed partial answer remains visible until explicit retry', () => {
  const { chat, database, service } = setup();
  service.send('Question');
  const { requestId } = database.sent[0];
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Partial' });
  chat.emit({ task: 'llm:query', requestId, error: { message: 'Generation failed' } });
  assert.equal(service.stateSubscription.getValue().error, 'Generation failed');
  assert.deepEqual(service.chatMessagesSubscription.getValue()[1], {
    role: 'assistant',
    content: 'Partial',
    interrupted: true,
  });
  assert.equal(database.sent.length, 1);
  chat.emit({ task: 'llm:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'error');
  service.retry();
  assert.equal(database.sent.length, 2);
});

test('reset preserves a failed initialization and retry restarts only the failed worker', () => {
  const chat = transport();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  database.emit({ task: 'vectordb:ready' });
  chat.emit({ task: 'llm:init', error: { message: 'Model initialization failed' } });
  service.reset();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
  assert.deepEqual(service.stateSubscription.getValue(), {
    status: 'error',
    error: 'Model initialization failed',
  });
  service.retry();
  assert.deepEqual(initialized, ['chat']);
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  chat.emit({ task: 'llm:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('retry after both workers fail requires fresh readiness from both', () => {
  const chat = transport();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  database.emit({ task: 'vectordb:init', error: { message: 'Retrieval failed' } });
  service.retry();
  chat.emit({ task: 'llm:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  database.emit({ task: 'vectordb:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.deepEqual(initialized, ['chat', 'database']);
});

test('initialization retry preserves a healthy worker that is still loading', () => {
  const chat = transport();
  const database = transport();
  const initialized = [];
  chat.initialize = () => initialized.push('chat');
  database.initialize = () => initialized.push('database');
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  service.init();
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  service.retry();
  assert.deepEqual(initialized, ['chat']);
  chat.emit({ task: 'llm:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  database.emit({ task: 'vectordb:ready' });
  assert.equal(service.stateSubscription.getValue().status, 'ready');
});

test('a cached client recovers on retry after another client repairs its worker', () => {
  const chat = transport();
  const database = transport();
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
  );
  const release = service.attach();
  database.emit({ task: 'vectordb:ready' });
  chat.emit({ task: 'llm:init', error: { message: 'Model failed' } });
  release();
  chat.emit({ task: 'llm:ready' });
  const detach = service.attach();
  service.retry();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  service.send('Question after recovery');
  assert.equal(database.sent.length, 1);
  detach();
});
