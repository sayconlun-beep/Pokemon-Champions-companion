import { getGroupedPokemonOptions, resolveGroupedPokemonId } from '../../utils/formGrouping.js';
import { renderMetadexDetailOverlay } from '../../pages/metadex/renderMetadexDetailPanel.js';

export function closeMetadexDetailOverlay(root, state, overlay = null) {
  const overlays = overlay ? [overlay] : Array.from(document.querySelectorAll('[data-metadex-detail-overlay]'));
  overlays.forEach((node) => node.remove());
  document.body.classList.remove('compact-move-picker-open');
  if (state?.metadex) state.metadex.selectedId = '';
  root?.querySelector?.('.metadex-grid .metadex-tile')?.focus?.({ preventScroll: true });
}

export function openMetadexDetailOverlay(root, state, selectedId = '') {
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

  const close = () => closeMetadexDetailOverlay(root, state, overlay);
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
