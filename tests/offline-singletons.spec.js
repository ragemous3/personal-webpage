import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOrCreateBroadcast } from '@/composition/factories/broadcast.factory';
import { getLocalChatBot } from '@/composition/factories/local-chat-bot.factory';
import { getVectorDatabase } from '@/composition/factories/local-vector-database.factory';
import { getSharedWorker } from '@/composition/factories/shared-worker.actory';
import { HubConnection } from '@/layers/data/hub.connection';
import { Hub } from '@/layers/data/hub.data';

import { databaseConfig, modelConfig, workers } from './browser-workers.fixture.js';

test('both factories reuse singletons and create independent configured clients when requested', () => {
  const coordinator = getSharedWorker('/workers/state-machine.js', false);
  const hub = new Hub(new HubConnection('/workers/hub.js', 'hub'), coordinator, [], 'hub');
  for (const [factory, name, payload] of [
    [getLocalChatBot, 'llm', modelConfig],
    [getVectorDatabase, 'vectordb', databaseConfig],
  ]) {
    const broadcast = getOrCreateBroadcast(name);
    const config = { name, payload };
    const singleton = factory(hub, coordinator, broadcast, config);
    assert.equal(factory(hub, coordinator, broadcast, config), singleton);
    const independent = factory(hub, coordinator, broadcast, config, false);
    assert.notEqual(independent, singleton);
    assert.equal(factory(hub, coordinator, broadcast, config), singleton);
    independent.send({ query: 'résumé' });
  }
  const worker = workers.find((item) => item.source.pathname === '/workers/hub.js');
  const queries = worker.messages
    .filter((message) => message.task === 'hub:query')
    .map(({ payload: { name, task, payload } }) => ({ name, task, payload }));
  assert.deepEqual(queries, [
    { name: 'llm', task: 'llm:query', payload: { query: 'résumé' } },
    { name: 'vectordb', task: 'vectordb:query', payload: { query: 'résumé' } },
  ]);
});
