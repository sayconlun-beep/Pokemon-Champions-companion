import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LEVEL,
  DEFAULT_IV,
  EV_LIMIT,
  EV_TOTAL_LIMIT,
  emptyEvs,
  emptyIvs,
  normaliseEvs,
  normaliseIvs,
  calculateFinalStat,
  calculateFinalStats,
  normaliseFinalStats,
  normaliseLevel,
  buildCalculatedStatPoints,
  inferEvFromFinalStat,
  formatShowdownEvs,
  formatFinalStats,
  parseShowdownStatObject,
  getCanonicalStatKey,
  toShowdownStatLabel
} from '../src/core/statFormulaEngine.js';

test('exports the expected deterministic defaults', () => {
  assert.equal(DEFAULT_LEVEL, 50);
  assert.equal(DEFAULT_IV, 31);
  assert.equal(EV_LIMIT, 252);
  assert.equal(EV_TOTAL_LIMIT, 510);
  assert.deepEqual(emptyEvs(), { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 });
  assert.deepEqual(emptyIvs(), { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 });
});

test('normalises Showdown stat keys, clamps EVs and enforces total cap in stat order', () => {
  assert.deepEqual(normaliseEvs({ HP: 255, Atk: 252, Def: 252, SpA: 252, SpD: 4, Spe: 4 }), {
    hp: 252,
    attack: 252,
    defense: 6,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0
  });
  assert.deepEqual(normaliseIvs({ HP: 40, Atk: -2, Spe: 30.6 }), {
    hp: 31,
    attack: 0,
    defense: 31,
    specialAttack: 31,
    specialDefense: 31,
    speed: 31
  });
});

test('calculates level 50 Pokémon stats with IV, EV and nature modifiers', () => {
  const baseStats = { hp: 90, attack: 100, defense: 80, specialAttack: 70, specialDefense: 80, speed: 95 };
  assert.equal(calculateFinalStat({ baseStats, statKey: 'hp', evs: { hp: 252 } }), 197);
  assert.equal(calculateFinalStat({ baseStats, statKey: 'attack', evs: { attack: 252 }, nature: 'Adamant' }), 167);
  assert.equal(calculateFinalStat({ baseStats, statKey: 'specialAttack', evs: { specialAttack: 252 }, nature: 'Adamant' }), 109);

  const allStats = calculateFinalStats({ baseStats, evs: { Spe: 252 }, nature: 'Jolly' });
  assert.equal(allStats.speed, 161);
  assert.equal(buildCalculatedStatPoints({ baseStats, evs: { Spe: 252 }, nature: 'Jolly' }).speed, 161);
});

test('formats, parses and infers stats through the public helpers', () => {
  assert.equal(normaliseLevel(999), 100);
  assert.equal(normaliseLevel('bad', 50), 50);
  assert.deepEqual(normaliseFinalStats({ HP: 197, Spe: '161', unknown: 999 }).speed, 161);
  assert.deepEqual(parseShowdownStatObject({ HP: 252, Atk: 4 }).attack, 4);
  assert.equal(getCanonicalStatKey('SpA'), 'specialAttack');
  assert.equal(toShowdownStatLabel('specialDefense'), 'SpD');
  assert.equal(formatShowdownEvs({ HP: 252, Atk: 4 }), '252 HP / 4 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe');
  assert.equal(formatFinalStats({ hp: 197, speed: 161 }), '197 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 161 Spe');
  assert.equal(inferEvFromFinalStat({ finalStat: 161, baseStats: { speed: 95 }, statKey: 'speed', nature: 'Jolly' }), 252);
});
