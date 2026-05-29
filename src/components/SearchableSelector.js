export function SearchableSelector({
  kind,
  slotIndex,
  moveIndex = '',
  label,
  selectedLabel = '',
  hint = 'Search…',
  options = [],
  emptyMessage = 'No matching options.',
  extraClass = ''
}) {
  const id = `${kind}-search-${slotIndex}${moveIndex !== '' ? `-${moveIndex}` : ''}`;
  const portalId = `selector-portal-${id}`;
  const rendered = options.map((option, index) => selectorOption(option, kind, slotIndex, moveIndex, index)).join('');
  return `<div class="field search-field searchable-selector ${extraClass}" data-selector-wrap data-portal-id="${escapeText(portalId)}" data-selector-kind="${escapeText(kind)}" data-slot="${slotIndex}" ${moveIndex !== '' ? `data-move-index="${moveIndex}"` : ''}>
    <label for="${escapeText(id)}">${escapeText(label)}</label>
    <div class="selector-input-row selector-card-button ${selectedLabel ? 'has-selection' : 'is-empty'}" data-selector-input-row>
      <input id="${escapeText(id)}" class="selector-search ${escapeText(kind)}-search" data-selector-search data-selector-kind="${escapeText(kind)}" data-slot="${slotIndex}" ${moveIndex !== '' ? `data-move-index="${moveIndex}"` : ''} value="${escapeText(selectedLabel)}" data-hint="${escapeText(hint)}" autocomplete="off" aria-label="${escapeText(label)} selector" aria-autocomplete="list" aria-expanded="false" role="combobox" data-selected-label="${escapeText(selectedLabel)}" />
      ${!selectedLabel ? `<span class="selector-empty-text" aria-hidden="true">${escapeText(emptyTextFor(kind, label))}</span>` : ''}
      ${selectedLabel ? `<button type="button" class="selector-clear" data-selector-clear data-selector-kind="${escapeText(kind)}" data-slot="${slotIndex}" ${moveIndex !== '' ? `data-move-index="${moveIndex}"` : ''} aria-label="Clear ${escapeText(label)}">×</button>` : ''}
      <span class="selector-chevron" aria-hidden="true">⌄</span>
    </div>
    ${hint ? `<p class="selector-helper">${escapeText(selectedLabel ? hint : emptyTextFor(kind, label))}</p>` : ''}
    <div class="dropdown-panel selector-dropdown" data-selector-dropdown data-portal-id="${escapeText(portalId)}" role="listbox">
      <div class="selector-sheet-head" data-selector-sheet-head><span>${escapeText(label)}</span><button type="button" class="tiny-button selector-sheet-close" data-selector-sheet-close aria-label="Close ${escapeText(label)} selector">Close</button></div>
      <div class="selector-options-scroll" data-selector-options-scroll>
        ${rendered || `<p class="muted small-copy dropdown-empty">${escapeText(emptyMessage)}</p>`}
      </div>
    </div>
  </div>`;
}

function emptyTextFor(kind, label) {
  if (kind === 'ability') return 'Choose ability';
  if (kind === 'item') return 'Choose item';
  if (kind === 'nature') return 'Choose nature';
  if (kind === 'move') return 'Choose move';
  return `Choose ${String(label || kind).toLowerCase()}`;
}

function selectorOption(option, kind, slotIndex, moveIndex, index) {
  const badges = (option.badges || []).filter(Boolean).map((badge) => `<span class="badge mini-badge ${escapeText(badge.className || '')}" ${badge.style ? `style="${escapeText(badge.style)}"` : ''}>${escapeText(badge.label || badge)}</span>`).join('');
  const meta = (option.meta || []).filter(Boolean).map(escapeText).join(' · ');
  const sprite = option.sprite ? `<span class="dropdown-sprite-frame" aria-hidden="true"><img class="pokemon-sprite dropdown-pokemon-sprite" src="/assets/pokemon-silhouette.svg" data-src="${escapeText(option.sprite.src)}" alt="" loading="lazy" decoding="async" fetchpriority="low" width="40" height="40" data-pokemon-sprite data-pokemon-id="${escapeText(option.sprite.pokemonId || '')}" data-sprite-stage="home" /></span>` : '';
  const search = [option.label, option.detail, meta, ...(option.searchTerms || []), ...(option.badges || []).map((b) => b.label || b)].filter(Boolean).join(' ');
  return `<button type="button" class="dropdown-option selector-option ${escapeText(kind)}-option ${option.restricted ? 'restricted' : ''} ${option.selected ? 'selected' : ''}" data-selector-option="${escapeText(option.value)}" data-selector-kind="${escapeText(kind)}" data-slot="${slotIndex}" ${moveIndex !== '' ? `data-move-index="${moveIndex}"` : ''} data-searchable="${escapeText(search)}" data-option-index="${index}" data-option-label="${escapeText(option.label)}" data-selected="${option.selected ? 'true' : 'false'}" role="option" aria-selected="${option.selected ? 'true' : 'false'}">
    ${sprite}
    <span class="selector-option-copy">
      <span class="selector-option-title">${escapeText(option.label)}</span>
      ${meta ? `<span class="selector-option-meta">${meta}</span>` : ''}
      ${option.detail ? `<span class="selector-option-detail">${escapeText(option.detail)}</span>` : ''}
    </span>
    ${badges ? `<span class="selector-option-badges">${badges}</span>` : ''}
  </button>`;
}

export function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
