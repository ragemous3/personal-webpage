import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import { createServer } from 'vite';

const visiblePixels = async (page) => {
  const canvas = await page.$('#head');
  const png = await canvas.screenshot();
  return page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await globalThis.createImageBitmap(await response.blob());
    const image = globalThis.document.createElement('canvas');
    image.width = bitmap.width;
    image.height = bitmap.height;
    const context = image.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let colored = 0;
    for (let index = 0; index < data.length; index += 4)
      if (data[index + 3] > 0 && Math.min(data[index], data[index + 1], data[index + 2]) < 235)
        colored++;
    bitmap.close();
    return colored;
  }, Buffer.from(png).toString('base64'));
};

test('the idle avatar stays visible and disposes pending audio without unhandled errors', async () => {
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
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
      globalThis.closedResumeCount = 0;
      globalThis.AudioContext.prototype.resume = function () {
        return new Promise((_resolve, reject) => {
          const changed = () => {
            if (this.state !== 'closed') return;
            this.removeEventListener('statechange', changed);
            globalThis.closedResumeCount++;
            reject(
              new DOMException(
                'AudioContext closed before a pending resume() could complete.',
                'InvalidStateError',
              ),
            );
          };
          this.addEventListener('statechange', changed);
        });
      };
    });
    await page.goto(`${server.resolvedUrls.local[0]}tests/talking-head-browser.fixture.html`);
    await page.waitForFunction(() => globalThis.fixture, { timeout: 120_000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
        ),
    );
    assert.ok(
      (await visiblePixels(page)) > 500,
      'The initial idle head must remain visible after compositing',
    );
    await page.$eval('#head', (element) => {
      element.style.width = '300px';
    });
    await page.waitForFunction(
      () => globalThis.document.querySelector('#head canvas').width === 300,
    );
    assert.ok(
      (await visiblePixels(page)) > 500,
      'The resized idle head must contain a visible avatar',
    );
    await page.evaluate(() => globalThis.fixture.adapter.stop());
    assert.ok((await visiblePixels(page)) > 500, 'Stop must leave a visible neutral avatar');
    const activationError = await page.evaluate(async () => {
      const activation = globalThis.fixture.adapter.activate();
      globalThis.fixture.adapter.dispose();
      try {
        await activation;
        return null;
      } catch (error) {
        return error.message;
      }
    });
    assert.match(activationError, /closed before a pending resume/);
    await page.waitForFunction(() => globalThis.closedResumeCount > 0);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
        ),
    );
    assert.deepEqual(errors, [], 'SDK disposal must not create unhandled resume rejections');
  } finally {
    await browser?.close();
    await server.close();
  }
});
