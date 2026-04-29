import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { parseSync } from 'oxc-parser';

const files = [...globSync('assets/**/*.ts'), ...globSync('scripts/create-index/src/**/*.ts')];

console.log(`Checking ${files.length} files...\n`);

for (const file of files) {
  try {
    const source = readFileSync(file, 'utf8');

    console.log(`OK? ${file}`);

    parseSync(file, source);

    console.log(`OK  ${file}`);
  } catch (error) {
    console.error(`\nCRASHED ON: ${file}`);
    console.error(error);
    process.exit(1);
  }
}

console.log('\nAll files parsed successfully.');
