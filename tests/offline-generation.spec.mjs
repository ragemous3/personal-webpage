import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildChatbotOfflineDeps } from '@/composition/factories/chatbot-offline.factory';

import { siteConfig, workers } from './browser-workers.fixture.mjs';

test('explicit valid generation options survive composition into the worker startup message', () => {
  const config = siteConfig();
  const options = { max_new_tokens: 64, temperature: 0.7, do_sample: true };
  config.SITE_PARAMS.params.chatbot.config.locallm.generation = options;
  assert.ok(buildChatbotOfflineDeps(config));
  const hub = workers.find((worker) => worker.source.pathname === '/workers/hub.js');
  const model = hub.messages.find((message) => message.payload?.task === 'llm:init');
  assert.deepEqual(model.payload.payload.generation, options);
});
