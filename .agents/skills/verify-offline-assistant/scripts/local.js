#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const helper = (file) =>
  import(new URL(`../../../../scripts/browser-verification/${file}.js`, import.meta.url));
const [
  { closeResources },
  { createSite, launch, root },
  { defaultEvidenceDirectory, finalizeEvidence },
  { createPage },
  { seedVerificationPreferences },
  { sourceSnapshot },
] = await Promise.all(
  ['cleanup', 'environment', 'evidence', 'page', 'preferences', 'source'].map((file) =>
    helper(file),
  ),
);

const directory = defaultEvidenceDirectory(root, 'local');
await mkdir(directory, { recursive: true });
const state = { scratch: await mkdtemp(path.join(tmpdir(), 'verification-local-')) };
const evidence = {
  mode: 'local',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  sourceChanges: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
  sourceSnapshot: sourceSnapshot(root),
  helperDigest: createHash('sha256')
    .update(await readFile(import.meta.filename))
    .digest('hex'),
  command: {
    executable: process.execPath,
    arguments: [...process.execArgv, ...process.argv.slice(1)],
    cwd: root,
  },
  artifacts: [],
  events: [],
  scenarios: [],
  inferenceVerified: false,
  started: new Date().toISOString(),
};
const chat = 'chatbot-provider >>> chat-container';
const question = 'What experience does Rasmus have?';
let page;
const openPage = async () => {
  const opened = await createPage(state.browser);
  opened.on('pageerror', (error) =>
    evidence.events.push({ type: 'page-error', message: error.message }),
  );
  return opened;
};
const capture = async (page, name) => {
  await page.screenshot({ path: path.join(directory, name), fullPage: true });
  evidence.artifacts.push(name);
};
const ready = (page) =>
  page.waitForFunction(() => globalThis.verificationChat()?.lifecycle.status === 'ready', {
    timeout: 600_000,
  });
const submit = async (page, keyboard) => {
  await ready(page);
  const url = page.url();
  await page.type(`${chat} >>> input`, question);
  assert.equal(await page.$eval(`${chat} >>> input`, (element) => element.value), question);
  assert.equal(
    await page.$eval(`${chat} >>> button[type=submit]`, (element) => element.disabled),
    false,
  );
  await capture(page, keyboard ? 'typed-enter.png' : 'typed-button.png');
  await (keyboard ? page.keyboard.press('Enter') : page.click(`${chat} >>> button[type=submit]`));
  await page.waitForFunction(
    () => globalThis.verificationChat()?.lifecycle.status === 'responding',
    { timeout: 30_000 },
  );
  assert.equal(await page.$eval(`${chat} >>> input`, (element) => element.disabled), true);
  await ready(page);
  const messages = await page.$eval(chat, (element) => element.messages);
  const answer = messages.at(-1);
  assert.equal(answer.role, 'assistant');
  assert.match(answer.content, /Ericsson/i);
  assert.equal(page.url(), url);
  await capture(page, keyboard ? 'local-enter-answer.png' : 'local-answer.png');
  return { action: keyboard ? 'Enter' : 'Send', answer: answer.content, urlUnchanged: true };
};
try {
  assert.ok(process.env.RUNTIME_MODEL_DIR, 'Set RUNTIME_MODEL_DIR to a real model mirror');
  state.site = await createSite(state.scratch, 'cache', evidence);
  evidence.origin = state.site.origin;
  state.browser = await launch(path.join(state.scratch, 'profile'));
  evidence.browser = await state.browser.version();
  page = await openPage();
  await page.evaluateOnNewDocument(() => {
    globalThis.verificationProgress = [];
    const observe = () => {
      const progress = globalThis.document
        .querySelector('progress-provider')
        ?.shadowRoot?.querySelector('progress-container');
      if (!progress) return;
      const snapshot = [...progress.data.entries()];
      const encoded = JSON.stringify(snapshot);
      if (encoded !== globalThis.verificationProgress.at(-1)?.encoded)
        globalThis.verificationProgress.push({ encoded, snapshot });
    };
    globalThis.document.addEventListener('DOMContentLoaded', () => {
      const timer = setInterval(observe, 50);
      globalThis.addEventListener(
        'pagehide',
        () => {
          clearInterval(timer);
        },
        { once: true },
      );
    });
  });
  await seedVerificationPreferences(page, 'local');
  await page.goto(state.site.origin);
  await page.waitForSelector(`${chat} >>> input`, { visible: true });
  await capture(page, 'local-loading.png');
  await ready(page);
  assert.equal(await page.$eval(`${chat} >>> input`, (element) => element.disabled), false);
  assert.equal(
    await page.$eval(`${chat} >>> button[type=submit]`, (element) => element.disabled),
    true,
  );
  const progress = await page.evaluate(() => globalThis.verificationProgress);
  assert.ok(
    progress.some(({ snapshot }) => snapshot.some(([, item]) => item.status !== 'ready')),
    'Observe actual cold progress',
  );
  evidence.scenarios.push(
    { name: 'local-loading', verdict: 'PASS', progress },
    {
      name: 'local-button-answer',
      verdict: 'PASS',
      ...(await submit(page, false)),
    },
  );
  const history = await page.$eval(chat, (element) => element.messages);
  await page.reload();
  await ready(page);
  assert.deepEqual(await page.$eval(chat, (element) => element.messages), history);
  const fresh = await openPage();
  await fresh.goto(state.site.origin);
  await ready(fresh);
  assert.equal(await fresh.$eval(chat, (element) => element.messages.length), 0);
  await fresh.close();
  evidence.scenarios.push({
    name: 'local-history',
    verdict: 'PASS',
    reloadRestored: true,
    freshTabEmpty: true,
  });
  await page.$$eval(`${chat} >>> button`, (buttons) =>
    buttons.find((button) => button.textContent.trim() === 'Reset').click(),
  );
  await page.waitForFunction(() => globalThis.verificationChat()?.messages.length === 0);
  evidence.scenarios.push({
    name: 'local-enter-answer',
    verdict: 'PASS',
    ...(await submit(page, true)),
  });
  await state.browser.close();
  state.site.blockModels(true);
  const downloads = evidence.modelRequests.length;
  state.browser = await launch(path.join(state.scratch, 'profile'), true);
  page = await openPage();
  await page.goto(state.site.origin);
  const returning = await submit(page, false);
  assert.equal(evidence.modelRequests.length, downloads, 'No model downloads on restart');
  await capture(page, 'local-returning-answer.png');
  assert.deepEqual(
    evidence.events.filter((event) => event.type === 'page-error'),
    [],
  );
  evidence.scenarios.push({ name: 'local-cached-restart', verdict: 'PASS', ...returning });
  evidence.inferenceVerified = true;
} catch (error) {
  evidence.scenarios.push({ name: 'local-verification', verdict: 'FAIL', reason: error.stack });
  if (page && !page.isClosed()) await capture(page, 'local-failure.png').catch(() => {});
} finally {
  evidence.cleanup = await closeResources(state);
  evidence.finished = new Date().toISOString();
  await finalizeEvidence(directory, evidence);
}
console.info(
  JSON.stringify({
    verdict: evidence.verdict,
    directory,
    scenarios: evidence.scenarios,
    cleanup: evidence.cleanup,
  }),
);
process.exitCode = evidence.verdict === 'PASS' ? 0 : 1;
