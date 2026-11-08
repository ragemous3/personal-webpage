import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IDBFactory } from 'fake-indexeddb';

import { ChatHistoryRepository } from '@/layers/data/chat-history-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/rag.service';

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
  const saved = [
    { role: 'user', content: 'Saved question' },
    { role: 'assistant', content: 'Saved answer' },
  ];
  let writes = 0;
  const history = {
    load: () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
    save: async () => {
      writes++;
    },
    clear: async () => {},
  };
  const { service, chat } = create(history);
  chat.emit({ task: 'llm:init', error: { message: 'GPU failed' } });
  await tick();
  assert.equal(writes, 0);
  restore(saved);
  await tick();
  assert.deepEqual(service.chatMessagesSubscription.getValue(), saved);
  assert.equal(service.stateSubscription.getValue().status, 'error');
});

test('a stale lease acknowledgement cannot finish the new response after Reset', async () => {
  let oldBegin;
  const finished = [];
  let attempts = 0;
  const history = { load: async () => [], save: async () => {}, clear: async () => {} };
  const { service, database } = create(history, {
    begin: () =>
      ++attempts === 1
        ? new Promise((resolve) => {
            oldBegin = resolve;
          })
        : Promise.resolve(),
    finish: (id) => finished.push(id),
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Old question');
  service.reset();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('New question');
  await until(() => database.sent.some(({ action }) => action === 'query'));
  const current = database.sent.find(({ action }) => action === 'query').requestId;
  oldBegin();
  await service.whenSettled();
  await tick();
  assert.equal(finished.includes(current), false);
  assert.equal(service.stateSubscription.getValue().status, 'responding');
});

test('an older Reset completion cannot enable Send while the current clear is pending', async () => {
  let commit;
  const history = {
    load: async () => [],
    save: async () => {},
    clear: () =>
      new Promise((resolve) => {
        commit = resolve;
      }),
  };
  const { service, database } = create(history);
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.reset();
  service.reset();
  await until(() => commit);
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  service.send('Blocked until current clear commits');
  assert.equal(database.sent.length, 0);
  commit();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
});

test('a failed restoration from before Reset cannot cancel the new conversation', async () => {
  let rejectRestore;
  const history = {
    load: () =>
      new Promise((_resolve, reject) => {
        rejectRestore = reject;
      }),
    save: async () => {},
    clear: async () => {},
  };
  const { service, database } = create(history);
  service.reset();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('New question');
  await until(() => database.sent.some(({ action }) => action === 'query'));
  rejectRestore(new Error('Obsolete load failure'));
  await tick();
  assert.equal(service.stateSubscription.getValue().status, 'responding');
  assert.equal(
    database.sent.some(({ action }) => action === 'cancel'),
    false,
  );
});

test('Retry saving keeps Send blocked and cannot override a later Reset clear', async () => {
  let fail = true;
  let saveCommit;
  let clearCommit;
  const history = {
    load: async () => [],
    save: () =>
      fail
        ? Promise.reject(new Error('Quota'))
        : new Promise((resolve) => {
            saveCommit = resolve;
          }),
    clear: () =>
      new Promise((resolve) => {
        clearCommit = resolve;
      }),
  };
  const { service, database } = create(history);
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Not sent before storage works');
  await until(() => service.stateSubscription.getValue().storageFailure);
  fail = false;
  service.retry();
  await until(() => saveCommit);
  service.setAvailable(true);
  assert.notEqual(service.stateSubscription.getValue().status, 'ready');
  service.send('Blocked during saving');
  assert.equal(
    database.sent.some(({ action }) => action === 'query'),
    false,
  );
  service.reset();
  saveCommit();
  await until(() => clearCommit);
  assert.equal(service.stateSubscription.getValue().status, 'initializing');
  clearCommit();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
});

test('a cancelled begin acknowledgement retains its lease until the Reset clear commits', async () => {
  let acknowledge;
  let commit;
  const finished = [];
  const history = {
    load: async () => [],
    save: async () => {},
    clear: () =>
      new Promise((resolve) => {
        commit = resolve;
      }),
  };
  const { service } = create(history, {
    begin: () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
    finish: (id) => finished.push(id),
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Question');
  service.reset();
  await until(() => commit);
  acknowledge();
  await tick();
  assert.equal(finished.length, 0);
  commit();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  assert.equal(finished.length, 1);
});

test('overlapping storage and runtime failures expose saving first and reconnect afterward without replay', async () => {
  let fail = false;
  let recoveries = 0;
  const history = {
    load: async () => [],
    clear: async () => {},
    save: async () => {
      if (fail) throw new Error('Quota');
    },
  };
  const { service, chat, database } = create(history, {
    begin: async () => {},
    finish() {},
    reconnect: async () => {
      recoveries++;
    },
  });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Question');
  await until(() => database.sent.some(({ action }) => action === 'query'));
  const { requestId } = database.sent[0];
  chat.emit({ task: 'llm:stream:response', requestId, payload: 'Visible partial' });
  await until(
    () => service.chatMessagesSubscription.getValue().at(-1)?.content === 'Visible partial',
  );
  fail = true;
  chat.emit({ task: 'llm:stream:response', requestId, payload: ' pending save' });
  await until(() => service.stateSubscription.getValue().storageFailure);
  chat.emit({ task: 'llm:init', error: { message: 'Worker stopped' }, runtimeFailure: true });
  assert.equal(service.stateSubscription.getValue().storageFailure, true);
  fail = false;
  service.retry();
  await until(() => !service.stateSubscription.getValue().storageFailure);
  assert.equal(service.stateSubscription.getValue().runtimeFailure, true);
  assert.equal(recoveries, 0);
  chat.emit({ task: 'llm:ready' });
  await service.reconnect();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  assert.match(service.chatMessagesSubscription.getValue().at(-1).content, /^Visible partial/);
});

test('a stale request failure cannot poison a later response after Reset', async () => {
  const history = { load: async () => [], clear: async () => {}, save: async () => {} };
  const { service, chat, database } = create(history, { begin: async () => {}, finish() {} });
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Old question');
  await until(() => database.sent.some(({ action }) => action === 'query'));
  const old = database.sent[0].requestId;
  service.reset();
  await until(() => service.stateSubscription.getValue().status === 'ready');
  service.send('Current question');
  await until(() => database.sent.filter(({ action }) => action === 'query').length === 2);
  const current = database.sent.filter(({ action }) => action === 'query')[1].requestId;
  chat.emit({ task: 'llm:query', requestId: old, runtimeFailure: true, error: { message: 'Obsolete failure' } });
  chat.emit({ task: 'llm:message:response', requestId: current, payload: { generated_text: 'Current answer' } });
  await until(() => service.stateSubscription.getValue().status !== 'responding');
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(service.chatMessagesSubscription.getValue().at(-1).content, 'Current answer');
});

for (const fault of [
  { name: 'runtime', storage: false, runtime: true },
  { name: 'storage and runtime', storage: true, runtime: true },
  { name: 'storage and model', storage: true, runtime: false },
]) {
  test(`Reset preserves ${fault.name} recovery after its clear commits`, async () => {
    let failSaving = false;
    let clears = 0;
    let reconnects = 0;
    const history = {
      load: async () => [], clear: async () => { clears++; },
      save: async () => { if (failSaving) throw new Error('Quota'); },
    };
    const { service, chat, database } = create(history, {
      begin: async () => {}, finish() {}, reconnect: async () => { reconnects++; },
    });
    chat.initialize = () => chat.emit({ task: 'llm:ready' });
    await until(() => service.stateSubscription.getValue().status === 'ready');
    service.send('Question');
    await until(() => database.sent.some(({ action }) => action === 'query'));
    const { requestId } = database.sent[0];
    if (fault.storage) {
      failSaving = true;
      chat.emit({ task: 'llm:stream:response', requestId, payload: 'Pending save' });
      await until(() => service.stateSubscription.getValue().storageFailure);
    }
    chat.emit({ task: fault.storage ? 'llm:init' : 'llm:query', requestId: fault.storage ? undefined : requestId,
      error: { message: 'Model failed' }, runtimeFailure: fault.runtime });
    await service.whenSettled();
    service.reset();
    await service.whenSettled();
    await tick();
    const state = service.stateSubscription.getValue();
    assert.equal(clears, 1);
    assert.deepEqual(service.chatMessagesSubscription.getValue(), []);
    assert.equal(state.status, 'error');
    assert.notEqual(state.storageFailure, true);
    assert.equal(Boolean(state.runtimeFailure), fault.runtime);
    if (fault.runtime) {
      chat.emit({ task: 'llm:ready' });
      await service.reconnect();
    } else service.retry();
    assert.equal(service.stateSubscription.getValue().status, 'ready');
    assert.equal(reconnects, fault.runtime ? 1 : 0);
    assert.equal(database.sent.filter(({ action }) => action === 'query').length, 1);
  });
}
