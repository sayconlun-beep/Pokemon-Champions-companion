import { getReadablePokemonName } from '../utils/displayNames.js';
export const ATTACKING_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy'
];

export const TYPE_EFFECTIVENESS = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 }
};

export function calculateWeaknessCoverageProfile(team = [], data = {}) {
  const members = normaliseTeamMembers(team, data);

  return ATTACKING_TYPES.map((attackingType) => {
    const memberResults = members.map(({ slot, pokemon }) => {
      const multiplier = calculateDefensiveMultiplier(attackingType, getPokemonTypes(slot, pokemon));
      return {
        pokemonId: slot?.pokemon_id || pokemon?.pokemon_id || pokemon?.id || '',
        pokemonName: getReadablePokemonName(pokemon || { pokemon_id: slot?.pokemon_id }, 'Unknown Pokémon'),
        multiplier,
        relation: multiplier === 0 ? 'immune' : multiplier > 1 ? 'weak' : multiplier < 1 ? 'resist' : 'neutral'
      };
    });

    const weakCount = memberResults.filter((entry) => entry.relation === 'weak').length;
    const resistCount = memberResults.filter((entry) => entry.relation === 'resist').length;
    const immuneCount = memberResults.filter((entry) => entry.relation === 'immune').length;
    const defensiveAnswers = resistCount + immuneCount;

    return {
      attackingType,
      weakCount,
      resistCount,
      immuneCount,
      classification: classifyCoverage(weakCount, defensiveAnswers),
      memberResults
    };
  });
}

function classifyCoverage(weakCount, defensiveAnswers) {
  if (defensiveAnswers === 0 && weakCount >= 1) return 'Exposed';
  if (defensiveAnswers === 1) return 'Needs Attention';
  if (defensiveAnswers >= 2) return 'Covered';
  return 'Needs Attention';
}


export function calculateDefensiveMultiplier(attackingType, defendingTypes) {
  return defendingTypes.reduce((multiplier, defendingType) => {
    const typeMultiplier = TYPE_EFFECTIVENESS[attackingType]?.[defendingType] ?? 1;
    return multiplier * typeMultiplier;
  }, 1);
}

function normaliseTeamMembers(team, data) {
  const pokemonById = data?.indexes?.pokemonById || {};
  return (Array.isArray(team) ? team : [])
    .filter(Boolean)
    .map((slot) => {
      const pokemon = pokemonById[slot.pokemon_id] || slot.pokemon || slot;
      return pokemon ? { slot, pokemon } : null;
    })
    .filter(Boolean);
}

function getPokemonTypes(slot, pokemon) {
  const rawTypes = [
    slot?.typeOverride,
    slot?.type_1,
    slot?.type_2,
    slot?.type1,
    slot?.type2,
    pokemon?.type_1,
    pokemon?.type_2,
    pokemon?.type1,
    pokemon?.type2
  ];

  return [...new Set(rawTypes.flatMap(splitTypes).map(normaliseType).filter(Boolean))];
}

function splitTypes(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\/,&|]+/).map((entry) => entry.trim());
}

function normaliseType(value) {
  const clean = String(value || '').trim().toLowerCase();
  return ATTACKING_TYPES.find((type) => type.toLowerCase() === clean) || '';
}
