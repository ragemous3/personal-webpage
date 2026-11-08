import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createChatGenerationFixture } from './chat-generation.fixture.js';

test('Local chat exposes typed readiness and streams a correlated generation as text', async () => {
  const chat = createChatGenerationFixture();
  assert.deepEqual(chat.stateSubscription.getValue(), { ready: false });
  chat.emit({ task: 'llm:ready' });
  assert.deepEqual(chat.stateSubscription.getValue(), { ready: true });
  const chunks = [];
  const result = chat.generate(
    [{ role: 'user', content: 'Question' }],
    (text) => chunks.push(text),
    'question',
  );
  assert.deepEqual(chat.sent, [
    {
      payload: { message: [{ role: 'user', content: 'Question' }] },
      requestId: 'question',
      action: 'query',
    },
  ]);
  chat.emit({ task: 'llm:stream:response', requestId: 'obsolete', payload: 'wrong' });
  chat.emit({ task: 'llm:stream:response', requestId: 'question', payload: 'An answer' });
  chat.emit({
    task: 'llm:message:response',
    requestId: 'question',
    payload: { generated_text: [{ role: 'assistant', content: 'An answer.' }] },
  });
  assert.equal(await result, 'An answer.');
  assert.deepEqual(chunks, ['An answer']);
  chat.dispose();
});

test('Local cancellation rejects the attempt and late output cannot affect the next generation', async () => {
  const chat = createChatGenerationFixture(true);
  const first = chat.generate([], () => assert.fail('Cancelled output must be ignored'), 'first');
  chat.cancel('first');
  await assert.rejects(first, { name: 'AbortError' });
  assert.deepEqual(chat.sent.at(-1), { payload: {}, requestId: 'first', action: 'cancel' });
  const next = chat.generate([], () => {}, 'next');
  chat.emit({
    task: 'llm:query',
    requestId: 'first',
    error: { message: 'Stale failure' },
    runtimeFailure: true,
  });
  chat.emit({ task: 'llm:stream:response', requestId: 'first', payload: 'Stale text' });
  assert.deepEqual(chat.stateSubscription.getValue(), { ready: true });
  chat.emit({
    task: 'llm:message:response',
    requestId: 'next',
    payload: { generated_text: 'Current answer' },
  });
  assert.equal(await next, 'Current answer');
  chat.dispose();
});

test('Local runtime failure rejects pending work; disposal rejects work and releases its channel', async () => {
  const chat = createChatGenerationFixture(true);
  const first = chat.generate([], () => {}, 'first');
  chat.emit({ task: 'llm:init', error: { message: 'Something went wrong' }, runtimeFailure: true });
  await assert.rejects(first, { message: 'Something went wrong', runtimeFailure: true });
  assert.deepEqual(chat.stateSubscription.getValue(), {
    ready: false,
    error: 'Something went wrong',
    runtimeFailure: true,
  });
  chat.initialize();
  assert.equal(chat.initialized.length, 1);
  chat.emit({ task: 'llm:ready' });
  const second = chat.generate([], () => {}, 'second');
  chat.dispose();
  await assert.rejects(second, { name: 'AbortError' });
  assert.deepEqual(chat.stateSubscription.getValue(), { ready: false });
  assert.deepEqual(chat.released, [[chat.channelId, 'llm']]);
  await assert.rejects(
    chat.generate([], () => {}, 'third'),
    /unavailable/,
  );
});
