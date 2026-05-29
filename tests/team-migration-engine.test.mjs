import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteSavedTeam,
  exportTeam,
  getSavedTeamEntries,
  loadSavedTeamById,
  loadSavedTeams,
  migrateImportedTeam,
  migrateLegacyTeamToGoldStandard,
  renameSavedTeam,
  sanitizeTeam,
  saveTeam,
  updateSavedTeam
} from '../src/core/teamMigrationEngine.js';

function createStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null
  };
}

globalThis.localStorage = createStorage();

test('migrates legacy slot shapes into six clean gold-standard slots', () => {
  const migrated = migrateLegacyTeamToGoldStandard({ slots: [
    {
      pokemonId: 'PKMN_0038_ALOLA',
      moveIds: ['aurora-veil', 'blizzard', 'protect', 'moonblast', 'extra'],
      ability: 'snow-warning',
      item: 'light-clay',
      nature: 'Timid',
      EVs: { HP: 252, Spe: 252, SpA: 4 },
      IVs: { Atk: 0 },
      role: 'blocked legacy role',
      notes: 'Snow support'
    }
  ] });

  assert.equal(migrated.length, 6);
  assert.equal(migrated[0].pokemon_id, 'PKMN_0038_ALOLA');
  assert.deepEqual(migrated[0].moves, ['aurora-veil', 'blizzard', 'protect', 'moonblast']);
  assert.equal(migrated[0].ability_id, 'snow-warning');
  assert.equal(migrated[0].item_id, 'light-clay');
  assert.equal(migrated[0].role, undefined);
  assert.equal(migrated[0].notes, 'Snow support');
  assert.deepEqual(sanitizeTeam(migrated), migrated);
});

test('imports invalid JSON as an empty six-slot team and valid JSON as migrated slots', () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(migrateImportedTeam('not json'), [null, null, null, null, null, null]);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(migrateImportedTeam(JSON.stringify([{ speciesId: 'raichu' }]))[0].pokemon_id, 'raichu');
});

test('exports deterministic JSON with normalised EVs, IVs and calculated stats when data is available', () => {
  const data = {
    collections: {
      pokemon: [{ pokemon_id: 'PKMN_0038_ALOLA', name: 'Ninetales', baseStats: { hp: 73, attack: 67, defense: 75, specialAttack: 81, specialDefense: 100, speed: 109 } }]
    },
    indexes: { statsByPokemon: {} }
  };
  const parsed = JSON.parse(exportTeam([{ pokemon_id: 'PKMN_0038_ALOLA', evs: { Spe: 252 }, nature: 'Timid' }], data));
  assert.equal(parsed.version, 5);
  assert.equal(parsed.format, 'gold-standard-team');
  assert.equal(parsed.team[0].evs.speed, 252);
  assert.equal(parsed.team[0].calculatedStats.speed, 177);
});

test('saves, updates, renames, loads and deletes teams through localStorage', () => {
  localStorage.clear();
  const team = [{ pokemon_id: 'kangaskhan' }];
  const saved = saveTeam('Tempo Balance', team);
  assert.equal(saved.name, 'Tempo Balance');
  assert.equal(getSavedTeamEntries().length, 1);
  assert.equal(loadSavedTeamById(saved.id)[0].pokemon_id, 'kangaskhan');

  const updated = updateSavedTeam(saved.id, 'Tempo Balance Updated', [{ pokemon_id: 'milotic' }]);
  assert.equal(updated.name, 'Tempo Balance Updated');
  assert.equal(loadSavedTeamById(updated.id)[0].pokemon_id, 'milotic');

  const renamed = renameSavedTeam(updated.id, 'Snow Balance');
  assert.equal(renamed.name, 'Snow Balance');
  assert.equal(Object.keys(loadSavedTeams())[0], 'Snow Balance');

  const deleted = deleteSavedTeam(renamed.id);
  assert.equal(deleted.name, 'Snow Balance');
  assert.deepEqual(loadSavedTeams(), {});
});
