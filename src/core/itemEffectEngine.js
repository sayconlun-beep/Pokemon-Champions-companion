import { analyseItemClause, getItemUsageForSlot } from './itemClauseEngine.js';
import { getMegaOptions, getMegaRequirement, isMegaStoneItem } from './megaEvolutionEngine.js';

const FALLBACK_EFFECT = 'No effect text found in item database.';

export function getItemEffect(itemName, itemDatabase = []) {
  const item = resolveItem(itemName, itemDatabase);
  const name = item?.name || itemName || 'Unknown item';
  const effectText = firstText(item?.effect, item?.effectText, item?.description, item?.short_effect, item?.source_notes) || FALLBACK_EFFECT;
  return {
    name,
    itemId: item?.item_id || itemName || '',
    effectText,
    shortEffect: summarizeEffect(effectText),
    category: categorizeItem(item, effectText),
    isMegaStone: isMegaStoneItem(item) || /mega/i.test(`${name} ${effectText}`),
    raw: item || null,
    warningText: item ? '' : 'Item is unknown or missing from the held item database.'
  };
}

export function getItemLegalityState(itemName, team = [], currentSlotIndex = -1, dataOrItems = {}) {
  const itemDatabase = Array.isArray(dataOrItems) ? dataOrItems : dataOrItems.collections?.items || [];
  const data = Array.isArray(dataOrItems) ? { collections: { items: itemDatabase }, indexes: { itemsById: indexBy(itemDatabase, 'item_id') } } : dataOrItems;
  const item = resolveItem(itemName, itemDatabase);
  if (!itemName) return { isDuplicate: false, usedBy: [], legalityStatus: 'Legal', warningText: '', itemId: '' };
  const itemId = item?.item_id || itemName;
  const usage = getItemUsageForSlot(team, data, currentSlotIndex, itemId);
  const usedBy = usage.otherPokemonNames || [];
  return {
    isDuplicate: usage.usedByOtherSlot,
    usedBy,
    legalityStatus: usage.usedByOtherSlot ? 'Illegal duplicate' : 'Legal',
    warningText: usage.usedByOtherSlot ? `Duplicate items are illegal under Item Clause. Already used by ${usedBy.join(', ')}.` : '',
    itemId
  };
}

export function getItemStrategicFit(itemName, pokemon = {}, teamContext = {}) {
  const data = teamContext.data || teamContext;
  const itemDatabase = data.collections?.items || teamContext.itemDatabase || [];
  const effect = getItemEffect(itemName, itemDatabase);
  const text = `${effect.name} ${effect.effectText}`.toLowerCase();
  const pText = JSON.stringify(pokemon || {}).toLowerCase();
  const tags = [];
  let fitReason = 'General-purpose held item; use only if it supports this Pokémon’s planned board role.';

  if (/sash|survive|1 hp|full hp/.test(text)) {
    tags.push('opener stability', 'emergency action');
    fitReason = /opener|speed|disrupt|fragile|frail|lead/.test(pText) ? 'Matches fragile or opener-focused plans that need to guarantee at least one action.' : 'Useful when this Pokémon needs emergency survival from full HP.';
  } else if (/leftovers|recover|heal|restores|hp each turn/.test(text)) {
    tags.push('long board presence', 'recovery route');
    fitReason = /recover|route|sustain|board|presence|stall|cycle/.test(pText) ? 'Supports long board presence and repeated recovery routes.' : 'Improves repeated switch-in and staying power.';
  } else if (/choice scarf|speed/.test(text)) {
    tags.push('speed control', 'revenge pressure');
    fitReason = 'Improves speed control, revenge pressure, and cleaner positioning when move-lock risk is acceptable.';
  } else if (/choice band|choice specs|life orb|expert belt|boosts|power/.test(text)) {
    tags.push('turning pressure into damage', 'damage amplification');
    fitReason = 'Improves damage conversion when the team needs selected attacks to become meaningful pressure.';
  } else if (/berry|resist|weakness|reduces damage/.test(text)) {
    tags.push('collapse-risk reduction', 'survival threshold');
    fitReason = 'Helps patch a specific collapse trigger or survival threshold.';
  } else if (effect.isMegaStone) {
    tags.push('mega evolution', 'required item');
    const matching = getMegaOptions(pokemon?.pokemon_id, data).find((option) => option.requiredItemId === effect.itemId);
    const requirement = getMegaRequirement(pokemon?.pokemon_id, data);
    fitReason = matching || requirement?.requiredItemId === effect.itemId ? 'Required item for this Pokémon’s valid Mega Evolution route.' : 'Mega Stone detected, but it only fits if it matches this Pokémon’s valid Mega route.';
  }

  return { strategicTags: tags, fitReason, warningText: '' };
}

export function getRecommendedItemsForPokemon(pokemon = {}, team = [], itemDatabase = [], data = {}) {
  const currentIndex = typeof data.currentSlotIndex === 'number' ? data.currentSlotIndex : -1;
  const fullData = data.collections ? data : { collections: { items: itemDatabase, pokemon: data.pokemon || [] }, indexes: data.indexes || { itemsById: indexBy(itemDatabase, 'item_id') } };
  const items = itemDatabase.filter((item) => item?.item_id && String(item.is_legal || item.legal || 'Yes').toLowerCase() !== 'no');
  const clause = analyseItemClause(team, fullData);
  const megaOptions = getMegaOptions(pokemon?.pokemon_id, fullData);
  return items
    .map((item) => {
      const effect = getItemEffect(item.item_id, itemDatabase);
      const legality = getItemLegalityState(item.item_id, team, currentIndex, fullData);
      const fit = getItemStrategicFit(item.item_id, pokemon, fullData);
      const score = scoreItem(item, effect, fit, pokemon, megaOptions, legality, clause, team?.[currentIndex]);
      return { ...effect, ...legality, ...fit, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 6);
}

export function normaliseItemOption(item, pokemon, team, slotIndex, data) {
  const effect = getItemEffect(item?.item_id || item?.name || '', data.collections?.items || []);
  const legality = getItemLegalityState(effect.itemId, team, slotIndex, data);
  const fit = getItemStrategicFit(effect.itemId, pokemon, data);
  return { ...effect, ...legality, ...fit };
}

function scoreItem(item, effect, fit, pokemon, megaOptions, legality, clause, currentSlot) {
  const text = `${item.name || ''} ${effect.effectText}`.toLowerCase();
  const pText = JSON.stringify(pokemon || {}).toLowerCase();
  let score = 0;
  if (megaOptions.some((option) => option.requiredItemId === item.item_id)) score += 100;
  if (/focus sash/.test(text) && /opener|lead|speed|disrupt|fragile|frail|guarantee/.test(pText)) score += 30;
  if (/leftovers|heal|recover|restores/.test(text) && /recover|route|board|presence|cycle|long/.test(pText)) score += 24;
  if (/choice scarf|speed/.test(text) && /speed|revenge|endgame|clean/.test(pText)) score += 22;
  if (/life orb|choice band|choice specs|expert belt|boosts|power/.test(text) && /pressure|damage|conversion|ko|endgame|breaker/.test(pText)) score += 18;
  if (/berry|resist|weakness|reduces damage|survive/.test(text) && /failure|collapse|survive|threshold|weak/.test(pText)) score += 16;
  if (fit.strategicTags.length) score += 8;
  if (/focus sash|leftovers|choice scarf|life orb|expert belt|assault vest|sitrus berry/i.test(item.name || '')) score += 4;
  if (legality.isDuplicate && currentSlot?.item_id !== item.item_id) score -= 80;
  return score;
}

function resolveItem(itemName, itemDatabase) {
  const needle = normalize(itemName);
  return (itemDatabase || []).find((item) => normalize(item.item_id) === needle || normalize(item.name) === needle) || null;
}
function firstText(...values) { return values.map((v) => String(v || '').trim()).find(Boolean) || ''; }
function summarizeEffect(text) { const clean = String(text || FALLBACK_EFFECT).replace(/\s+/g, ' ').trim(); return clean.length > 92 ? `${clean.slice(0, 89)}…` : clean; }
function categorizeItem(item, text) { const hay = `${item?.name || ''} ${text}`.toLowerCase(); if (/mega/.test(hay)) return 'Mega Stone'; if (/choice/.test(hay)) return 'Choice item'; if (/berry/.test(hay)) return 'Berry'; if (/heal|recover|leftovers/.test(hay)) return 'Recovery'; if (/boost|power|orb|belt|plate|gem/.test(hay)) return 'Damage'; if (/speed|scarf/.test(hay)) return 'Speed'; return 'Utility'; }
function normalize(value) { return String(value || '').trim().toLowerCase(); }
function indexBy(rows, key) { return Object.fromEntries((rows || []).map((row) => [row[key], row]).filter(([id]) => id)); }
