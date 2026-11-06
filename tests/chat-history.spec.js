import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IDBFactory } from 'fake-indexeddb';

import { getConversationId } from '@/composition/factories/conversation-identity.factory';
import { ChatHistoryRepository } from '@/layers/data/chat-history-repository.data';

test('history survives repository replacement and clearing one conversation preserves another', async () => {
  const indexedDB = new IDBFactory();
  const first = new ChatHistoryRepository(indexedDB);
  await first.save('tab-a', [{ role: 'user', content: 'Remember this' }]);
  await first.save('tab-b', [{ role: 'assistant', content: 'Other conversation' }]);
  const replacement = new ChatHistoryRepository(indexedDB);
  assert.deepEqual(await replacement.load('tab-a'), [{ role: 'user', content: 'Remember this' }]);
  await replacement.clear('tab-a');
  assert.deepEqual(await first.load('tab-a'), []);
  assert.deepEqual(await first.load('tab-b'), [
    { role: 'assistant', content: 'Other conversation' },
  ]);
  first.dispose();
  replacement.dispose();
});

test('only a reload reuses the tab ID; fresh tabs and browser restores replace copied IDs', () => {
  let value;
  const storage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  const first = getConversationId(storage, 'navigate');
  assert.equal(getConversationId(storage, 'reload'), first);
  const child = getConversationId(storage, 'navigate');
  assert.notEqual(child, first);
  assert.equal(getConversationId(storage, 'reload'), child);
  assert.notEqual(getConversationId(storage, 'back_forward'), child);
});
