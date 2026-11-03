import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const runEntry = async (browser, origin, evidence, directory) => {
  const page = await browser.newPage();
  const events = [];
  page.on('pageerror', (error) => events.push({ type: 'pageerror', message: error.message }));
  page.on('requestfailed', (request) =>
    events.push({ type: 'requestfailed', url: request.url(), reason: request.failure() }),
  );
  const result = {
    name: 'entry-open-offline',
    kind: 'untouched-application',
    initialCondition: 'Fresh profile; external DNS blocked to avoid model downloads',
    events,
    verdict: 'PASS',
  };
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('chatbot-offline-provider >>> chat-container >>> input', {
      visible: true,
      timeout: 10_000,
    });
    await page.waitForSelector(
      'chatbot-offline-provider >>> chat-container >>> button[type=submit]',
      { visible: true, timeout: 10_000 },
    );
    result.state = await page.evaluate(() => {
      const chat = globalThis.document
        .querySelector('chatbot-offline-provider')
        .shadowRoot.querySelector('chat-container').shadowRoot;
      return {
        title: globalThis.document.title,
        inputDisabled: chat.querySelector('input').disabled,
        status: chat.querySelector('[role=status]')?.textContent,
        error: chat.querySelector('[role=alert]')?.textContent,
        controls: [...chat.querySelectorAll('button')].map((button) => button.textContent.trim()),
      };
    });
    assert.equal(result.state.title, 'Rasmus Moberg');
    evidence.artifacts.push('entry-open.png');
    await page.screenshot({ path: path.join(directory, 'entry-open.png'), fullPage: true });
  } catch (error) {
    result.verdict = 'FAIL';
    result.reason = error.message;
  } finally {
    evidence.scenarios.push(result);
    await page.close();
  }
};

export const cachePrerequisites = (root) => {
  const missing = ['chunks.json', 'contents.bin', 'vector-metadata.json'].filter(
    (file) => !existsSync(path.join(root, 'static/content-data', file)),
  );
  return {
    name: 'real-model-cache-restart',
    kind: 'real-model',
    verdict: missing.length > 0 ? 'BLOCKED' : 'READY_TO_ATTEMPT',
    missing,
    ownerTicket: '20261029-193942',
    inferenceVerified: false,
  };
};
