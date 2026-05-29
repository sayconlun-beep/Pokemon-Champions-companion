import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseTeamMegaState,
  buildMegaEvolutionIndex,
  candidateConflictsWithTeamMega,
  getMegaOptions,
  getMegaRequirement,
  getSlotMegaState,
  isMegaPokemon,
  isMegaStoneItem
} from '../src/core/megaEvolutionEngine.js';

const data = {
  collections: {
    pokemon: [
      { pokemon_id: 'charizard', name: 'Charizard' },
      { pokemon_id: 'mega-charizard-x', name: 'Mega Charizard X', base_species: 'Charizard', is_mega: 'Yes' },
      { pokemon_id: 'venusaur', name: 'Venusaur' },
      { pokemon_id: 'mega-venusaur', name: 'Mega Venusaur', base_species: 'Venusaur', is_mega: 'Yes' },
      { pokemon_id: 'raichu', name: 'Raichu' }
    ],
    items: [
      { item_id: 'charizardite-x', name: 'Charizardite X', effect: 'Allows Charizard to Mega Evolve.' },
      { item_id: 'venusaurite', name: 'Venusaurite', effect: 'Allows Venusaur to Mega Evolve.' },
      { item_id: 'white-herb', name: 'White Herb', effect: 'Restores lowered stats.' }
    ]
  }
};

data.indexes = {
  pokemonById: Object.fromEntries(data.collections.pokemon.map((pokemon) => [pokemon.pokemon_id, pokemon])),
  itemsById: Object.fromEntries(data.collections.items.map((item) => [item.item_id, item]))
};

test('indexes base forms, mega forms and mega stones', () => {
  const index = buildMegaEvolutionIndex(data);
  assert.equal(isMegaPokemon(data.indexes.pokemonById['mega-charizard-x']), true);
  assert.equal(isMegaStoneItem(data.indexes.itemsById['charizardite-x']), true);
  assert.equal(isMegaStoneItem(data.indexes.itemsById['white-herb']), false);
  assert.equal(index.byBaseId.get('charizard')[0].requiredItemId, 'charizardite-x');
  assert.equal(getMegaOptions('charizard', data)[0].megaPokemonId, 'mega-charizard-x');
  assert.equal(getMegaRequirement('mega-charizard-x', data).requiredItemName, 'Charizardite X');
});

test('classifies slot mega states for matching, wrong and direct mega-form cases', () => {
  assert.equal(getSlotMegaState({ pokemon_id: 'charizard', item_id: 'charizardite-x' }, data).status, 'preview-active');
  assert.equal(getSlotMegaState({ pokemon_id: 'charizard', item_id: 'venusaurite' }, data).status, 'wrong-stone');
  assert.equal(getSlotMegaState({ pokemon_id: 'mega-charizard-x', item_id: 'charizardite-x' }, data).status, 'mega-form-legal');
  assert.equal(getSlotMegaState({ pokemon_id: 'mega-charizard-x', item_id: 'venusaurite' }, data).status, 'mega-form-illegal');
});

test('detects team-level mega conflicts and candidate conflicts', () => {
  const team = [
    { pokemon_id: 'charizard', item_id: 'charizardite-x' },
    { pokemon_id: 'venusaur', item_id: 'venusaurite' }
  ];
  const state = analyseTeamMegaState(team, data);
  assert.equal(state.conflict, true);
  assert.equal(state.active.length, 2);
  assert.match(state.warnings[0], /Only one Mega Evolution is allowed/);
  assert.equal(candidateConflictsWithTeamMega({ pokemon_id: 'venusaur' }, [team[0]], data), true);
  assert.equal(candidateConflictsWithTeamMega({ pokemon_id: 'raichu' }, [team[0]], data), false);
});
