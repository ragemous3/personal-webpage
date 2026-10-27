#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.argv[2] === '--help') {
  console.log('Usage: observe.js <loopback-url> <new-evidence-directory> <open|type|send|enter>');
  console.log('Captures observations only. A successful exit is not a feature verdict.');
  process.exit(0);
}
const [address, directory, action] = process.argv.slice(2);
if (!address || !directory || !['open', 'type', 'send', 'enter'].includes(action)) {
  console.error('Use --help for arguments.');
  process.exit(2);
}
const url = new URL(address);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('Expected the owned loopback Hugo instance');
}
const evidence = resolve(directory);
await mkdir(evidence, { recursive: false });
const events = [];
const result = { action, address, verdict: 'UNASSESSED', events };
let browser;
let profile;
let page;
try {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const { default: puppeteer } = await import(require.resolve('puppeteer'));
  profile = await mkdtemp(join(tmpdir(), 'offline-assistant-browser-'));
  browser = await puppeteer.launch({ headless: true, userDataDir: profile });
  result.browser = await browser.version();
  page = await browser.newPage();
  page.on('console', (message) => events.push({ type: 'console', level: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.push({ type: 'pageerror', text: error.message }));
  page.on('requestfailed', (request) => events.push({ type: 'requestfailed', url: request.url(), error: request.failure() }));
  page.on('response', (response) => {
    if (response.status() >= 400) events.push({ type: 'http-error', url: response.url(), status: response.status() });
  });
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: join(evidence, 'before.png'), fullPage: true });
  const input = 'chatbot-offline-provider >>> chat-container >>> input';
  await page.waitForSelector(input, { visible: true, timeout: 15000 });
  if (action !== 'open') {
    const question = 'What experience does Rasmus have?';
    events.push({ type: 'action', name: 'type', question });
    await page.type(input, question);
    await page.screenshot({ path: join(evidence, 'typed.png'), fullPage: true });
    if (action === 'send') {
      events.push({ type: 'action', name: 'click-submit' });
      await page.click('chatbot-offline-provider >>> chat-container >>> button[type="submit"]');
    } else if (action === 'enter') {
      events.push({ type: 'action', name: 'press-enter' });
      await page.keyboard.press('Enter');
    }
  }
  await new Promise((done) => setTimeout(done, 2000));
  result.captureWindowMs = 2000;
  result.page = await page.evaluate(() => {
    const chat = document.querySelector('chatbot-offline-provider')?.shadowRoot
      ?.querySelector('chat-container')?.shadowRoot;
    const progress = document.querySelector('progress-provider')?.shadowRoot
      ?.querySelector('progress-container')?.shadowRoot;
    return {
      title: document.title, url: location.href,
      input: chat?.querySelector('input')?.value,
      chatText: chat?.textContent, progressText: progress?.textContent,
      webgpuApi: Boolean(navigator.gpu),
    };
  });
  await page.screenshot({ path: join(evidence, 'after.png'), fullPage: true });
} catch (error) {
  result.verdict = 'BLOCKED_OR_FAILED';
  result.error = error.stack;
  process.exitCode = 1;
  if (page) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  try {
    await browser?.close();
    if (profile) await rm(profile, { recursive: true, force: true });
    result.cleanup = 'Owned browser closed and temporary profile removed, if created';
  } catch (error) {
    result.cleanup = `FAILED: ${error.message}; profile: ${profile}`;
    process.exitCode = 1;
  }
  await writeFile(join(evidence, 'observations.json'), JSON.stringify(result, null, 2));
  console.log(`Observations saved to ${evidence}; feature verdict requires assessment.`);
}
