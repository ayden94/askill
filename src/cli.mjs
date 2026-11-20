#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { engine } from './engine.mjs';
import * as forge from './forge.mjs';
import { intake } from './intake.mjs';
import { excludeRuntimeState, openStore, projectRoot } from './store.mjs';

const intakeCommands = new Set(['init', 'scope', 'issues', 'create-lane']);
const engineCommands = new Set(['import-lane', 'plan', 'plan-all', 'record', 'run-ocr', 'publish-pr']);
const readOnlyCommands = new Set(['plan', 'plan-all']);

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      input: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command] = positionals;
  if (values.help || command === undefined) {
    process.stdout.write(
      `Usage: askill <command> [--root <target-project>] [--input <json-file|->]\n\n`
      + `Commands: ${[...intakeCommands, ...engineCommands].join(', ')}\n`
      + 'Use --input - to read one JSON object from stdin.\n',
    );
    return;
  }
  if (positionals.length !== 1 || (!intakeCommands.has(command) && !engineCommands.has(command))) {
    throw new TypeError('Expected exactly one known askill command');
  }
  const args = values.input === undefined ? {} : JSON.parse(readFileSync(values.input === '-' ? 0 : values.input, 'utf8'));
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new TypeError('Command input must be a JSON object');
  }
  const root = projectRoot(values.root ?? process.cwd());
  const store = openStore(root);
  const handler = intakeCommands.has(command) ? intake : engine;
  const call = async () => {
    const result = await handler(command, { root, store, forge }, args);
    if (command === 'init') {
      excludeRuntimeState(root);
    }
    return result;
  };
  print(readOnlyCommands.has(command) ? await call() : await store.transaction(call));
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
