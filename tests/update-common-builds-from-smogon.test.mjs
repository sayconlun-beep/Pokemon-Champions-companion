import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const fixture = path.join(root, 'tests', 'fixtures', 'smogon-common-builds.fixture.json');

test('offline Smogon common-build update fixture is optional and never performs network work', { skip: !fs.existsSync(fixture) ? 'skipped: no fixture' : false }, () => {
  const run = spawnSync(process.execPath, ['scripts/update-common-builds-from-smogon.mjs', '--input', fixture, '--month', '2026-04', '--format', 'gen9championsvgc2026regma', '--rating', '1760'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SMOGON_STATS_URL: '' }
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});
