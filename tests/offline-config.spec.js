import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildChatbotOfflineDeps } from '@/composition/factories/chatbot-offline.factory';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';

import {
  databaseConfig,
  modelConfig,
  resources,
  siteConfig,
  workers,
} from './browser-workers.fixture.js';

test('a language model configuration is accepted without database fields', () => {
  assert.equal(isLmConfig(modelConfig), true);
});

test('unsupported model devices, dtypes and malformed generation options are rejected', () => {
  for (const overrides of [
    { device: 'invalid' },
    { dtype: 'invalid' },
    { source: '' },
    { model: '' },
    { generation: [] },
    { generation: null },
    { generation: 'invalid' },
    { generation: { temperature: 'cold' } },
    { generation: { generation_kwargs: { callback: () => {} } } },
    { generation: { constraints: [{ callback: () => {} }] } },
  ]) {
    assert.equal(isLmConfig({ ...modelConfig, ...overrides }), false, JSON.stringify(overrides));
  }
});

test('database configuration requires a base URL, supported space and finite dimensions', () => {
  assert.equal(isDatabaseConfig(databaseConfig), true);
  for (const overrides of [
    { baseUrl: undefined },
    { baseUrl: '' },
    { spaceName: 'invalid' },
    { dim: Number.NaN },
    { dim: Number.POSITIVE_INFINITY },
    { dim: 0 },
    { dim: 3.5 },
  ]) {
    assert.equal(isDatabaseConfig({ ...databaseConfig, ...overrides }), false);
  }
});

test('invalid model configuration creates no worker or broadcast resources', (context) => {
  context.mock.method(console, 'error', () => {});
  const config = siteConfig();
  config.SITE_PARAMS.params.chatbot.config.locallm.device = 'invalid';
  const count = resources.length;
  assert.equal(buildChatbotOfflineDeps(config), undefined);
  assert.equal(resources.length, count);
});

test('invalid site settings are rejected before creating any resources', (context) => {
  context.mock.method(console, 'error', () => {});
  const changes = [
    (config) => {
      config.SITE_PARAMS.params.chatbot.sysmessage.offline = 7;
    },
    (config) => {
      config.SITE_PARAMS.params.chatbot.config.localdatabase.dim = 0;
    },
    (config) => {
      config.SITE_PARAMS.params.chatbot.config.locallm.generation = [];
    },
    (config) => {
      config.SITE_PARAMS.baseURL = '';
    },
    (config) => {
      config.WORKER_NAMES['hub.worker.ts'] = undefined;
    },
    (config) => {
      config.WORKER_NAMES['llm.worker.ts'] = '';
    },
    (config) => {
      config.WORKER_NAMES = null;
    },
    (config) => {
      config.SITE_PARAMS.params = [];
    },
  ];
  for (const change of changes) {
    const config = siteConfig();
    change(config);
    const count = resources.length;
    assert.equal(buildChatbotOfflineDeps(config), undefined);
    assert.equal(resources.length, count);
  }
});

test('non-serializable generation values are rejected before allocating worker resources', (context) => {
  context.mock.method(console, 'error', () => {});
  for (const generation of [
    { generation_kwargs: { nested: [() => {}] } },
    { constraints: [{ nested: { callback: () => {} } }] },
  ]) {
    const config = siteConfig();
    config.SITE_PARAMS.params.chatbot.config.locallm.generation = generation;
    const count = resources.length;
    assert.equal(buildChatbotOfflineDeps(config), undefined);
    assert.equal(resources.length, count);
  }
});

test('invalid numeric generation options are rejected before allocating resources', (context) => {
  context.mock.method(console, 'error', () => {});
  for (const generation of [
    { max_new_tokens: -1 },
    { num_beams: 1.5 },
    { num_beams: 0 },
    { top_p: 1.1 },
    { temperature: 0 },
    { eos_token_id: -1 },
    { suppress_tokens: [1.5] },
  ]) {
    assert.equal(isLmConfig({ ...modelConfig, generation }), false);
    const config = siteConfig();
    config.SITE_PARAMS.params.chatbot.config.locallm.generation = generation;
    const count = resources.length;
    assert.equal(buildChatbotOfflineDeps(config), undefined);
    assert.equal(resources.length, count);
  }
});

test('valid normalized site params produce configured model and database startup messages', () => {
  const service = buildChatbotOfflineDeps(siteConfig());
  assert.ok(service);
  const hub = workers.find((worker) => worker.source.pathname === '/workers/hub.js');
  assert.ok(hub);
  const startup = hub.messages
    .filter((message) => message.task === 'hub:host')
    .map(({ payload: { name, task, payload } }) => ({ name, task, payload }));
  assert.deepEqual(startup, [
    { name: 'llm', task: 'llm:init', payload: modelConfig },
    { name: 'vectordb', task: 'vectordb:init', payload: databaseConfig },
  ]);
});
