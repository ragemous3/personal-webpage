import assert from 'node:assert/strict';
import test from 'node:test';

import { BroadcastManager } from '@/layers/data/abstracts/broadcast-manager.abstract';
import { WebWorkerManager as AbstractWorkerManager } from '@/layers/data/abstracts/web-worker-manager.abstract';
import {
  isMessageBase,
  isVectorDbResponse as isVectorDatabaseResponse,
} from '@/layers/data/guards/is-message-base.guard';
import { WebWorkerManager } from '@/layers/data/workers/web-worker-manager';
import { isProgressStatusInfo } from '@/layers/shared/guards/progress.guard';

const message = { id: 'request', name: 'llm', task: 'llm:query', payload: 'question' };
const stringPayload = (value) => typeof value === 'string';
const taskGuard = (value) => value === 'custom-task';

test('message validation preserves payload, task, and error checks', () => {
  assert.equal(isMessageBase(message, stringPayload), true);
  for (const invalid of [
    null,
    { ...message, id: 3 },
    { ...message, name: undefined },
    { ...message, payload: null },
    { ...message, task: 'invalid' },
    { ...message, error: new Error('failed') },
  ]) {
    assert.equal(isMessageBase(invalid, stringPayload), false);
  }
  assert.equal(isMessageBase({ ...message, error: undefined }, stringPayload), true);
  assert.equal(isMessageBase({ ...message, error: 'failed' }, stringPayload), true);
});

test('a custom task guard controls message acceptance', () => {
  assert.equal(isMessageBase(message, stringPayload, taskGuard), false);
  assert.equal(isMessageBase({ ...message, task: 'custom-task' }, stringPayload, taskGuard), true);
});

test('the existing vector response export accepts only valid response shapes', () => {
  const response = { query: 'résumé', response: { neighbors: [0], distances: [0.2] } };
  assert.equal(isVectorDatabaseResponse(response), true);
  assert.equal(isVectorDatabaseResponse({ ...response, query: 42 }), false);
  assert.equal(isVectorDatabaseResponse({ ...response, response: { neighbors: [] } }), false);
});

test('progress validation accepts boundary values and rejects invalid amounts', () => {
  const progress = {
    status: 'progress',
    name: 'model',
    file: 'weights',
    progress: 0,
    loaded: 0,
    total: 10,
  };
  assert.equal(isProgressStatusInfo(progress), true);
  assert.equal(isProgressStatusInfo({ ...progress, progress: 100 }), true);
  for (const invalid of [
    { progress: -1 },
    { progress: 101 },
    { progress: Number.NaN },
    { loaded: -1 },
    { loaded: Infinity },
    { total: -1 },
    { total: '10' },
    { file: null },
  ]) {
    assert.equal(isProgressStatusInfo({ ...progress, ...invalid }), false);
  }
});

test('worker and broadcast listener setup delivers one notification per message', () => {
  for (const Manager of [WebWorkerManager, AbstractWorkerManager, BroadcastManager]) {
    const manager = new Manager('source', 'name');
    manager.carrier = new EventTarget();
    const received = [];
    const disconnect = manager.listen((value) => received.push(value));
    manager.setupEventListeners();
    manager.setupEventListeners();
    manager.carrier.dispatchEvent(new MessageEvent('message', { data: message }));
    assert.deepEqual(received, [message]);
    disconnect();
    manager.carrier.dispatchEvent(new MessageEvent('message', { data: message }));
    assert.deepEqual(received, [message]);
  }
});
