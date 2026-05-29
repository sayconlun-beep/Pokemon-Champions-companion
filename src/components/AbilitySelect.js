import { getReadableAbilityName } from '../utils/displayNames.js';
const abilityOptionsCache = new Map();

export function AbilitySelect(slotIndex, slot, data) {
  const selectedId = slot?.ability_id || '';
  const options = getAbilityOptions(slot?.pokemon_id, data).map((option) => ({ ...option, selected: selectedId === option.value }));
  const rows = options.map((option) => abilityRow(option, slotIndex)).join('');
  const empty = (data.indexes.abilitiesByPokemon[slot?.pokemon_id] || []).length
    ? 'No legal abilities are currently selectable for this Pokémon.'
    : 'Ability data missing for this Pokémon.';

  return `<div class="ability-card-picker" data-selector-wrap data-selector-kind="ability" data-slot="${slotIndex}">
    <div class="ability-card-picker-head">
      <h5>Ability</h5>
      ${selectedId ? `<button type="button" class="tiny-button secondary-button" data-selector-clear data-selector-kind="ability" data-slot="${slotIndex}">Clear ability</button>` : ''}
    </div>
    <div class="ability-card-options" role="radiogroup" aria-label="Ability selector">
      ${rows || `<p class="muted small-copy">${escapeText(empty)}</p>`}
    </div>
  </div>`;
}

function abilityRow(option, slotIndex) {
  return `<button type="button" class="ability-choice-card ${option.selected ? 'selected' : ''}" data-selector-option="${escapeText(option.value)}" data-selector-kind="ability" data-slot="${slotIndex}" data-option-label="${escapeText(option.label)}" data-selected="${option.selected ? 'true' : 'false'}" role="radio" aria-checked="${option.selected ? 'true' : 'false'}">
    <span class="ability-choice-check" aria-hidden="true">${option.selected ? '✓' : ''}</span>
    <span class="ability-choice-copy">
      <strong>${escapeText(option.label)}</strong>
      ${option.detail ? `<em>${escapeText(option.detail)}</em>` : ''}
    </span>
  </button>`;
}

function getAbilityOptions(pokemonId, data) {
  if (!pokemonId) return [];
  const cacheKey = pokemonId;
  if (abilityOptionsCache.has(cacheKey)) return abilityOptionsCache.get(cacheKey);
  const rows = (data.indexes.abilitiesByPokemon[pokemonId] || []);
  const options = rows
    .filter((row) => String(row.is_legal || 'Yes').toLowerCase() !== 'no')
    .map((row) => data.indexes.abilitiesById[row.ability_id] || { ability_id: row.ability_id, name: row.ability_name, effect: row.effect })
    .filter(Boolean)
    .sort((a, b) => String(getReadableAbilityName(a, '')).localeCompare(String(getReadableAbilityName(b, ''))))
    .map((ability) => ({
      value: ability.ability_id,
      label: getReadableAbilityName(ability),
      detail: summarize(ability.effect || ability.description || ability.notes || ''),
      searchTerms: [ability.effect, ability.description, ability.notes]
    }));
  abilityOptionsCache.set(cacheKey, options);
  return options;
}

function summarize(value) { const clean = String(value || '').replace(/\s+/g, ' ').trim(); return clean.length > 110 ? `${clean.slice(0, 107)}…` : clean; }

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
