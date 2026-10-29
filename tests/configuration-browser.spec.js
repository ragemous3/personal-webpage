import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import { createServer } from 'vite';

test('unstyled controls persist choices across tabs and show pending and failed settings', async () => {
  const server = await createServer({
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../assets', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0 },
  });
  let browser;
  try {
    await server.listen();
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH ?? ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((path) => existsSync(path)) ?? puppeteer.executablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const first = await browser.newPage();
    const second = await browser.newPage();
    const url = `${server.resolvedUrls.local[0]}tests/configuration-browser.fixture.html`;
    await first.goto(url);
    await second.goto(url);
    for (const page of [first, second])
      await page.waitForFunction(() => globalThis.fixture?.runtime.available);
    await first.bringToFront();
    await first.$eval('assistant-configuration >>> details', (element) => { element.open = true; });
    await first.click('assistant-configuration >>> input[name=sampling]');
    await first.waitForSelector('assistant-configuration >>> input[name=topP]');
    const setTopP = (value) => first.$eval('assistant-configuration >>> input[name=topP]', (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await setTopP('0.0000001');
    assert.equal(await first.evaluate(() => globalThis.fixture.service.stateSubscription.getValue().selected.topP), 0.000_000_1);
    await setTopP('0');
    assert.equal(await first.evaluate(() => globalThis.fixture.service.stateSubscription.getValue().selected.topP), 0.000_000_1);
    assert.match(await first.$eval('assistant-configuration', (element) => element.shadowRoot.textContent), /topP/);
    await setTopP('0.0000001');
    await second.evaluate(() =>
      globalThis.fixture.runtime.stateSubscription.emit({ responding: true }),
    );
    await first.select('assistant-configuration >>> select[name=execution]', 'wasm');
    await second.waitForFunction(
      () => globalThis.fixture.service.stateSubscription.getValue().selected.execution === 'wasm',
    );
    assert.equal(
      await second.evaluate(
        () => globalThis.fixture.service.stateSubscription.getValue().active.execution,
      ),
      'auto',
    );
    await second.evaluate(() =>
      globalThis.fixture.runtime.stateSubscription.emit({ responding: false }),
    );
    await second.waitForFunction(
      () => globalThis.fixture.service.stateSubscription.getValue().active.execution === 'wasm',
    );
    await first.select('assistant-configuration >>> select[name=mode]', 'online');
    await second.waitForFunction(() => !globalThis.fixture.runtime.available);
    assert.match(
      await first.$eval('assistant-configuration', (element) => element.shadowRoot.textContent),
      /Online mode is not available yet/,
    );
    await first.select('assistant-configuration >>> select[name=mode]', 'local');
    await first.waitForFunction(() => globalThis.fixture.runtime.available);
    await first.select('assistant-configuration >>> select[name=execution]', 'webgpu');
    await first.waitForFunction(
      () => globalThis.fixture.service.stateSubscription.getValue().error,
    );
    assert.match(
      await first.$eval('assistant-configuration', (element) => element.shadowRoot.textContent),
      /webgpu.*GPU unavailable/,
    );
    await first.evaluate(() =>
      [
        ...globalThis.document
          .querySelector('assistant-configuration')
          .shadowRoot.querySelectorAll('button'),
      ]
          .find((button) => button.textContent.trim() === 'Switch back')
        .click(),
    );
    await first.waitForFunction(() => globalThis.fixture.runtime.available);
    await first.reload();
    await first.waitForFunction(() => globalThis.fixture?.runtime.available);
    assert.equal(
      await first.$eval(
        'assistant-configuration >>> select[name=execution]',
        (input) => input.value,
      ),
      'wasm',
    );
    assert.equal(await first.$('assistant-configuration >>> style'), null);
  } finally {
    await browser?.close();
    await server.close();
  }
});
