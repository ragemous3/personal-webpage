#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`../docs/implementation-modes/${name}.json`, import.meta.url), 'utf8'),
  );

const readDecisions = () => {
  const decisions = read('decisions');
  if (
    !Array.isArray(decisions) ||
    decisions.length === 0 ||
    decisions.some((id) => typeof id !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(id)) ||
    new Set(decisions).size !== decisions.length
  ) {
    throw new Error('Invalid decision registry.');
  }
  return decisions;
};

const readInstructions = (mode, decisions) => {
  const instructions = read(mode);
  if (
    instructions === null ||
    typeof instructions !== 'object' ||
    Array.isArray(instructions) ||
    Object.entries(instructions).some(
      ([key, value]) =>
        !decisions.includes(key) || typeof value !== 'string' || value.trim().length === 0,
    )
  ) {
    throw new Error(`Invalid instruction map: ${mode}.`);
  }
  return instructions;
};

const lookup = (values, positionals, decisions) => {
  if (values.list || !['guided', 'autopilot'].includes(values.mode) || positionals.length !== 1) {
    throw new Error('Supply --mode guided|autopilot and one decision ID, or use --list.');
  }
  const [id] = positionals;
  if (!decisions.includes(id)) throw new Error(`Unknown decision ID: ${id}. Use --list.`);
  const instructions = readInstructions(values.mode, decisions);
  if (Object.hasOwn(instructions, id)) console.info(instructions[id]);
};

const main = () => {
  const { values, positionals } = parseArgs({
    options: {
      mode: { type: 'string' },
      list: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: true,
  });
  if (values.help) {
    console.info(
      'Usage: node scripts/implementation-decision.js --mode guided|autopilot <decision-id>',
    );
    console.info('       node scripts/implementation-decision.js --list');
    return;
  }
  const decisions = readDecisions();
  if (values.list && !values.mode && positionals.length === 0) {
    console.info(decisions.join('\n'));
    return;
  }
  lookup(values, positionals, decisions);
};

try {
  main();
} catch (error) {
  console.error(`implementation-decision: ${error.message}`);
  process.exitCode = 2;
}
