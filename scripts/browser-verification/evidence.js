import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const defaultEvidenceDirectory = (root, mode) =>
  path.join(
    root,
    'artifacts/verification',
    `${mode}-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID()}`,
  );

const verdict = (evidence) => {
  if (evidence.toolError || evidence.cleanup.errors.length > 0) return 'ERROR';
  if (evidence.scenarios.some((scenario) => scenario.verdict === 'FAIL')) return 'FAIL';
  if (evidence.scenarios.some((scenario) => scenario.verdict === 'BLOCKED')) return 'BLOCKED';
  return evidence.scenarios.length > 0 ? 'PASS' : 'ERROR';
};
const checkArtifact = async (directory, name) => {
  const file = path.resolve(directory, name);
  if (!file.startsWith(`${path.resolve(directory)}${path.sep}`))
    throw new Error('Artifact must be inside the evidence directory');
  const details = await stat(file);
  if (!details.isFile() || details.size === 0) throw new Error('Artifact is not a nonempty file');
  await access(file, constants.R_OK);
};
export const finalizeEvidence = async (directory, evidence) => {
  evidence.artifacts = [...new Set(['evidence.json', ...evidence.artifacts])];
  evidence.skippedChecks = evidence.scenarios
    .filter((scenario) => scenario.verdict === 'BLOCKED')
    .map((scenario) => ({
      name: scenario.name,
      reason: scenario.reason ?? 'Required prerequisites are unavailable',
    }));
  evidence.cleanup.evidenceRetained = false;
  evidence.verdict = 'ERROR';
  await writeFile(path.join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const failures = [];
  for (const name of evidence.artifacts) {
    try {
      await checkArtifact(directory, name);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  }
  evidence.cleanup.errors.push(...failures);
  evidence.cleanup.evidenceRetained = failures.length === 0;
  evidence.verdict = verdict(evidence);
  await writeFile(path.join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2));
};
