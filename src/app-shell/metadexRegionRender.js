import { getGroupedPokemonOptions } from '../utils/formGrouping.js';
import { metadexCache } from '../pages/metadex/metadexCache.js';
import { defaultMetadexSort, filteredPokemon, hasActiveMetadexFilters, metadexVisibleLimit } from '../pages/metadex/metadexFiltering.js';
import { normalize } from '../pages/metadex/metadexText.js';
import { renderMetadexResultsRegion, renderMetadexSearchOptions, selectPokemon } from '../pages/metadex/renderMetaDexPage.js';

export function renderMetadexDynamicRegions(root, state) {
  if (!root || state?.route !== 'metadex') return false;
  const page = root.querySelector('.metadex-page');
  const grid = page?.querySelector('[data-metadex-results]') || page?.querySelector('[data-metadex-results-region]');
  if (!page || !grid) return false;

  metadexCache(state, { ensureFresh: true });
  const view = state.metadex || {};
  const pokemon = filteredPokemon(state, view);
  const selected = view.selectedId ? selectPokemon(state, pokemon, view.selectedId) : null;

  updateMetadexMetrics(page, state, pokemon.length);
  updateMetadexSearchOptions(page, state, view);
  grid.innerHTML = renderMetadexResultsRegion(state, view, pokemon, selected);
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
  panel.innerHTML = renderMetadexSearchOptions(state, view);
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
