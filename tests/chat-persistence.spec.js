import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IDBFactory } from 'fake-indexeddb';

import { ChatHistoryRepository } from '@/layers/data/chat-history-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/chatbot.service';

const tick = () => new Promise((resolve) => setTimeout(resolve, 15));
const until = async (condition) => {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'Expected public state did not arrive');
    await tick();
  }
};
const port = (name) => {
  const listeners = new Set();
  return {
    name,
    sent: [],
    onData(listener) {
      listeners.add(listener);
      listener({ task: `${name}:ready` });
      return () => listeners.delete(listener);
    },
    send(payload, requestId, action = 'query') {
      this.sent.push({ payload, requestId, action });
    },
    emit(data) {
      for (const listener of listeners) listener(data);
    },
  };
};
const create = (history, runtime) => {
  const chat = port('llm');
  const database = port('vectordb');
  const service = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
    { history, conversationId: 'conversation', runtime },
  );
  service.init();
  return { service, chat, database };
};

test('a replaced service restores the committed conversation without replaying generation', async () => {
  const history = new ChatHistoryRepository(new IDBFactory());
  const { service, chat, database } = create(history);
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Keep across modes');
  await until(() => database.sent.length > 0);
  const { requestId } = database.sent[0];
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: 'Saved answer' },
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.dispose();
  const replacement = create(history);
  await until(() => replacement.service.stateSubscription.getValue().status === 'ready');
  assert.deepEqual(replacement.service.chatMessagesSubscription.getValue(), [
    { role: 'user', content: 'Keep across modes' },
    { role: 'assistant', content: 'Saved answer' },
  ]);
  assert.equal(replacement.database.sent.length, 0);
  history.dispose();
});

test('a failed response write cancels work and Retry saving never repeats generation', async () => {
  let fail = false;
  let saved = [];
  const finished = [];
  const history = {
    load: async () => [],
    clear: async () => {
      saved = [];
    },
    save: async (_id, messages) => {
      if (fail) throw new Error('Quota');
      saved = structuredClone(messages);
    },
  };
  const { service, chat, database } = create(history, {
    begin: async () => {},
    finish: (id) => finished.push(id),
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Question');
  await until(() => database.sent.length > 0);
  const { requestId } = database.sent[0];
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Visible' });
  await tick();
  fail = true;
  chat.emit({ task: 'llm:stream:response', requestId, payload: ' failed write' });
  await tick();
  assert.equal(service.chatMessagesSubscription.getValue().at(-1).content, 'Visible');
  assert.equal(service.stateSubscription.getValue().storageFailure, true);
  assert.equal(chat.sent.at(-1).action, 'cancel');
  assert.equal(finished.length, 0);
  service.send('Blocked');
  fail = false;
  service.retry();
  await tick();
  assert.equal(saved.at(-1).interrupted, true);
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  assert.deepEqual(finished, [requestId]);
});

test('the response lease remains held until the terminal history write commits', async () => {
  let commit;
  const finished = [];
  const history = { load: async () => [], clear: async () => {}, save: async () => {} };
  const { service, chat, database } = create(history, {
    begin: async () => {},
    finish: (id) => finished.push(id),
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Question');
  await until(() => database.sent.length > 0);
  history.save = () =>
    new Promise((resolve) => {
      commit = resolve;
    });
  const { requestId } = database.sent[0];
  chat.emit({ task: 'llm:message:response', requestId, payload: { generated_text: 'Terminal' } });
  await tick();
  assert.equal(service.stateSubscription.getValue().status, 'responding');
  assert.equal(service.chatMessagesSubscription.getValue().at(-1).content, '');
  assert.equal(finished.length, 0);
  commit();
  await tick();
  assert.equal(service.chatMessagesSubscription.getValue().at(-1).content, 'Terminal');
  assert.deepEqual(finished, [requestId]);
});

test('Reset drains old writes and late output cannot resurrect history', async () => {
  const history = new ChatHistoryRepository(new IDBFactory());
  const { service, chat, database } = create(history);
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Discard');
  await until(() => database.sent.length > 0);
  const { requestId } = database.sent[0];
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Old' });
  service.reset();
  chat.emit({ task: 'llm:message:response', requestId, payload: { generated_text: 'Late' } });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  assert.deepEqual(await history.load('conversation'), []);
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
  history.dispose();
});

test('a model failure during restoration cannot replace saved history with an empty conversation', async () => {
  let restore;
  const saved = [{ role: 'user', content: 'Saved question' }, { role: 'assistant', content: 'Saved answer' }];
  let writes = 0;
  const history = { load: () => new Promise((resolve) => { restore = resolve; }), save: async () => { writes++; }, clear: async () => {} };
  const { service, chat } = create(history);
  chat.emit({ task: 'llm:init', error: { message: 'GPU failed' } });
  await tick();
  assert.equal(writes, 0);
  restore(saved);
  await tick();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), saved);
  assert.equal(service.stateSubscription.getValue().status, 'error');
});
