import { loadGoldStandardData, loadMoveLegalityData, hasMoveLegalityData } from '../data/dataLoader.js';
import { getRoute, getRouteOrDefault, safeRouteFromLocation, isKnownRoutePath, routeFromPath } from './routes.js';
import { deleteSavedTeam, loadSavedTeamById, loadSavedTeams, migrateImportedTeam, renameSavedTeam, sanitizeTeam, saveTeam, updateSavedTeam } from '../core/teamMigrationEngine.js';
import { importTeamFromShowdown } from '../core/showdownFormatEngine.js';
import { buildShareTeamUrl, decodeTeamFromUrl, replaceTeamUrlState } from '../core/shareableTeamUrl.js';
import { recommendCandidates } from '../core/goldStandardStrategyEngine.js';
import { getPokemonSprite, getPokemonSpriteById } from '../utils/pokemonSprites.js';
import { checkPokemonLegality, checkTeamLegality } from '../core/legalityEngine.js';
import { candidateConflictsWithTeamMega, analyseTeamMegaState } from '../core/megaEvolutionEngine.js';
import { getRecommendedItemsForPokemon, normaliseItemOption } from '../core/itemEffectEngine.js';
import { STAT_DEFINITIONS, adjustStatAllocation, applyStatPreset, emptyStatAllocation, getSlotStatAllocation, setSlotStatAllocation } from '../core/statAllocationEngine.js';
import { loadProStudyTeams, getProStudyTeamById } from '../core/proTeamDataSource.js';
import { closeMobileMoreMenus, bindMobileMoreDocumentGuards } from '../app-shell/appShellNavigation.js';
import { METADEX_INITIAL_VISIBLE_LIMIT, METADEX_LOAD_MORE_INCREMENT, ensureMetadexView, resetMetadexVisibleLimit, buildMetadexContextFromLink, applyMetadexContextToView } from '../app-shell/appShellRoutes.js';
import { scrollSelectedMetadexIntoView, focusSelectedMetadexDetail } from '../app-shell/appShellLayout.js';
import { createAppShellRouteHandlers } from '../app-shell/appShellRoutesHandlers.js';
import { bindAppShellEvents } from '../app-shell/appShellEvents.js';
import { renderAppShell } from '../app-shell/appShellRender.js';
import { metadexSearchSignature, renderMetadexDynamicRegions } from '../app-shell/metadexRegionRender.js';
import { getSelectorDropdown, getSelectorWrapForDropdown, openCombobox, closeCombobox, filterGenericOptions, normalizeSearch, visibleGenericOptions, moveActiveGenericOption, hydrateVisibleDropdownSprites, clearDropdownPortal } from '../app-shell/appShellSearch.js';
import { getPokemonTypeChipStyle } from '../constants/pokemonTypeColors.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, getPokemonDisplayName, getPokemonFormLabel, resolveGroupedPokemonId } from '../utils/formGrouping.js';
import { renderMetadexDetailOverlay } from '../pages/metadex/renderMetadexDetailPanel.js';
import { createAppState, createInitialAppState } from './appState.js';
import { clearTeamBuilderRecommendationPending, getTeamBuilderRecommendation, isTeamBuilderRecommendationPending, markTeamBuilderRecommendationPending, resetTeamBuilderRecommendationMemo, setTeamBuilderRecommendation, teamRecommendationKey } from '../logic/recommendationMemo.js';

let metadexSearchRenderTimer = 0;
let lastMetadexSearchSignature = '';

export async function mountApp(root) {
  const initialRoute = safeRouteFromLocation(window.location);
  if (window.location.pathname === '/' || !isKnownRoutePath(window.location.pathname)) {
    window.history.replaceState({ routeId: initialRoute.id }, '', initialRoute.path);
  }

  const appState = createAppState(createInitialAppState({
    initialRouteId: initialRoute.id,
    slotUiState: loadSlotUiState()
  }));
  const state = appState.get();
  appState.subscribe((nextState) => render(root, nextState));

  try {
    const params = new URLSearchParams(window.location.search || '');
    if (initialRoute.id === 'metadex') {
      const targetType = params.get('answerType') || params.get('targetType') || '';
      const guideStep = Number(params.get('guideStep') || 0);
      const source = params.get('source') || (targetType ? 'weakness-coverage' : guideStep ? 'team-building-guide' : '');
      if (targetType || guideStep || source) {
        applyMetadexContextToView(state, {
          source,
          guideStep,
          intent: params.get('intent') || (targetType ? 'weakness-answer' : 'guide-step'),
          targetType,
          targetRole: params.get('targetRole') || '',
          targetArchetype: params.get('targetArchetype') || '',
          currentTeamSnapshot: []
        });
      } else if (initialRoute.id === 'items') {
        const itemId = params.get('item') || params.get('itemId') || '';
        const itemSearch = params.get('search') || '';
        state.items = { search: itemSearch, category: 'all', use: 'any', sort: 'alphabetical', selectedId: itemId };
      }
    }
  } catch {}

  root.innerHTML = '<main class="shell"><section class="card"><h1>Loading gold-standard app…</h1><p>Loading core Pokémon, move, item, and ability data. Large learnsets load only when needed.</p></section></main>';
  state.data = await loadGoldStandardData();
  hydrateTeamFromUrlIfPresent(state);
  await refreshProTeamLibraryState(state);

  window.addEventListener('popstate', () => {
    state.route = safeRouteFromLocation(window.location).id;
    appState.update((current) => current);
  });

  appState.update((current) => current);
}

function render(root, state) {
  clearDropdownPortal();
  renderAppShell(root, state, bind);
  lastMetadexSearchSignature = state?.route === 'metadex' ? metadexSearchSignature(state) : '';
  syncShareableTeamUrl(state);
}

function hydrateTeamFromUrlIfPresent(state) {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const encodedTeam = params.get('team');
    if (!encodedTeam) return;
    const result = decodeTeamFromUrl(encodedTeam);
    if (result.ok) {
      state.team = sanitizeTeam(result.team);
      state.activeSavedTeamId = '';
      state.shareUrlNotice = 'Loaded team from shared URL.';
      state.shareUrlWarning = '';
      state.slotUiState = state.team.map((slot) => ({ collapsed: Boolean(slot?.pokemon_id) }));
      scheduleSlotUiStateSave(state);
    } else {
      state.shareUrlWarning = result.warning || 'That shared team link could not be loaded.';
    }
  } catch (_) {
    state.shareUrlWarning = 'That shared team link could not be loaded.';
  }
}

function syncShareableTeamUrl(state) {
  try {
    replaceTeamUrlState(state.team, state.route);
  } catch (_) {}
}

async function refreshProTeamLibraryState(state) {
  state.proTeamLibraryState = { status: 'loading', teams: [], error: '' };
  try {
    const teams = await loadProStudyTeams({ data: state.data });
    state.proTeamLibraryState = { status: 'ready', teams, error: '' };
    state.importedProTeamState = {
      status: teams.length ? 'ready' : 'empty',
      teams,
      lastImportedAt: teams.length ? new Date().toISOString() : ''
    };
    state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
    state.proStudySelectionState.selectedId = teams[0]?.id || '';
  } catch (error) {
    state.proTeamLibraryState = { status: 'error', teams: [], error: error?.message || 'Unable to load pro teams.' };
    state.importedProTeamState = { status: 'error', teams: [], lastImportedAt: '' };
    state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
    state.proStudySelectionState.selectedId = '';
  }
}

function createProStudySnapshot(state) {
  return {
    team: cloneTeamForState(state.team),
    activeSavedTeamId: state.activeSavedTeamId || '',
    slotUiState: cloneJson(state.slotUiState || []),
    matchupsScenario: cloneJson(state.matchupsScenario || { selectedOpponentId: '' }),
    importExport: cloneJson(state.importExport || { mode: 'champions', draft: '', lastResult: null }),
    route: state.route || 'team-builder'
  };
}

function hydrateProStudySandbox(state, proTeam) {
  state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
  if (!state.proStudySelectionState.activeSandbox?.snapshot) {
    state.proStudySelectionState.activeSandbox = {
      teamId: proTeam.id,
      playerName: proTeam.playerName || proTeam.player || '',
      tournament: proTeam.tournament || '',
      snapshot: createProStudySnapshot(state)
    };
  } else {
    state.proStudySelectionState.activeSandbox.teamId = proTeam.id;
    state.proStudySelectionState.activeSandbox.playerName = proTeam.playerName || proTeam.player || '';
    state.proStudySelectionState.activeSandbox.tournament = proTeam.tournament || '';
  }

  state.team = cloneTeamForState(proTeam.roster.map((slot) => ({ ...createEmptyTeamSlot(slot.pokemon_id), ...slot })));
  state.activeSavedTeamId = '';
  state.activeProStudyTeamId = proTeam.id;
  state.slotUiState = state.team.map(() => ({ collapsed: true }));
  state.matchupsScenario = { selectedOpponentId: '' };
  markTeamBuilderDerivedWorkDirty(state);
}

function restoreProStudySnapshot(state) {
  const sandbox = state.proStudySelectionState?.activeSandbox;
  const snapshot = sandbox?.snapshot;
  if (!snapshot) return false;
  state.team = cloneTeamForState(snapshot.team || []);
  state.activeSavedTeamId = snapshot.activeSavedTeamId || '';
  state.activeProStudyTeamId = '';
  state.slotUiState = cloneJson(snapshot.slotUiState || []);
  state.matchupsScenario = cloneJson(snapshot.matchupsScenario || { selectedOpponentId: '' });
  state.importExport = cloneJson(snapshot.importExport || { mode: 'champions', draft: '', lastResult: null });
  state.route = snapshot.route || 'team-builder';
  state.proStudySelectionState.activeSandbox = null;
  markTeamBuilderDerivedWorkDirty(state);
  return true;
}

function cloneTeamForState(team = []) {
  const clone = cloneJson(Array.isArray(team) ? team : []);
  return Array.from({ length: 6 }, (_, index) => clone[index] || null);
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function bind(root, state) {
  bindAppShellEvents(root, state, {
    bindMobileMoreDocumentGuards,
    handleDelegatedPointerDown,
    handleDelegatedRouteClick,
    handleMetadexSelectCapture,
    handleDelegatedClick,
    handleDelegatedChange,
    handleDelegatedInput,
    handleDelegatedKeydown,
    handleDelegatedFocusIn,
    handleDelegatedBlur,
    handleDelegatedToggle,
    handleSpriteError,
    handleDropdownPortalPointerDown,
    handleDropdownPortalClick,
    handleDropdownPortalInput
  });
}

function handleDropdownPortalPointerDown(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  const openSheet = document.querySelector('#dropdown-portal .selector-dropdown.mobile-bottom-sheet');
  const openDropdown = document.querySelector('#dropdown-portal [data-selector-dropdown]');
  const activeWrap = openDropdown ? getSelectorWrapForDropdown(openDropdown) : null;

  const closeButton = target.closest('#dropdown-portal [data-selector-sheet-close]');
  if (closeButton) {
    event.preventDefault();
    event.stopPropagation();
    closeCombobox(getSelectorWrapForDropdown(closeButton.closest('[data-selector-dropdown]')));
    return;
  }

  const selectorOption = target.closest('#dropdown-portal [data-selector-option]');
  if (selectorOption) {
    // Do not select on pointerdown inside the mobile bottom sheet. Android/iOS
    // need the pointer stream to remain uncancelled so a drag on an option can
    // become a real scroll gesture. Selection happens on click instead.
    if (target.closest('#dropdown-portal .selector-dropdown.mobile-bottom-sheet')) return;
    event.preventDefault();
    event.stopPropagation();
    root.__suppressNextSelectorClick = true;
    selectGenericOption(selectorOption, state, root);
    return;
  }

  // On mobile Team Builder, the portaled dropdown is a bottom sheet. Tapping the
  // dimmed area outside it should close the sheet, while the page behind stays
  // locked and does not receive a stray click/scroll. Desktop compact move
  // picking uses the same page-like overlay behaviour.
  if (openSheet && !target.closest('#dropdown-portal .selector-dropdown.mobile-bottom-sheet') && !target.closest('[data-selector-wrap]')) {
    event.preventDefault();
    event.stopPropagation();
    closeCombobox(activeWrap);
    return;
  }

  const openCompactMovePicker = document.querySelector('#dropdown-portal .selector-dropdown.compact-move-picker-dropdown');
  if (openCompactMovePicker && !target.closest('#dropdown-portal .selector-dropdown.compact-move-picker-dropdown') && !target.closest('[data-selector-wrap]')) {
    event.preventDefault();
    event.stopPropagation();
    closeCombobox(activeWrap);
    return;
  }
}

function handleDropdownPortalClick(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;
  const portalClose = target.closest('#dropdown-portal [data-selector-sheet-close]');
  if (portalClose) {
    event.preventDefault();
    event.stopPropagation();
    closeCombobox(getSelectorWrapForDropdown(portalClose.closest('[data-selector-dropdown]')));
    return;
  }
  const option = target.closest('#dropdown-portal [data-selector-option]');
  if (!option) return;
  event.preventDefault();
  event.stopPropagation();
  if (Date.now() < Number(root.__ignorePortalOptionClickUntil || 0)) {
    root.__ignorePortalOptionClickUntil = 0;
    return;
  }
  root.__suppressNextSelectorClick = true;
  selectGenericOption(option, state, root);
}

function handleDropdownPortalInput(root, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches('#dropdown-portal [data-selector-sheet-search]')) return;
  const dropdown = target.closest('[data-selector-dropdown]');
  const wrap = getSelectorWrapForDropdown(dropdown);
  const sourceInput = wrap?.querySelector('[data-selector-search]');
  if (!sourceInput) return;

  event.stopPropagation();
  sourceInput.value = target.value || '';
  filterGenericOptions(sourceInput);
  hydrateVisibleDropdownSprites(sourceInput);
}


function openMetadexDetailOverlay(root, state, selectedId = '') {
  if (!selectedId) return false;
  const data = state?.data || {};
  const resolvedId = resolveGroupedPokemonId(selectedId, data) || selectedId;
  const pokemon = getGroupedPokemonOptions(data).find((entry) => entry?.pokemon_id === resolvedId)
    || data?.indexes?.pokemonById?.[resolvedId]
    || null;
  if (!pokemon) return false;

  state.metadex ||= { search: '', legality: 'all', field: 'all', selectedId: '', megaOnly: false };
  state.metadex.selectedId = resolvedId;

  document.querySelectorAll('[data-metadex-detail-overlay]').forEach((node) => node.remove());
  const host = document.createElement('div');
  host.innerHTML = renderMetadexDetailOverlay(pokemon, state).trim();
  const overlay = host.firstElementChild;
  if (!overlay) return false;
  document.body.appendChild(overlay);
  document.body.classList.add('compact-move-picker-open');

  const close = () => {
    overlay.remove();
    document.body.classList.remove('compact-move-picker-open');
    if (state?.metadex) state.metadex.selectedId = '';
    root?.querySelector?.('.metadex-grid .metadex-tile')?.focus?.({ preventScroll: true });
  };
  overlay.querySelector('[data-action="close-metadex-detail"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  overlay.querySelector('.metadex-detail-overlay-panel')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  window.setTimeout(() => {
    overlay.querySelector('[data-action="close-metadex-detail"]')?.focus?.({ preventScroll: true });
    overlay.querySelector('.metadex-detail-overlay-panel')?.scrollIntoView?.({ block: 'start', inline: 'nearest' });
  }, 0);
  return true;
}

function selectMetadexResult(root, state, selectedId = '', { fromPointer = false } = {}) {
  if (!selectedId) return false;
  const view = ensureMetadexView(state);
  const isSameSelection = view.selectedId === selectedId;
  view.selectedId = isMetaDexMobileViewport() && isSameSelection && !fromPointer ? '' : selectedId;
  render(root, state);
  if (view.selectedId) {
    scrollSelectedMetadexIntoView(root);
    focusSelectedMetadexDetail(root);
  }
  return true;
}

function handleDelegatedPointerDown(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  const selectorFocus = target.closest('[data-selector-focus]');
  if (selectorFocus && root.contains(selectorFocus)) {
    event.preventDefault();
    event.stopPropagation();
    root.querySelectorAll('[data-selector-wrap].combobox-open').forEach((wrap) => closeCombobox(wrap));
    // Open page-style pickers directly from the first pointer event and swallow
    // the synthetic click that follows on mobile. After a Pokémon has already
    // been selected, Android/Fold browsers can otherwise replay the click into
    // the freshly rendered slot header, which immediately closes/replaces the
    // picker and makes changing Pokémon feel impossible.
    root.__suppressNextSelectorFocusClick = true;
    root.__selectorCardPointerOpened = null;
    openSelectorFocusControl(selectorFocus, root);
    if (selectorFocus.dataset.selectorFocus !== 'pokemon') {
      root.__ignorePortalOptionClickUntil = Date.now() + 250;
    }
    return;
  }

  const activeSelector = target.closest('[data-selector-wrap]');
  root.querySelectorAll('[data-selector-wrap].combobox-open').forEach((wrap) => {
    if (wrap !== activeSelector) closeCombobox(wrap);
  });

  const activeMoreMenu = target.closest('[data-mobile-more]');
  closeMobileMoreMenus(root, activeMoreMenu);

  const selectorClear = target.closest('[data-selector-clear]');
  if (selectorClear && root.contains(selectorClear)) {
    // Clear immediately on pointerdown so the overlaid selector input/card cannot
    // steal the interaction before the click event fires. This keeps every clear
    // X reliable across Pokémon, Ability, Item, Nature, and Move selectors.
    event.preventDefault();
    event.stopPropagation();
    root.__suppressNextSelectorClearClick = true;
    clearGenericSelector(selectorClear, state, root);
    return;
  }

  const selectorInputRow = target.closest('[data-selector-input-row]');
  if (selectorInputRow && root.contains(selectorInputRow)) {
    const input = selectorInputRow.querySelector('[data-selector-search]');
    if (input) {
      // Treat every polished selector card as one stable click target. This fixes
      // clicks on placeholder text/empty card space across Pokémon, Ability, Item,
      // Nature, and Move selectors by preventing the browser's native input click
      // from briefly focusing/blurring and closing the combobox again.
      event.preventDefault();
      input.focus({ preventScroll: true });
      openCombobox(input);
      // Opening the mobile bottom sheet during pointerdown can leave the
      // pointerup/click over the first option (usually Abomasnow). Ignore
      // portal option clicks from this same tap so opening never selects.
      root.__ignorePortalOptionClickUntil = Date.now() + 450;
      root.__selectorCardPointerOpened = input;
      return;
    }
  }

  const selectorInput = target.closest('[data-selector-search]');
  if (selectorInput && root.contains(selectorInput)) {
    openCombobox(selectorInput);
    return;
  }

  const selectorOption = target.closest('[data-selector-option]');
  if (selectorOption && root.contains(selectorOption)) {
    event.preventDefault();
    root.__suppressNextSelectorClick = true;
    selectGenericOption(selectorOption, state, root);
    return;
  }

  // MetaDex tile selection is handled on click capture instead of pointerdown.
  // Rendering during pointerdown can remove the tapped tile before the browser
  // dispatches click, which made some desktop builds appear to do nothing.
}

function openSelectorFocusControl(selectorFocus, root) {
  const state = getDelegatedState(root);
  const slotIndex = Number(selectorFocus.dataset.slot);
  const kind = selectorFocus.dataset.selectorFocus;
  const moveIndex = selectorFocus.dataset.moveIndex;

  // When a move is removed, the compact move list is rebuilt on the next
  // animation frame. A quick tap on the newly-available + Add Move button could
  // otherwise race that pending rebuild: the selector briefly opens, then the
  // scheduled render immediately replaces the DOM and makes the tap look like it
  // did nothing. Flush that pending render before resolving the hidden move
  // selector so + Add Move is reliable after clearing a move.
  if (kind === 'move' && state?.__renderScheduled) {
    state.__renderScheduled = false;
    render(root, state);
  }

  const escapedMoveIndex = moveIndex !== undefined && window.CSS?.escape
    ? CSS.escape(String(moveIndex))
    : String(moveIndex || '').replace(/"/g, '\"');
  const moveFilter = moveIndex !== undefined ? `[data-move-index="${escapedMoveIndex}"]` : '';
  let input = root.querySelector(`[data-selector-wrap][data-selector-kind="${kind}"][data-slot="${slotIndex}"]${moveFilter} [data-selector-search]`);

  // Safety fallback for stale compact move DOM: render once and retry instead
  // of swallowing the tap.
  if (!input && kind === 'move' && state) {
    render(root, state);
    input = root.querySelector(`[data-selector-wrap][data-selector-kind="${kind}"][data-slot="${slotIndex}"]${moveFilter} [data-selector-search]`);
  }

  if (!input) {
    if (kind === 'move') openDirectMovePicker(slotIndex, Number(moveIndex || 0), state, root);
    if (kind === 'item') openDirectItemPicker(slotIndex, state, root);
    if (kind === 'pokemon') openDirectPokemonPicker(slotIndex, state, root);
    return kind === 'move' || kind === 'item' || kind === 'pokemon';
  }

  if (kind === 'pokemon') {
    openDirectPokemonPicker(slotIndex, state, root);
    return true;
  }

  if (kind === 'item') {
    openDirectItemPicker(slotIndex, state, root);
    return true;
  }

  // The compact move editor used to depend on invisible legacy selector inputs.
  // On some layouts/browsers those hidden anchors could be swallowed by older CSS,
  // so + Add Move appeared to do nothing. Moves now open a real page-style picker
  // directly from the compact row buttons, then return to the compact move list
  // after selection.
  if (kind === 'move') {
    openDirectMovePicker(slotIndex, Number(moveIndex || 0), state, root);
    return true;
  }

  input.value = '';
  input.dataset.selectedLabel = '';
  try { input.focus({ preventScroll: true }); } catch {}
  openCombobox(input);
  filterGenericOptions(input);
  hydrateVisibleDropdownSprites(input);
  return true;
}

function escapeMovePickerText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function normalizeMovePickerText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function setDirectPickerOptionVisible(option, visible) {
  option.hidden = !visible;
  option.toggleAttribute('aria-hidden', !visible);
  // Some of the picker cards have explicit display:grid/flex rules later in the
  // stylesheet. Setting inline display as well makes filtering reliable on both
  // desktop and real mobile browsers, even if cached/legacy CSS is still loaded.
  option.style.display = visible ? '' : 'none';
}

function movePickerPowerAccuracy(move) {
  const parts = [];
  if (move?.category) parts.push(move.category);
  const power = move?.power ?? '';
  if (power !== '' && power !== '—' && power !== null) parts.push(`Power: ${power}`);
  const pp = move?.pp ?? '';
  if (pp !== '' && pp !== '—' && pp !== null) parts.push(`PP: ${pp}`);
  const accuracy = move?.accuracy ?? '';
  if (accuracy !== '' && accuracy !== '—' && accuracy !== null) {
    const acc = accuracy === 1 ? 100 : Number(accuracy) > 0 && Number(accuracy) <= 1 ? Math.round(Number(accuracy) * 100) : accuracy;
    parts.push(`Accuracy: ${acc}`);
  }
  return parts.join(' · ');
}

function closeDirectMovePicker() {
  document.getElementById('direct-move-picker-overlay')?.remove();
  if (!document.getElementById('direct-item-picker-overlay') && !document.getElementById('direct-pokemon-picker-overlay')) {
    document.body.classList.remove('compact-move-picker-open');
  }
}

function closeAllDirectPickers() {
  document.getElementById('direct-move-picker-overlay')?.remove();
  document.getElementById('direct-item-picker-overlay')?.remove();
  document.getElementById('direct-pokemon-picker-overlay')?.remove();
  document.body.classList.remove('compact-move-picker-open');
}

function armDirectPickerOpenGuard(root, duration = 550) {
  if (!root) return;
  root.__ignoreDirectPickerOptionClickUntil = Date.now() + duration;
}

function shouldIgnoreDirectPickerOptionClick(root) {
  const until = Number(root?.__ignoreDirectPickerOptionClickUntil || 0);
  if (until && Date.now() < until) return true;
  if (root) root.__ignoreDirectPickerOptionClickUntil = 0;
  return false;
}

function renderDirectMovePicker(slotIndex, moveIndex, state, root, loading = false, error = '') {
  closeAllDirectPickers();
  const slot = state?.team?.[slotIndex];
  const pokemonId = slot?.pokemon_id;
  const overlay = document.createElement('div');
  overlay.id = 'direct-move-picker-overlay';
  overlay.className = 'direct-move-picker-overlay';
  overlay.innerHTML = `<div class="direct-move-picker-panel" role="dialog" aria-modal="true" aria-label="Select Move">
    <div class="direct-move-picker-head"><strong>Select Move</strong><button type="button" class="tiny-button direct-move-picker-close" aria-label="Close move selector">×</button></div>
    <input class="direct-move-picker-search" type="search" aria-label="Search moves" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="direct-move-picker-list"></div>
  </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('compact-move-picker-open');
  armDirectPickerOpenGuard(root);

  const list = overlay.querySelector('.direct-move-picker-list');
  const search = overlay.querySelector('.direct-move-picker-search');
  const close = () => closeDirectMovePicker();
  overlay.querySelector('.direct-move-picker-close')?.addEventListener('click', close);
  overlay.querySelector('.direct-move-picker-panel')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  if (!pokemonId) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">Choose a Pokémon before picking moves.</p>';
    search.disabled = true;
    return;
  }
  if (loading) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">Loading legal moves…</p>';
    search.disabled = true;
    return;
  }
  if (error) {
    list.innerHTML = `<p class="muted small-copy dropdown-empty">${escapeMovePickerText(error)}</p>`;
    search.disabled = true;
    return;
  }

  const rows = state.data?.indexes?.movesByPokemon?.[pokemonId] || [];
  const moves = rows
    .map((row) => state.data.indexes.movesById?.[row.move_id] || { move_id: row.move_id, name: row.move_name })
    .filter(Boolean)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  if (!moves.length) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">No legal move data found for this Pokémon.</p>';
    return;
  }

  list.innerHTML = moves.map((move) => {
    const type = move.type || '—';
    const style = move.type ? ` style="${escapeMovePickerText(getPokemonTypeChipStyle(move.type))}"` : '';
    const detail = String(move.effect || move.description || move.notes || '').replace(/\s+/g, ' ').trim();
    const meta = movePickerPowerAccuracy(move);
    const searchable = normalizeMovePickerText([move.name, type, meta, detail].join(' '));
    return `<button type="button" class="direct-move-picker-option" data-move-id="${escapeMovePickerText(move.move_id)}" data-search="${escapeMovePickerText(searchable)}">
      <span class="direct-move-picker-title">${escapeMovePickerText(move.name || move.move_id)}</span>
      <span class="badge mini-badge type-badge type-${escapeMovePickerText(String(type).toLowerCase())}"${style}>${escapeMovePickerText(type)}</span>
      ${detail ? `<span class="direct-move-picker-detail">${escapeMovePickerText(detail)}</span>` : ''}
      ${meta ? `<span class="direct-move-picker-meta">${escapeMovePickerText(meta)}</span>` : ''}
    </button>`;
  }).join('');

  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-move-id]');
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();
    if (shouldIgnoreDirectPickerOptionClick(root)) return;
    state.team[slotIndex].moves ||= [];
    state.team[slotIndex].moves[moveIndex] = option.dataset.moveId || '';
    closeDirectMovePicker();
    markTeamBuilderDerivedWorkDirty(state);
    render(root, state);
  });

  search.addEventListener('input', () => {
    const term = normalizeMovePickerText(search.value);
    let visible = 0;
    list.querySelectorAll('[data-move-id]').forEach((option) => {
      const haystack = normalizeMovePickerText(option.dataset.search || option.textContent || '');
      const match = !term || haystack.includes(term) || term.split(' ').every((token) => haystack.includes(token));
      setDirectPickerOptionVisible(option, match);
      if (match) visible += 1;
    });
    let empty = list.querySelector('[data-direct-move-empty]');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'muted small-copy dropdown-empty';
        empty.dataset.directMoveEmpty = 'true';
        empty.textContent = 'No legal move matches that search.';
        list.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  });

  window.requestAnimationFrame(() => {
    try {
      overlay.scrollTop = 0;
      overlay.querySelector('.direct-move-picker-panel, .direct-pokemon-picker-panel, .direct-item-picker-panel')?.scrollIntoView({ block: 'start', inline: 'nearest' });
      search.focus({ preventScroll: true });
    } catch {}
  });
}

function openDirectMovePicker(slotIndex, moveIndex, state, root) {
  if (!state?.data) return;
  renderDirectMovePicker(slotIndex, moveIndex, state, root, !hasMoveLegalityData(state.data));
  if (!hasMoveLegalityData(state.data)) {
    loadMoveLegalityData(state.data)
      .then(() => {
        clearMoveOptionsCacheIfAvailable();
        render(root, state);
        renderDirectMovePicker(slotIndex, moveIndex, state, root, false);
      })
      .catch((error) => {
        console.error('Move learnset lazy-load failed:', error);
        renderDirectMovePicker(slotIndex, moveIndex, state, root, false, 'Move learnset data could not be loaded.');
      });
  }
}

function getDirectItemPickerItems(slotIndex, state) {
  const data = state?.data || {};
  const slot = state?.team?.[slotIndex] || null;
  const pokemon = slot?.pokemon_id ? data.indexes?.pokemonById?.[slot.pokemon_id] : null;
  const allItems = (data.collections?.items || [])
    .filter((item) => String(item.is_legal ?? item.legal ?? 'Yes').toLowerCase() !== 'no')
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  let recommended = [];
  if (pokemon) {
    try {
      recommended = getRecommendedItemsForPokemon(pokemon, state.team || [], allItems, { ...data, currentSlotIndex: slotIndex })
        .map((item) => ({ ...item, currentSlotIndex: slotIndex }));
    } catch (error) {
      console.warn('Item recommendations unavailable:', error);
    }
  }
  const recommendedIds = new Set(recommended.map((item) => item.itemId || item.item_id || item.id || item.name));
  const normalized = allItems.map((item) => {
    try { return normaliseItemOption(item, pokemon, state.team || [], slotIndex, data); }
    catch { return item; }
  });
  const combined = [
    ...recommended,
    ...normalized.filter((item) => !recommendedIds.has(item.itemId || item.item_id || item.id || item.name))
  ];
  return { allItems: combined, recommended, recommendedIds };
}

function renderDirectItemCard(item, slotIndex, selectedId, recommendedIds) {
  const id = item.itemId || item.item_id || item.id || item.name || '';
  const name = item.name || id;
  const effect = item.shortEffect || item.effectText || itemPickerEffect(item) || 'No effect text available.';
  const category = item.category || itemPickerCategory(item);
  const duplicate = !!item.isDuplicate;
  const selected = id === selectedId;
  const isMega = !!item.isMegaStone || /mega stone/i.test(`${category} ${effect}`) || /ite$/i.test(name);
  const recommended = recommendedIds.has(id);
  const fit = item.fitReason || '';
  const searchable = normalizeMovePickerText([name, id, category, effect, fit, ...(item.strategicTags || item.strategic_tags || [])].join(' '));
  return `<button type="button" class="direct-move-picker-option direct-item-picker-option ${selected ? 'selected' : ''} ${duplicate ? 'restricted' : ''} ${recommended ? 'recommended' : ''}" data-item-id="${escapeMovePickerText(id)}" data-search="${escapeMovePickerText(searchable)}">
      <span class="direct-move-picker-title">${escapeMovePickerText(name)}</span>
      <span class="direct-item-picker-badges">
        ${selected ? '<span class="badge mini-badge selected-badge">Selected</span>' : ''}
        ${recommended ? '<span class="badge mini-badge recommended-badge">Recommended</span>' : ''}
        ${isMega ? '<span class="badge mini-badge mega-badge">Mega Stone</span>' : ''}
        ${duplicate ? '<span class="badge mini-badge warning-badge">Duplicate</span>' : '<span class="badge mini-badge legal-badge">Legal</span>'}
      </span>
      <span class="direct-move-picker-detail">${escapeMovePickerText(effect)}</span>
      ${fit ? `<span class="direct-item-picker-fit">${escapeMovePickerText(fit)}</span>` : ''}
      <span class="direct-move-picker-meta">${escapeMovePickerText(category)}</span>
    </button>`;
}

function closeDirectItemPicker() {
  document.getElementById('direct-item-picker-overlay')?.remove();
  if (!document.getElementById('direct-move-picker-overlay') && !document.getElementById('direct-pokemon-picker-overlay')) {
    document.body.classList.remove('compact-move-picker-open');
  }
}

function itemPickerEffect(item) {
  return String(item?.effect || item?.effect_text || item?.description || item?.short_effect || item?.shortEffect || item?.desc || '').replace(/\s+/g, ' ').trim();
}

function itemPickerCategory(item) {
  const raw = item?.category || item?.item_category || item?.type || item?.strategic_role || '';
  if (raw) return String(raw);
  if (/mega stone|ite$/i.test(`${item?.name || ''} ${item?.item_id || ''}`)) return 'Mega Stone';
  return 'Item';
}

function renderDirectItemPicker(slotIndex, state, root) {
  closeDirectItemPicker();
  const slot = state?.team?.[slotIndex];
  const selectedId = slot?.item_id || '';
  const { allItems: items, recommended, recommendedIds } = getDirectItemPickerItems(slotIndex, state);

  const overlay = document.createElement('div');
  overlay.id = 'direct-item-picker-overlay';
  overlay.className = 'direct-move-picker-overlay direct-item-picker-overlay';
  overlay.innerHTML = `<div class="direct-move-picker-panel direct-item-picker-panel" role="dialog" aria-modal="true" aria-label="Select Item">
    <div class="direct-move-picker-head"><strong>Select Item <span class="muted">— recommendations + all legal items</span></strong><button type="button" class="tiny-button direct-item-picker-close" aria-label="Close item selector">×</button></div>
    <input class="direct-move-picker-search direct-item-picker-search" type="search" aria-label="Search items" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="direct-item-picker-sections">
      <section class="direct-item-recommendations" ${recommended.length ? '' : 'hidden'}>
        <div class="direct-item-section-title"><strong>Recommended for this Pokémon</strong><span>Top ${Math.min(recommended.length, 8)}</span></div>
        <div class="direct-item-recommended-list">${recommended.slice(0, 8).map((item) => renderDirectItemCard(item, slotIndex, selectedId, recommendedIds)).join('')}</div>
      </section>
      <section class="direct-item-all-section">
        <div class="direct-item-section-title"><strong>All legal items</strong><span>${items.length}</span></div>
        <div class="direct-move-picker-list direct-item-picker-list"></div>
      </section>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('compact-move-picker-open');
  armDirectPickerOpenGuard(root);

  const list = overlay.querySelector('.direct-item-picker-list');
  const sections = overlay.querySelector('.direct-item-picker-sections');
  const search = overlay.querySelector('.direct-item-picker-search');
  const close = () => closeDirectItemPicker();
  overlay.querySelector('.direct-item-picker-close')?.addEventListener('click', close);
  overlay.querySelector('.direct-item-picker-panel')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  if (!slot) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">Choose a Pokémon before picking an item.</p>';
    search.disabled = true;
    return;
  }
  if (!items.length) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">No legal item data found.</p>';
    return;
  }

  list.innerHTML = items.map((item) => renderDirectItemCard(item, slotIndex, selectedId, recommendedIds)).join('');

  sections.addEventListener('click', (event) => {
    const option = event.target.closest('[data-item-id]');
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();
    if (shouldIgnoreDirectPickerOptionClick(root)) return;
    state.team[slotIndex].item_id = option.dataset.itemId || '';
    closeDirectItemPicker();
    markTeamBuilderDerivedWorkDirty(state);
    render(root, state);
  });

  search.addEventListener('input', () => {
    const term = normalizeMovePickerText(search.value);
    let visible = 0;
    sections.querySelectorAll('[data-item-id]').forEach((option) => {
      const haystack = normalizeMovePickerText(option.dataset.search || option.textContent || '');
      const match = !term || haystack.includes(term) || term.split(' ').every((token) => haystack.includes(token));
      setDirectPickerOptionVisible(option, match);
      if (match) visible += 1;
    });
    let empty = sections.querySelector('[data-direct-item-empty]');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'muted small-copy dropdown-empty';
        empty.dataset.directItemEmpty = 'true';
        empty.textContent = 'No item matches that search.';
        sections.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  });

  window.requestAnimationFrame(() => {
    try {
      overlay.scrollTop = 0;
      overlay.querySelector('.direct-move-picker-panel, .direct-pokemon-picker-panel, .direct-item-picker-panel')?.scrollIntoView({ block: 'start', inline: 'nearest' });
      search.focus({ preventScroll: true });
    } catch {}
  });
}

function openDirectItemPicker(slotIndex, state, root) {
  if (!state?.data) return;
  renderDirectItemPicker(slotIndex, state, root);
}

function closeDirectPokemonPicker() {
  document.getElementById('direct-pokemon-picker-overlay')?.remove();
  if (!document.getElementById('direct-move-picker-overlay') && !document.getElementById('direct-item-picker-overlay')) {
    document.body.classList.remove('compact-move-picker-open');
  }
}

function commitDirectPokemonSelection(option, slotIndex, state, root) {
  if (!option || option.dataset.selectionCommitted === 'true') return;
  option.dataset.selectionCommitted = 'true';
  const data = state?.data || {};
  const selected = data.indexes?.pokemonById?.[option.dataset.pokemonId];
  if (!selected) return;
  state.team[slotIndex] = {
    ...createEmptyTeamSlot(selected.pokemon_id),
    ...(slotIndex === 0 ? { isCoreAnchor: true } : {})
  };
  setSlotCollapsed(state, slotIndex, false);
  closeDirectPokemonPicker();
  root.__suppressNextSelectorFocusClick = false;
  root.__ignorePortalOptionClickUntil = 0;
  markTeamBuilderDerivedWorkDirty(state);
  render(root, state);
}

function renderDirectPokemonCard(pokemon, selectedId) {
  const id = pokemon?.pokemon_id || '';
  const name = getPokemonDisplayName(pokemon);
  const form = getPokemonFormLabel(pokemon);
  const types = String(pokemon?.typing || [pokemon?.type_1, pokemon?.type_2].filter(Boolean).join(' / ')).replace(/,/g, ' / ');
  const legal = String(pokemon?.champions_legal || pokemon?.is_legal || 'Yes').toLowerCase() !== 'no';
  const sprite = getPokemonSprite(pokemon);
  const aliases = getPokemonSearchAliases(pokemon);
  const searchable = normalizeMovePickerText([name, id, types, form, pokemon?.ndex, ...aliases].join(' '));
  return `<button type="button" class="direct-move-picker-option direct-pokemon-picker-option ${id === selectedId ? 'selected' : ''}" data-pokemon-id="${escapeMovePickerText(id)}" data-search="${escapeMovePickerText(searchable)}">
    <span class="dropdown-sprite-frame direct-pokemon-sprite-frame" aria-hidden="true"><img class="pokemon-sprite dropdown-pokemon-sprite" src="${escapeMovePickerText(sprite.src)}" alt="" loading="lazy" decoding="async" fetchpriority="low" width="48" height="48" data-pokemon-sprite data-pokemon-id="${escapeMovePickerText(pokemon?.ndex || id)}" data-sprite-stage="home" /></span>
    <span class="direct-move-picker-title">${escapeMovePickerText(name)}</span>
    <span class="direct-item-picker-badges">
      ${id === selectedId ? '<span class="badge mini-badge selected-badge">Selected</span>' : ''}
      ${legal ? '<span class="badge mini-badge legal-badge">Legal</span>' : '<span class="badge mini-badge warning-badge">Unavailable</span>'}
      ${form ? `<span class="badge mini-badge ruleset-badge">${escapeMovePickerText(form)}</span>` : ''}
      ${String(pokemon?.is_mega || '').toLowerCase() === 'yes' ? '<span class="badge mini-badge mega-badge">Mega</span>' : ''}
    </span>
    <span class="direct-move-picker-detail">${escapeMovePickerText(types || 'Type data pending')}</span>
    <span class="direct-move-picker-meta">${escapeMovePickerText(pokemon?.role || pokemon?.archetype || 'Pokémon')}</span>
  </button>`;
}

function renderDirectPokemonPicker(slotIndex, state, root) {
  closeAllDirectPickers();
  const data = state?.data || {};
  const selectedId = state?.team?.[slotIndex]?.pokemon_id || '';
  const pokemon = getGroupedPokemonOptions(data)
    .slice()
    .sort((a, b) => String(getPokemonDisplayName(a)).localeCompare(String(getPokemonDisplayName(b))));

  const overlay = document.createElement('div');
  overlay.id = 'direct-pokemon-picker-overlay';
  overlay.className = 'direct-move-picker-overlay direct-pokemon-picker-overlay';
  overlay.innerHTML = `<div class="direct-move-picker-panel direct-pokemon-picker-panel" role="dialog" aria-modal="true" aria-label="Select Pokémon">
    <div class="direct-move-picker-head"><strong>Select Pokémon <span class="muted">— search the Champions roster</span></strong><button type="button" class="tiny-button direct-pokemon-picker-close" aria-label="Close Pokémon selector">×</button></div>
    <input class="direct-move-picker-search direct-pokemon-picker-search" type="search" aria-label="Search Pokémon" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="direct-move-picker-list direct-pokemon-picker-list"></div>
  </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('compact-move-picker-open');
  armDirectPickerOpenGuard(root);

  const list = overlay.querySelector('.direct-pokemon-picker-list');
  const search = overlay.querySelector('.direct-pokemon-picker-search');
  const close = () => closeDirectPokemonPicker();
  overlay.querySelector('.direct-pokemon-picker-close')?.addEventListener('click', close);
  overlay.querySelector('.direct-pokemon-picker-panel')?.addEventListener('pointerdown', (event) => {
    // Keep taps/drags inside the picker from bubbling to page-level mobile guards.
    event.stopPropagation();
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  if (!pokemon.length) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">No Pokémon data found.</p>';
    return;
  }
  list.innerHTML = pokemon.map((entry) => renderDirectPokemonCard(entry, selectedId)).join('');

  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-pokemon-id]');
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();
    if (shouldIgnoreDirectPickerOptionClick(root)) return;
    commitDirectPokemonSelection(option, slotIndex, state, root);
  });

  search.addEventListener('input', () => {
    const term = normalizeMovePickerText(search.value);
    let visible = 0;
    list.querySelectorAll('[data-pokemon-id]').forEach((option) => {
      const haystack = normalizeMovePickerText(option.dataset.search || option.textContent || '');
      const match = !term || haystack.includes(term) || term.split(' ').every((token) => haystack.includes(token));
      setDirectPickerOptionVisible(option, match);
      if (match) visible += 1;
    });
    let empty = list.querySelector('[data-direct-pokemon-empty]');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'muted small-copy dropdown-empty';
        empty.dataset.directPokemonEmpty = 'true';
        empty.textContent = 'No Pokémon matches that search.';
        list.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  });

  window.requestAnimationFrame(() => {
    try {
      overlay.scrollTop = 0;
      // The overlay is fixed-position; scrolling the panel into view can scroll
      // the underlying Team Builder page to the top on Android/Fold browsers.
      // Keep the page anchored and only focus the picker search without scroll.
      search.focus({ preventScroll: true });
    } catch {}
  });
}

function openDirectPokemonPicker(slotIndex, state, root) {
  if (!state?.data) return;
  renderDirectPokemonPicker(slotIndex, state, root);
}

function selectGenericOption(option, state, root) {
  const kind = option.dataset.selectorKind;
  const slotIndex = Number(option.dataset.slot);
  const value = option.dataset.selectorOption || '';
  const slot = state.team[slotIndex];
  const label = option.dataset.optionLabel || option.textContent?.trim() || value;

  // Make the click feel instant before any card/sidebar rebuild happens.
  commitComboboxSelectionDom(option, label);

  if (kind === 'pokemon') {
    const selected = state.data.indexes.pokemonById[value];
    state.team[slotIndex] = selected ? { ...createEmptyTeamSlot(selected.pokemon_id), ...(slotIndex === 0 ? { isCoreAnchor: true } : {}) } : null;
    if (slotIndex === 0) {
      }
    setSlotCollapsed(state, slotIndex, false);
  } else if (kind === 'battle-scenario-opponent') {
    state.matchupsScenario ||= { selectedOpponentId: '' };
    state.matchupsScenario.selectedOpponentId = value;
  } else if (slot && kind === 'item') {
    slot.item_id = value;
  } else if (slot && kind === 'ability') {
    slot.ability_id = value;
  } else if (slot && kind === 'nature') {
    slot.nature = value;
  } else if (slot && kind === 'stat-preset') {
    if (value && value !== 'custom') applyStatPreset(slot, value);
  } else if (slot && kind === 'move') {
    slot.moves ||= [];
    slot.moves[Number(option.dataset.moveIndex)] = value;
  }
  markTeamBuilderDerivedWorkDirty(state);

  // Pokémon selection unlocks the rest of the Team Builder controls. Render this
  // immediately so a chosen Pokémon cannot leave the slot stuck as inert typed
  // text with the "Choose a Pokémon to unlock legal set controls" message.
  // Other selector edits can stay deferred for smoother typing/clicking.
  if (kind === 'pokemon') render(root, state);
  else scheduleRender(root, state, 'selector-selection');
}

function commitTypedSelectorValue(input, state, root, options = {}) {
  if (!(input instanceof HTMLInputElement)) return false;
  const wrap = input.closest('[data-selector-wrap]');
  if (!wrap) return false;

  const typed = normalizeSearch(input.value || '');
  if (!typed) return false;

  const option = findTypedSelectorMatch(wrap, typed, Boolean(options.exactOnly));
  if (!option) {
    if (!options.skipRenderIfNoMatch) filterGenericOptions(input);
    return false;
  }

  selectGenericOption(option, state, root);
  return true;
}

function findTypedSelectorMatch(wrap, typed, exactOnly = true) {
  const dropdown = getSelectorDropdown(wrap);
  const options = Array.from(dropdown?.querySelectorAll('[data-selector-option]') || []);
  const exact = options.find((option) => normalizeSearch(option.dataset.optionLabel || option.textContent || '') === typed);
  if (exact) return exact;

  if (exactOnly) return null;

  return options.find((option) => {
    const label = normalizeSearch(option.dataset.optionLabel || option.textContent || '');
    const haystack = normalizeSearch(option.dataset.searchable || option.textContent || '');
    return label.startsWith(typed) || haystack.includes(typed);
  }) || null;
}

function commitComboboxSelectionDom(option, label) {
  const dropdown = option.closest('[data-selector-dropdown]');
  const wrap = option.closest('[data-selector-wrap]') || getSelectorWrapForDropdown(dropdown);
  const input = wrap?.querySelector('[data-selector-search]');
  if (input) {
    input.value = label;
    input.dataset.selectedLabel = label;
    input.setAttribute('aria-expanded', 'false');
  }
  (dropdown || wrap)?.querySelectorAll('[data-selector-option]').forEach((row) => {
    row.classList.toggle('selected', row === option);
    row.dataset.selected = row === option ? 'true' : 'false';
  });
  closeCombobox(wrap);
}

function scheduleRender(root, state, reason = 'update') {
  if (state.__renderScheduled) return;
  state.__renderScheduled = true;
  window.requestAnimationFrame(() => {
    state.__renderScheduled = false;
    render(root, state);
  });
}

function markTeamBuilderDerivedWorkDirty(state) {
  state.__teamBuilderDerivedDirty = true;
}

function queueDeferredTeamBuilderRecommendations(root, state) {
  if (state.route !== 'team-builder' || !state.data) return;
  const key = teamRecommendationKey(state);
  if (getTeamBuilderRecommendation(key)) return;
  if (isTeamBuilderRecommendationPending(key)) return;
  markTeamBuilderRecommendationPending(key);
  window.setTimeout(() => {
    if (state.route !== 'team-builder') return;
    const latestKey = teamRecommendationKey(state);
    if (latestKey !== key) {
      clearTeamBuilderRecommendationPending(key);
      queueDeferredTeamBuilderRecommendations(root, state);
      return;
    }
    const items = recommendCandidates(state.team, state.data, 18, { focus: state.builderFocus || [] });
    setTeamBuilderRecommendation(key, items);
    clearTeamBuilderRecommendationPending(key);
    state.__teamBuilderDerivedDirty = false;
    scheduleRender(root, state, 'deferred-recommendations');
  }, 90);
}

function handleDelegatedToggle(root, event) {
  const target = event.target;
  if (!(target instanceof HTMLDetailsElement)) return;
  if (!root.contains(target)) return;
  if (target.matches('[data-mobile-more]')) {
    syncMobileMoreAria(target);
    if (target.open) closeMobileMoreMenus(root, target);
    return;
  }
  const state = getDelegatedState(root);
  if (target.matches('[data-learning-section]')) {
    state.learningHubExpanded ||= {};
    state.learningHubExpanded[target.dataset.learningSection] = target.open;
    return;
  }
  if (target.matches('[data-strategic-role-slot]')) {
    const slotIndex = Number(target.dataset.strategicRoleSlot);
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < 6) {
      state.slotUiState = normaliseSlotUiState(state.slotUiState);
      state.slotUiState[slotIndex] = { ...state.slotUiState[slotIndex], strategicRoleOpen: target.open };
      scheduleSlotUiStateSave(state);
    }
    return;
  }
  if (!target.matches('[data-analysis-section]')) return;
  try {
    window.localStorage.setItem(
      `kcc.analysisDesk.section.${target.dataset.analysisSection}`,
      target.open ? 'open' : 'closed'
    );
  } catch {}
}

function handleSpriteError(event) {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) || !target.matches('[data-pokemon-sprite]')) return;

  const currentStage = target.dataset.spriteStage || 'home';
  const nextStage = currentStage === 'home' ? 'pokeapi' : currentStage === 'pokeapi' ? 'silhouette' : '';
  if (!nextStage) return;

  const next = getPokemonSpriteById(target.dataset.pokemonId || '', { stage: nextStage, name: target.alt?.replace(/ sprite$/i, '') });
  target.dataset.spriteStage = nextStage;
  if (target.src !== next.src) target.src = next.src;
}

function getDelegatedState(root) {
  return root.__goldStandardState;
}

function closeAllOpenSelectors(root) {
  if (!root) return;
  root.querySelectorAll('[data-selector-wrap].combobox-open').forEach((wrap) => closeCombobox(wrap));
  const portalDropdown = document.querySelector('#dropdown-portal [data-selector-dropdown]');
  if (portalDropdown) closeCombobox(getSelectorWrapForDropdown(portalDropdown));
}

const { resolveRouteFromLink, findRouteLinkFromTarget, navigateToRoute, handleDelegatedRouteClick } = createAppShellRouteHandlers({
  getRoute,
  routeFromPath,
  closeMobileMoreMenus,
  closeAllOpenSelectors,
  buildMetadexContextFromLink,
  applyMetadexContextToView,
  getDelegatedState,
  render
});

function handleMetadexSelectCapture(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const metadexSelect = target.closest('[data-metadex-select], [data-action="select-metadex-pokemon"], [data-metadex-card]');
  if (!metadexSelect || !root.contains(metadexSelect)) return false;

  const selectedId = metadexSelect.dataset.metadexSelect || metadexSelect.dataset.pokemonId || '';
  if (!selectedId) return false;

  event.preventDefault();
  event.stopPropagation();
  root.__suppressNextMetadexSelectClick = false;
  openMetadexDetailOverlay(root, state, selectedId);
  return true;
}

function handleDelegatedClick(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (event.defaultPrevented) return;

  const selectorSheetClose = target.closest('[data-selector-sheet-close]');
  if (selectorSheetClose) {
    event.preventDefault();
    closeCombobox(getSelectorWrapForDropdown(selectorSheetClose.closest('[data-selector-dropdown]')));
    return;
  }

  if (root.__suppressNextSelectorClick && target.closest('[data-selector-option]')) {
    root.__suppressNextSelectorClick = false;
    event.preventDefault();
    return;
  }

  const routeLink = findRouteLinkFromTarget(root, target);
  if (routeLink) {
    if (!resolveRouteFromLink(routeLink)) return;
    event.preventDefault();
    navigateToRoute(root, state, routeLink);
    return;
  }

  const archetypeFilter = target.closest('[data-archetype-filter]');
  if (archetypeFilter && root.contains(archetypeFilter)) {
    const filter = archetypeFilter.dataset.archetypeFilter || 'All';
    const page = archetypeFilter.closest('.learning-archetypes-page') || root;
    page.querySelectorAll('[data-archetype-filter]').forEach((button) => {
      button.classList.toggle('active', button === archetypeFilter);
    });
    page.querySelectorAll('[data-archetype-tags]').forEach((tile) => {
      const tags = String(tile.dataset.archetypeTags || '').split('|');
      const visible = filter === 'All' || tags.includes(filter);
      tile.hidden = !visible;
    });
    return;
  }

  const proTeamFilter = target.closest('[data-action="set-pro-team-filter"]');
  if (proTeamFilter && root.contains(proTeamFilter)) {
    state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
    state.proStudySelectionState.filter = proTeamFilter.dataset.proTeamFilter || 'all';
    render(root, state);
    return;
  }

  const proTeamSelect = target.closest('[data-action="select-pro-team"]');
  if (proTeamSelect && root.contains(proTeamSelect)) {
    state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
    state.proStudySelectionState.selectedId = proTeamSelect.dataset.proTeamId || state.proStudySelectionState.selectedId || '';
    render(root, state);
    return;
  }

  const proTeamLoad = target.closest('[data-action="load-pro-team"]');
  if (proTeamLoad && root.contains(proTeamLoad)) {
    const libraryTeams = state.proTeamLibraryState?.teams || [];
    const importedTeams = state.importedProTeamState?.teams || [];
    const proTeam = getProStudyTeamById(libraryTeams, proTeamLoad.dataset.proTeamId || '') || getProStudyTeamById(importedTeams, proTeamLoad.dataset.proTeamId || '');
    if (!proTeam) {
      state.proStudySelectionState ||= { filter: 'all', selectedId: '', notice: '', activeSandbox: null };
      state.proStudySelectionState.notice = 'No pro teams available right now.';
      render(root, state);
      return;
    }
    hydrateProStudySandbox(state, proTeam);
    scheduleSlotUiStateSave(state);
    state.route = 'analysis-desk';
    window.history.pushState({ routeId: 'analysis-desk' }, '', '/analysis-desk');
    render(root, state);
    root.querySelector('.app-main')?.focus({ preventScroll: true });
    return;
  }

  const exitProStudy = target.closest('[data-action="exit-pro-study-sandbox"]');
  if (exitProStudy && root.contains(exitProStudy)) {
    const restored = restoreProStudySnapshot(state);
    scheduleSlotUiStateSave(state);
    const route = getRouteOrDefault(state.route);
    window.history.pushState({ routeId: route.id }, '', route.path);
    render(root, state);
    root.querySelector('.app-main')?.focus({ preventScroll: true });
    return;
  }

  const clearMetadexAnswerFilter = target.closest('[data-action="clear-metadex-answer-filter"]');
  if (clearMetadexAnswerFilter && root.contains(clearMetadexAnswerFilter)) {
    const view = resetMetadexVisibleLimit(state);
    view.answerType = '';
    view.weaknessAnswerType = '';
    view.context = null;
    view.teamNeed = 'all';
    view.teamFit = 'any';
    view.guideStep = 'any';
    view.sort = 'alphabetical';
    view.selectedId = '';
    render(root, state);
    return;
  }

  const clearMetadexGuideContext = target.closest('[data-action="clear-metadex-guide-context"]');
  if (clearMetadexGuideContext && root.contains(clearMetadexGuideContext)) {
    const view = resetMetadexVisibleLimit(state);
    view.context = null;
    view.answerType = '';
    view.weaknessAnswerType = '';
    view.guideStep = 'any';
    view.teamNeed = 'all';
    view.teamFit = 'any';
    view.roleConfidence = 'strong-secondary';
    view.sort = 'alphabetical';
    view.selectedId = '';
    render(root, state);
    return;
  }

  const itemsFilterTrigger = target.closest('[data-items-filter-trigger]');
  if (itemsFilterTrigger && root.contains(itemsFilterTrigger)) {
    const shell = itemsFilterTrigger.closest('[data-items-filter]');
    const menu = shell?.querySelector('.items-filter-menu');
    const isOpen = itemsFilterTrigger.getAttribute('aria-expanded') === 'true';
    root.querySelectorAll('.items-filter-trigger[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    root.querySelectorAll('.items-filter-menu').forEach((panel) => panel.classList.add('force-closed'));
    if (!isOpen && menu) {
      itemsFilterTrigger.setAttribute('aria-expanded', 'true');
      menu.classList.remove('force-closed');
      document.body.classList.add('dropdown-open-no-page-scroll');
    } else {
      document.body.classList.remove('dropdown-open-no-page-scroll');
    }
    event.preventDefault();
    return;
  }

  const itemsFilterOption = target.closest('[data-items-filter-option]');
  if (itemsFilterOption && root.contains(itemsFilterOption)) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    const filter = itemsFilterOption.dataset.itemsFilterOption;
    const value = itemsFilterOption.dataset.itemsFilterValue || '';
    if (filter === 'category') {
      state.items.category = value || 'all';
      state.items.selectedId = '';
    } else if (filter === 'use') {
      state.items.use = value || 'any';
      state.items.selectedId = '';
    } else if (filter === 'sort') {
      state.items.sort = value || 'alphabetical';
    }
    document.body.classList.remove('dropdown-open-no-page-scroll');
    render(root, state);
    return;
  }

  const itemDetail = target.closest('[data-item-detail]');
  if (itemDetail && root.contains(itemDetail)) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    const next = itemDetail.dataset.itemDetail || '';
    state.items.selectedId = state.items.selectedId === next ? '' : next;
    render(root, state);
    return;
  }

  const closeMetadexDetail = target.closest('[data-action="close-metadex-detail"]');
  if (closeMetadexDetail && root.contains(closeMetadexDetail)) {
    event.preventDefault();
    const view = ensureMetadexView(state);
    view.selectedId = '';
    render(root, state);
    root.querySelector('.metadex-page')?.scrollIntoView({ block: 'start', inline: 'nearest' });
    root.querySelector('.metadex-grid .metadex-tile')?.focus?.({ preventScroll: true });
    return;
  }

  const metadexOverlay = target.closest('[data-metadex-detail-overlay]');
  if (metadexOverlay && target === metadexOverlay && root.contains(metadexOverlay)) {
    event.preventDefault();
    const view = ensureMetadexView(state);
    view.selectedId = '';
    render(root, state);
    return;
  }

  const metadexShowMore = target.closest('[data-metadex-show-more]');
  if (metadexShowMore && root.contains(metadexShowMore)) {
    const view = ensureMetadexView(state);
    view.visibleLimit = Math.max(METADEX_INITIAL_VISIBLE_LIMIT, Number(view.visibleLimit || METADEX_INITIAL_VISIBLE_LIMIT)) + METADEX_LOAD_MORE_INCREMENT;
    render(root, state);
    return;
  }

  const metadexClearAllFilters = target.closest('[data-action="clear-metadex-all-filters"]');
  if (metadexClearAllFilters && root.contains(metadexClearAllFilters)) {
    const view = resetMetadexVisibleLimit(state);
    Object.assign(view, { search: '', legality: 'all', field: 'all', teamNeed: 'all', guideStep: 'any', teamFit: 'any', archetypeFit: 'any', roleConfidence: 'strong-secondary', sort: 'alphabetical', answerType: '', weaknessAnswerType: '', context: null, megaOnly: false, selectedId: '' });
    render(root, state);
    return;
  }

  const metadexSelect = target.closest('[data-metadex-select], [data-action="select-metadex-pokemon"], [data-metadex-card]');
  if (metadexSelect && root.contains(metadexSelect)) {
    event.preventDefault();
    if (root.__suppressNextMetadexSelectClick) {
      root.__suppressNextMetadexSelectClick = false;
      return;
    }
    openMetadexDetailOverlay(root, state, metadexSelect.dataset.metadexSelect || metadexSelect.dataset.pokemonId || '');
    return;
  }

  const metadexMegaToggle = target.closest('[data-metadex-mega-toggle]');
  if (metadexMegaToggle && root.contains(metadexMegaToggle)) {
    const view = resetMetadexVisibleLimit(state);
    view.megaOnly = !view.megaOnly;
    view.selectedId = '';
    render(root, state);
    return;
  }

  const activeSelector = target.closest('[data-selector-wrap]');
  root.querySelectorAll('[data-selector-wrap].combobox-open').forEach((wrap) => {
    if (wrap !== activeSelector) closeCombobox(wrap);
  });

  const activeMoreMenu = target.closest('[data-mobile-more]');
  closeMobileMoreMenus(root, activeMoreMenu);

  const selectorClear = target.closest('[data-selector-clear]');
  if (selectorClear && root.contains(selectorClear)) {
    if (root.__suppressNextSelectorClearClick) {
      root.__suppressNextSelectorClearClick = false;
      event.preventDefault();
      return;
    }
    clearGenericSelector(selectorClear, state, root);
    return;
  }

  const selectorInputRow = target.closest('[data-selector-input-row]');
  if (selectorInputRow && root.contains(selectorInputRow)) {
    event.preventDefault();
    const input = selectorInputRow.querySelector('[data-selector-search]');
    if (input) {
      input.focus({ preventScroll: true });
      openCombobox(input);
      root.__selectorCardPointerOpened = null;
    }
    return;
  }

  const selectorInput = target.closest('[data-selector-search]');
  if (selectorInput && root.contains(selectorInput)) {
    openCombobox(selectorInput);
    return;
  }

  const selectorOption = target.closest('[data-selector-option]');
  if (selectorOption && root.contains(selectorOption)) {
    selectGenericOption(selectorOption, state, root);
    return;
  }

  const selectorFocus = target.closest('[data-selector-focus]');
  if (selectorFocus && root.contains(selectorFocus)) {
    event.preventDefault();
    if (root.__suppressNextSelectorFocusClick) {
      root.__suppressNextSelectorFocusClick = false;
      return;
    }
    openSelectorFocusControl(selectorFocus, root);
    return;
  }

  const collapseSlot = target.closest('[data-collapse-slot]');
  if (collapseSlot && root.contains(collapseSlot)) {
    setSlotCollapsed(state, Number(collapseSlot.dataset.collapseSlot), true);
    scheduleSlotUiStateSave(state);
    scheduleRender(root, state, 'collapse-slot');
    return;
  }

  const expandSlot = target.closest('[data-expand-slot]');
  if (expandSlot && root.contains(expandSlot)) {
    const slotIndex = Number(expandSlot.dataset.expandSlot);
    if (window.matchMedia?.('(min-width: 1200px)')?.matches) {
      state.team.forEach((slot, index) => {
        if (slot?.pokemon_id && index !== slotIndex) setSlotCollapsed(state, index, true);
      });
    }
    setSlotCollapsed(state, slotIndex, false);
    scheduleSlotUiStateSave(state);
    scheduleRender(root, state, 'expand-slot');
    return;
  }

  const clearSlot = target.closest('[data-clear-slot]');
  if (clearSlot && root.contains(clearSlot)) {
    const slotIndex = Number(clearSlot.dataset.clearSlot);
    state.team[slotIndex] = null;
    setSlotCollapsed(state, slotIndex, false);
    scheduleSlotUiStateSave(state);
    render(root, state);
    return;
  }

  const dismissStatLegend = target.closest('[data-dismiss-stat-legend]');
  if (dismissStatLegend && root.contains(dismissStatLegend)) {
    dismissStatLegend.closest('[data-stat-legend]')?.remove();
    try { window.localStorage?.setItem('pokemonChampionsStatLegendDismissed', '1'); } catch {}
    return;
  }

  const resetStats = target.closest('[data-reset-stats]');
  if (resetStats && root.contains(resetStats)) {
    const slot = state.team[Number(resetStats.dataset.resetStats)];
    if (slot) setSlotStatAllocation(slot, emptyStatAllocation());
    render(root, state);
    return;
  }
  const statInc = target.closest('[data-stat-inc-slot]');
  if (statInc && root.contains(statInc)) {
    adjustStatPoint(state, Number(statInc.dataset.statIncSlot), statInc.dataset.statKey, 1);
    render(root, state);
    return;
  }

  const statDec = target.closest('[data-stat-dec-slot]');
  if (statDec && root.contains(statDec)) {
    adjustStatPoint(state, Number(statDec.dataset.statDecSlot), statDec.dataset.statKey, -1);
    render(root, state);
    return;
  }

  const statPreset = target.closest('[data-stat-preset-slot]');
  if (statPreset && root.contains(statPreset)) {
    const slot = state.team[Number(statPreset.dataset.statPresetSlot)];
    if (slot) applyStatPreset(slot, statPreset.dataset.statPreset);
    render(root, state);
    return;
  }

  const natureChoice = target.closest('[data-nature-choice-slot]');
  if (natureChoice && root.contains(natureChoice)) {
    const slot = state.team[Number(natureChoice.dataset.natureChoiceSlot)];
    if (slot) slot.nature = natureChoice.dataset.natureChoice || '';
    render(root, state);
    return;
  }

  const builderFocus = target.closest('[data-builder-focus]');
  if (builderFocus && root.contains(builderFocus)) {
    const focus = builderFocus.dataset.builderFocus;
    const active = new Set(state.builderFocus || []);
    active.has(focus) ? active.delete(focus) : active.add(focus);
    state.builderFocus = Array.from(active);
    render(root, state);
    return;
  }

  const loadTeamButton = target.closest('[data-load-team], [data-load-team-id]');
  if (loadTeamButton && root.contains(loadTeamButton)) {
    const savedTeamKey = loadTeamButton.dataset.loadTeamId || loadTeamButton.dataset.loadTeam;
    state.team = sanitizeTeam(loadSavedTeamById(savedTeamKey) || loadSavedTeams()[savedTeamKey] || []);
    resetCoreBuilderDraft(state);
    state.activeSavedTeamId = savedTeamKey;
    state.shareUrlNotice = 'Loaded saved team. Share URL updated for this team.';
    state.shareUrlWarning = '';
    state.slotUiState = normaliseSlotUiState(state.slotUiState);
    state.route = 'team-builder';
    window.history.pushState({ routeId: 'team-builder' }, '', '/team-builder');
    render(root, state);
    return;
  }

  const action = target.closest('[data-action]');
  if (!action || !root.contains(action)) return;

  if (action.dataset.action === 'team-guide-step') {
    const requestedStep = Number(action.dataset.teamGuideStep);
    state.teamBuildingGuideStep = Math.min(Math.max(Number.isFinite(requestedStep) ? requestedStep : 1, 1), 7);
    render(root, state);
    return;
  }

  if (action.dataset.action === 'team-guide-prev') {
    state.teamBuildingGuideStep = Math.min(Math.max(Number(state.teamBuildingGuideStep || 1) - 1, 1), 7);
    render(root, state);
    return;
  }

  if (action.dataset.action === 'team-guide-next') {
    state.teamBuildingGuideStep = Math.min(Math.max(Number(state.teamBuildingGuideStep || 1) + 1, 1), 7);
    render(root, state);
    return;
  }

  if (action.dataset.action === 'metadex-add-to-team' || action.dataset.action === 'metadex-guided-pick' || action.dataset.action === 'metadex-build-around') {
    const pokemonId = action.dataset.pokemonId || '';
    const pokemon = state.data?.indexes?.pokemonById?.[pokemonId];
    addCandidate(pokemonId, null, state, false);
    state.route = 'team-builder';
    window.history.pushState({ routeId: 'team-builder' }, '', '/team-builder');
    render(root, state);
    root.querySelector('.app-main')?.focus({ preventScroll: true });
    return;
  }

  if (action.dataset.action === 'collapse-completed-slots') {
    state.team.forEach((slot, index) => setSlotCollapsed(state, index, Boolean(slot?.pokemon_id)));
    scheduleSlotUiStateSave(state);
    scheduleRender(root, state, 'collapse-completed-slots');
  } else if (action.dataset.action === 'expand-all-slots') {
    state.team.forEach((slot, index) => setSlotCollapsed(state, index, false));
    scheduleSlotUiStateSave(state);
    scheduleRender(root, state, 'expand-all-slots');
  } else if (action.dataset.action === 'toggle-suggested-partners') {
    state.suggestedPartnersExpanded = !state.suggestedPartnersExpanded;
    render(root, state);
  } else if (action.dataset.action === 'clear-builder-focus') {
    state.builderFocus = [];
    render(root, state);
  } else if (action.dataset.action === 'clear-team') {
    resetCoreBuilderDraft(state);
    state.team = Array.from({ length: 6 }, () => null);
    state.activeSavedTeamId = '';
    state.shareUrlNotice = 'Team cleared. Share URL updated.';
    state.shareUrlWarning = '';
    state.slotUiState = Array.from({ length: 6 }, () => ({ collapsed: false }));
    state.suggestedPartnersExpanded = false;
    scheduleSlotUiStateSave(state);
    render(root, state);
  } else if (action.dataset.action === 'import-team' || action.dataset.action === 'import-showdown-team') {
    const raw = root.querySelector('#team-import')?.value || root.querySelector('#team-json')?.value || '';
    const trimmed = raw.trim();
    const isJson = /^[\[{]/.test(trimmed);
    if (isJson) {
      state.team = sanitizeTeam(migrateImportedTeam(trimmed));
      state.activeSavedTeamId = '';
      state.shareUrlNotice = 'Imported team. Share URL updated.';
      state.shareUrlWarning = '';
      const importWarnings = state.team.flatMap((slot, index) => (slot?.importWarnings || []).map((warning) => `Slot ${index + 1}: ${warning}`));
      state.importExport = { ...(state.importExport || {}), draft: raw, lastResult: { summary: 'App JSON imported', warnings: importWarnings, ignoredLines: [], filledSlots: state.team.map((slot, index) => slot?.pokemon_id ? index + 1 : null).filter(Boolean) } };
    } else {
      const result = importTeamFromShowdown(trimmed, state.data, { itemClause: true });
      state.team = sanitizeTeam(result.team);
      state.activeSavedTeamId = '';
      state.shareUrlNotice = 'Imported team. Share URL updated.';
      state.shareUrlWarning = '';
      state.importExport = { ...(state.importExport || {}), draft: raw, lastResult: result };
    }
    state.slotUiState = Array.from({ length: 6 }, (_, index) => ({ collapsed: Boolean(state.team[index]?.pokemon_id) }));
    scheduleSlotUiStateSave(state);
    render(root, state);
  } else if (action.dataset.action === 'copy-share-link') {
    const shareUrl = buildShareTeamUrl(state.team);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        state.shareUrlNotice = 'Share link copied.';
        state.shareUrlWarning = '';
        render(root, state);
      }).catch(() => {
        state.shareUrlWarning = 'Could not copy automatically. Use your browser address bar to copy the team link.';
        render(root, state);
      });
    } else {
      state.shareUrlWarning = 'Could not copy automatically. Use your browser address bar to copy the team link.';
      render(root, state);
    }
  } else if (action.dataset.action === 'copy-export') {
    const text = root.querySelector('#team-export')?.value || '';
    navigator.clipboard?.writeText(text);
  } else if (action.dataset.action === 'clear-import-box') {
    state.importExport = { ...(state.importExport || {}), draft: '', lastResult: null };
    render(root, state);
  } else if (action.dataset.action === 'save-team') {
    const customName = root.querySelector('#save-team-name')?.value?.trim() || '';
    const saved = state.activeSavedTeamId
      ? (updateSavedTeam(state.activeSavedTeamId, customName, state.team) || saveTeam(customName || `Team ${new Date().toLocaleString()}`, state.team))
      : saveTeam(customName || `Team ${new Date().toLocaleString()}`, state.team);
    state.activeSavedTeamId = saved?.id || saved?.name || '';
    state.importExport = { ...(state.importExport || {}), renamingTeamId: '', deletingTeamId: '', saveNotice: 'Saved changes to this team.' };
    render(root, state);
  } else if (action.dataset.action === 'save-team-copy') {
    const customName = root.querySelector('#save-team-name')?.value?.trim() || '';
    const saved = saveTeam(customName || `Team ${new Date().toLocaleString()}`, state.team);
    state.activeSavedTeamId = saved?.id || saved?.name || '';
    state.importExport = { ...(state.importExport || {}), renamingTeamId: '', deletingTeamId: '', saveNotice: 'Saved as a new copy.' };
    render(root, state);
  } else if (action.dataset.action === 'start-rename-team') {
    state.importExport = { ...(state.importExport || {}), renamingTeamId: action.dataset.renameTeamId || '', deletingTeamId: '' };
    render(root, state);
  } else if (action.dataset.action === 'cancel-rename-team') {
    state.importExport = { ...(state.importExport || {}), renamingTeamId: '' };
    render(root, state);
  } else if (action.dataset.action === 'confirm-rename-team') {
    const row = action.closest('.saved-team-entry');
    const nextName = row?.querySelector('.saved-team-rename-input')?.value?.trim() || '';
    const renamed = renameSavedTeam(action.dataset.renameTeamId, nextName);
    if (renamed && state.activeSavedTeamId === action.dataset.renameTeamId) state.activeSavedTeamId = renamed.id;
    state.importExport = { ...(state.importExport || {}), renamingTeamId: '', deletingTeamId: '' };
    render(root, state);
  } else if (action.dataset.action === 'start-delete-team') {
    state.importExport = { ...(state.importExport || {}), deletingTeamId: action.dataset.deleteTeamId || '', renamingTeamId: '' };
    render(root, state);
  } else if (action.dataset.action === 'cancel-delete-team') {
    state.importExport = { ...(state.importExport || {}), deletingTeamId: '' };
    render(root, state);
  } else if (action.dataset.action === 'confirm-delete-team') {
    const targetId = action.dataset.deleteTeamId || '';
    const deleted = deleteSavedTeam(targetId);
    if (deleted && (state.activeSavedTeamId === targetId || state.activeSavedTeamId === deleted.id || state.activeSavedTeamId === deleted.name)) {
      state.activeSavedTeamId = '';
    }
    state.importExport = { ...(state.importExport || {}), deletingTeamId: '', renamingTeamId: '' };
    render(root, state);
  }
}

function resetCoreBuilderDraft(state) {
  state.builderFocus = [];
  state.suggestedPartnersExpanded = false;
  resetTeamBuilderRecommendationMemo();
}

function clearGenericSelector(button, state, root) {
  const kind = button.dataset.selectorKind;
  const slotIndex = Number(button.dataset.slot);
  const slot = state.team[slotIndex];
  if (kind === 'pokemon') {
    state.team[slotIndex] = null;
    setSlotCollapsed(state, slotIndex, false);
    scheduleSlotUiStateSave(state);
  }
  else if (kind === 'battle-scenario-opponent') {
    state.matchupsScenario ||= { selectedOpponentId: '' };
    state.matchupsScenario.selectedOpponentId = '';
  }
  else if (slot && kind === 'item') slot.item_id = '';
  else if (slot && kind === 'ability') slot.ability_id = '';
  else if (slot && kind === 'nature') slot.nature = '';
  else if (slot && kind === 'move') {
    slot.moves ||= [];
    slot.moves[Number(button.dataset.moveIndex)] = '';
  }
  markTeamBuilderDerivedWorkDirty(state);

  if (kind === 'move') {
    // Keep the compact move editor's + Add Move target in sync immediately.
    // This avoids a tap race where clearing a move schedules a render and the
    // next Add tap opens a selector that is then replaced by that render.
    state.__renderScheduled = false;
    render(root, state);
    return;
  }

  scheduleRender(root, state, 'selector-clear');
}

function handleDelegatedChange(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.matches('[data-export-mode]')) {
    state.importExport = { ...(state.importExport || {}), mode: target.value || 'champions' };
    render(root, state);
    return;
  }

  if (target.matches('[data-items-category]')) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    state.items.category = target.value || 'all';
    state.items.selectedId = '';
    render(root, state);
    return;
  } else if (target.matches('[data-items-use]')) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    state.items.use = target.value || 'any';
    state.items.selectedId = '';
    render(root, state);
    return;
  } else if (target.matches('[data-items-sort]')) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    state.items.sort = target.value || 'alphabetical';
    render(root, state);
    return;
  }

  if (target.matches('[data-metadex-legality]')) {
    const view = resetMetadexVisibleLimit(state);
    view.legality = target.value || 'all';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-field]')) {
    const view = resetMetadexVisibleLimit(state);
    view.field = target.value || 'all';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-team-need]')) {
    const view = resetMetadexVisibleLimit(state);
    view.teamNeed = target.value || 'all';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-guide-step]')) {
    const view = resetMetadexVisibleLimit(state);
    view.guideStep = target.value || 'any';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-team-fit]')) {
    const view = resetMetadexVisibleLimit(state);
    view.teamFit = target.value || 'any';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-archetype-fit]')) {
    const view = resetMetadexVisibleLimit(state);
    view.archetypeFit = target.value || 'any';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-role-confidence]')) {
    const view = resetMetadexVisibleLimit(state);
    view.roleConfidence = target.value || 'strong-secondary';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-metadex-sort]')) {
    const view = resetMetadexVisibleLimit(state);
    view.sort = target.value || 'team-fit';
    view.selectedId = '';
    render(root, state);
  } else if (target.matches('[data-selector-search]')) {
    // Harden combobox selectors: if a user types an exact option and clicks away,
    // commit that option instead of leaving inert free text in the Team Builder.
    commitTypedSelectorValue(target, state, root, { exactOnly: true });
    return;
  } else if (target.matches('.pokemon-search')) {
    return;
  } else if (target.matches('[data-move-slot]')) {
    const slot = state.team[Number(target.dataset.moveSlot)];
    if (!slot) return;
    slot.moves ||= [];
    slot.moves[Number(target.dataset.moveIndex)] = target.value;
    render(root, state);
  } else if (target.matches('[data-ability-slot]')) {
    const slot = state.team[Number(target.dataset.abilitySlot)];
    if (slot) slot.ability_id = target.value;
    render(root, state);
  } else if (target.matches('[data-item-slot]')) {
    const slot = state.team[Number(target.dataset.itemSlot)];
    if (slot) slot.item_id = target.value;
    render(root, state);
  } else if (target.matches('[data-nature-slot]')) {
    const slot = state.team[Number(target.dataset.natureSlot)];
    if (slot) slot.nature = target.value;
    render(root, state);
  } else if (target.matches('[data-stat-preset-select-slot]')) {
    const slot = state.team[Number(target.dataset.statPresetSelectSlot)];
    if (slot && target.value && target.value !== 'custom') applyStatPreset(slot, target.value);
    render(root, state);
  } else if (target.matches('[data-stat-slot]')) {
    setStatPointValue(state, Number(target.dataset.statSlot), target.dataset.statKey, target.value);
    render(root, state);
  }
}

function adjustStatPoint(state, slotIndex, statKey, delta) {
  const slot = state.team[slotIndex];
  if (!slot || !isStatKey(statKey)) return;
  adjustStatAllocation(slot, statKey, delta);
}

function setStatPointValue(state, slotIndex, statKey, rawValue) {
  const slot = state.team[slotIndex];
  if (!slot || !isStatKey(statKey)) return;
  const allocation = getSlotStatAllocation(slot);
  const current = Number(allocation[statKey] || 0);
  const requested = Math.max(0, Math.min(32, Math.round(Number(rawValue || 0))));
  const spentWithoutStat = Object.values(allocation).reduce((sum, value) => sum + Number(value || 0), 0) - current;
  allocation[statKey] = Math.min(requested, Math.max(0, Math.min(32, 66 - spentWithoutStat)));
  setSlotStatAllocation(slot, allocation);
}

function isStatKey(statKey) {
  return STAT_DEFINITIONS.some((stat) => stat.key === statKey);
}

function handleDelegatedInput(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.matches('#team-import')) {
    state.importExport = { ...(state.importExport || {}), draft: target.value };
    return;
  }

  if (target.matches('[data-stat-slot]')) {
    setStatPointValue(state, Number(target.dataset.statSlot), target.dataset.statKey, target.value);
    render(root, state);
    return;
  }

  if (target.matches('[data-items-search]')) {
    state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
    const cursor = target.selectionStart ?? String(target.value || '').length;
    state.items.search = target.value || '';
    state.items.selectedId = '';
    window.clearTimeout(state.__itemsSearchRenderTimer);
    state.__itemsPendingSearchCursor = cursor;
    state.__itemsSearchRenderTimer = window.setTimeout(() => {
      render(root, state);
      const nextInput = root.querySelector('[data-items-search]');
      if (nextInput) {
        nextInput.focus({ preventScroll: true });
        try { nextInput.setSelectionRange(state.__itemsPendingSearchCursor || 0, state.__itemsPendingSearchCursor || 0); } catch {}
      }
    }, 90);
    return;
  }

  if (target.matches('[data-core-metadex-search]')) {
    return;
  } else if (target.matches('[data-metadex-search]')) {
    const view = resetMetadexVisibleLimit(state);
    view.search = target.value || '';
    view.selectedId = '';
    window.clearTimeout(metadexSearchRenderTimer);
    metadexSearchRenderTimer = window.setTimeout(() => {
      const nextSignature = metadexSearchSignature(state);
      if (nextSignature === lastMetadexSearchSignature) return;
      lastMetadexSearchSignature = nextSignature;
      if (!renderMetadexDynamicRegions(root, state)) render(root, state);
    }, 60);
  } else if (target.matches('[data-selector-search]')) {
    filterGenericOptions(target);
    hydrateVisibleDropdownSprites(target);

    // If the user types or accepts an exact Pokémon label, commit it immediately.
    // This covers keyboard selection, browser autofill, and cases where the
    // dropdown click event is interrupted by focus/route re-renders.
    if (target.dataset.selectorKind === 'pokemon') {
      commitTypedSelectorValue(target, state, root, { exactOnly: true, skipRenderIfNoMatch: true });
    }
  }
}

function handleDelegatedFocusIn(root, event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.matches('[data-selector-search]')) {
    // Only the remaining inline selectors, such as Nature, use the generic combobox path.
    openCombobox(target);
  }
}

function handleDelegatedKeydown(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (event.key === 'Escape') {
    const openMoreMenu = root.querySelector('[data-mobile-more][open]');
    if (openMoreMenu) {
      event.preventDefault();
      setMobileMoreOpen(openMoreMenu, false);
      openMoreMenu.querySelector('summary')?.focus?.();
      return;
    }
  }

  if (target.matches('[data-selector-search]')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCombobox(target.closest('[data-selector-wrap]'));
      target.blur();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openCombobox(target);
      moveActiveGenericOption(target, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      const options = visibleGenericOptions(target);
      const activeIndex = Math.max(0, Math.min(options.length - 1, Number(target.dataset.activeOptionIndex || 0)));
      const selected = options[activeIndex] || options[0];
      if (selected) {
        if (event.key === 'Enter') event.preventDefault();
        selectGenericOption(selected, getDelegatedState(root), root);
      }
      return;
    }
  }

  const focusedMetadexSelect = target.closest?.('[data-metadex-select]');
  if (focusedMetadexSelect && root.contains(focusedMetadexSelect) && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openMetadexDetailOverlay(root, state, focusedMetadexSelect.dataset.metadexSelect || focusedMetadexSelect.dataset.pokemonId || '');
    return;
  }

  if (event.key !== 'Enter') return;

  if (target.matches('#team-import')) {
    state.importExport = { ...(state.importExport || {}), draft: target.value };
    return;
  }

  if (target.matches('[data-stat-slot]')) {
    setStatPointValue(state, Number(target.dataset.statSlot), target.dataset.statKey, target.value);
    render(root, state);
    return;
  }

  if (target.matches('[data-metadex-search]')) {
    event.preventDefault();
    const first = root.querySelector('[data-metadex-select]');
    if (first) first.click();
  }
}

function handleDelegatedBlur(root, event) {
  const state = getDelegatedState(root);
  const target = event.target;
  if (!(target instanceof Element) || !target.matches('[data-selector-search]')) return;
  window.setTimeout(() => {
    const wrap = target.closest('[data-selector-wrap]');
    if (!wrap) return;

    // Mobile Team Builder selectors move the visible search input into the
    // dropdown portal. When the original combobox input blurs into that sheet
    // search, it is still the same selector interaction, so do not auto-commit
    // or close the sheet. Closing here caused the keyboard to dismiss as soon
    // as the user tapped "Choose Pokémon".
    const dropdown = getSelectorDropdown(wrap);
    const activeElement = document.activeElement;
    const focusStayedInSelector = wrap.contains(activeElement) || Boolean(dropdown && dropdown.contains(activeElement));
    if (focusStayedInSelector) return;

    commitTypedSelectorValue(target, state, root, { exactOnly: true, skipRenderIfNoMatch: true });
    closeCombobox(wrap);
  }, 120);
}

function createEmptyTeamSlot(pokemonId) {
  return { pokemon_id: pokemonId, moves: [], item_id: '', ability_id: '', nature: '', statAllocation: emptyStatAllocation() };
}

function addCandidate(pokemonId, root, state, refresh = true) {
  // Adds only the selected Pokémon to the next empty slot.
  // It intentionally does not auto-fill items, abilities, moves, natures, or stats.
  const pokemon = state.data.indexes.pokemonById[pokemonId];
  if (!pokemon) {
    if (refresh && root) render(root, state);
    return false;
  }
  const draft = Array.from({ length: 6 }, (_, index) => state.team?.[index] || null);
  if (draft.some((slot) => slot?.pokemon_id === pokemonId)) {
    if (refresh && root) render(root, state);
    return false;
  }
  const legality = checkPokemonLegality(pokemon, state.data);
  if (!legality.allowed) {
    if (refresh && root) render(root, state);
    return false;
  }
  if (candidateConflictsWithTeamMega(pokemon, draft, state.data)) {
    if (refresh && root) render(root, state);
    return false;
  }
  const index = draft.findIndex((slot) => !slot);
  if (index < 0) {
    if (refresh && root) render(root, state);
    return false;
  }
  draft[index] = createEmptyTeamSlot(pokemonId);
  state.team = draft;
  setSlotCollapsed(state, index, false);
  markTeamBuilderDerivedWorkDirty(state);
  if (refresh && root) render(root, state);
  return true;
}

const SLOT_UI_STORAGE_KEY = 'gold-standard-rebuild.teamBuilderSlotUiState';

function normaliseSlotUiState(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 6 }, (_, index) => ({
    collapsed: Boolean(source[index]?.collapsed),
    strategicRoleOpen: source[index]?.strategicRoleOpen === true
  }));
}

function loadSlotUiState() {
  try {
    return normaliseSlotUiState(JSON.parse(localStorage.getItem(SLOT_UI_STORAGE_KEY) || '[]'));
  } catch (error) {
    console.warn('Could not load Team Builder slot UI state.', error);
    return normaliseSlotUiState([]);
  }
}

function setSlotCollapsed(state, slotIndex, collapsed) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 6) return;
  state.slotUiState = normaliseSlotUiState(state.slotUiState);
  state.slotUiState[slotIndex] = { ...state.slotUiState[slotIndex], collapsed: Boolean(collapsed) };
}

function scheduleSlotUiStateSave(state) {
  window.clearTimeout(state.__slotUiStateSaveTimer);
  state.__slotUiStateSaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SLOT_UI_STORAGE_KEY, JSON.stringify(normaliseSlotUiState(state.slotUiState)));
    } catch (error) {
      console.warn('Could not persist Team Builder slot UI state.', error);
    }
  }, 160);
}

