import assert from 'node:assert/strict';
import path from 'node:path';

import { createPage } from './page.js';
import { seedVerificationPreferences } from './preferences.js';

const settingsSelector = 'chatbot-provider >>> assistant-configuration';
const chatSelector = 'chatbot-provider >>> chat-container';
const uiTimeout = 60_000;
const ready = (page) =>
  page.waitForFunction(
    () => {
      const input = globalThis.verificationChat()
        ?.shadowRoot?.querySelector('input');
      return input && !input.disabled;
    },
    { timeout: uiTimeout, polling: 25 },
  );
const configuration = (page) =>
  page.$eval(settingsSelector, (element) =>
    element.configurationService.stateSubscription.getValue(),
  );
const history = (page) =>
  page.$eval(chatSelector, (element) =>
    [...element.shadowRoot.querySelectorAll('[role=log] p')].map((p) => p.textContent),
  );
const select = (page, name, value) =>
  page.select(`${settingsSelector} >>> select[name=${name}]`, value);
const tokens = (page, value) =>
  page.$eval(
    `${settingsSelector} >>> input[name=maxNewTokens]`,
    (input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );
const untilSettings = (page, expected) =>
  page.waitForFunction(
    (expected) => {
      const component = globalThis.document
        .querySelector('chatbot-provider')?.shadowRoot?.querySelector('assistant-configuration');
      const state = component?.configurationService?.stateSubscription.getValue();
      return (
        state && Object.entries(expected).every(([key, value]) => state.selected[key] === value)
      );
    },
    { polling: 25 },
    expected,
  );

const exerciseChanges = async (first, second) => {
  await first.type(`${chatSelector} >>> input`, 'hold-for-failure');
  await first.click(`${chatSelector} >>> button[type=submit]`);
  await first.waitForFunction(() =>
    globalThis.verificationChat()
      .shadowRoot.querySelector('[role=log] p:last-child')
      ?.textContent.includes('Controlled'),
  );
  await tokens(second, 48);
  await tokens(second, 64);
  await untilSettings(first, { maxNewTokens: 64 });
  const before = await configuration(first);
  assert.equal(before.pending, true);
  assert.equal(before.loading, false);
  assert.equal(before.active.maxNewTokens, 32);
  const paragraphs = await history(first);
  assert.equal(paragraphs.length, 2);
  await first.$eval(chatSelector, (element) =>
    [...element.shadowRoot.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Cancel')
      .click(),
  );
  await Promise.all([ready(first), ready(second)]);
  const applied = await configuration(first);
  assert.equal(applied.active.maxNewTokens, 64);
  const kept = await history(first);
  await select(second, 'mode', 'online');
  await untilSettings(first, { mode: 'online' });
  assert.deepEqual(await history(first), kept);
  await select(second, 'mode', 'local');
  await Promise.all([ready(first), ready(second)]);
  await select(first, 'execution', 'webgpu');
  await first.waitForFunction(
    () =>
      globalThis.document
        .querySelector('chatbot-provider')?.shadowRoot?.querySelector('assistant-configuration')
        .configurationService.stateSubscription.getValue().error,
    { polling: 25 },
  );
  assert.equal(await first.$eval(`${chatSelector} >>> input`, (input) => input.disabled), true);
  await first.$eval(settingsSelector, (element) => element.configurationService.switchBack());
  await Promise.all([ready(first), ready(second)]);
  const recovered = await configuration(first);
  assert.equal(recovered.selected.execution, 'wasm');
  assert.deepEqual(await history(first), kept);
  await first.reload();
  await ready(first);
  const restored = await configuration(first);
  assert.equal(restored.selected.maxNewTokens, 64);
};

const exerciseSessionOnlyTab = async (context, origin, first, second, pageErrors) => {
  const session = await createPage(context);
  session.on('pageerror', (error) => pageErrors.push(error.message));
  session.setDefaultTimeout(uiTimeout);
  await session.evaluateOnNewDocument(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('Storage denied for verification');
      },
    });
  });
  await session.goto(origin);
  await ready(session);
  await session.$eval(settingsSelector, (element) => {
    const service = element.configurationService;
    service.update({
      ...service.stateSubscription.getValue().selected,
      execution: 'wasm',
      maxNewTokens: 64,
    });
  });
  await Promise.all([ready(first), ready(second), ready(session)]);
  await untilSettings(first, { execution: 'wasm', maxNewTokens: 64 });
  await untilSettings(second, { execution: 'wasm', maxNewTokens: 64 });
  const observed = await configuration(session);
  assert.match(observed.notice, /not be remembered|session only/);
  await session.close();
};

const exerciseDiscoveredOptions = async (first, second, initialized) => {
  await first.bringToFront();
  await first.waitForFunction(
    () => {
      const provider = globalThis.document.querySelector('chatbot-provider');
      return (
        provider.shadowRoot
          .querySelector('assistant-configuration')
          .configurationService.stateSubscription.getValue().metadataLoading === false
      );
    },
    { polling: 25, timeout: uiTimeout },
  );
  const discovered = await configuration(first);
  assert.equal(discovered.metadataError, undefined);
  assert.equal(
    initialized.find((event) => event.role === 'llm').configuration.revision,
    discovered.choices.revision,
  );
  assert.deepEqual(
    discovered.choices.precisions.map(({ value }) => value),
    ['fp16', 'q4'],
  );
  await first.bringToFront();
  await first.click(`${settingsSelector} >>> summary`);
  const rendered = await first.$$eval(
    `${settingsSelector} >>> select[name=precision] option`,
    (options) => options.map((option) => option.value),
  );
  assert.deepEqual(rendered, ['fp16', 'q4']);
  await select(first, 'precision', 'fp16');
  await Promise.all([ready(first), ready(second)]);
  const fp16 = await configuration(first);
  assert.equal(fp16.active.precision, 'fp16');
  await select(first, 'precision', 'q4');
  await Promise.all([ready(first), ready(second)]);
  return {
    metadataRevision: discovered.choices.revision,
    discoveredPrecisions: discovered.choices.precisions,
  };
};

export const runSettings = async (browser, origin, evidence, directory) => {
  const context = await browser.createBrowserContext();
  const pageErrors = [];
  const first = await createPage(context);
  first.on('pageerror', (error) => pageErrors.push(error.message));
  first.setDefaultTimeout(uiTimeout);
  const result = {
    name: 'production-settings-controls-and-shared-runtime',
    kind: 'controlled-model-drivers-production-application',
    verdict: 'PASS',
  };
  evidence.artifacts.push('settings.png');
  try {
    await seedVerificationPreferences(first, 'online');
    await first.goto(origin);
    await untilSettings(first, { mode: 'online', maxNewTokens: 32 });
    const second = await createPage(context);
    second.on('pageerror', (error) => pageErrors.push(error.message));
    second.setDefaultTimeout(uiTimeout);
    await second.goto(origin);
    await untilSettings(second, { mode: 'online' });
    assert.equal(evidence.events.filter((event) => event.type === 'initialized').length, 0);
    assert.equal(await first.$(`${chatSelector} >>> input`), null);
    result.savedOnlineInitializations = 0;
    await select(first, 'mode', 'local');
    await Promise.all([ready(first), ready(second)]);
    const initialized = evidence.events.filter((event) => event.type === 'initialized');
    assert.ok(initialized.every((event) => event.configuration.device === 'wasm'));
    assert.equal(
      initialized.find((event) => event.role === 'llm').configuration.generation.max_new_tokens,
      32,
    );
    Object.assign(result, await exerciseDiscoveredOptions(first, second, initialized));
    await first.bringToFront();
    await exerciseChanges(first, second);
    await exerciseSessionOnlyTab(context, origin, first, second, pageErrors);
    result.finalSettings = await configuration(first);
    result.createdModels = evidence.events.filter((event) => event.type === 'created').length;

    assert.equal(await first.$(`${settingsSelector} >>> style`), null);
    assert.deepEqual(pageErrors, []);
    result.inferenceVerified = false;
  } catch (error) {
    result.verdict = 'FAIL';
    result.reason = error.stack;
    result.observedSettings = await configuration(first);
  } finally {
    await first.screenshot({ path: path.join(directory, 'settings.png'), fullPage: true });
    evidence.scenarios.push(result);
    await context.close();
  }
};
