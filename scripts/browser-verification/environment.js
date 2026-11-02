import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const directory = import.meta.dirname;
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const browserPath = () =>
  process.env.CHROME_PATH ??
  ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) => existsSync(candidate)) ??
  puppeteer.executablePath();
const mime = (file) =>
  ({
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.css': 'text/css',
  })[path.extname(file)] ?? 'application/octet-stream';

const receiveEvent = async (request, response, evidence) => {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536) throw new Error('Event too large');
  }
  evidence.events.push(JSON.parse(body));
  response.end('ok');
};
const serveFile = (pathname, response, state) => {
  const { output, workers, mode } = state;
  let file = path.resolve(output, `.${decodeURIComponent(pathname)}`);
  if (!file.startsWith(`${output}/`) && file !== output) throw new Error('Outside site');
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (pathname === '/__verify/probe') file = path.join(directory, 'probe.html');
  const role = Object.keys(workers).find((name) => workers[name] === pathname);
  if (mode === 'controlled' && ['llm.worker.ts', 'vectordb.worker.ts'].includes(role)) {
    response.setHeader('content-type', 'text/javascript');
    response.end(
      `globalThis.verificationRole = ${JSON.stringify(role)};\n${readFileSync(path.join(directory, 'controlled-model.js'), 'utf8')}`,
    );
    return;
  }
  response.setHeader('content-type', mime(file));
  response.end(readFileSync(file));
};
const requestHandler = (state, evidence) => async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/__verify/events') await receiveEvent(request, response, evidence);
    else serveFile(pathname, response, state);
  } catch {
    response.writeHead(404);
    response.end('Missing verification asset or invalid event');
  }
};

export const createSite = async (scratch, mode, evidence) => {
  const output = path.join(scratch, 'site');
  const state = { output, mode, workers: {} };
  const server = createServer(requestHandler(state, evidence));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = spawnSync(
      'hugo',
      [
        '--environment',
        'production',
        '--source',
        root,
        '--destination',
        output,
        '--cacheDir',
        path.join(scratch, 'cache'),
        '--baseURL',
        `${origin}/`,
        '--ignoreCache',
        '--noBuildLock',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, HUGO_RESOURCEDIR: path.join(scratch, 'resources') },
      },
    );
    evidence.build = {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error?.message,
    };
    if (result.status !== 0) throw new Error('Verification site build failed');
    state.workers = JSON.parse(
      readFileSync(path.join(output, 'data/workers.json'), 'utf8'),
    ).workers;
    evidence.workerMap = state.workers;
    return { server, origin, output };
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
};

export const launch = (profile, offline = false) =>
  puppeteer.launch({
    executablePath: browserPath(),
    headless: true,
    userDataDir: profile,
    protocolTimeout: 10_000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      ...(offline ? ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] : []),
    ],
  });
