import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import { createServer } from 'vite';

test('tabs share one live owner, keep their answers separate, and hand ownership over on close', async () => {
  const server = await createServer({ configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../assets', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
      headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const first = await browser.newPage();
    const errors = [];
    const ready = async (page) => page.waitForFunction(() => globalThis.fixture?.chat.stateSubscription.getValue().status === 'ready', { polling: 50 });
    const url = `${server.resolvedUrls.local[0]}tests/shared-configuration-browser.fixture.html`;
    first.on('pageerror', (error) => errors.push(error.message));
    await first.goto(url);
    await ready(first);
    assert.equal(await first.evaluate(() => globalThis.fixture.initializations.length), 2);
    const second = await browser.newPage();
    second.on('pageerror', (error) => errors.push(error.message));
    await second.goto(url);
    await ready(second);
    assert.equal(await second.evaluate(() => globalThis.fixture.initializations.length), 0);
    await second.type('chat-container >>> input', 'Follower question');
    await second.click('chat-container >>> button[type=submit]');
    await ready(second);
    assert.match(await second.$eval('chat-container >>> [role=log]', (log) => log.textContent), /Answer with budget 256/);
    assert.equal(await first.evaluate(() => globalThis.fixture.chat.chatMessagesSubscription.getValue().length), 0);
    for (const [page, question] of [[first, 'Owner question'], [second, 'Another follower question']]) {
      await page.bringToFront();
      await page.type('chat-container >>> input', question);
      await page.click('chat-container >>> button[type=submit]');
    }
    await second.select('assistant-configuration >>> select[name=execution]', 'wasm');
    assert.equal(await first.evaluate(() => globalThis.fixture.initializations.length), 2);
    await ready(first);
    await ready(second);
    assert.equal(await first.evaluate(() => globalThis.fixture.initializations.length), 4);
    assert.equal(await second.evaluate(() => globalThis.fixture.initializations.length), 0);
    await first.close();
    await second.waitForFunction(() => globalThis.fixture.initializations.length === 2);
    await ready(second);
    assert.equal(await second.evaluate(() => globalThis.fixture.chat.chatMessagesSubscription.getValue().length), 4);
    const isolated = await browser.createBrowserContext();
    const cold = await isolated.newPage();
    await cold.evaluateOnNewDocument(() => globalThis.localStorage.setItem('assistant.preferences', JSON.stringify({ version: 1,
      preferences: { mode: 'local', model: 'Xenova/Qwen1.5-0.5B-Chat', execution: 'webgpu', precision: 'q4', maxNewTokens: 32, sampling: false, temperature: 0.7, topP: 0.9 } })));
    await cold.goto(url);
    await cold.waitForFunction(() => globalThis.fixture?.service.stateSubscription.getValue().error, { polling: 50 });
    assert.match(await cold.$eval('assistant-configuration', (element) => element.shadowRoot.textContent), /webgpu.*GPU unavailable/);
    assert.doesNotMatch(await cold.$eval('assistant-configuration', (element) => element.shadowRoot.textContent), /after this response/);
    assert.equal(await cold.evaluate(() => globalThis.fixture.chat.stateSubscription.getValue().status), 'initializing');
    await isolated.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
