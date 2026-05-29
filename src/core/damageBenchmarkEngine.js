import { getReadablePokemonName } from '../utils/displayNames.js';
import { getSlotStatAllocation, STAT_DEFINITIONS } from './statAllocationEngine.js';
const LEVEL = 50;
const NATURES = {
  Adamant: ['atk', 'spa'], Bold: ['def', 'atk'], Brave: ['atk', 'spe'], Calm: ['spd', 'atk'], Careful: ['spd', 'spa'],
  Hasty: ['spe', 'def'], Impish: ['def', 'spa'], Jolly: ['spe', 'spa'], Modest: ['spa', 'atk'], Quiet: ['spa', 'spe'],
  Relaxed: ['def', 'spe'], Sassy: ['spd', 'spe'], Timid: ['spe', 'atk']
};

export function estimateBenchmarks(team, data) {
  const slots = team.filter(Boolean);
  return slots.flatMap((attacker) => slots.filter((target) => target.pokemon_id !== attacker.pokemon_id).slice(0, 2).flatMap((target) => {
    return attacker.moves.slice(0, 2).map((moveId) => estimateDamage(attacker, target, moveId, data)).filter(Boolean);
  })).slice(0, 24);
}

export function estimateDamage(attackerSlot, targetSlot, moveId, data) {
  const attacker = data.indexes.pokemonById[attackerSlot.pokemon_id];
  const target = data.indexes.pokemonById[targetSlot.pokemon_id];
  const move = data.indexes.movesById[moveId];
  if (!attacker || !target || !move || !Number(move.power || move.base_power)) return null;
  const category = String(move.category || '').toLowerCase();
  const attackStat = category.includes('special') ? 'spa' : 'atk';
  const defenseStat = category.includes('special') ? 'spd' : 'def';
  const atk = finalStat(data.indexes.statsByPokemon[attacker.pokemon_id], attackStat, attackerSlot.nature, selectedPoints(attackerSlot, attackStat));
  const def = finalStat(data.indexes.statsByPokemon[target.pokemon_id], defenseStat, targetSlot.nature, selectedPoints(targetSlot, defenseStat));
  const hp = finalStat(data.indexes.statsByPokemon[target.pokemon_id], 'hp', targetSlot.nature, selectedPoints(targetSlot, 'hp'));
  if (!atk || !def || !hp) return null;
  const power = Number(move.power || move.base_power);
  const base = Math.floor(Math.floor(((2 * LEVEL / 5 + 2) * power * atk / def) / 50) + 2);
  const stab = [attacker.type_1, attacker.type_2].filter(Boolean).map(String).map((t) => t.toLowerCase()).includes(String(move.type || '').toLowerCase()) ? 1.5 : 1;
  const low = Math.max(1, Math.floor(base * stab * 0.85));
  const high = Math.max(low, Math.floor(base * stab));
  return {
    attacker: getReadablePokemonName(attacker),
    target: getReadablePokemonName(target),
    move: move.name || move.move_id,
    moveType: move.type || '',
    moveCategory: move.category || '',
    targetTypes: [target.type_1, target.type_2].filter(Boolean),
    range: `${Math.round(low / hp * 100)}-${Math.round(high / hp * 100)}%`,
    confidence: 'formula-estimate',
    assumptions: 'Level 50, selected move, current stat rows, no field modifiers.'
  };
}

function selectedPoints(slot, stat) {
  const definition = STAT_DEFINITIONS.find((entry) => entry.dataKey === stat || entry.key === stat);
  const allocation = getSlotStatAllocation(slot);
  return allocation?.[definition?.key || stat] ?? 0;
}

function finalStat(row, stat, nature, points) {
  const base = Number(row?.[stat] || 0);
  if (!base) return 0;
  if (stat === 'hp') return Math.floor(((2 * base + Number(points || 0) / 4) * LEVEL) / 100) + LEVEL + 10;
  const [up, down] = NATURES[nature] || [];
  const natureMod = up === stat ? 1.1 : down === stat ? 0.9 : 1;
  return Math.floor((Math.floor(((2 * base + Number(points || 0) / 4) * LEVEL) / 100) + 5) * natureMod);
}
