import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createPage } from './page.js';
import { seedVerificationPreferences } from './preferences.js';

const chat = 'chatbot-provider >>> chat-container';
const head = 'chatbot-provider >>> talking-head';
const waitReady = (page) =>
  page.waitForFunction(() => globalThis.verificationChat()?.lifecycle.status === 'ready', {
    timeout: 120_000,
  });
const status = (page) =>
  page.$eval(head, (element) => element.service.stateSubscription.getValue());
const enable = async (page) => {
  const start = performance.now();
  await page.click(`${head} >>> button`);
  await page.waitForFunction(
    () => {
      const root = globalThis.verificationChat()?.getRootNode();
      return ['ready', 'error'].includes(
        root?.querySelector('talking-head')?.service.stateSubscription.getValue()?.status,
      );
    },
    { timeout: 240_000 },
  );
  const state = await status(page);
  assert.equal(state.status, 'ready', JSON.stringify(state));
  return performance.now() - start;
};
const instrument = async (page) => {
  await page.evaluateOnNewDocument(() => {
    globalThis.verificationSpeech = { audio: [], states: [], stops: 0 };
    const stop = globalThis.AudioBufferSourceNode.prototype.stop;
    globalThis.AudioBufferSourceNode.prototype.stop = function (...arguments_) {
      globalThis.verificationSpeech.stops++;
      return Reflect.apply(stop, this, arguments_);
    };
    const start = globalThis.AudioBufferSourceNode.prototype.start;
    globalThis.AudioBufferSourceNode.prototype.start = function (...arguments_) {
      if (this.buffer) {
        const samples = this.buffer.getChannelData(0);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        globalThis.verificationSpeech.clip ??= {
          samples: [...samples],
          sampleRate: this.buffer.sampleRate,
        };
        globalThis.verificationSpeech.audio.push({
          peak,
          duration: this.buffer.duration,
          samples: this.buffer.length,
          sampleRate: this.buffer.sampleRate,
        });
      }
      return Reflect.apply(start, this, arguments_);
    };
  });
};
const ask = async (page, question, stop = false) => {
  const count = await page.evaluate(() => globalThis.verificationSpeech.audio.length);
  const start = performance.now();
  await page.type(`${chat} >>> input`, question);
  await page.click(`${chat} >>> button[type=submit]`);
  await page.waitForFunction(
    (count) => globalThis.verificationSpeech.audio.length > count,
    { timeout: 240_000 },
    count,
  );
  const latency = performance.now() - start;
  if (stop) await page.click(`${head} >>> button:nth-of-type(2)`);
  await page.waitForFunction(
    () => {
      const root = globalThis.verificationChat()?.getRootNode();
      return (
        root?.querySelector('talking-head')?.service.stateSubscription.getValue()?.status ===
        'ready'
      );
    },
    { timeout: 30_000 },
  );
  await waitReady(page);
  const answer = await page.$eval(chat, (element) => element.messages.at(-1).content);
  assert.ok(answer.trim().length > 0);
  return latency;
};
const caches = (page) =>
  page.evaluate(async () => {
    const result = [];
    for (const name of await globalThis.caches.keys()) {
      const cache = await globalThis.caches.open(name);
      const requests = await cache.keys();
      result.push(...requests.map((request) => ({ cache: name, url: request.url })));
    }
    return result;
  });

export const runSpeech = async (restart, origin, evidence, directory) => {
  const result = {
    name: 'talking-head-speech-cache',
    kind: 'real-avatar-and-kokoro-controlled-chat-generation',
    realOpenAI: false,
    realLocalModels: Boolean(process.env.RUNTIME_MODEL_DIR),
    verdict: 'PASS',
  };
  let page;
  try {
    const browser = await restart(false);
    page = await createPage(browser);
    await instrument(page);
    await seedVerificationPreferences(page, 'online');
    await page.goto(origin);
    await waitReady(page);
    await page.waitForSelector(`${head} >>> canvas`, { timeout: 120_000 });
    result.coldInitializationMs = await enable(page);
    const recorder = await page.screencast({
      path: path.join(directory, 'talking-head.webm'),
      fps: 10,
    });
    evidence.artifacts.push('talking-head.webm');
    try {
      result.firstAudioMs = await ask(page, 'Please introduce yourself.');
      await page.screenshot({ path: path.join(directory, 'talking-head.png'), fullPage: true });
      evidence.artifacts.push('talking-head.png');
      await page.$eval(`${head} >>> button:nth-of-type(2)`, (button) => button.click());
      const stopped = await status(page);
      assert.equal(stopped.status, 'ready');
      await page.$eval(chat, (element) => element.chatbotService.reset());
      await waitReady(page);
      assert.equal(await page.$eval(chat, (element) => element.messages.length), 0);
    } finally {
      await recorder.stop();
    }
    await checkLocal(page, evidence, result, directory);
    result.cache = await caches(page);
    assert.ok(
      result.cache.some((entry) => entry.url.includes('Kokoro') && entry.url.includes('.onnx')),
    );
    assert.ok(result.cache.some((entry) => entry.url.includes('/voices/')));
    result.audio = await page.evaluate(() => globalThis.verificationSpeech.audio);
    assert.ok(
      result.audio.every((audio) => audio.duration > 0 && audio.samples > 0 && audio.peak > 0.001),
    );
    const warmBrowser = await restart(true);
    page = await createPage(warmBrowser);
    await instrument(page);
    await page.goto(origin);
    await waitReady(page);
    result.cachedInitializationMs = await enable(page);
    result.cachedFirstAudioMs = await ask(page, 'Does cached speech work?');
    result.offlineModelRestart = true;
  } catch (error) {
    result.verdict = 'FAIL';
    result.reason = error.stack;
    if (page && !page.isClosed()) {
      result.failureState = await page
        .evaluate(() => ({
          chat: globalThis.verificationChat?.()?.lifecycle,
          settings: globalThis.document
            .querySelector('chatbot-provider')
            ?.shadowRoot?.querySelector('assistant-configuration')
            ?.configurationService?.stateSubscription.getValue(),
        }))
        .catch(() => {});
      await page
        .screenshot({ path: path.join(directory, 'speech-failure.png'), fullPage: true })
        .catch(() => {});
    }
  } finally {
    evidence.scenarios.push(result);
    if (page && !page.isClosed()) await page.close();
  }
};

const saveAudio = async (file, clip) => {
  const buffer = Buffer.alloc(44 + clip.samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(clip.sampleRate, 24);
  buffer.writeUInt32LE(clip.sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(clip.samples.length * 2, 40);
  for (let index = 0; index < clip.samples.length; index++)
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, clip.samples[index])) * 32_767),
      44 + index * 2,
    );
  await writeFile(file, buffer);
};

const checkLocal = async (page, evidence, result, directory) => {
  await page.select('chatbot-provider >>> assistant-configuration >>> select[name=mode]', 'local');
  await page.waitForFunction(
    () =>
      globalThis.verificationChat()?.getRootNode()?.host?.localName === 'chatbot-offline-provider',
    { timeout: 120_000 },
  );
  await waitReady(page);
  result.localInitializationMs = await enable(page);
  result.localFirstAudioMs = await ask(page, 'What experience does Rasmus have?', true);
  result.localGenerationRequests = evidence.events.filter(
    (event) => event.type === 'accepted' && event.role === 'llm',
  ).length;
  if (!result.realLocalModels) assert.equal(result.localGenerationRequests, 1);
  result.dedicatedWorkers = page.workers().map((worker) => worker.url());
  assert.ok(result.dedicatedWorkers.length <= 1);
  result.nativeAudioStops = await page.evaluate(() => globalThis.verificationSpeech.stops);
  assert.ok(result.nativeAudioStops > 0);
  const clip = await page.evaluate(() => globalThis.verificationSpeech.clip);
  await saveAudio(path.join(directory, 'talking-head.wav'), clip);
  evidence.artifacts.push('talking-head.wav');
};
