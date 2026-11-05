import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConfigurationRepository } from '@/layers/data/configuration-repository.data';

const fixture = () => {
  const entries = new Map();
  const events = new EventTarget();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  return { entries, events, storage, repository: new ConfigurationRepository(storage, events) };
};

test('configuration preferences round-trip through the repository', () => {
  const { repository } = fixture();
  assert.deepEqual(repository.load(), { value: undefined });
  assert.deepEqual(repository.save({ mode: 'local', execution: 'auto' }), {});
  assert.deepEqual(repository.load(), { value: { mode: 'local', execution: 'auto' } });
});

test('damaged or unsupported data recovers without changing unrelated entries', () => {
  const { repository, entries } = fixture();
  repository.save({ mode: 'local' });
  const key = [...entries.keys()][0];
  entries.set('unrelated', 'keep');
  entries.set(key, '{bad');
  assert.match(repository.load().notice, /damaged/);
  entries.set(key, JSON.stringify({ version: 99, preferences: {} }));
  assert.match(repository.load().notice, /unsupported/);
  assert.equal(entries.get('unrelated'), 'keep');
});

test('denied storage stays usable and reports session-only persistence', () => {
  const repository = new ConfigurationRepository(undefined, new EventTarget());
  assert.match(repository.load().notice, /not be remembered/);
  assert.match(repository.save({ mode: 'local' }).notice, /session only/);
});

test('observation filters unrelated changes and disconnects its own listener', () => {
  const { repository, events, entries } = fixture();
  const observations = [];
  const stop = repository.observe((record) => observations.push(record));
  repository.save({ mode: 'online' });
  const key = [...entries.keys()][0];
  const emit = (changedKey) => {
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: changedKey });
    events.dispatchEvent(event);
  };
  emit('unrelated');
  assert.equal(observations.length, 0);
  emit(key);
  assert.deepEqual(observations, [{ value: { mode: 'online' } }]);
  stop();
  emit(key);
  assert.equal(observations.length, 1);
});
