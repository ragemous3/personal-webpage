import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConfigurationService } from '@/layers/services/configuration.service';
import { defaultAssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

import { metadata } from './model-metadata.fixture.js';

const disconnect = () => {};

test('saved Online discovers API choices and becomes available while retaining local preferences', async () => {
  const applied = [];
  const settings = new ConfigurationService({
    load: () => ({ value: { ...defaultAssistantSettings, mode: 'online' } }),
    save: () => ({}), observe: () => disconnect,
  }, {
    select() {}, setAvailable() {},
    apply: async (selection) => { applied.push(selection); },
    stateSubscription: createStatefulSubscribable({ responding: false }),
  }, metadata, { load: async () => [{ id: 'gpt-6-luna', label: 'Luna', reasoningEffort: 'low', maxOutputTokens: 1024 }] });
  await new Promise((resolve) => setTimeout(resolve, 25));
  const state = settings.stateSubscription.getValue();
  assert.equal(state.available, true);
  assert.equal(state.selected.onlineModel, 'gpt-6-luna');
  assert.equal(state.selected.model, defaultAssistantSettings.model);
  assert.equal(state.choices.models[0].value, 'gpt-6-luna');
  settings.dispose();
});

test('saved Online cannot enable Send before its model is confirmed by the API catalog', async () => {
  let rejectCatalog = true;
  const service = new ConfigurationService({
    load: () => ({ value: { ...defaultAssistantSettings, mode: 'online', onlineModel: 'gpt-6-luna' } }),
    save: () => ({}), observe: () => disconnect,
  }, {
    select() {}, setAvailable() {}, apply: async () => {},
    stateSubscription: createStatefulSubscribable({ responding: false }),
  }, metadata, { async load() {
    if (rejectCatalog) throw new Error('Catalog offline');
    return [{ id: 'gpt-6-luna', label: 'Luna', reasoningEffort: 'low', maxOutputTokens: 1024 }];
  } });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(service.stateSubscription.getValue().available, false);
  rejectCatalog = false;
  await service.refreshOptions();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(service.stateSubscription.getValue().available, true);
  service.dispose();
});
