import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BrowserSpeechAdapter } from '@/layers/data/browser-speech.adapter';
import { TalkingHeadAdapter } from '@/layers/data/talking-head.adapter';

Object.defineProperties(globalThis, {
  SpeechSynthesisUtterance: { configurable: true, writable: true, value: undefined },
  speechSynthesis: { configurable: true, writable: true, value: undefined },
});

const browser = (context) => {
  const spoken = [];
  let cancels = 0;
  class Utterance extends EventTarget {
    constructor(text) {
      super();
      this.text = text;
    }
  }
  context.mock.property(globalThis, 'SpeechSynthesisUtterance', Utterance);
  context.mock.property(globalThis, 'speechSynthesis', {
    speak: (utterance) => spoken.push(utterance),
    cancel: () => {
      cancels++;
    },
  });
  return { spoken, cancels: () => cancels };
};

test('browser speech plays the exact answer and waits for the native completion event', async (context) => {
  const native = browser(context);
  const synthesis = new BrowserSpeechAdapter();
  const presentation = new TalkingHeadAdapter('/');
  const signal = new AbortController().signal;
  const [output] = await synthesis.synthesize('A local answer.', signal);
  let finished = false;
  const playback = presentation.play(output, signal).then(() => {
    finished = true;
  });
  assert.equal(native.spoken[0].text, 'A local answer.');
  assert.equal(native.spoken[0].lang, 'en-US');
  await Promise.resolve();
  assert.equal(finished, false);
  native.spoken[0].dispatchEvent(new Event('end'));
  await playback;
  presentation.dispose();
  assert.equal(native.cancels(), 0);
});

test('cancelling browser playback rejects and a late native event cannot finish it', async (context) => {
  const native = browser(context);
  const presentation = new TalkingHeadAdapter('/');
  const work = new AbortController();
  const playback = presentation.play({ text: 'Obsolete answer' }, work.signal);
  work.abort();
  await assert.rejects(playback, { name: 'AbortError' });
  native.spoken[0].dispatchEvent(new Event('end'));
  assert.equal(native.cancels(), 1);
  presentation.dispose();
  assert.equal(native.cancels(), 1);
});

test('native synthesis errors reject playback and allow the next answer', async (context) => {
  const native = browser(context);
  const presentation = new TalkingHeadAdapter('/');
  const signal = new AbortController().signal;
  const playback = presentation.play({ text: 'First' }, signal);
  const event = new Event('error');
  event.error = 'voice-unavailable';
  native.spoken[0].dispatchEvent(event);
  await assert.rejects(playback, /voice-unavailable/);
  const next = presentation.play({ text: 'Second' }, signal);
  native.spoken[1].dispatchEvent(new Event('end'));
  await next;
  presentation.dispose();
});

test('missing browser speech reports a capability error', async (context) => {
  context.mock.property(globalThis, 'speechSynthesis', undefined);
  await assert.rejects(
    new BrowserSpeechAdapter().initialize(new AbortController().signal),
    /unavailable/,
  );
});

test('disposing the presentation cancels and settles pending native playback', async (context) => {
  const native = browser(context);
  const presentation = new TalkingHeadAdapter('/');
  const playback = presentation.play({ text: 'Pending' }, new AbortController().signal);
  presentation.dispose();
  await assert.rejects(playback, { name: 'AbortError' });
  assert.equal(native.cancels(), 1);
  presentation.dispose();
  assert.equal(native.cancels(), 1);
  await assert.rejects(
    presentation.play({ text: 'Too late' }, new AbortController().signal),
    /unavailable/,
  );
});
