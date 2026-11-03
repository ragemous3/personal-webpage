#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { values } = parseArgs({ options: { journey: { type: 'string', default: 'answer' } } });
if (!['entry', 'answer'].includes(values.journey)) throw new Error('Use --journey entry|answer');
const checks = [];
const record = (name, passed, detail, required = true) =>
  checks.push({ name, passed, detail, required });
const hugo = spawnSync('hugo', ['version'], { encoding: 'utf8', timeout: 10_000 });
const version = hugo.stdout?.match(/hugo v(\d+)\.(\d+)\.(\d+)/);
record(
  'hugo-template-support',
  hugo.status === 0 && Boolean(version) && (Number(version[1]) > 0 || Number(version[2]) >= 146),
  hugo.error?.message ?? (hugo.stdout || hugo.stderr).trim(),
);

const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
  try {
    require.resolve(name === 'hnswlib-wasm' ? 'hnswlib-wasm/dist/hnswlib.js' : name);
    record(`dependency:${name}`, true, 'Resolvable from this checkout');
  } catch (error) {
    record(`dependency:${name}`, false, error.code);
  }
}
const postcss = spawnSync('postcss', ['--version'], {
  encoding: 'utf8',
  timeout: 10_000,
  env: {
    ...process.env,
    PATH: `${path.join(root, 'node_modules/.bin')}:${process.env.PATH ?? ''}`,
  },
});
record(
  'postcss-cli',
  postcss.status === 0,
  postcss.error?.message ?? (postcss.stdout || postcss.stderr).trim(),
);
try {
  const { default: puppeteer } = await import(require.resolve('puppeteer'));
  const path =
    process.env.CHROME_PATH ??
    ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) => existsSync(candidate)) ??
    puppeteer.executablePath();
  accessSync(path, constants.X_OK);
  record('browser-executable', true, path);
} catch (error) {
  record('browser-executable', false, error.message);
}
const checkDataFile = (name) => {
  try {
    const filename = path.join(root, 'static/content-data', name);
    const info = statSync(filename);
    if (!info.isFile() || info.size === 0) throw new Error('Expected a nonempty data file');
    if (name.endsWith('.json')) JSON.parse(readFileSync(filename, 'utf8'));
    record(
      `data:${name}`,
      true,
      `${info.size} bytes; consistency still needs runtime verification`,
      values.journey === 'answer',
    );
  } catch (error) {
    record(`data:${name}`, false, error.message, values.journey === 'answer');
  }
};
for (const name of ['chunks.json', 'contents.bin', 'vector-metadata.json']) checkDataFile(name);

const passed = checks.every((check) => check.passed || !check.required);
console.info(
  JSON.stringify(
    {
      status: passed ? 'PREREQUISITES_PRESENT' : 'BLOCKED',
      root,
      journey: values.journey,
      node: process.version,
      runtimeVerified: false,
      checks,
    },
    null,
    2,
  ),
);
process.exitCode = passed ? 0 : 1;
