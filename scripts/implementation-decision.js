#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

try {
  const { values, positionals } = parseArgs({
    options: {
      mode: { type: 'string' },
      list: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: true,
  });
  if (values.help) {
    console.log('Usage: node scripts/implementation-decision.js --mode guided|autopilot <decision-id>');
    console.log('       node scripts/implementation-decision.js --list');
  } else {
    const read = (name) =>
      JSON.parse(
        readFileSync(new URL(`../docs/implementation-modes/${name}.json`, import.meta.url), 'utf8'),
      );
    const decisions = read('decisions');
    if (
      !Array.isArray(decisions) ||
      decisions.length === 0 ||
      decisions.some((id) => typeof id !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(id)) ||
      new Set(decisions).size !== decisions.length
    ) {
      throw new Error('Invalid decision registry.');
    }
    if (values.list && !values.mode && positionals.length === 0) {
      console.log(decisions.join('\n'));
    } else {
      if (values.list || !['guided', 'autopilot'].includes(values.mode) || positionals.length !== 1) {
        throw new Error('Supply --mode guided|autopilot and one decision ID, or use --list.');
      }
      const [id] = positionals;
      if (!decisions.includes(id)) throw new Error(`Unknown decision ID: ${id}. Use --list.`);
      const instructions = read(values.mode);
      if (
        instructions === null ||
        typeof instructions !== 'object' ||
        Array.isArray(instructions) ||
        Object.entries(instructions).some(
          ([key, value]) =>
            !decisions.includes(key) || typeof value !== 'string' || value.trim().length === 0,
        )
      ) {
        throw new Error(`Invalid instruction map: ${values.mode}.`);
      }
      if (Object.hasOwn(instructions, id)) console.log(instructions[id]);
    }
  }
} catch (error) {
  console.error(`implementation-decision: ${error.message}`);
  process.exitCode = 2;
}
