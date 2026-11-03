import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getLocalChatBot } from '@/composition/factories/local-chat-bot.factory';
import { getVectorDatabase } from '@/composition/factories/local-vector-database.factory';
import { progressFactory } from '@/composition/factories/progress.factory';
import { RuntimeCoordinatorConnection } from '@/layers/data/runtime-coordinator.connection';
import { RuntimeCoordinator } from '@/layers/data/runtime-coordinator.data';

import { databaseConfig, modelConfig, siteConfig, workers } from './browser-workers.fixture.js';

test('both factories reuse singletons and create independent configured clients when requested', () => {
  const runtime = new RuntimeCoordinator(
    new RuntimeCoordinatorConnection('/workers/coordinator.js', {
      llm: '/workers/llm.js',
      vectordb: '/workers/vectordb.js',
    }),
  );
  for (const [factory, name, payload] of [
    [getLocalChatBot, 'llm', modelConfig],
    [getVectorDatabase, 'vectordb', databaseConfig],
  ]) {
    const config = { name, payload };
    const singleton = factory(runtime, config);
    assert.equal(factory(runtime, config), singleton);
    const independent = factory(runtime, config, false);
    assert.notEqual(independent, singleton);
    assert.equal(factory(runtime, config), singleton);
    independent.send({ query: 'résumé' });
  }
  const worker = workers.find((item) => item.source.pathname === '/workers/coordinator.js');
  const queries = worker.messages
    .filter((message) => message.task === 'runtime:send')
    .map(({ payload: { name, task, payload } }) => ({ name, task, payload }));
  assert.deepEqual(queries, [
    { name: 'llm', task: 'llm:query', payload: { query: 'résumé' } },
    { name: 'vectordb', task: 'vectordb:query', payload: { query: 'résumé' } },
  ]);
});

test('recreating progress providers reuses one resource subscription service', () => {
  assert.equal(progressFactory(siteConfig()), progressFactory(siteConfig()));
});
