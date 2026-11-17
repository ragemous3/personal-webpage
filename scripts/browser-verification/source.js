import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const sourceSnapshot = (root) => {
  const files = execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n');
  const entries = [...new Set(files)]
    .filter(
      (file) =>
        /^(assets\/|static\/avatars\/|server\/|scripts\/|tests\/|config\/|package.*\.json$|tsconfig\.json$|eslint\.config\.js$)/.test(
          file,
        ) && existsSync(path.join(root, file)),
    )
    .toSorted()
    .map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(path.join(root, file)))
        .digest('hex'),
    ]);
  return {
    algorithm:
      'SHA-256 of sorted path/content-hash pairs for existing assets, server, scripts, tests, config and toolchain configuration',
    files: entries.length,
    digest: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  };
};
