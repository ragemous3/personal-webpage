import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BrowserSpeechLipSync } from '@/layers/data/utils/browser-speech-lip-sync.utility';

Object.defineProperties(globalThis, {
  requestAnimationFrame: { configurable: true, writable: true, value: undefined },
  cancelAnimationFrame: { configurable: true, writable: true, value: undefined },
});
const setup = (context, text = 'Hello wonderful world.') => {
  let now = 0;
  let id = 0;
  let started = 0;
  let stopped = 0;
  const pending = new Map();
  const values = new Map();
  const seen = new Set();
  context.mock.method(performance, 'now', () => now);
  context.mock.property(globalThis, 'requestAnimationFrame', (callback) => {
    pending.set(++id, callback);
    return id;
  });
  context.mock.property(globalThis, 'cancelAnimationFrame', (key) => pending.delete(key));
  const head = {
    start: () => {
      started++;
    },
    stop: () => {
      stopped++;
    },
    stopSpeaking: () => {
      for (const name of values.keys()) values.set(name, 0);
    },
    animQueue: [],
    animFactory: (template) => {
      for (const [name, series] of Object.entries(template.vs)) {
        const value = series.at(-1);
        values.set(name, value);
        if (value) seen.add(name);
      }
      return { template };
    },
  };
  return {
    sync: new BrowserSpeechLipSync(head, text, 1),
    values,
    seen,
    pending,
    counts: () => ({ started, stopped }),
    step: (time) => {
      now = time;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
};

test('text produces different mouth shapes without boundary events, only after speech starts', (context) => {
  const state = setup(context);
  assert.equal(state.pending.size, 0);
  assert.equal(state.values.size, 0);
  state.sync.start();
  for (let time = 0; time < 2000; time += 40) state.step(time);
  assert.ok(state.seen.size > 3);
  assert.deepEqual(state.counts(), { started: 1, stopped: 0 });
  state.sync.stop();
  assert.equal(state.pending.size, 0);
  assert.ok([...state.values.values()].every((value) => value === 0));
});

test('a word boundary moves animation to the actual current word', (context) => {
  const state = setup(context, 'aaa ppp');
  state.sync.start();
  const before = [...state.values].filter(([, value]) => value > 0).map(([name]) => name);
  state.step(10);
  state.sync.boundary(4);
  state.step(11);
  const after = [...state.values].filter(([, value]) => value > 0).map(([name]) => name);
  assert.notDeepEqual(after, before);
  assert.ok(after.includes('viseme_PP'));
  state.sync.stop();
});

test('stop closes the mouth, cancels scheduling and ignores late boundary callbacks', (context) => {
  const state = setup(context);
  state.sync.start();
  const lateFrame = [...state.pending.values()][0];
  state.sync.stop();
  state.sync.stop();
  state.sync.boundary(6);
  lateFrame();
  assert.equal(state.pending.size, 0);
  assert.ok([...state.values.values()].every((value) => value === 0));
  assert.deepEqual(state.counts(), { started: 1, stopped: 1 });
});

test('punctuation-only input schedules no invalid mouth values', (context) => {
  const state = setup(context, '... !');
  state.sync.start();
  state.step(500);
  assert.ok([...state.values.values()].every((value) => Number.isFinite(value)));
  state.sync.stop();
});
