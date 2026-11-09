import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RagService } from '@/layers/services/rag.service';
import { TalkingHeadService } from '@/layers/services/talking-head.service';

import { createChatGenerationFixture } from './chat-generation.fixture.js';

const disconnect = () => {};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const setup = async (context, failAnswerSave = false) => {
  const chat = createChatGenerationFixture(true);
  const queries = [];
  let receive;
  const database = {
    onData(listener) {
      receive = listener;
      listener({ task: 'vectordb:ready' });
      return disconnect;
    },
    send(payload, requestId, action = 'query') {
      if (action === 'query') queries.push({ payload, requestId });
    },
  };
  const rag = new RagService(
    chat,
    database,
    { getChunksAsync: async () => [] },
    new ChatMessageModel({ role: 'system', content: 'Help' }),
    {
      conversationId: 'speech-integration',
      history: {
        load: async () => [],
        clear: async () => {},
        save: async (_id, messages) => {
          if (failAnswerSave && messages.at(-1)?.content) throw new Error('Quota');
        },
      },
    },
  );
  const spoken = [];
  let pending;
  const speech = new TalkingHeadService(
    chat,
    rag.lifecycleSubscription,
    {
      initialize: async () => {},
      synthesize: (text, signal) =>
        new Promise((resolve) => {
          pending = { signal, finish: () => resolve([{ text }]) };
        }),
      release() {},
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async (output) => {
        spoken.push(output);
      },
      stop() {},
      dispose() {},
    },
  );
  context.after(() => {
    speech.dispose();
    rag.dispose();
    chat.dispose();
  });
  rag.init();
  await tick();
  assert.equal(rag.stateSubscription.getValue().status, 'ready');
  await speech.enable();
  rag.send('First question');
  await tick();
  const { requestId } = queries[0];
  receive({ task: 'vectordb:query:response', requestId, payload: { response: { neighbors: [] } } });
  await tick();
  chat.emit({
    task: 'llm:message:response',
    requestId,
    payload: { generated_text: 'Completed answer' },
  });
  await tick();
  await rag.whenSettled();
  await tick();
  assert.ok(pending, 'Generation reached the connected speech service');
  return { rag, chat, queries, pending, spoken };
};

test('RagService Reset after completion invalidates connected pending speech', async (context) => {
  const { rag, pending, spoken } = await setup(context);
  assert.equal(rag.stateSubscription.getValue().status, 'ready');
  assert.equal(pending.signal.aborted, false);
  rag.reset();
  assert.equal(pending.signal.aborted, true);
  pending.finish();
  await tick();
  assert.deepEqual(spoken, []);
});

test('a new RagService question invalidates speech before retrieval can start another generation', async (context) => {
  const { rag, chat, queries, pending, spoken } = await setup(context);
  assert.equal(pending.signal.aborted, false);
  rag.send('Next question');
  await tick();
  assert.equal(queries.length, 2);
  assert.equal(chat.sent.filter((item) => item.action === 'query').length, 1);
  assert.equal(pending.signal.aborted, true);
  pending.finish();
  await tick();
  assert.deepEqual(spoken, []);
});

test('a terminal history-save failure invalidates speech after generation output', async (context) => {
  const { rag, chat, pending, spoken } = await setup(context, true);
  assert.equal(rag.stateSubscription.getValue().storageFailure, true);
  assert.equal(pending.signal.aborted, true);
  pending.finish();
  await tick();
  assert.deepEqual(spoken, []);
  assert.equal(chat.sent.filter((item) => item.action === 'query').length, 1);
});
