import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { assessObservations } from './report.js';

const { values } = parseArgs({
  options: {
    help: { type: 'boolean' },
    assess: { type: 'string' },
    mode: { type: 'string' },
    evidence: { type: 'string' },
    baseline: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.info(
    'Usage: npm run verify:browser -- --mode controlled|settings|entry|cache|performance|online [--evidence <new-directory>] [--baseline]\nDefault output: artifacts/verification/<unique-run-id>/\nOr: --assess <observations.json>',
  );
}
if (values.assess && !values.help) {
  const report = assessObservations(JSON.parse(readFileSync(values.assess, 'utf8')));
  console.info(JSON.stringify(report));
  process.exitCode = report.verdict === 'PASS' ? 0 : 1;
}

if (!values.assess && !values.help) {
  if (!['controlled', 'settings', 'entry', 'cache', 'performance', 'online'].includes(values.mode))
    throw new Error(
      'Use --mode controlled|settings|entry|cache|performance|online [--evidence <new-directory>] [--baseline], or --assess <observations.json>',
    );
  const { verifyBrowser } = await import('./browser.js');
  process.exitCode = await verifyBrowser({
    mode: values.mode,
    directory: values.evidence ? path.resolve(values.evidence) : undefined,
    baseline: values.baseline,
  });
}
