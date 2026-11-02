import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runEntry } from './application.js';
import { runCache } from './cache.js';
import { closeResources } from './cleanup.js';
import { createSite, launch, root } from './environment.js';
import { runControlled } from './scenarios.js';

const verdict = (evidence) => {
  if (evidence.toolError || evidence.cleanup.errors.length > 0) return 'ERROR';
  if (evidence.scenarios.some((scenario) => scenario.verdict === 'FAIL')) return 'FAIL';
  if (evidence.scenarios.some((scenario) => scenario.verdict === 'BLOCKED')) return 'BLOCKED';
  return evidence.scenarios.length > 0 ? 'PASS' : 'ERROR';
};
const sourceHashes = async (site, workers) => {
  const hashes = {};
  for (const name of ['hub.worker.ts', 'state-machine.shared-worker.ts']) {
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
    state.browser = await launch(path.join(state.scratch, 'profile'), offline);
    evidence.browser = await state.browser.version();
    return state.browser;
  };
  const { mode } = evidence;
  if (mode === 'cache') return runCache(restart, state.site.origin, evidence, directory);
  const browser = await restart(mode === 'entry');
  if (mode === 'controlled') return runControlled(browser, state.site.origin, evidence);
  return runEntry(browser, state.site.origin, evidence, directory);
};

export const verifyBrowser = async ({ mode, directory, baseline }) => {
  await mkdir(directory, { recursive: false });
  const scratch = await mkdtemp(path.join(tmpdir(), 'browser-verification-'));
  const state = { scratch };
  const evidence = {
    mode,
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceChanges: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
    inferenceVerified: false,
    started: new Date().toISOString(),
    scenarios: [],
    events: [],
  };
  try {
    state.site = await createSite(scratch, mode, evidence);
    evidence.origin = state.site.origin;
    evidence.sourceHashes = await sourceHashes(state.site, evidence.workerMap);
    evidence.migrationScenarios = JSON.parse(
      await readFile(new URL('migration-scenarios.json', import.meta.url), 'utf8'),
    ).map((scenario) => ({
      ...scenario,
      verdict: 'BLOCKED',
      ownerTicket: '20261029-193942',
      reason: 'Future architecture is not implemented on this revision',
    }));
    await exercise(state, evidence, directory);
  } catch (error) {
    evidence.toolError = error.stack;
  } finally {
    evidence.cleanup = await closeResources(state);
    evidence.finished = new Date().toISOString();
    evidence.verdict = verdict(evidence);
    await writeFile(path.join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2));
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
