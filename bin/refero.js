#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((error) => {
  const hint = error.status === 401 ? ' Run `refero auth login` or set REFERO_TOKEN.' : '';
  process.stderr.write(`refero: ${error.message}.${hint}\n`);
  process.exitCode = 1;
});
