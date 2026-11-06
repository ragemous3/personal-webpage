import assert from 'node:assert/strict';

import { createPage } from './page.js';

const stopModel = async (targets, browser) => {
  const list = await targets();
  const info = list.find((entry) => /llm\.shared-worker\./.test(entry.url));
  const target = browser.targets().find((entry) => entry.url() === info.url);
  const session = await target.createCDPSession();
  await session.send('Runtime.evaluate', { expression: 'globalThis.close()' }).catch(() => {});
  await session.detach().catch(() => {});
  const deadline = Date.now() + 12_000;
  while (browser.targets().includes(target)) {
    if (Date.now() >= deadline) throw new Error('Model worker target did not close');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const exerciseRemount = async (page) => {
  await page.evaluate(() => {
    const chat = globalThis.verificationChat();
    const provider = chat.parentNode;
    chat.remove();
    provider.append(chat);
  });
  await page.waitForFunction(
    () =>
      !globalThis.verificationChat()
        .shadowRoot.querySelector('input').disabled,
  );
  await page.type('chatbot-provider >>> chat-container >>> input', 'After remount');
  await page.click('chatbot-provider >>> chat-container >>> button[type=submit]');
  await page.waitForFunction(
    () => {
      const chat = globalThis.verificationChat().shadowRoot;
      return (
        chat.querySelector('[role=status]').textContent.trim() === 'ready' &&
        chat.querySelector('[role=log] p:last-child')?.textContent.includes('Controlled')
      );
    },
    { timeout: 5000 },
  );
};

export const exerciseReconnectUI = async ({ context, origin, targets, browser, evidence }) => {
  const page = await createPage(context);
  page.on('pageerror', (error) => evidence.record({ type: 'ui-error', message: error.message }));
  page.on('console', (event) => {
    if (event.type() === 'error') evidence.record({ type: 'ui-console', message: event.text() });
  });
  await page.goto(origin);
  await page.waitForFunction(() => {
    const chat = globalThis.verificationChat()?.shadowRoot;
    return chat && !chat.querySelector('input').disabled;
  });
  await page.type('chatbot-provider >>> chat-container >>> input', 'hold-for-failure');
  await page.click('chatbot-provider >>> chat-container >>> button[type=submit]');
  await page.waitForFunction(() => {
    const chat = globalThis.verificationChat().shadowRoot;
    return chat.querySelector('[role=log] p:last-child')?.textContent.includes('Controlled');
  });
  await stopModel(targets, browser);
  await page.waitForFunction(
    () => {
      const chat = globalThis.verificationChat().shadowRoot;
      return chat.querySelector('[role=alert]')?.textContent.trim() === 'Something went wrong' &&
        chat.querySelector('[role=log] p:last-child')?.textContent.includes('(interrupted)');
    },
    { timeout: 5000 },
  );
  const before = await page.evaluate(() => {
    const chat = globalThis.verificationChat().shadowRoot;
    const reconnect = [...chat.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'reconnect',
    );
    if (!reconnect) throw new Error('Missing reconnect control');
    const messages = [...chat.querySelectorAll('[role=log] p')].map(
      (paragraph) => paragraph.textContent,
    );
    reconnect.click();
    reconnect.click();
    return messages;
  });
  await page.waitForFunction(
    () => {
      const chat = globalThis.verificationChat().shadowRoot;
      return !chat.querySelector('input').disabled;
    },
    { timeout: 6000 },
  ).catch(async (error) => {
    evidence.record({ type: 'ui-reconnect-failure', state: await page.evaluate(() => ({
      chat: globalThis.verificationChat().lifecycle,
      settings: globalThis.document.querySelector('chatbot-provider').shadowRoot.querySelector('assistant-configuration').configurationService.stateSubscription.getValue(),
    })) });
    throw error;
  });
  const after = await page.evaluate(() => {
    const chat = globalThis.verificationChat().shadowRoot;
    return [...chat.querySelectorAll('[role=log] p')].map((paragraph) => paragraph.textContent);
  });
  assert.deepEqual(after, before);
  assert.equal(
    evidence.events.filter((event) => event.type === 'accepted' && event.role === 'llm').length,
    1,
    'Interrupted question was replayed',
  );
  assert.equal(
    evidence.events.filter((event) => event.type === 'initialized' && event.role === 'vectordb')
      .length,
    1,
    'Healthy retrieval model reloaded',
  );
  assert.equal(
    evidence.events.filter((event) => event.type === 'initialized' && event.role === 'llm').length,
    2,
    'Concurrent reconnect duplicated model initialization',
  );
  await exerciseRemount(page);
};
