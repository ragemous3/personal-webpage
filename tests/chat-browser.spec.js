import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import { createServer } from 'vite';

test('browser handles late context, submit, plain text, interruption, retry and reconnect', async () => {
  const server = await createServer({
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../assets', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0 },
  });
  let browser;
  try {
    await server.listen();
    browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ??
        ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) =>
          existsSync(candidate),
        ) ??
        puppeteer.executablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${server.resolvedUrls.local[0]}tests/chat-browser.fixture.html`);
    await page.waitForFunction(() => globalThis.fixture);
    await page.evaluate(() => globalThis.attachService());
    await page.waitForFunction(
      () => globalThis.fixture.element.shadowRoot.querySelector('input').disabled,
    );
    await page.evaluate(() => {
      globalThis.fixture.chat.emit({ task: 'llm:ready' });
      globalThis.fixture.database.emit({ task: 'vectordb:ready' });
    });
    await page.waitForFunction(
      () => !globalThis.fixture.element.shadowRoot.querySelector('input').disabled,
    );
    await page.type('chat-container >>> input', 'Question');
    await page.click('chat-container >>> button[type=submit]');
    await page.waitForFunction(() => globalThis.fixture.database.sent.length === 1);
    await page.evaluate(() => {
      const { chat, database } = globalThis.fixture;
      const { requestId } = database.sent[0];
      chat.emit({ task: 'llm:stream:response', requestId, payload: '<b>Plain text</b>' });
    });
    await page.waitForFunction(() =>
      globalThis.fixture.element.shadowRoot
        .querySelector('[role=log]')
        .textContent.includes('<b>Plain text</b>'),
    );
    assert.equal(await page.$('chat-container >>> b'), null);
    await page.evaluate(() => globalThis.fixture.service.cancel());
    await page.waitForFunction(() =>
      globalThis.fixture.element.shadowRoot.textContent.includes('(interrupted)'),
    );
    await page.evaluate(() => {
      const buttons = [...globalThis.fixture.element.shadowRoot.querySelectorAll('button')];
      buttons.find((button) => button.textContent === 'Retry').click();
    });
    assert.equal(
      await page.evaluate(
        () => globalThis.fixture.service.chatMessagesSubscription.getValue().length,
      ),
      2,
    );
    await page.evaluate(() => {
      const { chat, database } = globalThis.fixture;
      chat.emit({
        task: 'llm:message:response',
        requestId: database.sent[1].requestId,
        payload: { generated_text: [{ role: 'assistant', content: 'Completed' }] },
      });
    });
    await page.waitForFunction(() =>
      globalThis.fixture.element.shadowRoot.textContent.includes('Completed'),
    );
    await page.evaluate(() => {
      const { element } = globalThis.fixture;
      const parent = element.parentNode;
      element.remove();
      parent.append(element);
    });
    await page.waitForFunction(
      () => globalThis.fixture.element.shadowRoot.querySelectorAll('[role=log] p').length === 0,
    );
    assert.deepEqual(errors, []);
    const retrieved = await page.evaluate(() => globalThis.exerciseRetrieval());
    assert.deepEqual(retrieved.neighbors, [0]);
    assert.deepEqual(retrieved.distances, [0]);
  } finally {
    await browser?.close();
    await server.close();
  }
});
