import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const cli = new URL('../scripts/browser-verification/run.js', import.meta.url);
const assess = (context, observations) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'verification-report-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'input.json');
  writeFileSync(input, JSON.stringify(observations));
  const result = spawnSync(process.execPath, [cli.pathname, '--assess', input], {
    encoding: 'utf8',
  });
  return {
    ...result,
    report: () => JSON.parse(result.stdout),
  };
};

test('verification CLI reports a completed isolated request without inventing model proof', (context) => {
  const result = assess(context, {
    mode: 'controlled',
    events: [
      { type: 'accepted', requestId: 'a', client: 'one' },
      { type: 'answer', requestId: 'a', client: 'one' },
    ],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report().inferenceVerified, false);
  assert.deepEqual(result.report().findings, []);
});

for (const [name, events, code] of [
  ['a stranded request', [{ type: 'accepted', client: 'one', requestId: 'a' }], 'stranded-request'],
  [
    'an answer delivered to the wrong client',
    [
      { type: 'accepted', client: 'one', requestId: 'a' },
      { type: 'answer', client: 'two', requestId: 'a' },
    ],
    'stranded-request',
  ],
  [
    'duplicate initialization',
    [
      { type: 'initialized', role: 'generation' },
      { type: 'initialized', role: 'generation' },
    ],
    'duplicate-initialization',
  ],
  [
    'stale readiness',
    [{ type: 'worker-stopped', role: 'generation', ready: true }],
    'stale-readiness',
  ],
  [
    'overlapping recovery',
    [
      { type: 'recovery-start', role: 'generation' },
      { type: 'recovery-start', role: 'generation' },
    ],
    'overlapping-recovery',
  ],
]) {
  test(`verification CLI detects ${name}`, (context) => {
    const result = assess(context, { mode: 'controlled', events });
    assert.equal(result.status, 1);
    assert.ok(result.report().findings.some((finding) => finding.code === code));
  });
}

test('Doctor keeps résumé data optional for entry and required for an answer', () => {
  const doctor = new URL(
    '../.agents/skills/verify-offline-assistant/scripts/doctor.js',
    import.meta.url,
  );
  for (const journey of ['entry', 'answer']) {
    const result = spawnSync(process.execPath, [doctor.pathname, '--journey', journey], {
      encoding: 'utf8',
    });
    const report = JSON.parse(result.stdout);
    assert.equal(report.runtimeVerified, false);
    const data = report.checks.filter((check) => check.name.startsWith('data:'));
    assert.equal(data.length, 3);
    assert.ok(data.every((check) => check.required === (journey === 'answer')));
  }
});

test('verification CLI does not report an empty observation as a pass', (context) => {
  const result = assess(context, { mode: 'controlled', events: [] });
  assert.equal(result.status, 1);
  assert.equal(result.report().verdict, 'BLOCKED');
});

for (const [name, events, expected] of [
  ['unknown-only events', [{ type: 'unrecognized' }], 'BLOCKED'],
  ['requests without identities', [{ type: 'accepted' }, { type: 'answer' }], 'BLOCKED'],
  [
    'delivery to both correct and wrong clients',
    [
      { type: 'accepted', client: 'one', requestId: 'q' },
      { type: 'answer', client: 'one', requestId: 'q' },
      { type: 'answer', client: 'two', requestId: 'q' },
    ],
    'FAIL',
  ],
  [
    'duplicate terminal delivery',
    [
      { type: 'accepted', client: 'one', requestId: 'q' },
      { type: 'answer', client: 'one', requestId: 'q' },
      { type: 'answer', client: 'one', requestId: 'q' },
    ],
    'FAIL',
  ],
]) {
  test(`verification CLI refuses to pass ${name}`, (context) => {
    const result = assess(context, { mode: 'controlled', events });
    assert.equal(result.status, 1);
    assert.equal(result.report().verdict, expected);
  });
}

test('assessment preserves its input and existing reports', (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'verification-preserve-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'report.json');
  const observations = JSON.stringify({
    mode: 'controlled',
    events: [{ type: 'initialized', role: 'generation' }],
  });
  writeFileSync(input, observations);
  const result = spawnSync(process.execPath, [cli.pathname, '--assess', input], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(input, 'utf8'), observations);
});
