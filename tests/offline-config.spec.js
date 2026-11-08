import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IDBFactory } from 'fake-indexeddb';

import { buildChatbotDeps } from '@/composition/factories/chatbot.factory';
import { buildChatbotOfflineDeps } from '@/composition/factories/chatbot-offline.factory';
import { getOfflineConfiguration } from '@/composition/factories/offline-configuration.factory';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { defaultAssistantSettings } from '@/layers/shared/constants/assistant-settings.constant';

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

test('the configured Online API directory is preserved and normalized', () => {
  for (const [configured, expected] of [
    ['/assistant-api', '/assistant-api/'],
    ['https://api.example.test/assistant/v2/', 'https://api.example.test/assistant/v2/'],
  ]) {
    const config = siteConfig();
    config.SITE_PARAMS.params.chatbot.config.online = { apibaseurl: configured };
    assert.equal(getOfflineConfiguration(config).onlineApiBaseURL, expected);
  }
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
  assert.throws(() => buildChatbotDeps(config, new EventTarget()));
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
    ...[undefined, '', 'javascript:alert(1)', '/api/?version=2', '/api/#models', 'http://['].map(
      (apibaseurl) => (config) => {
        config.SITE_PARAMS.params.chatbot.config.online = { apibaseurl };
      },
    ),
    (config) => {
      config.WORKER_NAMES['runtime-coordinator.shared-worker.ts'] = undefined;
    },
    (config) => {
      config.WORKER_NAMES['llm.shared-worker.ts'] = '';
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
    assert.throws(() => buildChatbotDeps(config, new EventTarget()));
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
    assert.throws(() => buildChatbotDeps(config, new EventTarget()));
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
    assert.throws(() => buildChatbotDeps(config, new EventTarget()));
    assert.equal(resources.length, count);
  }
});

test('valid normalized site params produce configured model and database startup messages after saved settings resolve', async () => {
  const browser = Object.assign(new EventTarget(), { indexedDB: new IDBFactory() });
  const dependencies = buildChatbotDeps(siteConfig(), browser);
  assert.ok(dependencies.settings);
  await new Promise((resolve) => setImmediate(resolve));
  const offline = buildChatbotOfflineDeps(dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  const coordinator = workers.find(
    (worker) => worker.source.pathname === '/workers/coordinator.js',
  );
  assert.ok(coordinator);
  const startup = coordinator.messages
    .filter((message) => message.task === 'runtime:host')
    .map(({ payload: { name, task, payload } }) => ({ name, task, payload }));
  assert.deepEqual(startup, [
    { name: 'vectordb', task: 'vectordb:init', payload: { ...databaseConfig, device: defaultAssistantSettings.execution } },
    { name: 'llm', task: 'llm:init', payload: { ...modelConfig, device: defaultAssistantSettings.execution, generation: { max_new_tokens: 256, do_sample: false } } },
  ]);
  offline.dispose();
  dependencies.dispose();
});

test('model infrastructure settings reject malformed URLs and unsupported retrieval devices', () => {
  assert.equal(isDatabaseConfig({ ...databaseConfig, device: 'unsupported' }), false);
  for (const overrides of [{ modelBaseUrl: 42 }, { wasmBaseUrl: {} }, { modelBaseUrl: '' }]) {
    assert.equal(isDatabaseConfig({ ...databaseConfig, ...overrides }), false);
    assert.equal(isLmConfig({ ...modelConfig, ...overrides }), false);
  }
});
