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

for (const screenshotAvailable of [true, false]) {
  test(`entry assertion failure preserves required screenshot outcome (available: ${screenshotAvailable})`, async (context) => {
    const { runEntry } = await import(
      new URL('../scripts/browser-verification/application.js', import.meta.url)
    );
    const directory = await mkdtemp(path.join(tmpdir(), 'entry-failure-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    let closed = false;
    const page = {
      on() {},
      async evaluateOnNewDocument() {},
      async goto() {},
      async waitForSelector() {},
      async evaluate() {
        return { title: 'Unexpected title' };
      },
      async screenshot({ path: file }) {
        assert.equal(closed, false);
        if (!screenshotAvailable) throw new Error('Renderer unavailable');
        await writeFile(file, 'failure-state screenshot');
      },
      async close() {
        closed = true;
      },
    };
    const evidence = { artifacts: [], scenarios: [], cleanup: { errors: [] } };
    await runEntry(
      {
        async newPage() {
          return page;
        },
      },
      'http://localhost',
      evidence,
      directory,
    );
    assert.equal(closed, true);
    assert.equal(evidence.scenarios[0].verdict, 'FAIL');
    assert.ok(evidence.artifacts.includes('entry-open.png'));
    await finalizeEvidence(directory, evidence);
    assert.equal(evidence.verdict, screenshotAvailable ? 'FAIL' : 'ERROR');
    assert.equal(evidence.cleanup.evidenceRetained, screenshotAvailable);
  });
}

for (const screenshotAvailable of [true, false]) {
  test(`settings failure retains its cause and closes the context when screenshot is available: ${screenshotAvailable}`, async (context) => {
    const { runSettings } = await import(
      new URL('../scripts/browser-verification/settings.js', import.meta.url)
    );
    const directory = await mkdtemp(path.join(tmpdir(), 'settings-failure-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    let closed = false;
    let foreground = false;
    const page = {
      on() {},
      setDefaultTimeout() {},
      async evaluateOnNewDocument() {},
      async goto() {
        throw new Error('Settings initialization failed');
      },
      async $eval() {
        return { available: false };
      },
      async bringToFront() {
        foreground = true;
      },
      async screenshot({ path: file }) {
        assert.equal(foreground, true);
        assert.equal(closed, false);
        if (!screenshotAvailable) throw new Error('Renderer capture timed out');
        await writeFile(file, 'settings failure screenshot');
      },
    };
    const browserContext = {
      async newPage() {
        return page;
      },
      async close() {
        closed = true;
      },
    };
    const evidence = { artifacts: [], scenarios: [], cleanup: { errors: [] } };
    await runSettings(
      {
        async createBrowserContext() {
          return browserContext;
        },
      },
      'http://localhost',
      evidence,
      directory,
    );
    assert.equal(closed, true);
    assert.equal(evidence.scenarios[0].verdict, 'FAIL');
    assert.match(evidence.scenarios[0].reason, /Settings initialization failed/);
    if (!screenshotAvailable)
      assert.match(evidence.scenarios[0].screenshotError, /Renderer capture timed out/);
    await finalizeEvidence(directory, evidence);
    assert.equal(evidence.verdict, screenshotAvailable ? 'FAIL' : 'ERROR');
  });
}
