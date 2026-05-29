import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseTeamValidation,
  checkPokemonLegality,
  checkSlotLegality,
  checkTeamLegality,
  legalPokemon
} from '../src/core/legalityEngine.js';

function requiredProfile() {
  return {
    strategicStrengths: ['profiled'],
    interactionProfiles: ['profiled'],
    pressureFlow: ['profiled'],
    strategicTriggers: ['profiled'],
    replayBehaviourEvidence: ['profiled'],
    failureChains: ['profiled'],
    preferredBoardStates: ['profiled'],
    advancedResourceEconomy: ['profiled'],
    damageBenchmarks: ['profiled']
  };
}

const pokemon = [
  { pokemon_id: 'ninetales-a', name: 'Ninetales-Alola', champions_legal: 'Yes', type_1: 'Ice', type_2: 'Fairy', ...requiredProfile() },
  { pokemon_id: 'abomasnow', name: 'Abomasnow', champions_legal: 'Yes', type_1: 'Grass', type_2: 'Ice', ...requiredProfile() },
  { pokemon_id: 'kangaskhan', name: 'Kangaskhan', champions_legal: 'Yes', type_1: 'Normal', ...requiredProfile() },
  { pokemon_id: 'banned', name: 'Bannedmon', champions_legal: 'No', type_1: 'Fire', ...requiredProfile() }
];
const moves = [
  { move_id: 'aurora-veil', name: 'Aurora Veil', priority: 0 },
  { move_id: 'tailwind', name: 'Tailwind', priority: 0 },
  { move_id: 'trick-room', name: 'Trick Room', priority: -7 },
  { move_id: 'fake-out', name: 'Fake Out', priority: 3 }
];
const abilities = [
  { ability_id: 'snow-warning', name: 'Snow Warning' },
  { ability_id: 'inner-focus', name: 'Inner Focus' }
];
const items = [
  { item_id: 'light-clay', name: 'Light Clay', effect: 'Extends screens.' },
  { item_id: 'leftovers', name: 'Leftovers', effect: 'Recovery.' }
];
const data = {
  collections: { pokemon, moves, abilities, items, rulesets: [{ pokemon_id: 'banned', is_legal: 'No', reason: 'Test ban.' }] },
  indexes: {
    pokemonById: Object.fromEntries(pokemon.map((row) => [row.pokemon_id, row])),
    movesById: Object.fromEntries(moves.map((row) => [row.move_id, row])),
    abilitiesById: Object.fromEntries(abilities.map((row) => [row.ability_id, row])),
    itemsById: Object.fromEntries(items.map((row) => [row.item_id, row]))
  }
};

test('checks Pokémon availability against active data and rulesets', () => {
  assert.equal(checkPokemonLegality(data.indexes.pokemonById['ninetales-a'], data).allowed, true);
  const banned = checkPokemonLegality(data.indexes.pokemonById.banned, data);
  assert.equal(banned.allowed, false);
  assert.match(banned.reason, /Unavailable|Test ban/);
  assert.deepEqual(legalPokemon(data).map((row) => row.pokemon_id), ['ninetales-a', 'abomasnow', 'kangaskhan']);
});

test('checks slot warnings for unknown selected catalogue entries and missing profile fields', () => {
  const result = checkSlotLegality({ pokemon_id: 'ninetales-a', moves: ['aurora-veil', 'missing-move'], ability_id: 'missing-ability', item_id: 'missing-item' }, data);
  assert.equal(result.allowed, false);
  assert.ok(result.warnings.some((warning) => warning.includes('Unknown move selected')));
  assert.ok(result.warnings.some((warning) => warning.includes('Unknown ability selected')));
  assert.ok(result.warnings.some((warning) => warning.includes('Unknown item selected')));
  assert.deepEqual(result.missing, []);
});

test('reports strategic team validation strengths and conflicts', () => {
  const snowTeam = [
    { pokemon_id: 'ninetales-a', moves: ['aurora-veil'], ability_id: 'snow-warning', item_id: 'light-clay' },
    { pokemon_id: 'abomasnow', moves: ['fake-out'], ability_id: 'snow-warning', item_id: 'leftovers' },
    { pokemon_id: 'kangaskhan', moves: ['fake-out', 'trick-room', 'tailwind'], ability_id: 'inner-focus' }
  ];
  const validation = analyseTeamValidation(snowTeam, data);
  assert.ok(validation.strengths.some((issue) => issue.code.startsWith('snow-aurora-veil')));
  assert.ok(validation.strengths.some((issue) => issue.code === 'stacked-fake-out'));
  assert.ok(validation.errors.some((issue) => issue.code === 'trick-room-tailwind-compete'));

  const teamLegality = checkTeamLegality(snowTeam, data);
  assert.equal(teamLegality.allowed, false);
  assert.ok(teamLegality.warnings.some((warning) => warning.includes('Trick Room and Tailwind')));
});
