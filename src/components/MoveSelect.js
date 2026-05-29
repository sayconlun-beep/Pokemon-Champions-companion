import { getPokemonTypeChipStyle } from '../constants/pokemonTypeColors.js';
import { hasMoveLegalityData } from '../data/dataLoader.js';
import { escapeText } from './SearchableSelector.js';

// `clearMoveOptionsCache` is kept as a no-op for external callers
// (appShellSearch.js calls it when move learnsets reload). The cache it
// used to flush was tied to the legacy `MoveSelect` picker which has
// been removed.
export function clearMoveOptionsCache() {}

function summarize(value) { const clean = String(value || '').replace(/\s+/g, ' ').trim(); return clean.length > 110 ? `${clean.slice(0, 107)}…` : clean; }


export function MoveSelectionList(slotIndex, slot, data) {
  const selectedMoveIds = Array.isArray(slot?.moves) ? slot.moves.slice(0, 4) : [];
  const selectedMoves = selectedMoveIds
    .map((moveId, moveIndex) => ({ moveId, moveIndex, move: moveId ? data.indexes.movesById?.[moveId] : null }))
    .filter((entry) => entry.moveId);
  const firstEmptyIndex = [0, 1, 2, 3].find((moveIndex) => !selectedMoveIds[moveIndex]);
  const moveDataLoaded = hasMoveLegalityData(data);
  const helper = !slot?.pokemon_id
    ? 'Choose a Pokémon first.'
    : moveDataLoaded
      ? 'Legal move choices only.'
      : 'Move learnsets load when you open the selector.';

  return `<div class="compact-move-editor" data-compact-move-editor data-slot="${slotIndex}">
    <div class="compact-move-list" aria-label="Selected moves">
      ${selectedMoves.length ? selectedMoves.map((entry) => compactMoveRow(slotIndex, entry)).join('') : `<p class="muted small-copy compact-move-empty">No moves selected yet.</p>`}
    </div>
    <div class="compact-move-actions">
      ${firstEmptyIndex !== undefined ? `<button type="button" class="tiny-button add-move-button compact-add-move-button" data-selector-focus="move" data-slot="${slotIndex}" data-move-index="${firstEmptyIndex}">+ Add Move</button>` : '<span class="badge legal-badge compact-move-max">4 moves selected</span>'}
      <span class="muted small-copy">${escapeText(helper)}</span>
    </div>
  </div>`;
}

function compactMoveRow(slotIndex, entry) {
  const move = entry.move || {};
  const type = move.type || '—';
  const category = normalizeCategory(move.category);
  const typeStyle = move.type ? `style="${escapeText(getPokemonTypeChipStyle(move.type))}"` : '';
  const accentStyle = move.type ? `style="--move-accent:${escapeText(typeAccent(move.type))};"` : '';
  const power = formatMovePower(move);
  const accuracy = formatMoveAccuracy(move);
  const extra = statusExtra(move);
  const detail = summarize(move.effect || move.description || move.notes || move.shortEffect || '');
  return `<div class="compact-move-row compact-move-card" data-move-row="${entry.moveIndex}" ${accentStyle}>
    <button type="button" class="compact-move-hitbox" data-selector-focus="move" data-slot="${slotIndex}" data-move-index="${entry.moveIndex}" aria-label="Change ${escapeText(move.name || 'move')}"></button>
    <div class="compact-move-icon" aria-hidden="true">${categoryIcon(category)}</div>
    <div class="compact-move-copy">
      <div class="compact-move-title-line">
        <strong>${escapeText(move.name || entry.moveId || `Move ${entry.moveIndex + 1}`)}</strong>
        <span class="badge mini-badge type-badge type-${escapeText(String(type).toLowerCase())}" ${typeStyle}>${escapeText(type)}</span>
      </div>
      <div class="compact-move-meta-line">
        <span class="compact-move-category compact-move-category-${escapeText(category.toLowerCase())}">${categoryIcon(category)} ${escapeText(category)}</span>
        ${extra ? `<span class="compact-move-extra">${escapeText(extra)}</span>` : ''}
      </div>
      ${detail ? `<p>${escapeText(detail)}</p>` : ''}
    </div>
    <div class="compact-move-stats" aria-label="Move stats">
      <span><em>BP</em><b>${escapeText(power)}</b></span>
      <span><em>ACC</em><b>${escapeText(accuracy)}</b></span>
      ${extra ? `<span class="compact-move-extra-stat"><em>${escapeText(extraLabel(move))}</em><b>${escapeText(extraValue(move))}</b></span>` : ''}
    </div>
    <button type="button" class="selector-clear compact-move-clear" data-selector-clear data-selector-kind="move" data-slot="${slotIndex}" data-move-index="${entry.moveIndex}" aria-label="Remove ${escapeText(move.name || 'move')}">×</button>
  </div>`;
}

function normalizeCategory(category) {
  const value = String(category || 'Status').trim();
  if (/physical/i.test(value)) return 'Physical';
  if (/special/i.test(value)) return 'Special';
  return 'Status';
}

function categoryIcon(category) {
  if (category === 'Physical') return '⚔';
  if (category === 'Special') return '✦';
  return '◎';
}

function formatMovePower(move) {
  const value = move.power ?? move.basePower ?? '—';
  return value && value !== '—' ? String(value) : '—';
}

function formatMoveAccuracy(move) {
  const value = move.accuracy ?? '—';
  if (value === true || value === 'true') return '—';
  if (value === '—' || value === '' || value == null) return '—';
  const number = Number(value);
  if (Number.isFinite(number)) return number <= 1 ? `${Math.round(number * 100)}%` : `${Math.round(number)}%`;
  return String(value);
}

function statusExtra(move) {
  const priority = Number(move.priority || 0);
  if (priority) return `${priority > 0 ? '+' : ''}${priority} priority`;
  const text = String(move.effect || move.description || move.notes || move.name || '').toLowerCase();
  const duration = text.match(/(\d+)\s*turns?/i);
  if (duration) return `${duration[1]} turns`;
  return '';
}

function extraLabel(move) {
  return Number(move.priority || 0) ? 'Priority' : 'Duration';
}

function extraValue(move) {
  const extra = statusExtra(move);
  return extra.replace(/ priority$/i, '');
}

function typeAccent(type) {
  const styles = getPokemonTypeChipStyle(type) || '';
  const match = styles.match(/background(?:-color)?:\s*([^;]+)/i);
  return match ? match[1].trim() : 'rgba(96, 165, 250, .9)';
}
