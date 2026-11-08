import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TalkingHeadService } from '@/layers/services/talking-head.service';
import { createSubscribable } from '@/layers/shared/utils/subscribable';

test('the head speaks completed live generation once and drops synthesis invalidated by Reset', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  const spoken = [];
  let finish;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {},
      synthesize: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      release() {},
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async (audio) => spoken.push(audio),
      stop() {},
      release() {},
      dispose() {},
    },
  );
  await service.mount({});
  await service.enable();
  events.emit({ type: 'start', requestId: 'first' });
  events.emit({ type: 'complete', requestId: 'first', text: 'Old answer' });
  lifecycle.emit('invalidate');
  finish(['old audio']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(spoken, []);
  events.emit({ type: 'start', requestId: 'second' });
  events.emit({ type: 'complete', requestId: 'second', text: 'New answer' });
  finish(['new audio']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(spoken, ['new audio']);
  events.emit({ type: 'complete', requestId: 'second', text: 'New answer' });
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  service.dispose();
});

test('speech can be enabled again after a synthesis failure', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let initializations = 0;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {
        initializations++;
      },
      synthesize: async () => {
        throw new Error('Voice failed');
      },
      release() {},
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {},
      stop() {},
      release() {},
      dispose() {},
    },
  );
  await service.mount({});
  await service.enable();
  events.emit({ type: 'start', requestId: 'failed' });
  events.emit({ type: 'complete', requestId: 'failed', text: 'An answer' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.stateSubscription.getValue().status, 'error');
  await service.enable();
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(initializations, 2);
  service.dispose();
});

test('disposing speech releases presentation and ignores delayed audio without owning generation', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let resolveAudio;
  let played = 0;
  let released = 0;
  const generation = {
    generationSubscription: events,
    dispose: () => assert.fail('Shared generation belongs to composition'),
  };
  const service = new TalkingHeadService(
    generation,
    lifecycle,
    {
      initialize: async () => {},
      synthesize: () =>
        new Promise((resolve) => {
          resolveAudio = resolve;
        }),
      release() {},
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {
        played++;
      },
      stop() {},
      dispose() {
        released++;
      },
    },
  );
  await service.enable();
  events.emit({ type: 'start', requestId: 'leaving' });
  events.emit({ type: 'complete', requestId: 'leaving', text: 'Late answer' });
  service.dispose();
  service.dispose();
  resolveAudio(['stale']);
  await new Promise((resolve) => setImmediate(resolve));
  events.emit({ type: 'start', requestId: 'after-disposal' });
  events.emit({ type: 'complete', requestId: 'after-disposal', text: 'Never spoken' });
  assert.equal(played, 0);
  assert.equal(released, 1);
});

test('configuration unavailability releases an idle voice model before another model initializes', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let resident = false;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {
        resident = true;
      },
      synthesize: async () => [],
      release() {
        resident = false;
      },
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {},
      stop() {},
      dispose() {},
    },
  );
  await service.enable();
  assert.equal(resident, true);
  lifecycle.emit('unavailable');
  assert.equal(resident, false);
  service.dispose();
});

test('speech stays unloaded while configuration is unavailable and old answers cannot restart it', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let loads = 0;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {
        loads++;
      },
      synthesize: async () => assert.fail('Unaccepted speech'),
      release() {},
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {},
      stop() {},
      dispose() {},
    },
    { available: false },
  );
  await service.enable();
  assert.equal(loads, 0);
  lifecycle.emit('available');
  await service.enable();
  assert.equal(loads, 1);
  events.emit({ type: 'start', requestId: 'old-mode' });
  lifecycle.emit('unavailable');
  events.emit({ type: 'complete', requestId: 'old-mode', text: 'Old answer' });
  await service.enable();
  assert.equal(loads, 1);
  assert.equal(service.stateSubscription.getValue().status, 'unavailable');
  service.dispose();
});

test('stable configuration keeps the idle voice warm between questions', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let resident = false;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {
        resident = true;
      },
      synthesize: async () => {
        assert.equal(resident, true);
        return [];
      },
      release() {
        resident = false;
      },
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {},
      stop() {},
      dispose() {},
    },
  );
  await service.enable();
  events.emit({ type: 'start', requestId: 'warm' });
  events.emit({ type: 'complete', requestId: 'warm', text: 'A new answer' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.stateSubscription.getValue().status, 'ready');
  assert.equal(resident, true);
  service.dispose();
});

test('Local generation can release the voice before model work begins', async () => {
  const events = createSubscribable();
  const lifecycle = createSubscribable();
  let resident = false;
  const service = new TalkingHeadService(
    { generationSubscription: events },
    lifecycle,
    {
      initialize: async () => {
        resident = true;
      },
      synthesize: async () => [],
      release() {
        resident = false;
      },
      dispose() {},
    },
    {
      mount: async () => {},
      activate: async () => {},
      play: async () => {},
      stop() {},
      dispose() {},
    },
    { releaseVoiceDuringGeneration: true },
  );
  await service.enable();
  assert.equal(resident, true);
  events.emit({ type: 'start', requestId: 'local-inference' });
  assert.equal(resident, false);
  service.dispose();
});
