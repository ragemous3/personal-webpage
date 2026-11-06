import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import puppeteer from 'puppeteer';

const directory = import.meta.dirname;
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const browserPath = () =>
  process.env.CHROME_PATH ??
  ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) => existsSync(candidate)) ??
  puppeteer.executablePath();
export const mime = (file) =>
  ({
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
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
const streamAsset = (file, response) => {
  response.setHeader('content-type', mime(file));
  response.setHeader('content-length', statSync(file).size);
  createReadStream(file)
    .on('error', () => {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    })
    .pipe(response);
};
const serveModel = (pathname, response, state, evidence) => {
  evidence.modelRequests.push({
    path: pathname,
    blocked: Boolean(state.modelsBlocked),
    at: Date.now(),
  });
  if (state.modelsBlocked) {
    response.writeHead(503);
    response.end('Model downloads blocked for cache verification');
    return;
  }
  let file = path.resolve(state.models, `.${pathname.slice(7)}`);
  if (!file.startsWith(`${state.models}/`)) throw new Error('Outside model mirror');
  if (pathname.endsWith('/Qwen1.5-0.5B-Chat/resolve/main/onnx/model_q4.onnx') && !existsSync(file))
    file = path.join(state.models, 'qwen.onnx');
  streamAsset(file, response);
};
const modelAsset = (pathname, response, state, evidence) => {
  if (pathname === `/__verify/model-metadata/${state.model}/revision/${state.modelRevision}`) {
    evidence.events.push({
      type: 'metadata-request',
      model: state.model,
      revision: state.modelRevision,
    });
    response.setHeader('content-type', 'application/json');
    const files = state.models
      ? ['onnx/model_q4.onnx']
      : ['onnx/model_q4.onnx', 'onnx/model_fp16.onnx'];
    response.end(
      JSON.stringify({
        sha: state.modelRevision,
        siblings: files.map((rfilename) => ({ rfilename })),
      }),
    );
    return true;
  }
  if (
    !state.models &&
    pathname === `/models/${state.model}/resolve/${state.modelRevision}/config.json`
  ) {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ model_type: 'qwen2' }));
    return true;
  }
  if (!state.models) return false;
  if (pathname.startsWith('/models/')) {
    serveModel(pathname, response, state, evidence);
    return true;
  }
  if (pathname.startsWith('/lib/')) {
    streamAsset(
      path.join(root, 'node_modules/@huggingface/transformers/dist', path.basename(pathname)),
      response,
    );
    return true;
  }
  return false;
};
const serveControlled = (pathname, response, state) => {
  if (!['controlled', 'settings', 'online'].includes(state.mode)) return false;
  if (pathname === '/content-data/chunks.json') {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify([{ text: 'Controlled résumé fixture for transport verification', index: 0 }]),
    );
    return true;
  }
  const role = Object.keys(state.workers).find((name) => state.workers[name] === pathname);
  if (!['llm.shared-worker.ts', 'vectordb.shared-worker.ts'].includes(role)) return false;
  response.setHeader('content-type', 'text/javascript');
  if (state.mode === 'online' && role === 'llm.shared-worker.ts') {
    response.end(readFileSync(path.join(state.scratch, 'online-model.js'), 'utf8'));
    return true;
  }
  response.end(
    `globalThis.verificationSettings = ${state.mode !== 'controlled'};\nglobalThis.verificationRole = ${JSON.stringify(role.split('.')[0])};\n${readFileSync(path.join(state.scratch, 'controlled-model.js'), 'utf8')}`,
  );
  return true;
};
const servePerformance = (response) => {
  response.setHeader('content-type', 'text/html');
  response.end('<script type=module src=/__verify/performance-client.js></script>');
};
const serveFile = (pathname, response, state) => {
  const { output } = state;
  let file = path.resolve(output, `.${decodeURIComponent(pathname)}`);
  if (!file.startsWith(`${output}/`) && file !== output) throw new Error('Outside site');
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  const aliases = {
    '/__verify/probe': path.join(directory, 'probe.html'),
    '/__verify/client.js': path.join(state.scratch, 'client.js'),
    '/__verify/baseline.js': path.join(state.scratch, 'dedicated-model.js'),
    '/__verify/performance-client.js': path.join(directory, 'performance-client.js'),
  };
  file = aliases[pathname] ?? file;
  if (pathname === '/__verify/performance') {
    servePerformance(response);
    return;
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (serveControlled(pathname, response, state)) return;
  response.setHeader('content-type', mime(file));
  response.end(readFileSync(file));
};
const requestHandler = (state, evidence) => async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (state.api && (pathname.startsWith('/api/') || pathname.startsWith('/__verify/openai/'))) {
      state.api(request, response);
      return;
    }
    if (pathname === '/__verify/events') await receiveEvent(request, response, evidence);
    else if (!modelAsset(pathname, response, state, evidence)) serveFile(pathname, response, state);
  } catch {
    response.writeHead(404);
    response.end('Missing verification asset or invalid event');
  }
};

const prepareConfiguration = async (scratch, origin, state, evidence) => {
  const configDirectory = path.join(scratch, 'config');
  await cp(path.join(root, 'config'), configDirectory, { recursive: true });
  if (state.models || ['settings', 'controlled', 'online'].includes(state.mode)) {
    const parametersFile = path.join(configDirectory, '_default/params.toml');
    const locations = `modelBaseUrl = '${origin}/models/'\nwasmBaseUrl = '${origin}/lib/'\n`;
    const metadataLocation = `metadataBaseUrl = '${origin}/__verify/model-metadata/'\n`;
    const source = await readFile(parametersFile, 'utf8');
    state.model = /^model = '([^']+)'/m.exec(source)?.[1];
    state.modelRevision = /^revision = '([^']+)'/m.exec(source)?.[1];
    const parameters = source
      .replace("device = 'webgpu'", "device = 'wasm'")
      .replace('[chatbot.config.localDatabase]', `[chatbot.config.localDatabase]\n${locations}`)
      .replace(
        '[chatbot.config.localLM]',
        `[chatbot.config.localLM]\n${locations}${metadataLocation}`,
      );
    await writeFile(
      parametersFile,
      `${parameters}\n[chatbot.config.localLM.generation]\nmax_new_tokens = 32\ndo_sample = false\n`,
    );
    evidence.configuration = {
      device: 'wasm',
      generation: { max_new_tokens: 32, do_sample: false },
      modelMirror: state.models,
      metadataKind: state.models ? 'local-mirror-manifest' : 'controlled-model-metadata',
      modelRevision: state.modelRevision,
      model: state.model,
      wasmSource: '@huggingface/transformers/dist',
      productionDefaultsChanged: false,
    };
  }
  return configDirectory;
};

const buildFixtures = async (scratch) => {
  for (const [entry, outfile] of [
    ['runtime-client.js', 'client.js'],
    ['controlled-model.js', 'controlled-model.js'],
    ['dedicated-model.js', 'dedicated-model.js'],
    ['online-model.js', 'online-model.js'],
  ])
    await build({
      entryPoints: [path.join(directory, entry)],
      outfile: path.join(scratch, outfile),
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      tsconfig: path.join(root, 'tsconfig.json'),
    });
};

export const createSite = async (scratch, mode, evidence) => {
  const output = path.join(scratch, 'site');
  const state = {
    output,
    mode,
    scratch,
    workers: {},
    models:
      ['cache', 'performance'].includes(mode) && process.env.RUNTIME_MODEL_DIR
        ? path.resolve(process.env.RUNTIME_MODEL_DIR)
        : undefined,
  };
  evidence.modelRequests = [];
  if (['controlled', 'settings', 'performance', 'online'].includes(mode)) await buildFixtures(scratch);
  const server = createServer(requestHandler(state, evidence));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    if (mode === 'online') {
      const { createControlledApi } = await import('./online-server.factory.ts');
      state.api = createControlledApi(origin, evidence);
    }
    const configDirectory = await prepareConfiguration(scratch, origin, state, evidence);
    const result = spawnSync(
      'hugo',
      [
        '--environment',
        'production',
        '--source',
        root,
        '--configDir',
        configDirectory,
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
    return {
      server,
      origin,
      output,
      blockModels: (blocked) => {
        state.modelsBlocked = blocked;
      },
    };
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
    protocolTimeout: 120_000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      ...(offline ? ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] : []),
    ],
  });
