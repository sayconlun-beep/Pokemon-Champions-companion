import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { getMetadexTeamCoachingProfile, metadexCache } from './metadexCache.js';
import { FIELD_LABELS } from './metadexConstants.js';
import { currentTeamPokemon, defaultMetadexSort, filteredPokemon, hasActiveMetadexFilters, metadexVisibleLimit } from './metadexFiltering.js';
import { archetypeFitOptions, emptyState, escapeAttr, escapeText, guideStepOptions, normalize, option, roleConfidenceOptions, section, sortOptions, teamFitOptions, teamNeedOptions } from './metadexText.js';
import { renderMetadexDetailOverlay } from './renderMetadexDetailPanel.js';
import { dexTile } from './renderMetadexTile.js';

export function renderMetaDexPage(state) {
  metadexCache(state, { ensureFresh: true });
  const view = state.metadex || {};
  const pokemon = filteredPokemon(state, view);
  const groupedCount = getGroupedPokemonOptions(state.data).length;
  const selected = view.selectedId ? selectPokemon(state, pokemon, view.selectedId) : null;
  const coverageTotal = state.data.requiredGoldFields.length;
  return `<section class="page-stack metadex-page">
    <header class="hero metadex-hero">
      <div>
        <p class="eyebrow">Gold-standard scouting terminal</p>
        <h1>MetaDex</h1>
        <p>Browse each Pokémon by tactical identity, pressure route, board-state fit, matchup risk, and Champions availability.</p>
      </div>
      <div class="analysis-metrics" data-metadex-metrics>
        <span class="badge">${pokemon.length}/${groupedCount} matched</span>
        <span class="badge">${coverageTotal} tracked fields</span>
      </div>
    </header>

    ${renderMetadexContextBanner(state)}

    <section class="card metadex-controls" aria-label="MetaDex filters">
      <div class="metadex-search-row">
        <label class="field search-field metadex-name-search" data-metadex-search-wrap>
          <span>Pokémon name</span>
          <input id="metadex-name-search" value="${escapeAttr(view.search || '')}" aria-label="Search Pokémon" autocomplete="off" data-metadex-search />
          <div class="dropdown-panel metadex-dropdown" role="listbox" data-metadex-search-options>
            ${renderMetadexSearchOptions(state, view)}
          </div>
        </label>
        <label class="field metadex-primary-filter">
          <span>Team-building need</span>
          <select data-metadex-team-need>
            ${teamNeedOptions(view.teamNeed || 'all')}
          </select>
        </label>
        <label class="field">
          <span>Guide step</span>
          <select data-metadex-guide-step>
            ${guideStepOptions(view.guideStep || 'any')}
          </select>
        </label>
        <label class="field">
          <span>Team fit</span>
          <select data-metadex-team-fit ${currentTeamPokemon(state).length ? '' : 'disabled'}>
            ${teamFitOptions(view.teamFit || 'any')}
          </select>
          ${currentTeamPokemon(state).length ? '' : '<small>Add Pokémon to your team to unlock team-fit filters.</small>'}
        </label>
        <label class="field">
          <span>Archetype fit</span>
          <select data-metadex-archetype-fit>
            ${archetypeFitOptions(view.archetypeFit || 'any')}
          </select>
        </label>
        <label class="field">
          <span>Role confidence</span>
          <select data-metadex-role-confidence>
            ${roleConfidenceOptions(view.roleConfidence || 'strong-secondary')}
          </select>
        </label>
        <label class="field">
          <span>Sort by</span>
          <select data-metadex-sort>
            ${sortOptions(view.sort || defaultMetadexSort(view))}
          </select>
        </label>
        <details class="metadex-advanced-filters">
          <summary>Advanced filters</summary>
          <div class="metadex-search-row metadex-advanced-filter-grid">
            <label class="field">
              <span>Strategic field</span>
              <select data-metadex-field>
                ${option('all', 'All strategic fields', view.field || 'all')}
                ${state.data.requiredGoldFields.map((field) => option(field, FIELD_LABELS[field] || field, view.field || 'all')).join('')}
              </select>
            </label>
            <label class="field">
              <span>Availability</span>
              <select data-metadex-legality>
                ${option('all', 'All Pokémon', view.legality || 'all')}
                ${option('legal', 'Champions legal', view.legality || 'all')}
                ${option('review', 'Needs review', view.legality || 'all')}
              </select>
            </label>
            <div class="metadex-filter-action">
              <span>Form filter</span>
              <button type="button" class="metadex-filter-toggle${view.megaOnly ? ' active' : ''}" data-metadex-mega-toggle aria-pressed="${view.megaOnly ? 'true' : 'false'}">Mega Forms</button>
              <small>Show only Pokémon with Mega forms.</small>
            </div>
          </div>
        </details>
      </div>
    </section>

    ${selected ? renderMetadexDetailOverlay(selected, state) : ''}

    <section class="metadex-layout metadex-grid-only-layout">
      <section class="dex-grid metadex-grid" aria-label="Pokémon results" data-metadex-results data-metadex-results-region>
        ${renderMetadexResultsRegion(state, view, pokemon, selected)}
      </section>
    </section>
  </section>`;
}


export function renderMetadexSearchOptions(state = {}, view = {}) {
  return searchOptions(state, view)
    .map((pokemonRow) => `<button type="button" class="dropdown-option" data-metadex-select="${escapeAttr(pokemonRow.pokemon_id)}" data-action="select-metadex-pokemon" data-pokemon-id="${escapeAttr(pokemonRow.pokemon_id)}">${escapeText(getPokemonDisplayName(pokemonRow))}</button>`)
    .join('');
}

export function renderMetadexResultsRegion(state = {}, view = state.metadex || {}, pokemon = filteredPokemon(state, view), selected = null) {
  const visibleLimit = metadexVisibleLimit(view);
  const visiblePokemon = pokemon.slice(0, visibleLimit);
  const hiddenCount = Math.max(0, pokemon.length - visiblePokemon.length);
  return `${visiblePokemon.map((pokemonRow) => dexTile(pokemonRow, state, selected?.pokemon_id)).join('') || emptyState()}${hiddenCount > 0 ? renderMetadexResultLimitNotice(hiddenCount, view) : ''}`;
}

export function searchOptions(state = {}, view = {}) {
  const term = normalize(view.search || '');
  const source = getGroupedPokemonOptions(state.data).filter((pokemon) => {
    if (!term) return true;
    return getPokemonSearchAliases(pokemon).some((alias) => normalize(alias).includes(term));
  });
  return source.slice(0, 20);
}

export function selectPokemon(state = {}, rows = [], selectedId = '') {
  const resolvedId = resolveGroupedPokemonId(selectedId, state.data) || selectedId;
  return rows.find((pokemon) => pokemon.pokemon_id === resolvedId)
    || getGroupedPokemonOptions(state.data).find((pokemon) => pokemon.pokemon_id === resolvedId)
    || state.data?.indexes?.pokemonById?.[resolvedId]
    || null;
}

export function renderMetadexContextBanner(state = {}) {
  const team = currentTeamPokemon(state);
  if (!team.length) {
    return `<article class="mini-card metadex-context-banner"><h3>Team-aware MetaDex</h3><p class="muted small-copy">Add Pokémon to your team to unlock team-fit sorting and matchup-aware suggestions.</p></article>`;
  }
  const profile = getMetadexTeamCoachingProfile(state);
  const archetype = profile?.archetype?.primary || profile?.archetype?.label || 'current team';
  const speedMode = profile?.speedProfile?.mode || profile?.speedControl?.primary || '';
  const parts = [`${team.length}/6 Pokémon selected`, `Reading as ${archetype}`];
  if (speedMode && speedMode !== 'none') parts.push(`Speed plan: ${speedMode}`);
  return `<article class="mini-card metadex-context-banner"><h3>Team-aware MetaDex active</h3><p class="muted small-copy">${parts.map(escapeText).join(' · ')}</p></article>`;
}

export function renderMetadexResultLimitNotice(hiddenCount, view = {}) {
  return `<article class="mini-card metadex-result-limit-note" aria-live="polite">
    <h3>${hiddenCount} more matches</h3>
    <p class="muted small-copy">Use search or filters to narrow results, or show more.</p>
    <div class="metadex-limit-actions">
      <button type="button" class="secondary-button compact-button" data-metadex-show-more>Show more</button>
      ${hasActiveMetadexFilters(view) ? '<button type="button" class="ghost-button compact-button" data-action="clear-metadex-all-filters">Clear filters</button>' : ''}
    </div>
  </article>`;
}
