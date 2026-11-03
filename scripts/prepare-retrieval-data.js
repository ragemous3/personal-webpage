import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

import { browserPath, mime, root } from './browser-verification/environment.js';
import { sourceSnapshot } from './browser-verification/source.js';
const sourceFile = (pathname, models, scratch) => {
  if (pathname === '/transformers.js') return path.join(scratch, 'transformers.js');
  const roots = [
    ['/models/', models],
    ['/lib/', path.join(root, 'node_modules/@huggingface/transformers/dist')],
    ['/hnsw/', path.join(root, 'node_modules/hnswlib-wasm/dist')],
  ];
  const match = roots.find(([prefix]) => pathname.startsWith(prefix));
  if (!match) throw new Error('Unknown asset');
  const file = path.resolve(match[1], pathname.slice(match[0].length));
  if (!file.startsWith(`${path.resolve(match[1])}/`)) throw new Error('Outside asset directory');
  return file;
};

const { values } = parseArgs({
  options: { models: { type: 'string' }, evidence: { type: 'string' } },
});
if (!values.models || !values.evidence)
  throw new Error('Use --models <local-model-directory> --evidence <new-json-path>');
const models = path.resolve(values.models);
await writeFile(values.evidence, '', { flag: 'wx' });
const scratch = await mkdtemp(path.join(tmpdir(), 'runtime-index-'));
const evidence = {
  started: new Date().toISOString(),
  errors: [],
  sourceSnapshot: sourceSnapshot(root),
};
let browser, server;
try {
  const built = spawnSync(
    'hugo',
    [
      '--source',
      root,
      '--destination',
      path.join(scratch, 'site'),
      '--cacheDir',
      path.join(scratch, 'cache'),
      '--baseURL',
      '/',
      '--ignoreCache',
      '--noBuildLock',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, HUGO_RESOURCEDIR: path.join(scratch, 'resources') },
    },
  );
  if (built.status !== 0) throw new Error(built.stdout + built.stderr);
  const wanted = new Set([
    'About me',
    'Competence and Skills',
    'Education',
    'Employment',
    'Experience',
    'Personality',
  ]);
  const pages = JSON.parse(await readFile(path.join(scratch, 'site/index.json'), 'utf8')).filter(
    (p) => wanted.has(p.title),
  );
  if (pages.length !== 6 || pages.some((p) => !p.content.trim()))
    throw new Error('Unexpected CV source inventory');
  evidence.pages = pages.map((p) => ({ title: p.title, characters: p.content.length }));
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 300, chunkOverlap: 40 });
  const documents = await Promise.all(
    pages.map(async (page, index) => {
      const texts = await splitter.splitText(page.content);
      return texts.map((text) => ({ text, index }));
    }),
  );
  const chunks = documents.flat();
  await build({
    entryPoints: [
      path.join(root, 'node_modules/@huggingface/transformers/dist/transformers.web.min.js'),
    ],
    outfile: path.join(scratch, 'transformers.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
  });
  const source = await readFile(new URL('retrieval-index.browser.js', import.meta.url), 'utf8');
  const assets = new Map([
    ['/', { type: 'text/html', data: '<script type="module" src="/generate.js"></script>' }],
    ['/generate.js', { type: 'text/javascript', data: source }],
    ['/chunks.json', { type: 'application/json', data: JSON.stringify(chunks) }],
  ]);
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const asset = assets.get(pathname);
      if (asset) {
        response.setHeader('content-type', asset.type);
        response.end(asset.data);
        return;
      }
      if (pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      const file = sourceFile(pathname, models, scratch);
      const details = await stat(file);
      response.setHeader('content-length', details.size);
      response.setHeader('content-type', mime(file));
      createReadStream(file).pipe(response);
    } catch (error) {
      evidence.errors.push(String(error));
      response.writeHead(404);
      response.end(String(error));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    userDataDir: path.join(scratch, 'profile'),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => {
    evidence.errors.push(error.stack);
    void page
      .evaluate((message) => {
        globalThis.failure = message;
      }, error.message)
      .catch(() => {});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => globalThis.result || globalThis.failure, {
    timeout: 180_000,
    polling: 100,
  });
  const failure = await page.evaluate(() => globalThis.failure);
  if (failure) throw new Error(failure);
  const result = await page.evaluate(() => globalThis.result);
  const destination = path.join(root, 'static/content-data');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'chunks.json'), JSON.stringify(result.chunks));
  await writeFile(path.join(destination, 'contents.bin'), Buffer.from(result.contents));
  await writeFile(path.join(destination, 'vector-metadata.json'), JSON.stringify(result.metadata));
  evidence.artifacts = {};
  for (const filename of ['chunks.json', 'contents.bin', 'vector-metadata.json'])
    evidence.artifacts[filename] = createHash('sha256')
      .update(await readFile(path.join(destination, filename)))
      .digest('hex');
  evidence.count = result.count;
  evidence.neighbors = result.neighbors;
  evidence.selected = result.selected;
  evidence.bytes = result.contents.length;
  evidence.verdict = 'PASS';
} catch (error) {
  evidence.verdict = 'FAIL';
  evidence.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await rm(scratch, { recursive: true, force: true });
  evidence.finished = new Date().toISOString();
  evidence.cleanup = 'Owned browser/server closed and scratch removed';
  await writeFile(values.evidence, JSON.stringify(evidence, null, 2));
  console.info(JSON.stringify(evidence));
}
