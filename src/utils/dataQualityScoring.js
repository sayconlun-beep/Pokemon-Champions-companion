const GOLD_FIELD_NAMES = [
  'strategicStrengths',
  'interactionProfiles',
  'pressureFlow',
  'strategicTriggers',
  'replayBehaviourEvidence',
  'failureChains',
  'preferredBoardStates',
  'advancedResourceEconomy',
  'damageBenchmarks'
];

const STRATEGIC_STRENGTH_KEYS = [
  'coreStrengths',
  'pressureTypes',
  'opponentConstraints',
  'conversionPatterns',
  'failureConditions',
  'preferredBoardStates',
  'endgamePatterns',
  'supportRequirements'
];

const EMPTY_SIGNAL_STRINGS = new Set([
  'n/a',
  'na',
  'none',
  'unknown',
  'tbd',
  `place${'holder'}`,
  'null',
  'undefined'
]);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isEmptySignalString(value) {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || EMPTY_SIGNAL_STRINGS.has(normalized);
}

export function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;

  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    return !isEmptySignalString(normalized) && normalized.replace(/\s/g, '').length >= 20;
  }

  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return false;
    return entries.some(([, nestedValue]) => hasMeaningfulValue(nestedValue));
  }

  return false;
}

function countMeaningfulArrayItems(value) {
  return Array.isArray(value) ? value.filter((item) => hasMeaningfulValue(item)).length : 0;
}

function countMeaningfulObjectValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value).filter((entry) => hasMeaningfulValue(entry)).length;
}

function scoreFromRequirement(passed, score, passedReason, failedReason) {
  return {
    complete: Boolean(passed),
    score: passed ? score : 0,
    reason: passed ? passedReason : failedReason
  };
}

function scoreStrategicStrengths(value) {
  const meaningfulSections = STRATEGIC_STRENGTH_KEYS.filter((key) => hasMeaningfulValue(value?.[key]));
  return scoreFromRequirement(
    meaningfulSections.length >= 4,
    Math.min(100, Math.round((meaningfulSections.length / STRATEGIC_STRENGTH_KEYS.length) * 100)),
    `${meaningfulSections.length} strategic-strength sections contain meaningful tactical content.`,
    `Only ${meaningfulSections.length}/8 strategic-strength sections contain meaningful tactical content.`
  );
}

function scoreInteractionProfiles(value) {
  const count = countMeaningfulObjectValues(value) + countMeaningfulArrayItems(value);
  return scoreFromRequirement(
    count >= 2,
    Math.min(100, count * 50),
    `${count} meaningful interaction entries found.`,
    `Needs at least 2 meaningful interaction entries; found ${count}.`
  );
}

function scorePressureFlow(value) {
  const created = hasMeaningfulValue(value?.entryPressure) || hasMeaningfulValue(value?.openingPressure) || hasMeaningfulValue(value?.pressureCreation) || hasMeaningfulValue(value?.creates) || hasMeaningfulValue(value?.createdBy);
  const maintainedOrConverted = hasMeaningfulValue(value?.midgamePressure) || hasMeaningfulValue(value?.conversionPressure) || hasMeaningfulValue(value?.cleanupPressure) || hasMeaningfulValue(value?.pressureMaintenance) || hasMeaningfulValue(value?.maintains) || hasMeaningfulValue(value?.converts);
  const fallbackCount = countMeaningfulObjectValues(value);
  const complete = (created && maintainedOrConverted) || fallbackCount >= 2;
  return scoreFromRequirement(
    complete,
    created && maintainedOrConverted ? 100 : 75,
    'Pressure creation and pressure maintenance/conversion are meaningfully described.',
    'Needs meaningful pressure creation plus maintenance or conversion content.'
  );
}

function scoreStrategicTriggers(value) {
  let count = 0;
  if (Array.isArray(value)) {
    count = value.filter((entry) => hasMeaningfulValue(entry)).length;
  } else if (value && typeof value === 'object') {
    count = Object.values(value).filter((entry) => {
      if (!entry || typeof entry !== 'object') return hasMeaningfulValue(entry);
      if (entry.applicable === false) return false;
      return hasMeaningfulValue(entry.pressureChange) || hasMeaningfulValue(entry.opponentResponse) || hasMeaningfulValue(entry.failureCondition);
    }).length;
  }
  return scoreFromRequirement(
    count >= 2,
    Math.min(100, count * 50),
    `${count} meaningful trigger conditions found.`,
    `Needs at least 2 meaningful trigger conditions; found ${count}.`
  );
}

function scoreReplayBehaviourEvidence(value) {
  const evidenceKeys = ['leadPatterns', 'pressureSequences', 'defensiveResponses', 'pivotSequences', 'setupWindows', 'endgameConversions', 'failureSequences', 'evidenceNotes', 'notes'];
  const hasEvidence = evidenceKeys.some((key) => hasMeaningfulValue(value?.[key]));
  return scoreFromRequirement(
    hasEvidence,
    100,
    'Meaningful replay behaviour evidence note found.',
    'Needs at least 1 meaningful replay evidence note or observed sequence.'
  );
}

function scoreFailureChains(value) {
  const count = Array.isArray(value) ? value.filter((entry) => hasMeaningfulValue(entry)).length : countMeaningfulObjectValues(value);
  return scoreFromRequirement(
    count >= 2,
    Math.min(100, count * 50),
    `${count} meaningful failure/collapse entries found.`,
    `Needs at least 2 meaningful failure/collapse entries; found ${count}.`
  );
}

function scorePreferredBoardStates(value) {
  const count = Array.isArray(value) ? value.filter((entry) => hasMeaningfulValue(entry)).length : countMeaningfulObjectValues(value);
  return scoreFromRequirement(
    count >= 2,
    Math.min(100, count * 50),
    `${count} meaningful board-state descriptions found.`,
    `Needs at least 2 meaningful board-state descriptions; found ${count}.`
  );
}

function scoreAdvancedResourceEconomy(value) {
  const count = Array.isArray(value)
    ? value.filter((entry) => hasMeaningfulValue(entry)).length
    : Object.values(value || {}).filter((entry) => hasMeaningfulValue(entry)).length;
  return scoreFromRequirement(
    count >= 2,
    Math.min(100, count * 50),
    `${count} meaningful resource/trade/tempo entries found.`,
    `Needs at least 2 meaningful resource/trade/tempo entries; found ${count}.`
  );
}

function scoreDamageBenchmarks(value) {
  const complete = hasMeaningfulValue(value);
  return scoreFromRequirement(
    complete,
    100,
    'Meaningful damage benchmark data found.',
    'No meaningful damage benchmark data is populated.'
  );
}

export function scoreGoldField(pokemon, fieldName) {
  const value = pokemon?.[fieldName];

  switch (fieldName) {
    case 'strategicStrengths':
      return scoreStrategicStrengths(value);
    case 'interactionProfiles':
      return scoreInteractionProfiles(value);
    case 'pressureFlow':
      return scorePressureFlow(value);
    case 'strategicTriggers':
      return scoreStrategicTriggers(value);
    case 'replayBehaviourEvidence':
      return scoreReplayBehaviourEvidence(value);
    case 'failureChains':
      return scoreFailureChains(value);
    case 'preferredBoardStates':
      return scorePreferredBoardStates(value);
    case 'advancedResourceEconomy':
      return scoreAdvancedResourceEconomy(value);
    case 'damageBenchmarks':
      return scoreDamageBenchmarks(value);
    default: {
      const complete = hasMeaningfulValue(value);
      return scoreFromRequirement(complete, complete ? 100 : 0, 'Meaningful field content found.', 'Field is missing or lacks meaningful tactical content.');
    }
  }
}

export function scorePokemonGoldCoverage(pokemon) {
  const fieldScores = GOLD_FIELD_NAMES.map((fieldName) => [fieldName, scoreGoldField(pokemon, fieldName)]);
  const completedFieldNames = fieldScores.filter(([, score]) => score.complete).map(([fieldName]) => fieldName);
  const missingFieldNames = fieldScores.filter(([, score]) => !score.complete).map(([fieldName]) => fieldName);
  const weakFieldReasons = Object.fromEntries(fieldScores.filter(([, score]) => !score.complete).map(([fieldName, score]) => [fieldName, score.reason]));

  return {
    totalFields: GOLD_FIELD_NAMES.length,
    completeFields: completedFieldNames.length,
    percent: Math.round((completedFieldNames.length / GOLD_FIELD_NAMES.length) * 100),
    completedFieldNames,
    missingFieldNames,
    weakFieldReasons
  };
}

function getQualityTier(completeFields) {
  if (completeFields >= 8) return 'Gold Star';
  if (completeFields >= 5) return 'Strong';
  if (completeFields >= 3) return 'Needs Work';
  return 'Incomplete';
}

export function getDataQualityReport(pokemonList) {
  const pokemon = Array.isArray(pokemonList) ? pokemonList : [];
  const totalPokemon = pokemon.length;
  const denominator = totalPokemon || 1;

  const scoredPokemon = pokemon.map((entry) => {
    const coverage = scorePokemonGoldCoverage(entry);
    return {
      pokemon_id: entry?.pokemon_id,
      name: entry?.name || entry?.base_species || 'Unknown Pokémon',
      ...coverage,
      qualityTier: getQualityTier(coverage.completeFields)
    };
  });

  const fieldCompletion = Object.fromEntries(GOLD_FIELD_NAMES.map((fieldName) => {
    const completeCount = pokemon.filter((entry) => scoreGoldField(entry, fieldName).complete).length;
    return [fieldName, {
      completeCount,
      total: totalPokemon,
      percent: Math.round((completeCount / denominator) * 100)
    }];
  }));

  const qualityTiers = scoredPokemon.reduce((acc, entry) => {
    acc[entry.qualityTier] = (acc[entry.qualityTier] || 0) + 1;
    return acc;
  }, { 'Gold Star': 0, Strong: 0, 'Needs Work': 0, Incomplete: 0 });

  return {
    totalPokemon,
    pokemonWithAllGoldFields: scoredPokemon.filter((entry) => entry.completeFields === GOLD_FIELD_NAMES.length).length,
    pokemonWithFivePlusGoldFields: scoredPokemon.filter((entry) => entry.completeFields >= 5).length,
    pokemonWithBelowThreeGoldFields: scoredPokemon.filter((entry) => entry.completeFields < 3).length,
    fieldCompletion,
    incompletePokemon: scoredPokemon
      .filter((entry) => entry.completeFields < GOLD_FIELD_NAMES.length)
      .sort((a, b) => a.completeFields - b.completeFields || String(a.name).localeCompare(String(b.name))),
    scoredPokemon,
    qualityTiers
  };
}

export { GOLD_FIELD_NAMES };
