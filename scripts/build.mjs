import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// -----------------------------------------------------------------------------
// Split data production build
// -----------------------------------------------------------------------------
// public/db.json remains in the repo as a build input for regenerating the
// split public/data/*.json files. It must not be copied into dist/ or requested
// by the production runtime.
//
// Some top-level collections exist only to support dev, debug, audit, and
// data-validation workflows. The production app reads the split files under
// /data/*.json, so those dev-only standalone split files are excluded from dist/
// unless KEEP_DEV_BLOBS=1 is set for local inspection.
//
// If you add another dev-only top-level collection in the future, list its
// key here. Per-Pokémon fields like `replayBehaviourEvidence` (camelCase) are
// a different thing — they live inside each pokemon row and ARE consumed by
// the strategy/analysis engines. Do not confuse the two.
const DEV_ONLY_DB_KEYS = ['validationReports', 'replay_behaviour_evidence'];
const KEEP_DEV_BLOBS = process.env.KEEP_DEV_BLOBS === '1';
// -----------------------------------------------------------------------------

const COLLECTION_SPLIT_KEYS = Object.freeze([
  'pokemon',
  'moves',
  'items',
  'abilities',
  'pokemon_moves',
  'pokemon_abilities',
  'rulesets',
  'formats',
  'stats',
  'pokemon_biographies',
  'team_building_principles',
  'learning_concepts',
  'archetypes',
  'competitive_cores',
  'threat_checks',
  'pro_teams'
]);
const CORE_COLLECTION_KEYS = Object.freeze([
  'version',
  'pokemon_abilities',
  'rulesets',
  'formats',
  'stats',
  'pokemon_biographies',
  'team_building_principles',
  'learning_concepts',
  'archetypes',
  'competitive_cores',
  'threat_checks',
  'pro_teams'
]);

await splitPublicDatabase();

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

// Copy runtime assets from public/ into dist/ — except db.json.
// public/db.json is a build input only; production data comes from the split
// /data/*.json files copied from public/data/.
//
// Developer QA artifacts are intentionally kept in the repo/public tree for
// local inspection, but they must not be published with the production bundle.
// This prevents internal validation state from being reachable on the deployed
// site while preserving local/CI report generation.
//
// We also exclude the standalone dev-only data files (replay_behaviour_evidence.json,
// validationReports.json) when they happen to exist as separate files in public/data/.
// The split-data path doesn't write these unless KEEP_DEV_BLOBS=1, but historical
// versions of the data directory may still ship them through the recursive cp.
const PUBLIC_BUILD_EXCLUDES = [
  /[/\\]db\.json$/,
  /[/\\]data[/\\]audits[/\\]/,
  /[/\\]data[/\\]strategic_profiles[/\\]/,
  /[/\\](?:generated-strategic-data-validation-report|champions-confirmation-status-report)(?:\.strict|\.strict\.latest|\.latest)?\.json$/,
  // Dev-only top-level collections that may exist as standalone files under public/data/.
  // Mirrors DEV_ONLY_DB_KEYS so the file form can't sneak past the db.json strip.
  ...(KEEP_DEV_BLOBS ? [] : [
    /[/\\]data[/\\]replay_behaviour_evidence\.json$/,
    /[/\\]data[/\\]validationReports\.json$/
  ])
];

await cp('public', 'dist', {
  recursive: true,
  filter: (src) => !PUBLIC_BUILD_EXCLUDES.some((pattern) => pattern.test(src))
});

if (existsSync('dist/db.json')) {
  throw new Error('dist/db.json must not be shipped. public/db.json is build input only.');
}
console.log('db.json: build input only; not copied to dist/.');

await cp('src', 'dist/src', { recursive: true });
let html = await readFile('index.html', 'utf8');
await writeFile('dist/index.html', html);
await writeFile('dist/404.html', html);
await writeFile('dist/_redirects', '/* /index.html 200\n');
for (const route of ['team-builder','analysis-desk','matchups','damage','metadex','learning-hub','import-export','data-quality']) {
  await mkdir(`dist/${route}`, { recursive: true });
  await writeFile(`dist/${route}/index.html`, html);
}
console.log('Built clean gold-standard rebuild into dist/');
if (!existsSync('dist/data/core.json')) throw new Error('dist/data/core.json missing');
if (!existsSync('dist/data/pokemon_moves.json')) throw new Error('dist/data/pokemon_moves.json missing');


async function splitPublicDatabase() {
  const db = await readJson('public/db.json', 'public/db.json');
  await writeSplitCollections(db, 'public/data', { includeDevOnly: false });
}


async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

async function writeSplitCollections(db, outDir, { includeDevOnly = false } = {}) {
  await mkdir(outDir, { recursive: true });

  for (const key of COLLECTION_SPLIT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(db, key)) {
      await writeFile(`${outDir}/${key}.json`, JSON.stringify({ [key]: db[key] }));
    }
  }

  const core = {};
  for (const key of CORE_COLLECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(db, key)) core[key] = db[key];
  }
  await writeFile(`${outDir}/core.json`, JSON.stringify(core));

  const manifest = {
    source: 'split db.json',
    cacheVersion: 'split-data-blank-screen-fix-2026-05-25',
    startupCollections: ['core', 'pokemon', 'moves', 'items', 'abilities'],
    lazyCollections: ['pokemon_moves'],
    generatedAt: new Date().toISOString(),
    files: Object.fromEntries([...COLLECTION_SPLIT_KEYS, 'core'].map((key) => [key, `/data/${key}.json`]))
  };

  if (includeDevOnly) {
    for (const key of DEV_ONLY_DB_KEYS) {
      if (Object.prototype.hasOwnProperty.call(db, key)) {
        await writeFile(`${outDir}/${key}.json`, JSON.stringify({ [key]: db[key] }));
        manifest.files[key] = `/data/${key}.json`;
      }
    }
  }

  await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
}

