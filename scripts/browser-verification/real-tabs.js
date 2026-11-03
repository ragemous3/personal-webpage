import assert from 'node:assert/strict';

const input = 'chatbot-offline-provider >>> chat-container >>> input';
const submit = 'chatbot-offline-provider >>> chat-container >>> button[type=submit]';
const cancelAndReset = async (survivor) => {
  const buttons = await survivor.$$('chatbot-offline-provider >>> chat-container >>> button');
  for (const button of buttons) {
    const text = await button.evaluate((element) => element.textContent);
    if (text.trim() === 'Cancel') await button.click();
  }
  await survivor.waitForFunction(() =>
    globalThis.document
      .querySelector('chatbot-offline-provider')
      .shadowRoot.querySelector('chat-container')
      .shadowRoot.querySelector('[role=alert]')
      ?.textContent.includes('Response interrupted'),
  );
  for (const button of buttons) {
    const text = await button.evaluate((element) => element.textContent);
    if (text.trim() === 'Reset') await button.click();
  }
};

export const exerciseRealTabs = async (browser, origin, evidence, ask) => {
  const initialPages = await browser.pages();
  const first = initialPages.at(-1);
  const before = browser
    .targets()
    .filter((target) => target.type() === 'shared_worker')
    .map((target) => target.url())
    .toSorted();
  const modelDownloads = evidence.modelRequests.length;
  const second = await ask(browser, origin, evidence);
  const pages = await browser.pages();
  const survivor = pages.at(-1);
  assert.equal(
    evidence.modelRequests.length,
    modelDownloads,
    'Joining tab downloaded model files again',
  );
  const afterJoin = browser
    .targets()
    .filter((target) => target.type() === 'shared_worker')
    .map((target) => target.url())
    .toSorted();
  assert.deepEqual(afterJoin, before);
  assert.equal(before.length, 3);
  await first.close();
  const afterClose = await ask(browser, origin, evidence, survivor);
  assert.deepEqual(
    browser
      .targets()
      .filter((target) => target.type() === 'shared_worker')
      .map((target) => target.url())
      .toSorted(),
    before,
  );
  await survivor.type(input, 'What experience does Rasmus have?');
  await survivor.click(submit);
  await survivor.waitForFunction(
    () => {
      const chat = globalThis.document
        .querySelector('chatbot-offline-provider')
        .shadowRoot.querySelector('chat-container').shadowRoot;
      return (
        chat.querySelector('[role=status]').textContent.trim() === 'responding' &&
        chat.querySelector('[role=log] p:last-child')?.textContent.trim().length > 11
      );
    },
    { timeout: 120_000 },
  );
  await cancelAndReset(survivor);
  const resetCount = await survivor.evaluate(
    () =>
      globalThis.document
        .querySelector('chatbot-offline-provider')
        .shadowRoot.querySelector('chat-container')
        .shadowRoot.querySelectorAll('[role=log] p').length,
  );
  assert.equal(resetCount, 0);
  return {
    secondAnswer: second.answer,
    survivingAnswer: afterClose.answer,
    sharedWorkerUrls: before,
    additionalModelDownloads: evidence.modelRequests.length - modelDownloads,
    cancellation: 'Real streamed answer interrupted using the visible Cancel button',
    resetCount,
  };
};
