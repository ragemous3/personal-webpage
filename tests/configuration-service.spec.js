import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('a cached pending snapshot cannot restart a completed apply in a microtask loop', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { ConfigurationService } from '@/layers/services/configuration.service';
    import { createStatefulSubscribable } from '@/layers/shared/utils/subscribable';
    let finish;
    const runtime = {
      select() {}, setAvailable() {},
      stateSubscription: createStatefulSubscribable({ responding: false }),
      apply: () => new Promise((resolve) => { finish = resolve; }),
    };
    const repository = { load: () => ({}), save: () => ({}), observe: () => () => {} };
    const service = new ConfigurationService(repository, runtime);
    const selected = service.stateSubscription.getValue().selected;
    runtime.stateSubscription.emit({ responding: false, runtime: {
      selected, pending: true, loading: true, ready: false,
    } });
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(service.stateSubscription.getValue().pending, false);
    service.dispose();
  `;
  const result = spawnSync(
    process.execPath,
    ['--import', './scripts/typescript-test.loader.js', '--input-type=module', '-e', source],
    { encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

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
  runtime.stateSubscription.emit({
    responding: false,
    runtime: {
      selected,
      active: selected,
      pending: true,
      loading: false,
      ready: false,
      error: 'Replacement owner failed',
    },
  });
  const state = service.stateSubscription.getValue();
  assert.equal(state.available, false);
  assert.match(state.error, /Replacement owner failed/);
  assert.equal(state.canSwitchBack, true);
});

test('a session-only tab adopts authoritative shared settings without writing preferences back', async () => {
  const { runtime } = setup();
  let writes = 0;
  const denied = new ConfigurationRepository(
    {
      getItem() {
        throw new Error('Denied');
      },
      setItem() {
        writes++;
        throw new Error('Denied');
      },
    },
    new EventTarget(),
  );
  const service = new ConfigurationService(denied, runtime);
  await settle();
  const selected = {
    ...service.stateSubscription.getValue().selected,
    execution: 'wasm',
    maxNewTokens: 32,
  };
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { selected, active: selected, pending: false, loading: false, ready: true },
  });
  const state = service.stateSubscription.getValue();
  assert.equal(state.selected.execution, 'wasm');
  assert.equal(state.active.maxNewTokens, 32);
  assert.equal(writes, 0);
  assert.equal(state.available, true);
});

test('a shared snapshot cannot overwrite a newer local edit while it is applying', async () => {
  const { service, runtime } = setup();
  await settle();
  const original = service.stateSubscription.getValue().selected;
  let finish;
  runtime.apply = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  service.update({ ...original, maxNewTokens: 48 });
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { selected: original, active: original, pending: false, loading: false, ready: true },
  });
  assert.equal(service.stateSubscription.getValue().selected.maxNewTokens, 48);
  const peer = { ...original, maxNewTokens: 64 };
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { selected: peer, active: peer, pending: false, loading: false, ready: true },
  });
  finish();
  await settle();
  assert.equal(service.stateSubscription.getValue().selected.maxNewTokens, 64);
  assert.equal(service.stateSubscription.getValue().active.maxNewTokens, 64);
});

test('a repairing shared port cannot silently retry the same failed selection', async () => {
  const { service, runtime } = setup();
  await settle();
  const original = service.stateSubscription.getValue().selected;
  let attempts = 0;
  runtime.apply = async () => {
    attempts++;
    throw new Error('GPU unavailable');
  };
  const failed = { ...original, execution: 'webgpu' };
  service.update(failed);
  await settle();
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { selected: failed, active: original, pending: true, loading: true, ready: false },
  });
  await settle();
  assert.equal(attempts, 1);
  assert.match(service.stateSubscription.getValue().error, /GPU unavailable/);
});

test('a cached shared snapshot cannot erase a failed local selection', async () => {
  const { service, runtime } = setup();
  await settle();
  const original = service.stateSubscription.getValue().selected;
  const old = {
    selected: original,
    active: original,
    selectionId: 'previous',
    pending: false,
    loading: false,
    ready: true,
  };
  runtime.stateSubscription.emit({ responding: false, runtime: old });
  runtime.apply = async () => {
    throw new Error('Connection deadline exceeded');
  };
  service.update({ ...original, execution: 'webgpu' });
  await settle();
  runtime.stateSubscription.emit({ responding: false, runtime: old });
  const failed = service.stateSubscription.getValue();
  assert.equal(failed.selected.execution, 'webgpu');
  assert.match(failed.error, /Connection deadline exceeded/);
  assert.equal(failed.available, false);
  const newer = { ...original, execution: 'wasm' };
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { ...old, selected: newer, active: newer, selectionId: 'newer' },
  });
  assert.equal(service.stateSubscription.getValue().selected.execution, 'wasm');
  assert.equal(service.stateSubscription.getValue().error, undefined);
  service.retry();
  await settle();
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { ...old, selected: newer, active: newer, selectionId: 'newer' },
  });
  assert.match(service.stateSubscription.getValue().error, /Connection deadline exceeded/);
  assert.equal(service.stateSubscription.getValue().available, false);
});

test('each apply attempt establishes a shared-snapshot baseline even for observed settings', async () => {
  const { service, runtime } = setup();
  await settle();
  const original = service.stateSubscription.getValue().selected;
  runtime.apply = async () => {
    throw new Error('Connection deadline exceeded');
  };
  const selected = { ...original, execution: 'wasm' };
  const shared = {
    selected,
    active: original,
    selectionId: 'peer',
    pending: true,
    loading: true,
    ready: false,
  };
  runtime.stateSubscription.emit({ responding: false, runtime: shared });
  await settle();
  runtime.stateSubscription.emit({
    responding: false,
    runtime: { ...shared, active: selected, pending: false, loading: false, ready: true },
  });
  assert.match(service.stateSubscription.getValue().error, /Connection deadline exceeded/);
  assert.equal(service.stateSubscription.getValue().available, false);
});

test('the first late shared identity cannot erase a failure with no previously observed baseline', async () => {
  const { service, runtime } = setup();
  await settle();
  const original = service.stateSubscription.getValue().selected;
  runtime.apply = async () => {
    throw new Error('Connection deadline exceeded');
  };
  service.update({ ...original, execution: 'webgpu' });
  await settle();
  runtime.stateSubscription.emit({
    responding: false,
    runtime: {
      selected: original,
      active: original,
      selectionId: 'first-observed',
      pending: false,
      loading: false,
      ready: true,
    },
  });
  assert.equal(service.stateSubscription.getValue().selected.execution, 'webgpu');
  assert.match(service.stateSubscription.getValue().error, /Connection deadline exceeded/);
});
