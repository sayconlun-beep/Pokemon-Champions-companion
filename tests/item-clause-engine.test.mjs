import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseItemClause,
  getItemUsageForSlot,
  firstLegalItemId,
  suggestLegalItemAlternatives
} from '../src/core/itemClauseEngine.js';

const data = {
  collections: {
    items: [
      { item_id: 'leftovers', name: 'Leftovers', is_legal: 'Yes', effect: 'Heal recovery each turn.' },
      { item_id: 'sitrus-berry', name: 'Sitrus Berry', is_legal: 'Yes', effect: 'Berry heal recovery.' },
      { item_id: 'choice-band', name: 'Choice Band', is_legal: 'Yes', effect: 'Boost physical damage.' },
      { item_id: 'banned-item', name: 'Banned Item', is_legal: 'No' }
    ]
  },
  indexes: {
    pokemonById: {
      p1: { name: 'Kangaskhan' },
      p2: { name: 'Milotic' },
      p3: { name: 'Raichu' }
    },
    itemsById: {
      leftovers: { item_id: 'leftovers', name: 'Leftovers', effect: 'Heal recovery each turn.' },
      'sitrus-berry': { item_id: 'sitrus-berry', name: 'Sitrus Berry', effect: 'Berry heal recovery.' },
      'choice-band': { item_id: 'choice-band', name: 'Choice Band', effect: 'Boost physical damage.' }
    }
  }
};

const team = [
  { pokemon_id: 'p1', item_id: 'leftovers' },
  { pokemon_id: 'p2', item_id: 'leftovers' },
  { pokemon_id: 'p3', item_id: 'choice-band' },
  null
];

test('detects duplicate held items and reports conflicting slots', () => {
  const result = analyseItemClause(team, data);
  assert.equal(result.legal, false);
  assert.equal(result.duplicates.length, 1);
  assert.deepEqual(result.duplicates[0].slots, [0, 1]);
  assert.deepEqual(result.duplicates[0].pokemonNames, ['Kangaskhan', 'Milotic']);
  assert.deepEqual([...result.conflictSlotIndexes].sort(), [0, 1]);
  assert.match(result.warnings[0], /Leftovers is duplicated by Kangaskhan and Milotic/);
});

test('returns slot-specific item usage against other slots', () => {
  const usage = getItemUsageForSlot(team, data, 0, 'leftovers');
  assert.equal(usage.usedByOtherSlot, true);
  assert.deepEqual(usage.otherSlots, [1]);
  assert.deepEqual(usage.otherPokemonNames, ['Milotic']);
});

test('selects first non-conflicting preferred item and suggests legal alternatives', () => {
  assert.equal(firstLegalItemId(['leftovers', 'sitrus-berry'], team, data, 2), 'sitrus-berry');
  const alternatives = suggestLegalItemAlternatives('leftovers', team, data, 0, 2);
  assert.deepEqual(alternatives.map((item) => item.item_id), ['sitrus-berry']);
});
