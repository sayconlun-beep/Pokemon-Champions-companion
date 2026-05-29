import assert from 'node:assert/strict';
import {
  DEFAULT_LEVEL,
  normaliseEvs,
  normaliseIvs,
  buildCalculatedStatPoints,
  calculateFinalStat
} from '../src/core/statFormulaEngine.js';
import { exportTeamToShowdown, importTeamFromShowdown } from '../src/core/showdownFormatEngine.js';
import { exportTeam, migrateImportedTeam } from '../src/core/teamMigrationEngine.js';

const charizard = {
  pokemon_id: 'charizard',
  name: 'Charizard',
  baseStats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 }
};

const db = {
  collections: {
    pokemon: [charizard],
    items: [{ item_id: 'life-orb', name: 'Life Orb' }],
    abilities: [{ ability_id: 'blaze', name: 'Blaze' }],
    moves: [
      { move_id: 'flare-blitz', name: 'Flare Blitz' },
      { move_id: 'dragon-claw', name: 'Dragon Claw' },
      { move_id: 'protect', name: 'Protect' },
      { move_id: 'tailwind', name: 'Tailwind' }
    ]
  },
  indexes: {
    pokemonById: { charizard },
    itemsById: { 'life-orb': { item_id: 'life-orb', name: 'Life Orb' } },
    abilitiesById: { blaze: { ability_id: 'blaze', name: 'Blaze' } },
    movesById: {
      'flare-blitz': { move_id: 'flare-blitz', name: 'Flare Blitz' },
      'dragon-claw': { move_id: 'dragon-claw', name: 'Dragon Claw' },
      protect: { move_id: 'protect', name: 'Protect' },
      tailwind: { move_id: 'tailwind', name: 'Tailwind' }
    },
    statsByPokemon: { charizard: charizard.baseStats }
  }
};

function baseSlot(overrides = {}) {
  return {
    pokemon_id: 'charizard',
    item_id: 'life-orb',
    ability_id: 'blaze',
    moves: ['flare-blitz', 'dragon-claw', 'protect', 'tailwind'],
    nature: 'Adamant',
    level: 50,
    evs: { hp: 252, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 4 },
    ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
    ...overrides
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    throw error;
  }
}

test('252 EVs do not become 252 final stat points by mistake', () => {
  const statPoints = buildCalculatedStatPoints({ pokemon: charizard, evs: baseSlot().evs, ivs: baseSlot().ivs, level: 50, nature: 'Adamant' });
  assert.equal(statPoints.hp, 185);
  assert.equal(statPoints.attack, 149);
  assert.notEqual(statPoints.hp, 252);
  assert.notEqual(statPoints.attack, 252);
});

test('Final stat points do not get saved as EVs on JSON import', () => {
  const imported = migrateImportedTeam({ team: [{ pokemon_id: 'charizard', calculatedStats: { hp: 185, attack: 149, defense: 98, specialAttack: 116, specialDefense: 105, speed: 121 } }] });
  assert.deepEqual(imported[0].evs, { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 });
  assert.equal(imported[0].statPoints.hp, 185);
});

test('Showdown import/export preserves EV spreads', () => {
  const text = `Charizard @ Life Orb\nAbility: Blaze\nLevel: 50\nEVs: 252 HP / 252 Atk / 4 Spe\nAdamant Nature\n- Flare Blitz\n- Dragon Claw\n- Protect\n- Tailwind`;
  const imported = importTeamFromShowdown(text, db);
  assert.equal(imported.team[0].evs.hp, 252);
  assert.equal(imported.team[0].evs.attack, 252);
  assert.equal(imported.team[0].evs.speed, 4);
  const exported = exportTeamToShowdown(imported.team, { database: db, mode: 'standard' }).text;
  assert.match(exported, /EVs:/);
  assert.match(exported, /252 HP/);
  assert.match(exported, /252 Atk/);
  assert.match(exported, /4 Spe/);
});

test('Showdown final stats import keeps EVs as source of truth when both are present', () => {
  const text = `Charizard\nLevel: 50\nEVs: 252 HP / 252 Atk / 4 Spe\nCalculated Stats: 999 HP / 999 Atk / 999 Def / 999 SpA / 999 SpD / 999 Spe\nAdamant Nature`;
  const imported = importTeamFromShowdown(text, db);
  assert.equal(imported.team[0].evs.hp, 252);
  assert.equal(imported.team[0].evs.attack, 252);
  assert.equal(imported.team[0].statPoints.hp, 185);
  assert.equal(imported.team[0].statPoints.attack, 149);
  assert.notEqual(imported.team[0].statPoints.hp, 999);
});

test('JSON import/export keeps EVs and calculated stats separate', () => {
  const json = exportTeam([baseSlot()], db);
  const parsed = JSON.parse(json);
  assert.equal(parsed.team[0].evs.hp, 252);
  assert.equal(parsed.team[0].evs.attack, 252);
  assert.equal(parsed.team[0].calculatedStats.hp, 185);
  assert.equal(parsed.team[0].calculatedStats.attack, 149);
  assert.notDeepEqual(parsed.team[0].evs, parsed.team[0].calculatedStats);
  const imported = migrateImportedTeam(json);
  assert.equal(imported[0].evs.hp, 252);
  assert.equal(imported[0].statPoints.hp, 185);
});

test('Level 50 HP and non-HP formulas are correct', () => {
  assert.equal(calculateFinalStat({ pokemon: charizard, statKey: 'hp', evs: { hp: 252 }, ivs: { hp: 31 }, level: 50 }), 185);
  assert.equal(calculateFinalStat({ pokemon: charizard, statKey: 'defense', evs: { defense: 0 }, ivs: { defense: 31 }, level: 50 }), 98);
});

test('Nature boosts and drops apply correctly', () => {
  assert.equal(calculateFinalStat({ pokemon: charizard, statKey: 'attack', evs: { attack: 252 }, ivs: { attack: 31 }, level: 50, nature: 'Adamant' }), 149);
  assert.equal(calculateFinalStat({ pokemon: charizard, statKey: 'specialAttack', evs: { specialAttack: 0 }, ivs: { specialAttack: 31 }, level: 50, nature: 'Adamant' }), 116);
});

test('Missing IVs default safely and level defaults to 50', () => {
  assert.deepEqual(normaliseIvs({}), { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 });
  assert.equal(DEFAULT_LEVEL, 50);
  const imported = migrateImportedTeam({ team: [{ pokemon_id: 'charizard', evs: { HP: 252, Atk: 252, Spe: 4 } }] });
  assert.equal(imported[0].level, 50);
  assert.equal(imported[0].ivs.hp, 31);
});

test('EVs clamp per stat and to 510 total', () => {
  const evs = normaliseEvs({ hp: 999, attack: 999, defense: 999, specialAttack: 999, specialDefense: 999, speed: 999 });
  assert.equal(evs.hp, 252);
  assert.equal(evs.attack, 252);
  assert.equal(evs.defense, 6);
  assert.equal(Object.values(evs).reduce((sum, value) => sum + value, 0), 510);
});

test('Existing saved-team shaped data still loads correctly', () => {
  const imported = migrateImportedTeam({
    name: 'Legacy Team',
    slots: [{
      pokemonId: 'charizard',
      itemId: 'life-orb',
      abilityId: 'blaze',
      moveIds: ['flare-blitz', 'dragon-claw'],
      EVs: { HP: 252, Atk: 252, Spe: 4 },
      IVs: { HP: 31, Atk: 31, Spe: 31 },
      level: 50
    }]
  });
  assert.equal(imported[0].pokemon_id, 'charizard');
  assert.equal(imported[0].item_id, 'life-orb');
  assert.equal(imported[0].ability_id, 'blaze');
  assert.equal(imported[0].evs.hp, 252);
  assert.equal(imported[0].evs.attack, 252);
  assert.equal(imported[0].ivs.speed, 31);
});

console.log('\nStat conversion QA passed.');


test('Champions-format EV line imports as statAllocation in default Champions mode', () => {
  const text = `Charizard @ Life Orb
Ability: Blaze
Level: 50
EVs: 32 HP / 32 Def / 2 SpA
Timid Nature
- Protect
- Tailwind`;
  const imported = importTeamFromShowdown(text, db);
  assert.equal(imported.team[0].statAllocation.hp, 32);
  assert.equal(imported.team[0].statAllocation.defense, 32);
  assert.equal(imported.team[0].statAllocation.specialAttack, 2);
  assert.equal(Object.values(imported.team[0].statAllocation).reduce((sum, value) => sum + value, 0), 66);
  assert.equal(imported.team[0].evs.hp, 0);
  assert.equal(imported.team[0].importedShowdownEvs, undefined);
});

test('Explicit standard mode keeps low EV lines as Showdown EVs', () => {
  const text = `Charizard @ Life Orb
Ability: Blaze
Level: 50
EVs: 32 HP / 32 Def / 2 SpA
Timid Nature`;
  const imported = importTeamFromShowdown(text, db, { mode: 'standard' });
  assert.equal(imported.team[0].evs.hp, 32);
  assert.equal(imported.team[0].evs.defense, 32);
  assert.equal(imported.team[0].evs.specialAttack, 0);
  assert.equal(imported.team[0].statAllocation.hp, 0);
});

test('Pokémon Champions Points comment wins when low EV line differs', () => {
  const text = `Charizard @ Life Orb
Ability: Blaze
Level: 50
EVs: 32 HP / 32 Def / 2 SpA
Pokémon Champions Points: HP +30 / Def +32 / SpA +4
Timid Nature`;
  const imported = importTeamFromShowdown(text, db);
  assert.equal(imported.team[0].statAllocation.hp, 30);
  assert.equal(imported.team[0].statAllocation.defense, 32);
  assert.equal(imported.team[0].statAllocation.specialAttack, 4);
  assert.ok(imported.warnings.some((warning) => /differed/.test(warning)));
});
