import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Chat } from '@/layers/data/local-chat-lm.data';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

test('transport preserves retrieval envelopes, readiness, errors and request identity', () => {
  let receive;
  const sent = [];
  const chat = new Chat(
    { $isReady: createStatefulSubscribable(false), send: (data) => sent.push(data) },
    { listen() {}, send() {} },
    {
      listen(listener) {
        receive = listener;
      },
    },
    { name: 'llm', payload: {} },
  );
  const ready = { id: chat.channelId, name: 'llm', task: 'llm:ready', payload: {} };
  receive(ready);
  const messages = [];
  chat.onData((data) => messages.push(data));
  const response = {
    id: chat.channelId,
    name: 'llm',
    task: 'vectordb:query:response',
    requestId: 'question-1',
    payload: { response: { neighbors: [0] } },
  };
  receive(response);
  assert.deepEqual(messages, [ready, response]);
  chat.send({}, 'question-1', 'cancel');
  assert.equal(sent[0].task, 'llm:cancel');
  assert.equal(sent[0].requestId, 'question-1');
});
