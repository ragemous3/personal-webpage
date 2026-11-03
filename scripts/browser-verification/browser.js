import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runEntry } from './application.js';
import { runCache } from './cache.js';
import { closeResources } from './cleanup.js';
import { createSite, launch, root } from './environment.js';
import { defaultEvidenceDirectory, finalizeEvidence } from './evidence.js';
import { runPerformance } from './performance.js';
import { runControlled } from './scenarios.js';
import { runSettings } from './settings.js';
import { sourceSnapshot } from './source.js';

const sourceHashes = async (site, workers) => {
  const hashes = {};
  for (const name of Object.keys(workers)) {
    const file = path.join(site.output, workers[name].replace(/^\//, ''));
    hashes[name] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }
  return hashes;
};
const exercise = async (state, evidence, directory) => {
  const restart = async (offline) => {
    if (state.browser) {
      for (const page of await state.browser.pages()) await page.close();
      await state.browser.close();
    }
    state.site.blockModels(offline);
    state.browser = await launch(path.join(state.scratch, 'profile'), offline);
    evidence.browser = await state.browser.version();
    return state.browser;
  };
  const { mode } = evidence;
  if (mode === 'cache') return runCache(restart, state.site.origin, evidence, directory);
  const browser = await restart(mode === 'entry');
  if (mode === 'performance') return runPerformance(browser, state.site.origin, evidence);
  if (mode === 'settings') return runSettings(browser, state.site.origin, evidence, directory);
  if (mode === 'controlled') return runControlled(browser, state.site.origin, evidence);
  return runEntry(browser, state.site.origin, evidence, directory);
};

export const verifyBrowser = async ({
  mode,
  directory = defaultEvidenceDirectory(root, mode),
  baseline,
}) => {
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory, { recursive: false });
  const scratch = await mkdtemp(path.join(tmpdir(), 'browser-verification-'));
  const state = { scratch };
  const evidence = {
    mode,
    artifacts: [],
    command: {
      executable: 'node',
      arguments: [
        'scripts/browser-verification/run.js',
        '--mode',
        mode,
        '--evidence',
        directory,
        ...(baseline ? ['--baseline'] : []),
      ],
      cwd: root,
    },
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceChanges: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
    inferenceVerified: false,
    sourceSnapshot: sourceSnapshot(root),
    started: new Date().toISOString(),
    scenarios: [],
    events: [],
  };
  try {
    state.site = await createSite(scratch, mode, evidence);
    evidence.origin = state.site.origin;
    evidence.sourceHashes = await sourceHashes(state.site, evidence.workerMap);
    await exercise(state, evidence, directory);
    if (mode === 'controlled') {
      const definitions = JSON.parse(
        await readFile(new URL('migration-scenarios.json', import.meta.url), 'utf8'),
      );
      evidence.migrationScenarios = definitions.map((definition) => ({
        ...definition,
        verdict:
          evidence.scenarios.find((scenario) => scenario.name === definition.name)?.verdict ??
          'BLOCKED',
      }));
    }
  } catch (error) {
    evidence.toolError = error.stack;
  } finally {
    evidence.cleanup = await closeResources(state);
    evidence.finished = new Date().toISOString();
    await finalizeEvidence(directory, evidence);
  }
  console.info(
    JSON.stringify({
      verdict: evidence.verdict,
      scenarios: evidence.scenarios.map(({ name, verdict, reason }) => ({ name, verdict, reason })),
      directory,
      cleanup: evidence.cleanup,
    }),
  );
  if (evidence.verdict === 'ERROR') return 1;
  return evidence.verdict === 'PASS' || baseline ? 0 : 1;
};
