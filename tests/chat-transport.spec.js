import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DB } from '@/layers/data/local-vector-database.data';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

test('transport preserves retrieval envelopes, readiness, errors and request identity', () => {
  let receive;
  const sent = [];
  const database = new DB(
    {
      $isReady: createStatefulSubscribable(false),
      send: (data) => sent.push(data),
      release() {},
      host() {},
      onData(listener) {
        receive = listener;
        return () => {
          receive = undefined;
        };
      },
    },
    { name: 'vectordb', payload: {} },
  );
  const ready = { id: database.channelId, name: 'vectordb', task: 'vectordb:ready', payload: {} };
  receive(ready);
  const messages = [];
  database.onData((data) => messages.push(data));
  const response = {
    id: database.channelId,
    name: 'vectordb',
    task: 'vectordb:query:response',
    requestId: 'question-1',
    payload: { response: { neighbors: [0] } },
  };
  receive(response);
  assert.deepEqual(messages, [ready, response]);
  database.send({}, 'question-1', 'cancel');
  assert.equal(sent[0].task, 'vectordb:cancel');
  assert.equal(sent[0].requestId, 'question-1');
});
