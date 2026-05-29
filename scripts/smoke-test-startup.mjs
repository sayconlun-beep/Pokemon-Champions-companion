// Headless smoke test: simulate what mountApp does on first paint.
// We can't run the browser-only modules (they use window/document) but we
// CAN exercise the data loader and the validator, which is where startup
// failures most often hide.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distData = path.join(repoRoot, 'dist', 'data');
const publicData = path.join(repoRoot, 'public', 'data');

console.log('=== Smoke test: startup data load ===\n');

const checkDist = fs.existsSync(distData);
const dirs = checkDist ? [['public', publicData], ['dist', distData]] : [['public', publicData]];
if (!checkDist) {
  console.log('(Note: dist/ not present — run `npm run build` to also validate the built artifact.)\n');
}

// Step 1: confirm all startup files exist in the dirs we are checking.
const startupCollections = ['core', 'pokemon', 'moves', 'items', 'abilities'];
let failed = false;
for (const name of startupCollections) {
  for (const [label, dir] of dirs) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) {
      console.error(`✗ ${label}/data/${name}.json is MISSING`);
      failed = true;
    } else {
      const size = fs.statSync(file).size;
      console.log(`✓ ${label}/data/${name}.json present (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

if (failed) {
  console.error('\nCannot continue: required startup data files missing.');
  process.exit(1);
}

// Step 2: load + merge startup files the way dataLoader.js does.
const sourceLabel = checkDist ? 'dist' : 'public';
const sourceDir = checkDist ? distData : publicData;
console.log(`\n=== Merge startup payloads (${sourceLabel}) ===\n`);
const merged = {};
for (const name of startupCollections) {
  const payload = JSON.parse(fs.readFileSync(path.join(sourceDir, `${name}.json`), 'utf8'));
  if (Array.isArray(payload)) {
    console.log(`! ${name}.json is a bare array (loader expects { [name]: [...] } or merged keys)`);
  } else {
    const keys = Object.keys(payload);
    console.log(`  ${name}.json merged keys: ${keys.join(', ')}`);
    Object.assign(merged, payload);
  }
}

console.log('\nMerged db top-level keys:', Object.keys(merged).join(', '));

// Step 3: run the actual schemaValidator on the merged payload.
console.log('\n=== Run schemaValidator on merged payload ===\n');
const validatorUrl = pathToFileURL(path.join(repoRoot, 'src', 'data', 'schemaValidator.js'));
const { validateDatabase } = await import(validatorUrl);

let validation;
try {
  validation = validateDatabase(merged);
  console.log(`✓ validateDatabase returned without throwing`);
  console.log(`  warnings: ${validation.warnings.length}`);
  for (const w of validation.warnings.slice(0, 5)) console.log(`    - ${w}`);
  if (validation.warnings.length > 5) console.log(`    … and ${validation.warnings.length - 5} more`);
  console.log(`  collections: ${Object.keys(validation.collections).join(', ')}`);
  console.log(`  pokemon rows: ${validation.collections.pokemon.length}`);
  console.log(`  moves rows: ${validation.collections.moves.length}`);
  console.log(`  items rows: ${validation.collections.items.length}`);
  console.log(`  abilities rows: ${validation.collections.abilities.length}`);
  console.log(`  rulesets rows: ${validation.collections.rulesets.length}`);
} catch (error) {
  console.error(`✗ validateDatabase THREW: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}

// Step 4: smoke-check createIndexes — most page handlers depend on indexes
// existing on data.indexes.pokemonById, data.indexes.itemsById, etc. If any
// of these indexes are empty/undefined, pages will silently render blank
// instead of erroring out (because lookup chains use optional chaining).
console.log('\n=== Smoke-check indexes ===\n');
const sampleIndexes = {
  pokemonById: validation.collections.pokemon.length > 0,
  itemsById: validation.collections.items.length > 0,
  abilitiesById: validation.collections.abilities.length > 0,
  movesById: validation.collections.moves.length > 0,
  statsByPokemon: validation.collections.stats.length > 0,
  rulesetsLoaded: validation.collections.rulesets.length > 0
};
for (const [k, ok] of Object.entries(sampleIndexes)) {
  console.log(`  ${ok ? '✓' : '✗'} ${k}: ${ok ? 'has data' : 'EMPTY (would cause blank-page renders)'}`);
}

// Step 5: do the same for public/ to compare (catches drift between source
// of truth and shipped artifacts). Only meaningful if dist exists.
if (checkDist) {
  console.log('\n=== Compare dist vs public ===\n');
  for (const name of startupCollections) {
    const distSize = fs.statSync(path.join(distData, `${name}.json`)).size;
    const publicSize = fs.statSync(path.join(publicData, `${name}.json`)).size;
    const drift = Math.abs(distSize - publicSize);
    if (drift === 0) {
      console.log(`  = ${name}.json identical (${(distSize / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  Δ ${name}.json drifted by ${(drift / 1024).toFixed(1)} KB (dist=${(distSize/1024).toFixed(1)}, public=${(publicSize/1024).toFixed(1)})`);
    }
  }
} else {
  console.log('\n(Skipping dist-vs-public drift comparison; dist not built.)');
}

console.log('\n=== Smoke test complete ===');
