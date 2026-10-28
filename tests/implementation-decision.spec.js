import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const command = fileURLToPath(new URL('../scripts/implementation-decision.js', import.meta.url));
const run = (...arguments_) =>
  spawnSync(process.execPath, [command, ...arguments_], { encoding: 'utf8' });

test('Guided returns the approval instruction before publishing', () => {
  const result = run('--mode', 'guided', 'before-publish');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /approval/i);
  assert.match(result.stdout, /already authorized/i);
  assert.equal(result.stderr, '');
});

test('known decisions without extra instructions produce no output', () => {
  for (const [mode, id] of [
    ['autopilot', 'before-publish'],
    ['autopilot', 'before-documentation-change'],
    ['guided', 'after-implementation'],
  ]) {
    const result = run('--mode', mode, id);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('invalid decisions or missing modes cannot silently authorize continuation', () => {
  for (const arguments_ of [
    ['--mode', 'guided', 'before-publsh'],
    ['--mode', 'autopilot', 'before-publsh'],
    ['before-publish'],
    ['--mode', 'unknown', 'before-publish'],
    ['--mode', 'guided'],
    ['--mode', 'guided', 'before-publish', 'extra'],
  ]) {
    const result = run(...arguments_);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.notEqual(result.stderr, '');
  }
});

test('decision discovery and lookup work outside the repository directory', () => {
  const result = spawnSync(process.execPath, [command, '--list'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const ids = result.stdout.trim().split('\n');
  assert.ok(ids.includes('before-documentation-change'));
  assert.ok(ids.includes('before-publish'));
  for (const id of ids) {
    const lookup = run('--mode', 'autopilot', id);
    assert.equal(lookup.status, 0, lookup.stderr);
    assert.equal(lookup.stdout, '');
  }
});

test('missing or invalid instruction data is an error, not an empty instruction', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'implementation-decision-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'scripts'));
  const maps = path.join(root, 'docs/implementation-modes');
  mkdirSync(maps, { recursive: true });
  const copy = path.join(root, 'scripts/implementation-decision.js');
  cpSync(command, copy);
  writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(maps, 'decisions.json'), '["before-publish"]');
  for (const data of [
    undefined,
    '{',
    'null',
    '[]',
    '{"before-publish":false}',
    '{"before-publish":""}',
    '{"before-publsh":"Ask"}',
  ]) {
    if (data === undefined) rmSync(path.join(maps, 'guided.json'), { force: true });
    else writeFileSync(path.join(maps, 'guided.json'), data);
    const result = spawnSync(process.execPath, [copy, '--mode', 'guided', 'before-publish'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 2, `data: ${data}; stdout: ${result.stdout}`);
    assert.equal(result.stdout, '');
    assert.notEqual(result.stderr, '');
  }
});
