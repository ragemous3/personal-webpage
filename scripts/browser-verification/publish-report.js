import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { root } from './environment.js';
import { sourceSnapshot } from './source.js';

const report = JSON.parse(process.env.LOCAL_VERIFICATION_REPORT);
if (report.sourceSnapshot?.digest !== sourceSnapshot(root).digest)
  throw new Error('Submitted verification report does not match the checked-out source digest');
if (!['PASS', 'FAIL', 'BLOCKED', 'ERROR'].includes(report.verdict))
  throw new Error('Submitted verification report has no recognized verdict');
const directory = path.join(root, 'artifacts/verification/submitted');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'local-report.json'), JSON.stringify(report, null, 2));
await writeFile(
  path.join(directory, 'provenance.json'),
  JSON.stringify(
    {
      origin: 'Submitted local browser run; not executed by this workflow',
      checkedOutRevision: process.env.GITHUB_SHA,
      matchingSourceDigest: report.sourceSnapshot.digest,
      originalSourceRevision: report.sourceRevision,
    },
    null,
    2,
  ),
);
