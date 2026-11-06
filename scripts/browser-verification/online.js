import assert from 'node:assert/strict';
import path from 'node:path';

import { seedVerificationPreferences } from './preferences.js';

const chat = 'chatbot-offline-provider >>> chat-container';
const settings = 'chatbot-offline-provider >>> assistant-configuration';
const ready = (page) => page.waitForFunction(() => {
  const element = globalThis.document.querySelector('chatbot-offline-provider')?.shadowRoot?.querySelector('chat-container');
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
  globalThis.document.querySelector('chatbot-offline-provider').shadowRoot.querySelector('chat-container')
    .messages.at(-1)?.content.includes('Controlled online response'), { polling: 25 });

export const runOnline = async (browser, origin, evidence, directory) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const result = { name: 'online-generation-controls', kind: 'controlled-openai-http-and-models-production-application', verdict: 'PASS', realOpenAI: false };
  try {
    await seedVerificationPreferences(page, 'online');
    await page.goto(origin);
    await ready(page);
    assert.equal(evidence.events.filter(({ type }) => type === 'local-pipeline-loaded').length, 0);
    assert.equal(await page.$eval(`${settings} >>> select[name=onlineModel]`, (input) => input.value), 'gpt-6-luna');
    await send(page, 'What experience does Rasmus have?');
    await streamed(page);
    await ready(page);
    await send(page, 'hold-online');
    await streamed(page);
    await click(page, 'Cancel');
    await page.waitForFunction(() => globalThis.document.querySelector('chatbot-offline-provider').shadowRoot.querySelector('chat-container').messages.at(-1)?.interrupted);
    await click(page, 'Retry');
    await streamed(page);
    await click(page, 'Cancel');
    await click(page, 'Reset');
    await ready(page);
    assert.equal(await page.$eval(chat, (element) => element.messages.length), 0);
    await send(page, 'fail-online');
    await page.waitForFunction(() => globalThis.document.querySelector('chatbot-offline-provider').shadowRoot.querySelector('chat-container').lifecycle.status === 'error');
    assert.match(await page.$eval(chat, (element) => element.messages.at(-1).content), /Controlled online/);
    await click(page, 'Reset');
    await ready(page);
    await send(page, 'hold-mode-switch');
    await streamed(page);
    await page.select(`${settings} >>> select[name=mode]`, 'local');
    assert.equal(await page.$eval(settings, (element) => element.configurationService.stateSubscription.getValue().pending), true);
    await click(page, 'Cancel');
    await ready(page);
    await send(page, 'local-regression');
    await ready(page);
    assert.match(await page.$eval(chat, (element) => element.messages.at(-1).content), /Controlled local/);
    await page.select(`${settings} >>> select[name=mode]`, 'online');
    await ready(page);
    await send(page, 'Back online');
    await streamed(page);
    await ready(page);
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
