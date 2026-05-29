import { STAT_DEFINITIONS } from './statAllocationEngine.js';

export const DEFAULT_LEVEL = 50;
export const DEFAULT_IV = 31;
export const EV_LIMIT = 252;
export const EV_TOTAL_LIMIT = 510;

const NATURE_MODIFIERS = {
  Lonely: ['attack', 'defense'], Brave: ['attack', 'speed'], Adamant: ['attack', 'specialAttack'], Naughty: ['attack', 'specialDefense'],
  Bold: ['defense', 'attack'], Relaxed: ['defense', 'speed'], Impish: ['defense', 'specialAttack'], Lax: ['defense', 'specialDefense'],
  Timid: ['speed', 'attack'], Hasty: ['speed', 'defense'], Jolly: ['speed', 'specialAttack'], Naive: ['speed', 'specialDefense'],
  Modest: ['specialAttack', 'attack'], Mild: ['specialAttack', 'defense'], Quiet: ['specialAttack', 'speed'], Rash: ['specialAttack', 'specialDefense'],
  Calm: ['specialDefense', 'attack'], Gentle: ['specialDefense', 'defense'], Sassy: ['specialDefense', 'speed'], Careful: ['specialDefense', 'specialAttack']
};

const SHOWDOWN_TO_CANONICAL = {
  HP: 'hp', hp: 'hp',
  Atk: 'attack', atk: 'attack', attack: 'attack', Attack: 'attack',
  Def: 'defense', def: 'defense', defense: 'defense', Defense: 'defense',
  SpA: 'specialAttack', spa: 'specialAttack', specialAttack: 'specialAttack', special_attack: 'specialAttack',
  SpD: 'specialDefense', spd: 'specialDefense', specialDefense: 'specialDefense', special_defense: 'specialDefense',
  Spe: 'speed', spe: 'speed', speed: 'speed', Speed: 'speed'
};

const CANONICAL_TO_SHOWDOWN = {
  hp: 'HP', attack: 'Atk', defense: 'Def', specialAttack: 'SpA', specialDefense: 'SpD', speed: 'Spe'
};

export function emptyEvs() { return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.key, 0])); }
export function emptyIvs() { return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.key, DEFAULT_IV])); }

export function normaliseEvs(...sources) {
  const evs = emptyEvs();
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = SHOWDOWN_TO_CANONICAL[rawKey] || rawKey;
      if (!(key in evs)) continue;
      evs[key] = clampEv(rawValue);
    }
  }
  return enforceEvTotalCap(evs);
}

export function normaliseIvs(...sources) {
  const ivs = emptyIvs();
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = SHOWDOWN_TO_CANONICAL[rawKey] || rawKey;
      if (!(key in ivs)) continue;
      ivs[key] = clampIv(rawValue);
    }
  }
  return ivs;
}

export function calculateFinalStat({ pokemon, baseStats, statKey, evs = {}, ivs = {}, level = DEFAULT_LEVEL, nature = '' }) {
  const stat = STAT_DEFINITIONS.find((entry) => entry.key === statKey || entry.dataKey === statKey);
  if (!stat) return 0;
  const base = getBaseStatValue(pokemon?.baseStats || baseStats || pokemon?.stats || pokemon, stat);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const safeLevel = clampLevel(level);
  const safeIvs = normaliseIvs(ivs);
  const safeEvs = normaliseEvs(evs);
  const iv = safeIvs[stat.key];
  const ev = safeEvs[stat.key];

  if (stat.key === 'hp') {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * safeLevel) / 100) + safeLevel + 10;
  }

  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * safeLevel) / 100) + 5;
  return Math.floor(raw * natureModifier(nature, stat.key));
}

export function calculateFinalStats({ pokemon, baseStats, evs = {}, ivs = {}, level = DEFAULT_LEVEL, nature = '' }) {
  return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [
    stat.key,
    calculateFinalStat({ pokemon, baseStats, statKey: stat.key, evs, ivs, level, nature })
  ]));
}

export function normaliseFinalStats(...sources) {
  const stats = Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.key, 0]));
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = SHOWDOWN_TO_CANONICAL[rawKey] || rawKey;
      if (!(key in stats)) continue;
      const number = Number(rawValue || 0);
      stats[key] = Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    }
  }
  return stats;
}

export function normaliseLevel(value, fallback = DEFAULT_LEVEL) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(100, Math.round(number)));
}

export function buildCalculatedStatPoints({ pokemon, baseStats, evs = {}, ivs = {}, level = DEFAULT_LEVEL, nature = '' } = {}) {
  return calculateFinalStats({
    pokemon,
    baseStats,
    evs: normaliseEvs(evs),
    ivs: normaliseIvs(ivs),
    level: normaliseLevel(level),
    nature
  });
}

export function inferEvFromFinalStat({ finalStat, pokemon, baseStats, statKey, ivs = {}, level = DEFAULT_LEVEL, nature = '' }) {
  const target = Number(finalStat);
  if (!Number.isFinite(target) || target <= 0) return null;
  for (let ev = 0; ev <= EV_LIMIT; ev += 4) {
    const candidate = calculateFinalStat({ pokemon, baseStats, statKey, evs: { [statKey]: ev }, ivs, level, nature });
    if (candidate === target) return ev;
  }
  return null;
}

export function formatShowdownEvs(evs = {}) {
  const normalised = normaliseEvs(evs);
  return STAT_DEFINITIONS
    .map((stat) => `${normalised[stat.key] || 0} ${CANONICAL_TO_SHOWDOWN[stat.key]}`)
    .join(' / ');
}

export function formatFinalStats(finalStats = {}) {
  return STAT_DEFINITIONS
    .map((stat) => `${Number(finalStats?.[stat.key] || 0)} ${CANONICAL_TO_SHOWDOWN[stat.key]}`)
    .join(' / ');
}

export function parseShowdownStatObject(stats = {}) { return normaliseEvs(stats); }
export function getCanonicalStatKey(rawKey) { return SHOWDOWN_TO_CANONICAL[rawKey] || rawKey; }
export function toShowdownStatLabel(statKey) { return CANONICAL_TO_SHOWDOWN[statKey] || statKey; }

function getBaseStatValue(baseStats, stat) {
  if (!baseStats || typeof baseStats !== 'object') return 0;
  const value = baseStats[stat.dataKey] ?? baseStats[stat.key] ?? baseStats[stat.label] ?? baseStats[stat.shortLabel];
  return Number(value || 0);
}

function natureModifier(nature, statKey) {
  const entry = NATURE_MODIFIERS[String(nature || '').trim()];
  if (!entry) return 1;
  if (entry[0] === statKey) return 1.1;
  if (entry[1] === statKey) return 0.9;
  return 1;
}

function enforceEvTotalCap(evs) {
  const cleaned = emptyEvs();
  let spent = 0;
  for (const stat of STAT_DEFINITIONS) {
    const value = clampEv(evs?.[stat.key]);
    const allowed = Math.max(0, Math.min(value, EV_TOTAL_LIMIT - spent));
    cleaned[stat.key] = allowed;
    spent += allowed;
  }
  return cleaned;
}

function clampEv(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(EV_LIMIT, Math.floor(number / 4) * 4));
}

function clampIv(value) {
  const number = Number(value ?? DEFAULT_IV);
  if (!Number.isFinite(number)) return DEFAULT_IV;
  return Math.max(0, Math.min(31, Math.round(number)));
}

function clampLevel(value) {
  return normaliseLevel(value);
}
