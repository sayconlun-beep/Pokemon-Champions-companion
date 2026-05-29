import { getGroupedPokemonOptions, getPokemonDisplayName } from '../utils/formGrouping.js';
import { metadexCache } from '../pages/metadex/metadexCache.js';
import { defaultMetadexSort, filteredPokemon, hasActiveMetadexFilters, metadexVisibleLimit } from '../pages/metadex/metadexFiltering.js';
import { emptyState, escapeAttr, escapeText, normalize } from '../pages/metadex/metadexText.js';
import { dexTile } from '../pages/metadex/renderMetadexTile.js';
import { renderMetadexResultLimitNotice, searchOptions, selectPokemon } from '../pages/metadex/renderMetaDexPage.js';

export function renderMetadexDynamicRegions(root, state) {
  if (!root || state?.route !== 'metadex') return false;
  const page = root.querySelector('.metadex-page');
  const grid = page?.querySelector('[data-metadex-results-region]');
  if (!page || !grid) return false;

  metadexCache(state, { ensureFresh: true });
  const view = state.metadex || {};
  const pokemon = filteredPokemon(state, view);
  const visibleLimit = metadexVisibleLimit(view);
  const visiblePokemon = pokemon.slice(0, visibleLimit);
  const selected = view.selectedId ? selectPokemon(state, pokemon, view.selectedId) : null;
  const hiddenCount = Math.max(0, pokemon.length - visiblePokemon.length);

  updateMetadexMetrics(page, state, pokemon.length);
  updateMetadexSearchOptions(page, state, view);
  grid.innerHTML = `${visiblePokemon.map((pokemonRow) => dexTile(pokemonRow, state, selected?.pokemon_id)).join('') || emptyState()}${hiddenCount > 0 ? renderMetadexResultLimitNotice(hiddenCount, view) : ''}`;
  return true;
}

function updateMetadexMetrics(page, state, matchedCount) {
  const metrics = page.querySelector('[data-metadex-metrics]');
  if (!metrics) return;
  const groupedCount = getGroupedPokemonOptions(state.data).length;
  const coverageTotal = state.data?.requiredGoldFields?.length || 0;
  metrics.innerHTML = `<span class="badge">${matchedCount}/${groupedCount} matched</span><span class="badge">${coverageTotal} tracked fields</span>`;
}

function updateMetadexSearchOptions(page, state, view) {
  const panel = page.querySelector('[data-metadex-search-options]');
  if (!panel) return;
  panel.innerHTML = searchOptions(state, view)
    .map((pokemonRow) => `<button type="button" class="dropdown-option" data-metadex-select="${escapeAttr(pokemonRow.pokemon_id)}" data-action="select-metadex-pokemon" data-pokemon-id="${escapeAttr(pokemonRow.pokemon_id)}">${escapeText(getPokemonDisplayName(pokemonRow))}</button>`)
    .join('');
}

export function metadexSearchSignature(state) {
  const view = state?.metadex || {};
  return [
    normalize(view.search || ''),
    view.legality || 'all',
    view.field || 'all',
    view.teamNeed || 'all',
    view.guideStep || 'any',
    view.teamFit || 'any',
    view.archetypeFit || 'any',
    view.roleConfidence || 'strong-secondary',
    view.sort || defaultMetadexSort(view),
    view.megaOnly ? 'mega' : 'all',
    metadexVisibleLimit(view)
  ].join('|');
}
