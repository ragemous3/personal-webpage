import path from 'node:path';

import { cachePrerequisites } from './application.js';
import { root } from './environment.js';
import { exerciseRealSettings } from './real-settings.js';
import { exerciseRealTabs } from './real-tabs.js';

const waitReady = async (page) => {
  await page.waitForFunction(
    () => {
      const chat = globalThis.document
        .querySelector('chatbot-offline-provider')
        ?.shadowRoot?.querySelector('chat-container')?.shadowRoot;
      return (
        chat &&
        (!chat.querySelector('input').disabled ||
          chat.querySelector('[role=alert]')?.textContent.trim())
      );
    },
    { timeout: 600_000, polling: 100 },
  );
  const failure = await page.evaluate(() =>
    globalThis.document
      .querySelector('chatbot-offline-provider')
      ?.shadowRoot?.querySelector('chat-container')
      ?.shadowRoot?.querySelector('[role=alert]')
      ?.textContent.trim(),
  );
  if (failure) throw new Error(failure);
};
const seedPreferences = async (page, evidence) => {
  if (evidence.configuration?.modelMirror)
    await page.evaluateOnNewDocument(() => {
      if (!localStorage.getItem('assistant.preferences'))
        localStorage.setItem(
          'assistant.preferences',
          JSON.stringify({
            version: 1,
            preferences: {
              mode: 'local',
              model: 'Xenova/Qwen1.5-0.5B-Chat',
              execution: 'wasm',
              precision: 'q4',
              maxNewTokens: 32,
              sampling: false,
              temperature: 0.7,
              topP: 0.9,
            },
          }),
        );
    });
};
const ask = async (browser, origin, evidence, existing) => {
  const page = existing ?? (await browser.newPage());
  const requests = [];
  page.on('console', (event) => {
    if (event.type() === 'error')
      evidence.events.push({ type: 'console-error', message: event.text() });
  });
  page.on('error', (error) =>
    evidence.events.push({ type: 'renderer-error', message: error.message }),
  );
  page.on('pageerror', (error) =>
    evidence.events.push({ type: 'page-error', message: error.message }),
  );
  page.on('request', (request) =>
    requests.push({ url: request.url(), type: request.resourceType() }),
  );
  if (!existing) {
    await seedPreferences(page, evidence);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
  }
  await waitReady(page);
  await page.type(
    'chatbot-offline-provider >>> chat-container >>> input',
    'What experience does Rasmus have?',
  );
  await page.click('chatbot-offline-provider >>> chat-container >>> button[type=submit]');
  await page.waitForFunction(
    () => {
      const provider = globalThis.document.querySelector('chatbot-offline-provider');
      if (!provider) return false;
      const chat = provider.shadowRoot.querySelector('chat-container').shadowRoot;
      const failure = chat.querySelector('[role=alert]');
      if (failure?.textContent.trim()) return true;
      const answer = [...chat.querySelectorAll('[role=log] p')].at(-1);
      if (!answer) return false;
      const text = answer.textContent.trim();
      return (
        chat.querySelector('[role=status]').textContent.trim() === 'ready' &&
        text.startsWith('assistant:') &&
        text.slice(10).trim().length > 0
      );
    },
    { timeout: 600_000, polling: 100 },
  );
  await waitReady(page);
  const answer = await page.evaluate(() =>
    globalThis.document
      .querySelector('chatbot-offline-provider')
      ?.shadowRoot?.querySelector('chat-container')
      ?.shadowRoot?.querySelector('[role=log] p:last-child')
      ?.textContent.trim(),
  );
  if (!answer?.trim()) throw new Error('No visible answer after the request');
  const cache = await page.evaluate(async () => {
    const entries = [];
    for (const name of await globalThis.caches.keys()) {
      const stored = await globalThis.caches.open(name);
      const keys = await stored.keys();
      entries.push({ name, urls: keys.map((request) => request.url) });
    }
    return { entries, persisted: await navigator.storage.persisted() };
  });
  return {
    answer,
    cache,
    pageRequests: requests,
    requestScope: 'Page requests; DNS blocking also applies to worker fetches on restart',
  };
};

export const runCache = async (restart, origin, evidence, directory) => {
  const result = cachePrerequisites(root);
  if (result.verdict === 'BLOCKED') {
    evidence.scenarios.push(result);
    return;
  }
  result.verdict = 'BLOCKED';
  try {
    let browser = await restart(false);
    result.warm = await ask(browser, origin, evidence);
    const cached = result.warm.cache.entries.flatMap((entry) => entry.urls);
    if (
      !['Qwen', 'MiniLM'].every((model) =>
        cached.some((url) => url.includes(model) && url.includes('.onnx')),
      )
    )
      throw new Error('Cache evidence does not contain both model weight sets');
    result.targetsBeforeRestart = browser
      .targets()
      .map((target) => ({ type: target.type(), url: target.url() }));
    result.multitab = await exerciseRealTabs(browser, origin, evidence, ask);
    result.settings = await exerciseRealSettings(browser, origin, evidence, ask);
    const restartEvent = evidence.modelRequests.length;
    browser = await restart(true);
    result.networkPolicyOnRestart =
      'External DNS and loopback /models/ downloads blocked; application, WASM and retrieval assets remain served; same profile, new browser process';
    result.returning = await ask(browser, origin, evidence);
    const pages = await browser.pages();
    evidence.artifacts.push('cache-returning.png');
    await pages.at(-1).screenshot({ path: path.join(directory, 'cache-returning.png') });
    result.restartModelRequests = evidence.modelRequests.slice(restartEvent);
    if (result.restartModelRequests.length > 0)
      throw new Error('Returning session attempted model downloads');
    result.verdict = 'PASS';
    result.inferenceVerified = true;
    evidence.inferenceVerified = true;
  } catch (error) {
    result.reason = `Real-model journey could not complete: ${error.message}`;
    result.failure = error.stack;
    result.cause = String(error.cause ?? '');
    result.inferenceVerified = false;
  }
  evidence.scenarios.push(result);
};
