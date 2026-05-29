import { loadMoveLegalityData, hasMoveLegalityData } from '../data/dataLoader.js';
import { clearMoveOptionsCache } from '../components/MoveSelect.js';
import { getPokemonSpriteById } from '../utils/pokemonSprites.js';

export function clearDropdownPortal() {
  if (typeof document === 'undefined') return;
  const portal = document.getElementById('dropdown-portal');
  if (!portal) return;
  portal.querySelectorAll('[data-selector-dropdown]').forEach((dropdown) => dropdown.remove());
  portal.classList.remove('selector-sheet-portal-open');
  portal.classList.remove('compact-move-picker-portal-open');
  document.body.classList.remove('selector-sheet-open');
  document.body.classList.remove('compact-move-picker-open');
}

export function ensureDropdownPortal() {
  if (typeof document === 'undefined') return null;
  let portal = document.getElementById('dropdown-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'dropdown-portal';
    portal.setAttribute('style', 'position:fixed;top:0;left:0;width:0;height:0;z-index:300;pointer-events:none;');
    document.body.appendChild(portal);
  }
  return portal;
}

export function installDropdownPortal() {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDropdownPortal, { once: true });
  } else {
    ensureDropdownPortal();
  }
}

installDropdownPortal();


export function getSelectorDropdown(wrap) {
  if (!wrap) return null;
  const portalId = wrap.dataset.portalId || '';
  return wrap.querySelector('[data-selector-dropdown]') || (portalId ? document.querySelector(`#dropdown-portal [data-selector-dropdown][data-portal-id="${CSS.escape(portalId)}"]`) : null);
}

export function getSelectorWrapForDropdown(dropdown) {
  if (!dropdown) return null;
  const portalId = dropdown.dataset.portalId || '';
  if (portalId) return document.querySelector(`[data-selector-wrap][data-portal-id="${CSS.escape(portalId)}"]`);
  return dropdown.closest('[data-selector-wrap]');
}

export function isMobileTeamBuilderSelector(wrap) {
  // The Team Builder uses the same selection system on every viewport. Pokémon,
  // Item, and Move selection open the direct modal picker (renderDirect*Picker)
  // and Nature uses the same anchored portal dropdown that desktop uses, just
  // sized down by CSS. No width/UA/pointer branch should ever swap the legacy
  // bottom-sheet layout back in — real phones, foldables, and a narrowed
  // desktop window all render the modern component tree.
  void wrap;
  return false;
}


export function ensureMobileSelectorSheetSearch(dropdown, wrap) {
  if (!dropdown || !wrap) return;
  const sourceInput = wrap.querySelector('[data-selector-search]');
  const label = wrap.querySelector('label')?.textContent?.trim() || 'Search';
  const head = dropdown.querySelector('[data-selector-sheet-head]');
  if (!head) return;

  let sheetSearch = dropdown.querySelector('[data-selector-sheet-search]');
  if (!sheetSearch) {
    sheetSearch = document.createElement('input');
    sheetSearch.type = 'search';
    sheetSearch.className = 'selector-sheet-search';
    sheetSearch.setAttribute('data-selector-sheet-search', '');
    sheetSearch.setAttribute('autocomplete', 'off');
    sheetSearch.setAttribute('autocapitalize', 'off');
    sheetSearch.setAttribute('spellcheck', 'false');
    head.insertAdjacentElement('afterend', sheetSearch);
  }

  sheetSearch.setAttribute('aria-description', `Search ${label.toLowerCase()}`);
  sheetSearch.setAttribute('aria-label', `Search ${label}`);
  sheetSearch.value = sourceInput?.value || '';

  // Keep typing focused in the visible sheet input on mobile. The original
  // combobox input stays in the card behind the sheet and only stores state.
  window.requestAnimationFrame(() => {
    try { sheetSearch.focus({ preventScroll: true }); } catch {}
    try { sheetSearch.setSelectionRange(sheetSearch.value.length, sheetSearch.value.length); } catch {}
  });
}

export function portalComboboxDropdown(wrap) {
  if (!wrap) return;
  const dropdown = getSelectorDropdown(wrap);
  const button = wrap.querySelector('.selector-card-button');
  const portal = ensureDropdownPortal();
  if (!dropdown || !button || !portal) return;
  const portalId = wrap.dataset.portalId || dropdown.dataset.portalId || '';
  if (portalId) {
    wrap.dataset.portalId = portalId;
    dropdown.dataset.portalId = portalId;
  }
  if (!dropdown.__selectorOriginalParent) dropdown.__selectorOriginalParent = dropdown.parentElement;

  const mobileSheet = isMobileTeamBuilderSelector(wrap);
  const compactMovePicker = Boolean(wrap.closest('[data-compact-move-editor]'));
  portal.appendChild(dropdown);
  dropdown.classList.toggle('mobile-bottom-sheet', mobileSheet);
  dropdown.classList.toggle('compact-move-picker-dropdown', compactMovePicker && !mobileSheet);
  document.body.classList.toggle('selector-sheet-open', mobileSheet);
  portal.classList.toggle('selector-sheet-portal-open', mobileSheet);
  portal.classList.toggle('compact-move-picker-portal-open', compactMovePicker && !mobileSheet);
  document.body.classList.toggle('compact-move-picker-open', compactMovePicker && !mobileSheet);
  if (mobileSheet) {
    ensureMobileSelectorSheetSearch(dropdown, wrap);
    dropdown.style.position = 'fixed';
    dropdown.style.top = 'auto';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.bottom = '0';
    dropdown.style.width = '100%';
    dropdown.style.maxWidth = '100vw';
    dropdown.style.height = 'min(74dvh, 34rem)';
    dropdown.style.maxHeight = 'min(74dvh, 34rem)';
    dropdown.style.overflowY = 'hidden';
    dropdown.style.overflowX = 'hidden';
    dropdown.style.touchAction = 'pan-y';
    dropdown.style.pointerEvents = 'auto';
    dropdown.style.display = 'flex';
    return;
  }

  if (compactMovePicker) {
    ensureMobileSelectorSheetSearch(dropdown, wrap);
    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720;
    const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 360;
    dropdown.style.position = 'fixed';
    dropdown.style.top = '50%';
    dropdown.style.left = '50%';
    dropdown.style.right = 'auto';
    dropdown.style.bottom = 'auto';
    dropdown.style.transform = 'translate(-50%, -50%)';
    dropdown.style.width = `${Math.min(viewportWidth - 24, 1024)}px`;
    dropdown.style.maxWidth = 'calc(100vw - 24px)';
    dropdown.style.height = `${Math.min(viewportHeight - 24, 860)}px`;
    dropdown.style.maxHeight = 'calc(100dvh - 24px)';
    dropdown.style.overflowY = 'hidden';
    dropdown.style.overflowX = 'hidden';
    dropdown.style.touchAction = 'pan-y';
    dropdown.style.pointerEvents = 'auto';
    dropdown.style.display = 'grid';
    return;
  }

  const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720;
  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 360;
  const gap = 6;
  const safeBottom = 10;
  let rect = button.getBoundingClientRect();
  let anchorWidth = rect.width;

  // Compact move rows keep the real SearchableSelector input visually hidden so
  // the section does not show four large boxes. That means the normal selector
  // button can measure as 0px wide, which made the portalled dropdown open at
  // 0px width and look like the Add/Change buttons did nothing. Anchor the
  // move dropdown to the compact editor card instead while keeping the same
  // selector/search/state machinery underneath.
  const compactEditor = wrap.closest('[data-compact-move-editor]');
  if (compactEditor && anchorWidth < 16) {
    const editorRect = compactEditor.getBoundingClientRect();
    const actionRect = compactEditor.querySelector('.compact-move-actions')?.getBoundingClientRect();
    rect = {
      top: actionRect?.bottom || editorRect.bottom,
      bottom: actionRect?.bottom || editorRect.bottom,
      left: editorRect.left,
      width: Math.min(Math.max(editorRect.width, 280), 440)
    };
    anchorWidth = rect.width;
  }

  const spaceBelow = Math.max(140, viewportHeight - rect.bottom - safeBottom - gap);
  const spaceAbove = Math.max(140, rect.top - safeBottom - gap);
  const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(openAbove ? spaceAbove : spaceBelow, Math.max(220, viewportHeight * 0.58));
  const dropdownWidth = Math.min(Math.max(anchorWidth, 280), viewportWidth - 16);
  const left = Math.max(8, Math.min(rect.left, viewportWidth - dropdownWidth - 8));

  dropdown.style.position = 'fixed';
  dropdown.style.top = openAbove ? 'auto' : `${Math.max(8, rect.bottom + gap)}px`;
  dropdown.style.bottom = openAbove ? `${Math.max(safeBottom, viewportHeight - rect.top + gap)}px` : 'auto';
  dropdown.style.left = `${left}px`;
  dropdown.style.right = 'auto';
  dropdown.style.width = `${dropdownWidth}px`;
  dropdown.style.maxHeight = `${Math.floor(maxHeight)}px`;
  dropdown.style.overflowY = 'auto';
  dropdown.style.touchAction = '';
  dropdown.style.pointerEvents = 'auto';
  dropdown.style.display = 'grid';
}

export function restoreComboboxDropdown(wrap) {
  if (!wrap) return;
  const dropdown = getSelectorDropdown(wrap);
  if (!dropdown) return;
  const originalParent = dropdown.__selectorOriginalParent || wrap;
  if (originalParent && dropdown.parentElement !== originalParent) originalParent.appendChild(dropdown);
  dropdown.classList.remove('mobile-bottom-sheet');
  dropdown.classList.remove('compact-move-picker-dropdown');
  document.body.classList.remove('selector-sheet-open');
  const portal = document.getElementById('dropdown-portal');
  portal?.classList.remove('selector-sheet-portal-open');
  portal?.classList.remove('compact-move-picker-portal-open');
  document.body.classList.remove('compact-move-picker-open');
  dropdown.style.position = '';
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  dropdown.style.right = '';
  dropdown.style.width = '';
  dropdown.style.maxWidth = '';
  dropdown.style.height = '';
  dropdown.style.maxHeight = '';
  dropdown.style.overflowY = '';
  dropdown.style.overflowX = '';
  dropdown.style.webkitOverflowScrolling = '';
  dropdown.style.overscrollBehavior = '';
  dropdown.style.touchAction = '';
  dropdown.style.pointerEvents = '';
  dropdown.style.display = '';
  dropdown.style.transform = '';
  dropdown.style.maxWidth = '';
  dropdown.style.height = '';
}

export function openCombobox(input) {
  const wrap = input.closest('[data-selector-wrap]');
  if (!wrap) return;
  const appRoot = document.getElementById('app');
  const state = appRoot ? getDelegatedState(appRoot) : null;

  if (input.dataset.selectorKind === 'move' && state?.data && !hasMoveLegalityData(state.data)) {
    const slot = input.dataset.slot;
    const moveIndex = input.dataset.moveIndex;
    const pendingSearch = input.value || '';
    renderLazyMoveLoadingState(wrap);
    wrap.classList.add('combobox-open');
    input.setAttribute('aria-expanded', 'true');
    portalComboboxDropdown(wrap);
    loadMoveLegalityData(state.data)
      .then(() => {
        clearMoveOptionsCacheIfAvailable();
        clearDropdownPortal();
        render(appRoot, state);
        window.requestAnimationFrame(() => {
          const nextInput = appRoot.querySelector(`[data-selector-search][data-selector-kind="move"][data-slot="${slot}"][data-move-index="${moveIndex}"]`);
          if (nextInput) {
            // Preserve what the user had already typed while the lazy move
            // learnset payload was loading, then filter the newly-rendered
            // legal move list against that term. Without this, the stale
            // loading dropdown could stay visible and searches appeared empty.
            nextInput.value = pendingSearch;
            nextInput.dataset.selectedLabel = '';
            openCombobox(nextInput);
            filterGenericOptions(nextInput);
            hydrateVisibleDropdownSprites(nextInput);
          }
        });
      })
      .catch((error) => {
        console.error('Move learnset lazy-load failed:', error);
        renderLazyMoveErrorState(wrap, error);
      });
    return;
  }

  wrap.classList.add('combobox-open');
  const dropdown = getSelectorDropdown(wrap);
  dropdown?.classList.remove('force-closed');
  input.setAttribute('aria-expanded', 'true');
  filterGenericOptions(input);
  hydrateVisibleDropdownSprites(input);
  portalComboboxDropdown(wrap);
}

export function renderLazyMoveLoadingState(wrap) {
  const dropdown = getSelectorDropdown(wrap);
  const scroll = dropdown?.querySelector('[data-selector-options-scroll]');
  if (scroll) scroll.innerHTML = '<p class="muted small-copy dropdown-empty">Loading move learnsets…</p>';
}

export function renderLazyMoveErrorState(wrap, error) {
  const dropdown = getSelectorDropdown(wrap);
  const scroll = dropdown?.querySelector('[data-selector-options-scroll]');
  if (scroll) scroll.innerHTML = `<p class="muted small-copy dropdown-empty">Could not load move learnsets: ${escapeText(error?.message || error)}</p>`;
}

export function clearMoveOptionsCacheIfAvailable() {
  clearMoveOptionsCache();
}

export function closeCombobox(wrap) {
  if (!wrap) return;
  const appRoot = document.getElementById('app');
  if (appRoot) appRoot.__ignorePortalOptionClickUntil = 0;
  wrap.classList.remove('combobox-open');
  const dropdown = getSelectorDropdown(wrap);
  dropdown?.classList.add('force-closed');
  restoreComboboxDropdown(wrap);
  const input = wrap.querySelector('[data-selector-search]');
  input?.setAttribute('aria-expanded', 'false');
}

export function filterGenericOptions(input) {
  const wrap = input.closest('[data-selector-wrap]');
  const dropdown = getSelectorDropdown(wrap);
  if (!wrap || !dropdown) return;

  const term = normalizeSearch(input.value || '');
  const selectedLabel = normalizeSearch(input.dataset.selectedLabel || '');
  input.dataset.activeOptionIndex = '0';

  const allOptions = Array.from(dropdown.querySelectorAll('[data-selector-option]'));
  const scored = allOptions
    .map((button, originalIndex) => ({ button, originalIndex, score: scoreComboboxOption(button, term, selectedLabel) }))
    .filter((entry) => entry.score < Number.POSITIVE_INFINITY)
    .sort((a, b) => a.score - b.score || a.originalIndex - b.originalIndex);

  // Do not cap selector results. The team builder needs every legal Pokémon, item,
  // move, and nature to remain reachable from the dropdown. Searching now filters
  // by exact/prefix/substring matches first, so unrelated fuzzy extras no longer
  // crowd out valid forms such as Ninetales (Alolan Form).
  const visible = new Set(scored.map((entry) => entry.button));
  const optionsScroll = dropdown.querySelector('[data-selector-options-scroll]') || dropdown;
  scored.forEach((entry) => optionsScroll.appendChild(entry.button));

  allOptions.forEach((button) => {
    const isVisible = visible.has(button);
    button.hidden = !isVisible;
    button.classList.remove('active');
    button.setAttribute('aria-selected', button.dataset.selected === 'true' ? 'true' : 'false');
  });

  const first = scored[0]?.button;
  if (first && visible.has(first)) {
    first.classList.add('active');
    first.setAttribute('aria-selected', 'true');
  }

  const empty = dropdown.querySelector('.dropdown-empty');
  if (empty) empty.hidden = Boolean(scored.length);
}

export function scoreComboboxOption(button, term, selectedLabel) {
  const label = normalizeSearch(button.dataset.optionLabel || button.textContent || '');
  const haystack = normalizeSearch(button.dataset.searchable || button.textContent || '');
  const isSelected = button.dataset.selected === 'true';

  // When the combobox opens with no search term, show the complete list instead
  // of an arbitrary first page. Keep the already-selected value out of the list
  // only when it exactly mirrors the input.
  if (!term) return isSelected && selectedLabel && label === selectedLabel ? Number.POSITIVE_INFINITY : Number(button.dataset.optionIndex || 0) + 1000;

  const termTokens = term.split(' ').filter(Boolean);
  const haystackTokens = haystack.split(' ').filter(Boolean);

  if (label === term) return isSelected ? 1 : 0;
  if (label.startsWith(term)) return 10 + Math.max(0, label.length - term.length) / 100;

  // Multi-word searches should behave predictably: every typed word must be
  // present somewhere in the option text or aliases. This keeps forms like
  // "Alolan Ninetales" easy to find without surfacing unrelated fuzzy matches.
  if (termTokens.length > 1) {
    const everyTokenMatches = termTokens.every((token) => haystackTokens.some((candidate) => candidate.startsWith(token) || candidate === token));
    if (!everyTokenMatches) return Number.POSITIVE_INFINITY;
    return 40 + termTokens.reduce((score, token) => score + haystack.indexOf(token), 0) / 10;
  }

  const labelContains = label.indexOf(term);
  if (labelContains >= 0) return 100 + labelContains + label.length / 100;

  const aliasPrefixIndex = haystackTokens.findIndex((candidate) => candidate.startsWith(term));
  if (aliasPrefixIndex >= 0) return 130 + aliasPrefixIndex / 10;

  const haystackContains = haystack.indexOf(term);
  if (haystackContains >= 0) return 250 + haystackContains / 10;

  // Do not use broad fuzzy matching in selectors. It made searches like
  // "alolan" return Talonflame/Basculegion/Mudsdale because their letters
  // appeared in order. Returning no match is clearer and keeps dropdowns useful.
  return Number.POSITIVE_INFINITY;
}

export function normalizeSearch(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function fuzzyScore(haystack, needle) {
  if (!needle) return 0;
  let hayIndex = 0;
  let score = 0;
  let lastMatch = -1;
  for (const char of needle) {
    const found = haystack.indexOf(char, hayIndex);
    if (found < 0) return Number.POSITIVE_INFINITY;
    score += found - hayIndex;
    if (lastMatch >= 0 && found === lastMatch + 1) score -= 0.25;
    lastMatch = found;
    hayIndex = found + 1;
  }
  return score + haystack.length / 100;
}

export function visibleGenericOptions(input) {
  const wrap = input.closest('[data-selector-wrap]');
  const dropdown = getSelectorDropdown(wrap);
  return Array.from(dropdown?.querySelectorAll('[data-selector-option]') || []).filter((button) => !button.hidden);
}

export function moveActiveGenericOption(input, direction) {
  const options = visibleGenericOptions(input);
  if (!options.length) return;
  const current = Number(input.dataset.activeOptionIndex || 0);
  const nextIndex = Math.max(0, Math.min(options.length - 1, current + direction));
  input.dataset.activeOptionIndex = String(nextIndex);
  options.forEach((option, index) => {
    const active = index === nextIndex;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', active ? 'true' : option.dataset.selected === 'true' ? 'true' : 'false');
  });
  options[nextIndex].scrollIntoView({ block: 'nearest' });
}

export function hydrateVisibleDropdownSprites(input) {
  const wrap = input.closest('[data-selector-wrap]');
  const dropdown = getSelectorDropdown(wrap);
  const visibleOptions = Array.from(dropdown?.querySelectorAll('[data-selector-option]') || []).filter((button) => !button.hidden).slice(0, 36);
  for (const option of visibleOptions) {
    const image = option.querySelector('img[data-src]');
    if (!image || image.dataset.spriteLoaded === 'true') continue;
    image.dataset.spriteLoaded = 'true';
    image.src = image.dataset.src;
  }
}
