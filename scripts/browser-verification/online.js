import assert from 'node:assert/strict';
import path from 'node:path';

import { holdLocalInitialization } from './environment.js';
import { createPage } from './page.js';
import { seedVerificationPreferences } from './preferences.js';

const chat = 'chatbot-provider >>> chat-container';
const settings = 'chatbot-provider >>> assistant-configuration';
const ready = (page) => page.waitForFunction(() => {
  const element = globalThis.verificationChat();
  return element?.lifecycle.status === 'ready';
}, { polling: 25, timeout: 20_000 });
const click = (page, text) => page.$eval(chat, (element, text) => {
  [...element.shadowRoot.querySelectorAll('button')].find((button) => button.textContent.trim() === text).click();
}, text);
const send = async (page, question) => {
  await ready(page);
  await page.type(`${chat} >>> input`, question);
  await page.click(`${chat} >>> button[type=submit]`);
};
const streamed = (page) => page.waitForFunction(() =>
  globalThis.verificationChat()
    .messages.at(-1)?.content.includes('Controlled online response'), { polling: 25 });

const checkHistoryLifetime = async (context, page, origin) => {
  const messages = await page.$eval(chat, (element) => element.messages);
  const id = await page.evaluate(() => sessionStorage.getItem('assistant-conversation-id'));
  await page.reload();
  await ready(page);
  assert.deepEqual(await page.$eval(chat, (element) => element.messages), messages);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('assistant-conversation-id')), id);
  const fresh = await createPage(context);
  try {
    await fresh.goto(origin);
    await ready(fresh);
    assert.deepEqual(await fresh.$eval(chat, (element) => element.messages), []);
    assert.notEqual(await fresh.evaluate(() => sessionStorage.getItem('assistant-conversation-id')), id);
  } finally { await fresh.close(); }
};

const checkPendingLocalSwitch = async (page, evidence) => {
  const release = holdLocalInitialization(evidence);
  try {
    await page.select(`${settings} >>> select[name=mode]`, 'local');
    const deadline = Date.now() + 10_000;
    while (!evidence.events.some(({ type }) => type === 'local-pipeline-loaded')) {
      assert.ok(Date.now() < deadline, 'Local initialization did not start');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await page.select(`${settings} >>> select[name=mode]`, 'online');
    await send(page, 'Online while Local is still loading');
    await streamed(page);
    await ready(page);
    const status = await page.$eval(chat, (element) => {
      let snapshot;
      const coordinator = element.parentNode.host.shared.coordinator;
      const disconnect = coordinator.onData((message) => { if (message.task === 'runtime:state') snapshot = message.payload; });
      disconnect();
      return snapshot.resources.find(({ role }) => role === 'llm').status;
    });
    assert.equal(status, 'loading');
  } finally { release(); }
};

export const runOnline = async (browser, origin, evidence, directory) => {
  const context = await browser.createBrowserContext();
  const page = await createPage(context);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const result = { name: 'online-generation-controls', kind: 'controlled-openai-http-and-models-production-application', verdict: 'PASS', realOpenAI: false };
  try {
    await seedVerificationPreferences(page, 'online');
    await page.goto(origin);
    await ready(page);
    assert.equal(evidence.events.filter(({ type }) => type === 'local-pipeline-loaded').length, 0);
    result.initialSharedWorkers = browser.targets().filter((target) => target.type() === 'shared_worker').map((target) => target.url());
    assert.equal(result.initialSharedWorkers.length, 2);
    assert.ok(result.initialSharedWorkers.every((url) => !url.includes('llm.shared-worker')));
    assert.equal(await page.$eval(`${settings} >>> select[name=onlineModel]`, (input) => input.value), 'gpt-6-luna');
    await checkPendingLocalSwitch(page, evidence);
    result.onlineWhileLocalInitializing = true;
    await send(page, 'What experience does Rasmus have?');
    await streamed(page);
    await ready(page);
    await send(page, 'hold-online');
    await streamed(page);
    await click(page, 'Cancel');
    await page.waitForFunction(() => globalThis.verificationChat().messages.at(-1)?.interrupted);
    await click(page, 'Retry');
    await streamed(page);
    await click(page, 'Cancel');
    await click(page, 'Reset');
    await ready(page);
    assert.equal(await page.$eval(chat, (element) => element.messages.length), 0);
    await send(page, 'fail-online');
    await page.waitForFunction(() => globalThis.verificationChat().lifecycle.status === 'error');
    assert.match(await page.$eval(chat, (element) => element.messages.at(-1).content), /Controlled online/);
    await click(page, 'Reset');
    await ready(page);
    await send(page, 'hold-mode-switch');
    await streamed(page);
    await page.select(`${settings} >>> select[name=mode]`, 'local');
    assert.equal(await page.$eval(settings, (element) => element.configurationService.stateSubscription.getValue().pending), true);
    await click(page, 'Cancel');
    await ready(page);
    const retrievalInitializations = evidence.events.filter((event) => event.type === 'initialized' && event.role === 'vectordb').length;
    const beforeLocal = await page.$eval(chat, (element) => element.messages);
    await send(page, 'local-regression');
    await ready(page);
    assert.match(await page.$eval(chat, (element) => element.messages.at(-1).content), /Controlled local/);
    assert.deepEqual(await page.$eval(chat, (element) => element.messages.slice(0, -2)), beforeLocal);
    const beforeOnline = await page.$eval(chat, (element) => element.messages);
    await page.select(`${settings} >>> select[name=mode]`, 'online');
    await ready(page);
    assert.deepEqual(await page.$eval(chat, (element) => element.messages), beforeOnline);
    assert.equal(evidence.events.filter((event) => event.type === 'initialized' && event.role === 'vectordb').length, retrievalInitializations);
    await send(page, 'Back online');
    await streamed(page);
    await ready(page);
    await checkHistoryLifetime(context, page, origin);
    result.reloadHistoryRestored = true;
    result.freshTabHistoryIsolated = true;
    await page.screenshot({ path: path.join(directory, 'online.png'), fullPage: true });
    evidence.artifacts.push('online.png');
    assert.deepEqual(errors, []);
    const requests = evidence.events.filter(({ type }) => type === 'online-request');
    assert.ok(requests.length >= 5);
    assert.ok(requests.every(({ model, reasoning }) => model === 'gpt-6-luna' && reasoning.effort === 'low'));
    result.onlineRequests = requests.length;
    result.localPipelineLoads = evidence.events.filter(({ type }) => type === 'local-pipeline-loaded').length;
  } catch (error) {
    result.verdict = 'FAIL';
    result.reason = error.stack;
    result.state = await page.$eval(settings, (element) => element.configurationService.stateSubscription.getValue()).catch(String);
  } finally {
    evidence.scenarios.push(result);
    await context.close();
  }
};
