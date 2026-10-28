import { createHash, X509Certificate } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const directory = path.dirname(fileURLToPath(import.meta.url));
const serveDirectory = path.join(directory, 'dist');
const downloadPath = path.resolve(directory, '../../static/content-data');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-index-'));

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filePath = path.resolve(
      serveDirectory,
      `.${pathname === '/' ? '/index.html' : pathname}`,
    );
    if (!filePath.startsWith(`${serveDirectory}${path.sep}`))
      throw new Error('[ERROR] - Invalid path');
    const types = {
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
    };
    response.setHeader('Content-Type', types[path.extname(filePath)] ?? 'text/html');
    response.end(await fs.readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end('File not found');
  }
});

const expected = ['contents.bin', 'vector-metadata.json', 'chunks.json'];
const waitForDownloads = async (completed) => {
  const deadline = Date.now() + 30_000;
  while (
    !expected.every((name) =>
      [...completed.values()].some((entry) => entry.name === name && entry.state === 'completed'),
    )
  ) {
    if (Date.now() > deadline) throw new Error('[ERROR] - Index downloads did not complete');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

let browser;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const proxy = process.env.HTTPS_PROXY;
  const certificatePath = process.env.NODE_EXTRA_CA_CERTS;
  const certificate = certificatePath
    ? new X509Certificate(await fs.readFile(certificatePath))
    : undefined;
  const certificateKey = certificate?.publicKey.export({ type: 'spki', format: 'der' });
  const trust = certificateKey
    ? [
        `--ignore-certificate-errors-spki-list=${createHash('sha256').update(certificateKey).digest('base64')}`,
      ]
    : [];
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      ...trust,
      ...(proxy ? [`--proxy-server=${proxy}`, '--proxy-bypass-list=localhost;127.0.0.1'] : []),
    ],
  });
  const page = await browser.newPage();
  page.on('console', (message) => console.info('BROWSER:', message.text()));
  page.on('pageerror', (error) => console.error('[ERROR] - BROWSER:', error.message));
  const session = await page.createCDPSession();
  await session.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: scratch,
    eventsEnabled: true,
  });
  const completed = new Map();
  session.on('Browser.downloadWillBegin', ({ guid, suggestedFilename }) =>
    completed.set(guid, { name: suggestedFilename }),
  );
  session.on('Browser.downloadProgress', ({ guid, state }) => {
    const entry = completed.get(guid);
    if (entry) entry.state = state;
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => globalThis.indexReady === true, { timeout: 300_000 });
  await page.click('#download');
  await page.click('#download-chunks');
  await waitForDownloads(completed);
  await fs.mkdir(downloadPath, { recursive: true });
  for (const name of expected) {
    await fs.copyFile(path.join(scratch, name), path.join(downloadPath, name));
    console.info(`Saved ${name}`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(scratch, { recursive: true, force: true });
}
