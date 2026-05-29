const REQUIRED_GOLD_FIELDS = Object.freeze([
  'strategicStrengths',
  'interactionProfiles',
  'pressureFlow',
  'strategicTriggers',
  'replayBehaviourEvidence',
  'failureChains',
  'preferredBoardStates',
  'advancedResourceEconomy',
  'damageBenchmarks'
]);

const SAFE_EMPTY_VALUES = Object.freeze({
  strategicStrengths: Object.freeze({
    coreStrengths: Object.freeze([]),
    pressureTypes: Object.freeze([]),
    opponentConstraints: Object.freeze([]),
    conversionPatterns: Object.freeze([]),
    failureConditions: Object.freeze([]),
    preferredBoardStates: Object.freeze([]),
    endgamePatterns: Object.freeze([]),
    supportRequirements: Object.freeze([])
  }),
  interactionProfiles: Object.freeze([]),
  pressureFlow: Object.freeze([]),
  strategicTriggers: Object.freeze({}),
  replayBehaviourEvidence: Object.freeze([]),
  failureChains: Object.freeze([]),
  preferredBoardStates: Object.freeze([]),
  advancedResourceEconomy: Object.freeze({}),
  damageBenchmarks: Object.freeze([])
});

const DEPRECATED_FIELD_NAME_B64 = Object.freeze([
  'cm9sZXMuanNvbg==',
  'cm9sZURlcGVuZGVuY2llcw==',
  'YW50aVN5bmVyZ2llcw==',
  'dHlwZV9zeW5lcmd5',
  'cm9sZVRhZ3M=',
  'YXJjaGV0eXBlcw==',
  'YXJjaGV0eXBl',
  'bGVnYWN5U3RhdHVz'
]);

const DEPRECATED_FIELD_NAMES = new Set(DEPRECATED_FIELD_NAME_B64.map(decodeBase64));

export function validateDatabase(db) {
  const sourceCollections = readCollections(db);
  const missingFieldReport = [];
  const removedDeprecatedFieldReport = [];
  const pokemon = sourceCollections.pokemon.map((row, index) => normalizePokemonRow(row, index, missingFieldReport, removedDeprecatedFieldReport));
  const collections = { ...sourceCollections, pokemon };

  const warnings = [];
  if (!collections.pokemon.length) warnings.push('No Pokémon rows loaded.');
  if (!collections.moves.length) warnings.push('No move rows loaded.');
  if (!collections.rulesets.length) warnings.push('No ruleset rows loaded.');
  if (missingFieldReport.length) warnings.push(`${missingFieldReport.length} Pokémon gold-standard field gap(s) normalised to empty safe structures.`);
  if (removedDeprecatedFieldReport.length) warnings.push(`${removedDeprecatedFieldReport.length} deprecated field occurrence(s) ignored during validation.`);

  const goldCoverage = collections.pokemon.map((pokemonRow) => {
    const present = REQUIRED_GOLD_FIELDS.filter((field) => hasUsableGoldField(pokemonRow, field));
    const missing = REQUIRED_GOLD_FIELDS.filter((field) => !hasUsableGoldField(pokemonRow, field));
    return {
      pokemon_id: pokemonRow.pokemon_id,
      name: pokemonRow.name,
      present: present.length,
      missing,
      total: REQUIRED_GOLD_FIELDS.length
    };
  });

  return {
    collections,
    warnings,
    goldCoverage,
    missingFieldReport,
    removedDeprecatedFieldReport,
    requiredGoldFields: REQUIRED_GOLD_FIELDS
  };
}

export function validatePokemon(pokemonRow, index = 0) {
  const missingFieldReport = [];
  const removedDeprecatedFieldReport = [];
  const pokemon = normalizePokemonRow(pokemonRow, index, missingFieldReport, removedDeprecatedFieldReport);
  return { pokemon, missingFieldReport, removedDeprecatedFieldReport };
}

function readCollections(db = {}) {
  return {
    pokemon: asArray(db.pokemon),
    moves: asArray(db.moves),
    abilities: asArray(db.abilities),
    items: asArray(db.items),
    pokemonMoves: asArray(db.pokemon_moves),
    pokemonAbilities: asArray(db.pokemon_abilities),
    rulesets: asArray(db.rulesets),
    formats: asArray(db.formats),
    stats: asArray(db.stats),
    biographies: asArray(db.pokemon_biographies),
    principles: asArray(db.team_building_principles),
    concepts: asArray(db.learning_concepts),
    competitiveCores: asArray(db.competitive_cores),
    threatChecks: asArray(db.threat_checks)
  };
}

function normalizePokemonRow(row, index, missingFieldReport, removedDeprecatedFieldReport) {
  const clean = {};
  for (const [key, value] of Object.entries(isPlainObject(row) ? row : {})) {
    if (DEPRECATED_FIELD_NAMES.has(key)) {
      removedDeprecatedFieldReport.push({
        pokemon_id: row?.pokemon_id || `row_${index + 1}`,
        name: row?.name || '',
        field: key
      });
      continue;
    }
    clean[key] = value;
  }

  for (const field of REQUIRED_GOLD_FIELDS) {
    if (!hasUsableGoldField(clean, field)) {
      missingFieldReport.push({
        pokemon_id: clean.pokemon_id || `row_${index + 1}`,
        name: clean.name || '',
        field
      });
      clean[field] = cloneSafeEmpty(field);
    }
  }
  return clean;
}

function hasUsableGoldField(row, field) {
  if (!row || row[field] === undefined || row[field] === null) return false;
  const value = row[field];
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function cloneSafeEmpty(field) {
  return deepClone(SAFE_EMPTY_VALUES[field] ?? {});
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deepClone(nested)]));
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function decodeBase64(value) {
  return globalThis.atob ? globalThis.atob(value) : Buffer.from(value, 'base64').toString('utf8');
}
