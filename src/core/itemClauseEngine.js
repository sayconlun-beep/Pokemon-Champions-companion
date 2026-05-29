export function analyseItemClause(team = [], data = {}) {
  const itemsById = data.indexes?.itemsById || Object.fromEntries((data.collections?.items || []).map((item) => [item.item_id, item]));
  const usage = new Map();

  (Array.isArray(team) ? team : []).forEach((slot, slotIndex) => {
    const itemId = String(slot?.item_id || '').trim();
    if (!itemId) return;
    const item = itemsById[itemId] || { item_id: itemId, name: itemId };
    const entry = usage.get(itemId) || { itemId, itemName: item.name || itemId, slots: [], pokemonNames: [] };
    const pokemon = data.indexes?.pokemonById?.[slot?.pokemon_id];
    entry.slots.push(slotIndex);
    entry.pokemonNames.push(pokemon?.name || `Slot ${slotIndex + 1}`);
    usage.set(itemId, entry);
  });

  const duplicates = Array.from(usage.values()).filter((entry) => entry.slots.length > 1);
  const conflictSlotIndexes = new Set(duplicates.flatMap((entry) => entry.slots));
  const warnings = duplicates.map((entry) => `${entry.itemName} is duplicated by ${entry.pokemonNames.join(' and ')}.`);

  return {
    legal: duplicates.length === 0,
    usage,
    duplicates,
    warnings,
    conflictSlotIndexes,
    usedItemIds: new Set(usage.keys())
  };
}

export function getItemUsageForSlot(team = [], data = {}, slotIndex = -1, itemId = '') {
  const clause = analyseItemClause(team, data);
  const entry = itemId ? clause.usage.get(itemId) : null;
  const otherSlots = entry ? entry.slots.filter((index) => index !== slotIndex) : [];
  return {
    clause,
    entry,
    otherSlots,
    usedByOtherSlot: otherSlots.length > 0,
    otherPokemonNames: entry ? entry.pokemonNames.filter((_, index) => entry.slots[index] !== slotIndex) : []
  };
}

export function firstLegalItemId(preferredItemIds = [], team = [], data = {}, slotIndex = -1) {
  for (const itemId of preferredItemIds) {
    const usage = getItemUsageForSlot(team, data, slotIndex, itemId);
    if (!usage.usedByOtherSlot) return itemId;
  }
  return '';
}


export function suggestLegalItemAlternatives(conflictingItemId = '', team = [], data = {}, slotIndex = -1, limit = 4) {
  const items = (data.collections?.items || [])
    .filter((item) => String(item.is_legal || item.legal || 'Yes').toLowerCase() !== 'no')
    .filter((item) => item.item_id && item.item_id !== conflictingItemId);
  const used = analyseItemClause(team, data).usedItemIds;
  const preferredWords = tacticalWords(data.indexes?.itemsById?.[conflictingItemId]);
  return items
    .filter((item) => !used.has(item.item_id) || team?.[slotIndex]?.item_id === item.item_id)
    .map((item) => ({ item, score: itemScore(item, preferredWords) }))
    .sort((a, b) => b.score - a.score || String(a.item.name || '').localeCompare(String(b.item.name || '')))
    .slice(0, limit)
    .map(({ item }) => item);
}

function itemScore(item, preferredWords) {
  const text = `${item.name || ''} ${item.effect || ''} ${item.description || ''}`.toLowerCase();
  let score = 0;
  for (const word of preferredWords) if (text.includes(word)) score += 3;
  if (/sash|berry|orb|band|specs|scarf|vest|boots|leftovers/i.test(item.name || '')) score += 1;
  return score;
}

function tacticalWords(item) {
  const text = `${item?.name || ''} ${item?.effect || ''} ${item?.description || ''}`.toLowerCase();
  const words = ['recovery','heal','speed','priority','damage','boost','survive','focus','protect','berry','mega','evolve','critical','weather','terrain'];
  return words.filter((word) => text.includes(word));
}
