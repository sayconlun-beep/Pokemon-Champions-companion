import { loadMoveLegalityData, hasMoveLegalityData } from '../../data/dataLoader.js';
import { clearMoveOptionsCacheIfAvailable } from '../../app-shell/appShellSearch.js';
import { getPokemonTypeChipStyle } from '../../constants/pokemonTypeColors.js';
import { markTeamBuilderDerivedWorkDirty } from '../teamBuilderDerivedState.js';
import {
  armDirectPickerOpenGuard,
  closeAllDirectPickers,
  closeDirectMovePicker,
  escapeMovePickerText,
  normalizeMovePickerText,
  rerenderAppShellRoot,
  setDirectPickerOptionVisible,
  shouldIgnoreDirectPickerOptionClick
} from './directPickerShared.js';

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
    rerenderAppShellRoot(root, state);
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

export function openDirectMovePicker(slotIndex, moveIndex, state, root) {
  if (!state?.data) return;
  renderDirectMovePicker(slotIndex, moveIndex, state, root, !hasMoveLegalityData(state.data));
  if (!hasMoveLegalityData(state.data)) {
    loadMoveLegalityData(state.data)
      .then(() => {
        clearMoveOptionsCacheIfAvailable();
        rerenderAppShellRoot(root, state);
        renderDirectMovePicker(slotIndex, moveIndex, state, root, false);
      })
      .catch((error) => {
        console.error('Move learnset lazy-load failed:', error);
        renderDirectMovePicker(slotIndex, moveIndex, state, root, false, 'Move learnset data could not be loaded.');
      });
  }
}

export { closeDirectMovePicker };
