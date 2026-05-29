export const STAT_ALLOCATION_LIMIT = 66;
export const STAT_SINGLE_LIMIT = 32;

export const STAT_DEFINITIONS = [
  { key: 'hp', dataKey: 'hp', label: 'HP', shortLabel: 'HP', role: 'bulk' },
  { key: 'attack', dataKey: 'atk', label: 'Attack', shortLabel: 'Atk', role: 'offense' },
  { key: 'defense', dataKey: 'def', label: 'Defense', shortLabel: 'Def', role: 'bulk' },
  { key: 'specialAttack', dataKey: 'spa', label: 'Sp. Attack', shortLabel: 'SpA', role: 'offense' },
  { key: 'specialDefense', dataKey: 'spd', label: 'Sp. Defense', shortLabel: 'SpD', role: 'bulk' },
  { key: 'speed', dataKey: 'spe', label: 'Speed', shortLabel: 'Spe', role: 'speed' }
];

const LEGACY_TO_CANONICAL = {
  hp: 'hp',
  atk: 'attack', attack: 'attack', Attack: 'attack',
  def: 'defense', defense: 'defense', Defense: 'defense',
  spa: 'specialAttack', spAtk: 'specialAttack', specialAttack: 'specialAttack', special_attack: 'specialAttack', special_attack_points: 'specialAttack',
  spd: 'specialDefense', spDef: 'specialDefense', specialDefense: 'specialDefense', special_defense: 'specialDefense', special_defense_points: 'specialDefense',
  spe: 'speed', speed: 'speed', Speed: 'speed'
};

export function emptyStatAllocation() {
  return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.key, 0]));
}

export function normaliseStatAllocation(...sources) {
  const combined = emptyStatAllocation();
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = LEGACY_TO_CANONICAL[rawKey] || rawKey;
      if (!(key in combined)) continue;
      combined[key] = clampPoint(rawValue);
    }
  }
  return enforceTotalCap(combined).allocation;
}

export function validateStatAllocation(allocation = {}) {
  const normalised = normaliseStatAllocation(allocation);
  const errors = [];
  const warnings = [];
  const overCapStats = [];
  let rawTotal = 0;

  for (const stat of STAT_DEFINITIONS) {
    const raw = Number(allocation?.[stat.key] ?? 0);
    if (!Number.isFinite(raw)) errors.push(`${stat.label} allocation is not a number.`);
    if (raw < 0) errors.push(`${stat.label} allocation is below 0.`);
    if (raw > STAT_SINGLE_LIMIT) {
      overCapStats.push(stat.key);
      errors.push(`${stat.label} exceeds +${STAT_SINGLE_LIMIT}.`);
    }
    rawTotal += Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }

  if (rawTotal > STAT_ALLOCATION_LIMIT) errors.push(`Total allocation exceeds ${STAT_ALLOCATION_LIMIT}.`);
  const totalAllocated = totalStatAllocation(normalised);
  const remainingPoints = Math.max(0, STAT_ALLOCATION_LIMIT - totalAllocated);
  if (remainingPoints === 0) warnings.push('Point cap reached.');

  return {
    isLegal: errors.length === 0,
    totalAllocated,
    remainingPoints,
    overCapStats,
    errors,
    warnings,
    allocation: normalised
  };
}

export function getSlotStatAllocation(slot = {}) {
  return normaliseStatAllocation(slot.statAllocation, slot.skillPoints, slot.sp);
}

export function setSlotStatAllocation(slot, allocation) {
  if (!slot) return null;
  slot.statAllocation = normaliseStatAllocation(allocation);
  delete slot.skillPoints;
  delete slot.sp;
  delete slot.evs;
  delete slot.EVs;
  return slot.statAllocation;
}

export function adjustStatAllocation(slot, statKey, delta) {
  if (!slot || !STAT_DEFINITIONS.some((stat) => stat.key === statKey)) return null;
  const current = getSlotStatAllocation(slot);
  const currentValue = clampPoint(current[statKey]);
  const requested = clampPoint(currentValue + Number(delta || 0));
  const spentWithoutStat = totalStatAllocation(current) - currentValue;
  const allowedForStat = Math.max(0, Math.min(STAT_SINGLE_LIMIT, STAT_ALLOCATION_LIMIT - spentWithoutStat));
  current[statKey] = Math.min(requested, allowedForStat);
  return setSlotStatAllocation(slot, current);
}

export function applyStatPreset(slot, presetName) {
  const preset = STAT_PRESETS[presetName];
  if (!slot || !preset) return null;
  return setSlotStatAllocation(slot, preset);
}

export const STAT_PRESETS = {
  fastAttacker: { hp: 2, attack: 32, defense: 0, specialAttack: 0, specialDefense: 0, speed: 32 },
  fastSpecialAttacker: { hp: 2, attack: 0, defense: 0, specialAttack: 32, specialDefense: 0, speed: 32 },
  bulkyAttacker: { hp: 18, attack: 28, defense: 10, specialAttack: 0, specialDefense: 10, speed: 0 },
  defensive: { hp: 24, attack: 0, defense: 21, specialAttack: 0, specialDefense: 21, speed: 0 },
  balanced: { hp: 11, attack: 11, defense: 11, specialAttack: 11, specialDefense: 11, speed: 11 }
};

export function totalStatAllocation(allocation = {}) {
  return STAT_DEFINITIONS.reduce((sum, stat) => sum + clampPoint(allocation?.[stat.key]), 0);
}

export function getBaseStat(baseStats, statKey) {
  const def = STAT_DEFINITIONS.find((stat) => stat.key === statKey || stat.dataKey === statKey);
  return Number(baseStats?.[def?.dataKey || statKey] || 0);
}

export function getFinalStat(baseStats, allocation, statKey) {
  return getBaseStat(baseStats, statKey) + clampPoint(allocation?.[statKey]);
}

export function toLegacyStatPointKeys(allocation = {}) {
  const normalised = normaliseStatAllocation(allocation);
  return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.dataKey, normalised[stat.key] || 0]));
}

export function describeStatInvestment(slot, pokemon) {
  const allocation = getSlotStatAllocation(slot);
  const lines = [];
  if ((allocation.speed || 0) >= 20) lines.push('Speed investment supports opener pressure and revenge positioning.');
  if ((allocation.hp || 0) + (allocation.defense || 0) + (allocation.specialDefense || 0) >= 32) lines.push('Bulk investment improves board presence and recovery route stability.');
  if ((allocation.attack || 0) + (allocation.specialAttack || 0) >= 28) lines.push('Offensive investment reinforces turning pressure into damage.');
  const pressureText = JSON.stringify(pokemon?.strategicStrengths || pokemon?.pressureFlow || '').toLowerCase();
  if ((allocation.attack || 0) >= 20 && pressureText.includes('special')) lines.push('Attack investment may not support this Pokémon’s main special pressure pattern.');
  if ((allocation.specialAttack || 0) >= 20 && pressureText.includes('physical')) lines.push('Sp. Attack investment may not support this Pokémon’s main physical pressure pattern.');
  return lines;
}

function enforceTotalCap(allocation) {
  const cleaned = emptyStatAllocation();
  let spent = 0;
  for (const stat of STAT_DEFINITIONS) {
    const value = clampPoint(allocation?.[stat.key]);
    const allowed = Math.max(0, Math.min(value, STAT_ALLOCATION_LIMIT - spent));
    cleaned[stat.key] = allowed;
    spent += allowed;
  }
  return { allocation: cleaned, spent };
}

function clampPoint(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(STAT_SINGLE_LIMIT, Math.round(number)));
}
