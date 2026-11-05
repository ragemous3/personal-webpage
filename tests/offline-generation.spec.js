import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOfflineConfiguration } from '@/composition/factories/offline-configuration.factory';

import { siteConfig } from './browser-workers.fixture.js';

test('explicit valid generation options survive validated offline site defaults', () => {
  const config = siteConfig();
  const options = {
    max_new_tokens: 64,
    temperature: 0.7,
    do_sample: true,
    length_penalty: -1,
    eos_token_id: [0, 2],
    suppress_tokens: [],
    epsilon_cutoff: 0,
    min_new_tokens: 0,
  };
  config.SITE_PARAMS.params.chatbot.config.locallm.generation = options;
  assert.deepEqual(getOfflineConfiguration(config).model.payload.generation, options);
});
