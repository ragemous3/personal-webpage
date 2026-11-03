import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { closeResources } = await import(
  new URL('../scripts/browser-verification/cleanup.js', import.meta.url)
);
const { defaultEvidenceDirectory, finalizeEvidence } = await import(
  new URL('../scripts/browser-verification/evidence.js', import.meta.url)
);

test('required screenshots and the report survive teardown and are verified before retention is claimed', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'verification-artifacts-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const scratch = path.join(directory, 'application');
  const output = path.join(directory, 'evidence');
  await mkdir(scratch);
  await mkdir(output);
  await writeFile(path.join(output, 'entry-open.png'), 'screenshot');
  const evidence = {
    mode: 'entry',
    artifacts: ['entry-open.png'],
    scenarios: [{ name: 'entry', verdict: 'PASS' }],
    cleanup: await closeResources({ scratch }),
  };
  assert.equal(evidence.cleanup.evidenceRetained, false);
  await finalizeEvidence(output, evidence);
  const report = JSON.parse(await readFile(path.join(output, 'evidence.json'), 'utf8'));
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.cleanup.evidenceRetained, true);
  assert.deepEqual(report.artifacts, ['evidence.json', 'entry-open.png']);
});

for (const kind of ['missing', 'empty']) {
  test(`${kind} declared evidence cannot be reported as retained or PASS`, async (context) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'missing-artifact-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    if (kind === 'empty') await writeFile(path.join(directory, 'entry-open.png'), '');
    const evidence = {
      artifacts: ['entry-open.png'],
      scenarios: [{ verdict: 'PASS' }],
      cleanup: { errors: [] },
    };
    await finalizeEvidence(directory, evidence);
    const report = JSON.parse(await readFile(path.join(directory, 'evidence.json'), 'utf8'));
    assert.equal(report.verdict, 'ERROR');
    assert.equal(report.cleanup.evidenceRetained, false);
    assert.match(report.cleanup.errors.join(' '), /entry-open.png/);
  });
}

test('default run directories are unique and stay under the verification artifact root', () => {
  const root = '/example/repository';
  const first = defaultEvidenceDirectory(root, 'entry');
  const second = defaultEvidenceDirectory(root, 'entry');
  assert.notEqual(first, second);
  assert.ok(first.startsWith('/example/repository/artifacts/verification/entry-'));
});

test('evidence outside the declared run folder is rejected', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'outside-artifact-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'run');
  await mkdir(output);
  await writeFile(path.join(directory, 'outside.png'), 'image');
  const evidence = {
    artifacts: ['../outside.png'],
    scenarios: [{ verdict: 'PASS' }],
    cleanup: { errors: [] },
  };
  await finalizeEvidence(output, evidence);
  assert.equal(evidence.verdict, 'ERROR');
  assert.equal(evidence.cleanup.evidenceRetained, false);
});

test('retained reports preserve blocked checks and do not hide teardown failures', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'blocked-artifact-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const evidence = {
    artifacts: [],
    scenarios: [{ name: 'cache', verdict: 'BLOCKED', reason: 'Missing model data' }],
    cleanup: { errors: ['Server did not close'] },
  };
  await finalizeEvidence(directory, evidence);
  assert.equal(evidence.verdict, 'ERROR');
  assert.equal(evidence.cleanup.evidenceRetained, true);
  assert.deepEqual(evidence.skippedChecks, [{ name: 'cache', reason: 'Missing model data' }]);
});
