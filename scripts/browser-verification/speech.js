import assert from 'node:assert/strict';
import path from 'node:path';

import { createPage } from './page.js';
import { seedVerificationPreferences } from './preferences.js';

const chat = 'chatbot-provider >>> chat-container';
const head = 'chatbot-provider >>> talking-head';
const ready = (page) =>
  page.waitForFunction(() => globalThis.verificationChat()?.lifecycle.status === 'ready', {
    timeout: 120_000,
  });
const instrument = (page) =>
  page.evaluateOnNewDocument(() => {
    globalThis.verificationSpeech = { utterances: [], cancels: 0 };
    const speak = globalThis.speechSynthesis.speak;
    globalThis.speechSynthesis.speak = function (utterance) {
      const record = { text: utterance.text, voices: this.getVoices().length };
      globalThis.verificationSpeech.utterances.push(record);
      utterance.addEventListener('start', () => {
        record.started = true;
      });
      utterance.addEventListener('end', () => {
        record.ended = true;
      });
      utterance.addEventListener('error', (event) => {
        record.error = event.error;
      });
      return Reflect.apply(speak, this, [utterance]);
    };
    const cancel = globalThis.speechSynthesis.cancel;
    globalThis.speechSynthesis.cancel = function () {
      globalThis.verificationSpeech.cancels++;
      return Reflect.apply(cancel, this, []);
    };
  });
const enable = async (page) => {
  const start = performance.now();
  await page.click(`${head} >>> button`);
  await page.waitForFunction(() =>
    ['ready', 'error'].includes(
      globalThis
        .verificationChat()
        ?.getRootNode()
        .querySelector('talking-head')
        ?.service.stateSubscription.getValue().status,
    ),
  );
  const state = await page.$eval(head, (element) => element.service.stateSubscription.getValue());
  assert.equal(state.status, 'ready', JSON.stringify(state));
  assert.equal(page.workers().length, 0);
  return performance.now() - start;
};
const ask = async (page, question, stop = false) => {
  const index = await page.evaluate(() => globalThis.verificationSpeech.utterances.length);
  const start = performance.now();
  await page.type(`${chat} >>> input`, question);
  await page.click(`${chat} >>> button[type=submit]`);
  await page.waitForFunction(
    (index) => {
      const utterance = globalThis.verificationSpeech.utterances[index];
      return utterance?.started || utterance?.error;
    },
    { timeout: 240_000 },
    index,
  );
  const latency = performance.now() - start;
  const observation = await page.evaluate(
    (index) => globalThis.verificationSpeech.utterances[index],
    index,
  );
  if (observation.error && observation.voices !== 0)
    throw new Error(`Browser speech failed: ${observation.error}`);
  if (stop && observation.started) await page.click(`${head} >>> button:nth-of-type(2)`);
  await page.waitForFunction(
    () =>
      ['ready', 'error'].includes(
        globalThis
          .verificationChat()
          ?.getRootNode()
          .querySelector('talking-head')
          ?.service.stateSubscription.getValue().status,
      ),
    { timeout: 30_000 },
  );
  await ready(page);
  const answer = await page.$eval(chat, (element) => element.messages.at(-1).content);
  assert.ok(answer.trim());
  assert.equal(observation.text, answer);
  assert.equal(page.workers().length, 0);
  return {
    firstSpeechEventMs: latency,
    answer,
    ...(await page.evaluate((index) => globalThis.verificationSpeech.utterances[index], index)),
  };
};

const capture = async (page, evidence, directory, name) => {
  await page.screenshot({ path: path.join(directory, name), fullPage: true });
  evidence.artifacts.push(name);
};

export const runSpeech = async (restart, origin, evidence, directory) => {
  const result = {
    name: 'talking-head-browser-speech',
    kind: 'real-avatar-native-speech-api',
    realOpenAI: false,
    realLocalModels: Boolean(process.env.RUNTIME_MODEL_DIR),
    verdict: 'PASS',
  };
  let page;
  try {
    page = await createPage(await restart(false));
    await instrument(page);
    await seedVerificationPreferences(page, 'online');
    await page.goto(origin);
    await ready(page);
    await page.waitForSelector(`${head} >>> canvas`, { timeout: 120_000 });
    result.onlineInitializationMs = await enable(page);
    const recorder = await page.screencast({
      path: path.join(directory, 'talking-head.webm'),
      fps: 10,
    });
    evidence.artifacts.push('talking-head.webm');
    try {
      result.online = await ask(page, 'Please introduce yourself.');
      await capture(page, evidence, directory, 'talking-head.png');
      await page.click(`${head} >>> button:nth-of-type(2)`);
      await page.$eval(chat, (element) => element.chatbotService.reset());
      await ready(page);
      assert.equal(await page.$eval(chat, (element) => element.messages.length), 0);
      await page.select(
        'chatbot-provider >>> assistant-configuration >>> select[name=mode]',
        'local',
      );
      await page.waitForFunction(
        () =>
          globalThis.verificationChat()?.getRootNode()?.host?.localName ===
          'chatbot-offline-provider',
        { timeout: 120_000 },
      );
      await ready(page);
      result.localInitializationMs = await enable(page);
      result.local = await ask(page, 'What experience does Rasmus have?', true);
      await capture(page, evidence, directory, 'local-answer.png');
      result.dedicatedWorkers = page.workers().map((worker) => worker.url());
      result.nativeCancels = await page.evaluate(() => globalThis.verificationSpeech.cancels);
      assert.ok(!result.local.started || result.nativeCancels > 0);
    } finally {
      await recorder.stop();
    }
    const warm = await restart(true);
    page = await createPage(warm);
    await instrument(page);
    await page.goto(origin);
    await ready(page);
    result.returningInitializationMs = await enable(page);
    result.returningLocal = await ask(page, 'What experience does Rasmus have?');
    await capture(page, evidence, directory, 'returning-local-answer.png');
    result.returningModelJourney = true;
    if ([result.online, result.local, result.returningLocal].some((item) => item.error)) {
      result.verdict = 'BLOCKED';
      result.reason =
        'Browser exposes no usable system voice; text/error paths and mode/restart checks completed. Audible speech and lip synchronization remain unverified.';
    }
  } catch (error) {
    result.verdict = 'FAIL';
    result.reason = error.stack;
    await page
      ?.screenshot({ path: path.join(directory, 'speech-failure.png'), fullPage: true })
      .catch(() => {});
  } finally {
    evidence.scenarios.push(result);
    if (page && !page.isClosed()) await page.close();
  }
};
