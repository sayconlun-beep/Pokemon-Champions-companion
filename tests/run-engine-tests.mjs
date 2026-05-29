import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'legality-engine.test.mjs',
  'stat-formula-engine.test.mjs',
  'mega-evolution-engine.test.mjs',
  'item-clause-engine.test.mjs',
  'team-migration-engine.test.mjs'
];

const results = [];
for (const file of files) {
  const fullPath = path.join(__dirname, file);
  const run = spawnSync(process.execPath, [fullPath], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  const passed = run.status === 0;
  results.push({ file, passed });
  process.stdout.write(`\n${passed ? 'PASS' : 'FAIL'} ${file}\n`);
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
}

const failed = results.filter((result) => !result.passed);
console.log('\nEngine test summary:');
for (const result of results) console.log(`- ${result.passed ? 'PASS' : 'FAIL'} ${result.file}`);
if (failed.length) process.exit(1);
