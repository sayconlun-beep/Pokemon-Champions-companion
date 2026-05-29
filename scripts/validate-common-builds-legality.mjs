import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');

function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function unwrapDataset(value, key) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[key])) return value[key];
  throw new Error(`Expected ${key} to be an array or wrapped array in dataset`);
}

function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

function flattenBuilds(commonBuilds) {
  if (!commonBuilds) return [];
  if (Array.isArray(commonBuilds)) return commonBuilds;
  if (typeof commonBuilds !== 'object') return [];
  return Object.entries(commonBuilds).flatMap(([groupName, groupValue]) => {
    if (Array.isArray(groupValue)) return groupValue.map((build) => ({ ...build, buildGroup: groupName }));
    if (groupValue && typeof groupValue === 'object') return [{ ...groupValue, buildGroup: groupName }];
    return [];
  });
}

function closest(value, allowedNames) {
  const wanted = normalise(value);
  if (!wanted) return null;
  let best = null;
  let bestScore = 0;
  for (const name of allowedNames) {
    const candidate = normalise(name);
    if (!candidate) continue;
    let score = 0;
    if (candidate === wanted) score = 100;
    else if (candidate.includes(wanted) || wanted.includes(candidate)) score = 70;
    else {
      const wantedParts = new Set(wanted.split(' '));
      const candidateParts = candidate.split(' ');
      score = candidateParts.filter((part) => wantedParts.has(part)).length * 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return bestScore >= 40 ? best : null;
}

const pokemon = unwrapDataset(readJson('public/data/pokemon.json'), 'pokemon');
const moves = unwrapDataset(readJson('public/data/pokemon_moves.json'), 'pokemon_moves');
const abilities = unwrapDataset(readJson('public/data/pokemon_abilities.json'), 'pokemon_abilities');
const items = unwrapDataset(readJson('public/data/items.json'), 'items');

const legalStatuses = new Set(['yes', 'needs review']);
const itemNames = new Map(items.map((item) => [normalise(item.name), item.name]));

const movesByPokemon = new Map();
for (const move of moves) {
  const pid = move.pokemon_id;
  if (!movesByPokemon.has(pid)) movesByPokemon.set(pid, new Map());
  movesByPokemon.get(pid).set(normalise(move.move_name), move);
}

const abilitiesByPokemon = new Map();
for (const ability of abilities) {
  const pid = ability.pokemon_id;
  if (!abilitiesByPokemon.has(pid)) abilitiesByPokemon.set(pid, new Map());
  abilitiesByPokemon.get(pid).set(normalise(ability.ability_name), ability);
}

const allMoveNames = [...new Set(moves.map((move) => move.move_name).filter(Boolean))];
const allAbilityNames = [...new Set(abilities.map((ability) => ability.ability_name).filter(Boolean))];
const allItemNames = [...new Set(items.map((item) => item.name).filter(Boolean))];

const errors = [];
const confirmationGaps = [];
const checkedRegionalForms = new Set();
let buildCount = 0;
let pokemonWithBuilds = 0;

function pushError(pokemonRow, build, field, value, message, suggestion = null) {
  errors.push({
    pokemon_id: pokemonRow.pokemon_id,
    pokemon_name: pokemonRow.name,
    build_name: build.name || build.buildId || build.buildGroup || 'Unnamed commonBuild',
    field,
    value,
    message,
    suggestion,
  });
}

function noteGap(pokemonRow, build, field, value, status) {
  confirmationGaps.push({
    pokemon_id: pokemonRow.pokemon_id,
    pokemon_name: pokemonRow.name,
    build_name: build.name || build.buildId || build.buildGroup || 'Unnamed commonBuild',
    field,
    value,
    status,
  });
}

for (const pokemonRow of pokemon) {
  const builds = flattenBuilds(pokemonRow.commonBuilds);
  if (!builds.length) continue;
  pokemonWithBuilds += 1;
  if (String(pokemonRow.is_regional_or_alt || '').toLowerCase() === 'yes' || /_ALOLA|_HISUI|_GALAR|_PALDEA/.test(pokemonRow.pokemon_id || '')) {
    checkedRegionalForms.add(pokemonRow.pokemon_id);
  }

  const pid = pokemonRow.pokemon_id;
  const moveMap = movesByPokemon.get(pid) || new Map();
  const abilityMap = abilitiesByPokemon.get(pid) || new Map();

  for (const build of builds) {
    buildCount += 1;
    const itemOptions = [
      ...asList(build.item),
      ...asList(build.itemOptions),
      ...asList(build.items),
    ];
    for (const itemName of itemOptions) {
      if (!itemNames.has(normalise(itemName))) {
        pushError(pokemonRow, build, 'item', itemName, 'Item does not exist in items.json.', closest(itemName, allItemNames));
      }
    }

    const buildMoves = [
      ...asList(build.move),
      ...asList(build.moves),
      ...asList(build.coreMoves),
      ...asList(build.commonMoves),
      ...asList(build.commonFourthMoves),
      ...asList(build.optionalMoves),
      ...asList(build.moveOptions),
    ];
    for (const moveName of buildMoves) {
      const move = moveMap.get(normalise(moveName));
      if (!move) {
        pushError(pokemonRow, build, 'move', moveName, 'Move is not present in this Pokémon/form-specific movepool.', closest(moveName, [...moveMap.values()].map((entry) => entry.move_name)) || closest(moveName, allMoveNames));
        continue;
      }
      if (!legalStatuses.has(normalise(move.is_legal))) {
        pushError(pokemonRow, build, 'move', moveName, `Move exists for this Pokémon/form but is not legal: ${move.is_legal || 'blank'}.`, null);
      } else if (normalise(move.is_legal) === 'needs review') {
        noteGap(pokemonRow, build, 'move', moveName, move.is_legal);
      }
    }

    const buildAbilities = [
      ...asList(build.ability),
      ...asList(build.abilities),
      ...asList(build.abilityOptions),
    ];
    for (const abilityName of buildAbilities) {
      const ability = abilityMap.get(normalise(abilityName));
      if (!ability) {
        pushError(pokemonRow, build, 'ability', abilityName, 'Ability is not present in this Pokémon/form-specific ability list.', closest(abilityName, [...abilityMap.values()].map((entry) => entry.ability_name)) || closest(abilityName, allAbilityNames));
        continue;
      }
      if (!legalStatuses.has(normalise(ability.is_legal))) {
        pushError(pokemonRow, build, 'ability', abilityName, `Ability exists for this Pokémon/form but is not legal: ${ability.is_legal || 'blank'}.`, null);
      } else if (normalise(ability.is_legal) === 'needs review') {
        noteGap(pokemonRow, build, 'ability', abilityName, ability.is_legal);
      }
    }
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  pokemonWithBuilds,
  commonBuildsChecked: buildCount,
  regionalFormsChecked: [...checkedRegionalForms].sort(),
  errorCount: errors.length,
  confirmationGapCount: confirmationGaps.length,
  errors,
  confirmationGaps,
};

const outDir = path.join(ROOT, 'reports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'common-builds-legality-report.json'), JSON.stringify(report, null, 2));

if (errors.length) {
  console.error(`Strict commonBuilds legality validation failed with ${errors.length} error(s).`);
  for (const error of errors.slice(0, 50)) {
    console.error(`- ${error.pokemon_id} ${error.pokemon_name} | ${error.build_name} | ${error.field}: "${error.value}" — ${error.message}${error.suggestion ? ` Suggested fix: ${error.suggestion}` : ''}`);
  }
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more. See reports/common-builds-legality-report.json`);
  process.exit(1);
}

console.log(`Strict commonBuilds legality validation passed: ${buildCount} build(s) across ${pokemonWithBuilds} Pokémon/form(s).`);
console.log(`Regional/alt forms included: ${checkedRegionalForms.size ? [...checkedRegionalForms].sort().join(', ') : 'none with commonBuilds found'}.`);
if (confirmationGaps.length) {
  console.log(`Confirmation gaps kept legal but reported separately: ${confirmationGaps.length}. See reports/common-builds-legality-report.json`);
}
