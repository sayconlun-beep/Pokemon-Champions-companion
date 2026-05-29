import { analyseItemClause } from './itemClauseEngine.js';
import { checkSlotLegality } from './legalityEngine.js';
import { getSlotMegaState } from './megaEvolutionEngine.js';
import { STAT_DEFINITIONS, getSlotStatAllocation, totalStatAllocation, validateStatAllocation, getFinalStat } from './statAllocationEngine.js';

const EMPTY_ITEM_CONFIRMED_VALUES = new Set(['__none__', 'none', 'no-item', 'intentional-empty']);

export function isPokemonSlotComplete(slot, teamContext = {}) {
  const data = teamContext.data || teamContext;
  const team = teamContext.team || [];
  const index = Number.isInteger(teamContext.index) ? teamContext.index : team.indexOf(slot);
  const missingFields = [];
  const warnings = [];
  const legalityIssues = [];

  if (!slot?.pokemon_id) {
    missingFields.push('Pokémon');
    return { isComplete: false, missingFields, warnings, legalityIssues };
  }

  if (!slot.ability_id) missingFields.push('Ability');
  if (!hasItemSelection(slot)) missingFields.push('Item or confirmed empty item');
  if (!slot.nature) missingFields.push('Nature');

  const moves = Array.isArray(slot.moves) ? slot.moves.filter(Boolean) : [];
  if (moves.length < 4) missingFields.push(`${4 - moves.length} move${4 - moves.length === 1 ? '' : 's'}`);

  const statValidation = validateStatAllocation(getSlotStatAllocation(slot));
  if (statValidation.totalAllocated <= 0) missingFields.push('Stat allocation reviewed');
  if (!statValidation.isLegal) legalityIssues.push(...statValidation.errors);

  if (data?.indexes) {
    const legality = checkSlotLegality(slot, data, team, Math.max(0, index));
    legalityIssues.push(...(legality.warnings || []));
    warnings.push(...(legality.missing || []));

    const megaState = getSlotMegaState(slot, data);
    if (megaState?.warnings?.length) legalityIssues.push(...megaState.warnings);

    const clause = analyseItemClause(team, data);
    const conflict = clause?.conflictSlotIndexes?.has?.(index);
    if (conflict) legalityIssues.push('Duplicate held item');
  }

  const uniqueIssues = unique(legalityIssues);
  const uniqueWarnings = unique(warnings);
  return {
    isComplete: missingFields.length === 0 && uniqueIssues.length === 0,
    missingFields: unique(missingFields),
    warnings: uniqueWarnings,
    legalityIssues: uniqueIssues
  };
}

export function buildPokemonReviewSummary(slot, index, data, team = []) {
  const pokemon = slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null;
  const item = slot?.item_id ? data?.indexes?.itemsById?.[slot.item_id] : null;
  const abilityRows = slot?.pokemon_id ? (data?.indexes?.abilitiesByPokemon?.[slot.pokemon_id] || []) : [];
  const ability = abilityRows.find((row) => row.ability_id === slot?.ability_id || row.ability_name === slot?.ability_id) || null;
  const moves = (slot?.moves || []).slice(0, 4).map((moveId) => data?.indexes?.movesById?.[moveId] || (moveId ? { name: moveId, move_id: moveId } : null));
  const completion = isPokemonSlotComplete(slot, { data, team, index });
  const allocation = getSlotStatAllocation(slot);
  const used = totalStatAllocation(allocation);
  const statValidation = validateStatAllocation(allocation);
  const baseStats = pokemon ? data?.indexes?.statsByPokemon?.[pokemon.pokemon_id] : null;
  const finalStats = STAT_DEFINITIONS.map((stat) => ({
    key: stat.key,
    label: stat.shortLabel || stat.label,
    fullLabel: stat.label,
    base: Number(baseStats?.[stat.key] || baseStats?.[stat.label] || 0),
    bonus: Number(allocation?.[stat.key] || 0),
    final: baseStats ? getFinalStat(baseStats, allocation, stat.key) : Number(allocation?.[stat.key] || 0)
  }));
  const investedStats = finalStats.filter((stat) => stat.bonus > 0).sort((a, b) => b.bonus - a.bonus || b.final - a.final).slice(0, 3);
  const keyFinalStats = finalStats.slice().sort((a, b) => b.final - a.final).slice(0, 4);
  const megaState = pokemon ? getSlotMegaState(slot, data) : null;
  const itemClause = data?.indexes ? analyseItemClause(team, data) : null;
  return {
    pokemon,
    item,
    ability,
    moves,
    completion,
    allocation,
    used,
    remaining: statValidation.remainingPoints,
    finalStats,
    investedStats,
    keyFinalStats,
    megaState,
    duplicateItem: Boolean(itemClause?.conflictSlotIndexes?.has?.(index)),
    isLegal: completion.legalityIssues.length === 0
  };
}

function hasItemSelection(slot) {
  if (!slot) return false;
  if (slot.item_id) return true;
  return EMPTY_ITEM_CONFIRMED_VALUES.has(String(slot.emptyItemConfirmed || slot.itemConfirmed || '').toLowerCase());
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}
