import assert from 'node:assert/strict';

const update = (page, patch) =>
  page.$eval(
    'chatbot-provider >>> assistant-configuration',
    (element, patch) => {
      const settings = element.configurationService;
      settings.update({ ...settings.stateSubscription.getValue().selected, ...patch });
    },
    patch,
  );
const ready = (page) =>
  page.waitForFunction(
    () => {
      const provider = globalThis.document.querySelector('chatbot-provider');
      const state = provider?.shadowRoot
        ?.querySelector('assistant-configuration')
        ?.configurationService?.stateSubscription.getValue();
      return state?.available || state?.error;
    },
    { timeout: 600_000, polling: 100 },
  );
const state = (page) =>
  page.$eval('chatbot-provider >>> assistant-configuration', (element) =>
    element.configurationService.stateSubscription.getValue(),
  );

export const exerciseRealSettings = async (browser, origin, evidence, ask) => {
  const pages = await browser.pages();
  const page = pages.at(-1);
  await update(page, { execution: 'auto' });
  await ready(page);
  const auto = await state(page);
  assert.equal(auto.error, undefined);
  assert.equal(auto.active.execution, 'auto');
  const autoAnswer = await ask(browser, origin, evidence, page);
  const before = await page.$eval(
    'chatbot-provider >>> chat-container',
    (element) => element.shadowRoot.querySelectorAll('[role=log] p').length,
  );
  await update(page, { execution: 'wasm' });
  await ready(page);
  const cpu = await state(page);
  assert.equal(cpu.error, undefined);
  assert.equal(cpu.active.execution, 'wasm');
  const after = await page.$eval(
    'chatbot-provider >>> chat-container',
    (element) => element.shadowRoot.querySelectorAll('[role=log] p').length,
  );
  assert.equal(after, before);
  return {
    autoAnswer: autoAnswer.answer,
    requestedAuto: auto.active.execution,
    restoredCPU: cpu.active.execution,
    historyPreserved: after === before,
    actualProviderInferred: false,
  };
};
