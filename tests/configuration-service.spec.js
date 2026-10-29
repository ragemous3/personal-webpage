import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConfigurationRepository } from '@/layers/data/configuration-repository.data';
import { ConfigurationService } from '@/layers/services/configuration.service';
import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';

const setup = () => {
  const storage = new Map();
  const repository = new ConfigurationRepository(
    {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    new EventTarget(),
  );
  const runtime = {
    select() {},
    stateSubscription: createStatefulSubscribable({ responding: false }),
    applied: [],
    setAvailable(value) {
      this.available = value;
    },
    async apply(settings) {
      this.applied.push(settings);
    },
  };
  return { repository, runtime, service: new ConfigurationService(repository, runtime) };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const disconnect = () => {};

test('startup resolves preferences and publishes defaults before loading the runtime', async () => {
  const { service, runtime } = setup();
  assert.equal(service.stateSubscription.getValue().selected.execution, 'auto');
  assert.equal(service.stateSubscription.getValue().selected.maxNewTokens, 256);
  await settle();
  assert.equal(runtime.applied[0].execution, 'auto');
  assert.equal(service.stateSubscription.getValue().available, true);
});

test('valid edits persist immediately but only the latest applies after a response', async () => {
  const { service, runtime, repository } = setup();
  await settle();
  runtime.stateSubscription.emit({ responding: true });
  const original = service.stateSubscription.getValue().selected;
  assert.equal(service.update({ ...original, execution: 'wasm' }), true);
  assert.equal(service.update({ ...original, execution: 'webgpu' }), true);
  assert.equal(runtime.applied.length, 1);
  assert.equal(repository.load().value.execution, 'webgpu');
  assert.equal(service.stateSubscription.getValue().active.execution, 'auto');
  runtime.stateSubscription.emit({ responding: false });
  await settle();
  assert.equal(runtime.applied.length, 2);
  assert.equal(service.stateSubscription.getValue().active.execution, 'webgpu');
});

test('invalid edits cannot replace or persist valid choices', async () => {
  const { service, repository } = setup();
  await settle();
  const settings = service.stateSubscription.getValue().selected;
  assert.equal(service.update({ ...settings, maxNewTokens: 0 }), false);
  assert.deepEqual(service.stateSubscription.getValue().selected, settings);
  assert.equal(repository.load().value, undefined);
});

test('returning visitors load saved settings before the first model starts', async () => {
  const first = setup();
  await settle();
  first.service.update({ ...first.service.stateSubscription.getValue().selected, mode: 'online' });
  await settle();
  const applied = [];
  const returning = new ConfigurationService(first.repository, {
    select() {},
    stateSubscription: createStatefulSubscribable({ responding: false }),
    setAvailable() {},
    async apply(settings) {
      applied.push(settings);
    },
  });
  await settle();
  assert.equal(applied[0].mode, 'online');
  assert.equal(returning.stateSubscription.getValue().available, false);
});

test('repository observations adopt settings without echoing a write', async () => {
  const original = setup();
  await settle();
  let observe;
  const repository = {
    load: () => original.repository.load(),
    save: () => {
      throw new Error('An observed update must not be written back');
    },
    observe(listener) {
      observe = listener;
      return disconnect;
    },
  };
  const service = new ConfigurationService(repository, original.runtime);
  await settle();
  observe({ value: { ...service.stateSubscription.getValue().selected, execution: 'wasm' } });
  await settle();
  assert.equal(service.stateSubscription.getValue().active.execution, 'wasm');
});

test('failure retains the requested combination and offers an explicit switch back', async () => {
  const { service, runtime } = setup();
  await settle();
  runtime.apply = async (settings) => {
    if (settings.execution === 'webgpu') throw new Error('GPU unavailable');
  };
  service.update({ ...service.stateSubscription.getValue().selected, execution: 'webgpu' });
  await settle();
  assert.match(service.stateSubscription.getValue().error, /webgpu.*GPU unavailable/);
  assert.equal(service.stateSubscription.getValue().selected.execution, 'webgpu');
  assert.equal(runtime.available, false);
  service.switchBack();
  await settle();
  assert.equal(service.stateSubscription.getValue().active.execution, 'auto');
  assert.equal(runtime.available, true);
});

test('edits during loading serialize and stale success cannot enable Send', async () => {
  const { service, runtime } = setup();
  await settle();
  const finish = [];
  runtime.apply = (settings) => new Promise((resolve) => finish.push({ settings, resolve }));
  const settings = service.stateSubscription.getValue().selected;
  service.update({ ...settings, execution: 'webgpu' });
  service.update({ ...settings, execution: 'wasm' });
  assert.equal(finish.length, 1);
  finish[0].resolve();
  await settle();
  assert.equal(runtime.available, false);
  assert.equal(finish[1].settings.execution, 'wasm');
  finish[1].resolve();
  await settle();
  assert.equal(service.stateSubscription.getValue().active.execution, 'wasm');
});

test('an ongoing shared runtime failure remains visible after startup apply has settled', async () => {
  const { service, runtime } = setup();
  await settle();
  const selected = service.stateSubscription.getValue().selected;
  runtime.stateSubscription.emit({ responding: false, runtime: {
    selected, active: selected, pending: true, loading: false, ready: false, error: 'Replacement owner failed',
  } });
  const state = service.stateSubscription.getValue();
  assert.equal(state.available, false);
  assert.match(state.error, /Replacement owner failed/);
  assert.equal(state.canSwitchBack, true);
});
