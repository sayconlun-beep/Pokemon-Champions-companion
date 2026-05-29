import { normaliseItemOption, getRecommendedItemsForPokemon } from '../core/itemEffectEngine.js';
import { getMegaOptions, getMegaRequirement } from '../core/megaEvolutionEngine.js';
import { escapeText } from './SearchableSelector.js';

let legalItemCacheSource = null;
let legalItemCache = null;
const itemOptionCache = new Map();
const recommendedItemCache = new Map();
const megaRequirementCache = new WeakMap();

export function ItemSelect(slotIndex, slot, data, team = [], pokemon = null) {
  const selected = slot?.item_id ? normaliseItemOption(data.indexes.itemsById[slot.item_id] || { item_id: slot.item_id, name: slot.item_id }, pokemon, team, slotIndex, data) : null;
  const recommended = pokemon ? getCachedRecommendedItems(pokemon, team, legalItems(data), data, slotIndex) : [];
  const detail = selected || recommended[0] || null;

  return `<div class="item-selector-shell streamlined-item-selector">
    <button type="button" class="tiny-button item-page-picker-button primary-item-page-picker-button" data-selector-focus="item" data-slot="${escapeText(slotIndex)}">${selected ? 'Change item' : '+ Choose Item'}</button>
    ${selected ? selectedItemSummary(selected, data, []) : `<p class="muted small-copy subtle-empty-item">No item selected. Use the item picker to browse recommendations and all legal items.</p>`}
    ${detail ? itemDetails(detail) : ''}
  </div>`;
}

function recommendedItemsPanel(recommended) {
  if (!recommended.length) return '';
  const top = recommended.slice(0, 3);
  const rest = recommended.slice(3);
  const renderRow = (item) => `<button type="button" class="recommended-item-row" data-selector-option="${escapeText(item.itemId)}" data-selector-kind="item" data-slot="${escapeText(item.currentSlotIndex ?? '')}" data-option-label="${escapeText(item.name)}"><span><strong>${escapeText(item.name)}</strong><em>${escapeText(item.shortEffect || item.effectText || 'Recommended fit')}</em></span><span class="badge recommended-badge">Recommended</span>${item.isDuplicate ? '<span class="badge warning-badge">Duplicate</span>' : '<span class="badge legal-badge">Legal</span>'}</button>`;
  return `<section class="recommended-items-compact"><div class="recommended-items-head"><strong>Recommended items</strong><span>Top ${top.length}</span></div><div class="recommended-item-list">${top.map(renderRow).join('')}</div>${rest.length ? `<details class="recommended-more"><summary>Show More</summary><div class="recommended-item-list extra">${rest.map(renderRow).join('')}</div></details>` : ''}</section>`;
}

function selectedItemSummary(selected, data, recommended = []) {
  const requirement = megaRequirementLine(selected, data);
  return `<section class="selected-item-card selected-item-summary ${selected.isDuplicate ? 'illegal' : ''}">
    <span class="selected-item-label">Current item</span>
    <div class="selected-item-title-row"><strong>${escapeText(selected.name)}</strong>${selected.isMegaStone ? '<span class="badge mega-badge compact-badge">Mega Stone</span>' : ''}${selected.isDuplicate ? '<span class="badge warning-badge compact-badge">Duplicate</span>' : '<span class="badge legal-badge compact-badge">Legal</span>'}</div>
    <p>${escapeText(selected.isDuplicate ? `Already used by ${selected.usedBy.join(', ')}` : selected.shortEffect || selected.effectText || 'No effect text available.')}</p>
    ${requirement ? `<p class="mega-requirement-line">${escapeText(requirement)}</p>` : ''}${selected.fitReason ? `<p class="muted small-copy">${escapeText(selected.fitReason)}</p>` : ''}
    <div class="selected-item-actions"><button type="button" class="tiny-button secondary-button" data-selector-clear data-selector-kind="item" data-slot="${escapeText(selected.currentSlotIndex ?? '')}" aria-label="Clear item">Clear item</button></div>
    ${recommended.length ? `<details class="recommended-items-compact collapsed-recommendations"><summary aria-expanded="false">Show recommendations</summary>${recommendedItemsPanel(recommended).replace('recommended-items-compact', 'recommended-items-compact nested-recommendations')}</details>` : ''}
  </section>`;
}

function toItemOption(item, selectedItemId, recommended, data) {
  const requiredFor = megaRequirementLine(item, data);
  return {
    value: item.itemId,
    label: item.name,
    detail: item.shortEffect,
    meta: [item.category, requiredFor].filter(Boolean),
    restricted: item.isDuplicate && selectedItemId !== item.itemId,
    selected: selectedItemId === item.itemId,
    badges: [
      recommended ? { label: 'Recommended', className: 'recommended-badge' } : null,
      item.isMegaStone ? { label: 'Mega Stone', className: 'mega-badge' } : null,
      item.isDuplicate ? { label: 'Duplicate', className: 'warning-badge' } : { label: 'Legal', className: 'legal-badge' }
    ].filter(Boolean),
    searchTerms: [item.effectText, item.shortEffect, item.category, ...(item.strategicTags || []), item.isMegaStone ? 'mega stone mega evolution' : '', requiredFor]
  };
}

function megaRequirementLine(item, data) {
  if (!item?.isMegaStone) return '';
  const map = getMegaRequirementMap(data);
  const name = map.get(item.itemId);
  return name ? `Required for ${name}` : '';
}

function getMegaRequirementMap(data) {
  if (megaRequirementCache.has(data)) return megaRequirementCache.get(data);
  const map = new Map();
  for (const row of data.collections?.pokemon || []) {
    for (const option of getMegaOptions(row.pokemon_id, data)) {
      if (option.requiredItemId && !map.has(option.requiredItemId)) map.set(option.requiredItemId, option.megaName);
    }
    const req = getMegaRequirement(row.pokemon_id, data);
    if (req?.requiredItemId && !map.has(req.requiredItemId)) map.set(req.requiredItemId, req.megaName);
  }
  megaRequirementCache.set(data, map);
  return map;
}

function getCachedRecommendedItems(pokemon, team, allItems, data, slotIndex) {
  const key = `${pokemon?.pokemon_id || ''}|${slotIndex}|${teamItemKey(team)}`;
  if (recommendedItemCache.has(key)) return recommendedItemCache.get(key);
  const items = getRecommendedItemsForPokemon(pokemon, team, allItems, { ...data, currentSlotIndex: slotIndex }).map((item) => ({ ...item, currentSlotIndex: slotIndex }));
  recommendedItemCache.set(key, items);
  return items;
}

function getCachedNormalizedItems(allItems, pokemon, team, slotIndex, data) {
  const key = `${pokemon?.pokemon_id || ''}|${slotIndex}|${teamItemKey(team)}`;
  if (itemOptionCache.has(key)) return itemOptionCache.get(key);
  const items = allItems.map((item) => normaliseItemOption(item, pokemon, team, slotIndex, data));
  itemOptionCache.set(key, items);
  return items;
}

function teamItemKey(team) {
  return (team || []).map((slot) => slot?.item_id || '').join('|');
}

function itemDetails(item) {
  return `<details class="item-detail-panel compact-item-details">
    <summary><span>More item context</span><strong>${escapeText(item.name)}</strong></summary>
    <div class="item-detail-body">
      <p><strong>Strategic fit:</strong> ${escapeText(item.fitReason || item.category || 'General utility')}</p>
      <p><strong>Legality:</strong> ${escapeText(item.legalityStatus || 'Legal')}${item.usedBy?.length ? ` — Already used by ${escapeText(item.usedBy.join(', '))}` : ''}</p>
      ${item.warningText ? `<p class="warning"><strong>Warning:</strong> ${escapeText(item.warningText)}</p>` : ''}
    </div>
  </details>`;
}

function legalItems(data) {
  const source = data.collections.items || [];
  if (legalItemCache && legalItemCacheSource === source) return legalItemCache;
  legalItemCacheSource = source;
  legalItemCache = source
    .filter((item) => String(item.is_legal || item.legal || 'Yes').toLowerCase() !== 'no')
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return legalItemCache;
}
