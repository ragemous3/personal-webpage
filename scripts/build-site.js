import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { 'base-url': { type: 'string', default: '/' } } });
const run = (command, arguments_, options = {}) => {
  const result = spawnSync(command, arguments_, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
};

try {
  const expectedNode = readFileSync(path.join(root, '.node-version'), 'utf8').trim();
  const expectedHugo = readFileSync(path.join(root, '.hugo-version'), 'utf8').trim();
  if (process.versions.node !== expectedNode)
    throw new Error(`Use Node ${expectedNode}; found ${process.versions.node}`);
  const version = spawnSync('hugo', ['version'], { encoding: 'utf8' });
  const actualHugo = version.stdout?.match(/^hugo v([\d.]+)(?:[-+].*)?/);
  if (actualHugo?.[1] !== expectedHugo || !version.stdout.includes('extended'))
    throw new Error(`Install Hugo Extended ${expectedHugo} and put hugo on PATH`);
  const cache = mkdtempSync(path.join(tmpdir(), 'site-build-'));
  try {
    rmSync(path.join(root, 'public'), { recursive: true, force: true });
    run(
      'hugo',
      [
        '--environment',
        'production',
        '--destination',
        'public',
        '--cacheDir',
        cache,
        '--ignoreCache',
        '--baseURL',
        values['base-url'],
      ],
      { env: { ...process.env, HUGO_RESOURCEDIR: path.join(cache, 'resources') } },
    );
    run(process.execPath, [
      'scripts/verify-production-assets.js',
      '--base-url',
      values['base-url'],
    ]);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
} catch (error) {
  console.error(`Build: ${error.message}`);
  process.exitCode = 1;
}
