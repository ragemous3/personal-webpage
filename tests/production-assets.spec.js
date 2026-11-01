import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const validator = new URL('../scripts/verify-production-assets.js', import.meta.url);

const fixture = (context) => {
  const root = mkdtempSync(path.join(tmpdir(), 'production-assets-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const site = path.join(root, 'site');
  const assets = path.join(root, 'assets');
  mkdirSync(path.join(site, 'data'), { recursive: true });
  mkdirSync(assets);
  const contents = 'self.onmessage = () => {};\n';
  const digest = createHash('sha256').update(contents).digest('hex');
  const url = `/demo/model.worker.${digest}.js`;
  writeFileSync(path.join(assets, 'model.worker.ts'), '');
  writeFileSync(path.join(site, path.basename(url)), contents);
  writeFileSync(path.join(site, 'app.js'), `const worker = ${JSON.stringify(url)};`);
  writeFileSync(
    path.join(site, 'index.html'),
    '<script type="module" src="/demo/app.js"></script>',
  );
  const manifest = { baseURL: 'https://example.test/demo/', workers: { 'model.worker.ts': url } };
  const saveManifest = () =>
    writeFileSync(path.join(site, 'data/workers.json'), JSON.stringify(manifest));
  saveManifest();
  const run = () =>
    spawnSync(
      process.execPath,
      [
        validator.pathname,
        '--site',
        site,
        '--assets',
        assets,
        '--base-url',
        'https://example.test/demo/',
      ],
      { encoding: 'utf8' },
    );
  return { site, assets, manifest, saveManifest, run, url };
};

test('production asset CLI accepts a fingerprinted worker used by a module under a deployment path', (context) => {
  const result = fixture(context).run();
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, corrupt, diagnostic] of [
  [
    'missing source entry',
    (f) => {
      f.manifest.workers = {};
      f.saveManifest();
    },
    /Worker map differs/,
  ],
  [
    'stale worker reference',
    (f) => {
      rmSync(path.join(f.site, path.basename(f.url)));
    },
    /Missing asset/,
  ],
  [
    'wrong deployment path',
    (f) => {
      f.manifest.workers['model.worker.ts'] = f.url.replace('/demo/', '/wrong/');
      f.saveManifest();
    },
    /Incorrect deployment base/,
  ],
  [
    'changed worker content',
    (f) => {
      writeFileSync(path.join(f.site, path.basename(f.url)), 'corrupted');
    },
    /Invalid fingerprint/,
  ],
  [
    'broken module import',
    (f) => {
      writeFileSync(
        path.join(f.site, 'app.js'),
        `import './missing.js'; const worker = ${JSON.stringify(f.url)};`,
      );
    },
    /Missing asset/,
  ],
  [
    'worker missing from application',
    (f) => {
      writeFileSync(path.join(f.site, 'app.js'), 'const worker = null;');
    },
    /Worker URL absent/,
  ],
]) {
  test(`production asset CLI rejects ${name}`, (context) => {
    const f = fixture(context);
    corrupt(f);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, diagnostic);
  });
}
