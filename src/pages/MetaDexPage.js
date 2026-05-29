import { getPokemonSprite } from '../utils/pokemonSprites.js';
import { TypeBadges } from '../utils/typeBadges.js';
import { CompactStatBars } from '../utils/compactStats.js';
import { normalizeDisplayText, normalizeDisplayLabel } from '../utils/tacticalTextNormalizer.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../utils/formGrouping.js';
import { getReadableAbilityName } from '../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';

const FIELD_LABELS = {
  strategicStrengths: 'Strategic strengths',
  interactionProfiles: 'Team Coordination',
  pressureFlow: 'offensive pressure',
  strategicTriggers: 'Strategic triggers',
  replayBehaviourEvidence: 'Replay evidence',
  failureChains: 'bad positions',
  preferredBoardStates: 'Preferred boards',
  advancedResourceEconomy: 'Resource economy',
  damageBenchmarks: 'Damage benchmarks'
};

const QUALITY_LABELS = {
  gold: 'Gold Star',
  strong: 'Strong',
  needs: 'Needs Work',
  incomplete: 'Incomplete'
};

const EMPTY_MESSAGES = {
  'Damage benchmark notes': 'No benchmark analysis recorded yet.',
  'Item compatibility': 'No advanced item interactions documented.',
  'Replay evidence': 'No tactical replay evidence available.',
  'Legal moves': 'No legal move data recorded yet.',
  Abilities: 'No legal ability data recorded yet.',
  default: 'No tactical note recorded yet.'
};

const SHOW_METADEX_ROLE_DEBUG = false;
const METADEX_INITIAL_VISIBLE_LIMIT = 90;
const METADEX_LOAD_MORE_INCREMENT = 60;

const MOVE_PRIORITY_TERMS = [
  'protect', 'fake out', 'tailwind', 'trick room', 'taunt', 'follow me', 'rage powder', 'wide guard', 'quick guard',
  'spore', 'will-o-wisp', 'thunder wave', 'icy wind', 'snarl', 'parting shot', 'u-turn', 'volt switch', 'knock off',
  'swords dance', 'dragon dance', 'nasty plot', 'calm mind', 'bulk up', 'recover', 'roost', 'wish', 'moonlight',
  'extreme speed', 'sucker punch', 'bullet punch', 'aqua jet', 'ice shard', 'mach punch', 'shadow sneak',
  'earthquake', 'rock slide', 'heat wave', 'dazzling gleam', 'blizzard', 'eruption', 'water spout', 'spread'
];

const TACTICAL_IDENTITY_CACHE = new WeakMap();
const METADEX_EMPTY_DETAIL = '<h2>Select a Pokémon</h2><p class="muted">Choose a tile or search result to inspect tactical identity, legal options, and evidence notes.</p>';

function metadexCache(state = {}, options = {}) {
  const dataKey = state?.data?.collections?.pokemon || null;
  const teamKey = teamCacheKey(state);
  const existing = state.__metadexRenderCache;
  if (!existing || existing.dataKey !== dataKey || options.ensureFresh && existing.teamKey !== teamKey) {
    state.__metadexRenderCache = {
      dataKey,
      teamKey,
      filterMatches: existing?.filterMatches instanceof Map ? existing.filterMatches : new Map(),
      roles: existing?.roles instanceof Map ? existing.roles : new Map(),
      facts: existing?.facts instanceof Map ? existing.facts : new Map(),
      legalMoves: existing?.legalMoves instanceof Map ? existing.legalMoves : new Map(),
      legalAbilities: existing?.legalAbilities instanceof Map ? existing.legalAbilities : new Map(),
      detailPanels: existing?.detailPanels instanceof Map ? existing.detailPanels : new Map(),
      teamProfile: null
    };
  }
  return state.__metadexRenderCache;
}


// SHARED PROFILE DISPLAY: cached shared team interpretation for MetaDex panels and filters.
// Candidate-specific scoring can compare against this profile, but should not recreate team identity/risk coaching.
function getMetadexTeamCoachingProfile(state = {}) {
  const cache = metadexCache(state);
  if (!cache.teamProfile) cache.teamProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  return cache.teamProfile;
}

function pokemonCacheKey(pokemon) {
  return String(pokemon?.pokemon_id || pokemon?.id || pokemon?.name || 'unknown');
}

function metadexViewCacheKey(view = {}, answerType = '') {
  return [
    view.search || '', view.field || 'all', view.legality || 'all', view.megaOnly ? 'mega' : 'all-forms',
    view.teamNeed || 'all', view.guideStep || 'any', view.teamFit || 'any', view.archetypeFit || 'any',
    view.roleConfidence || 'strong-secondary', view.sort || '', answerType || '', view.answerType || '', view.weaknessAnswerType || ''
  ].join('|');
}

function teamCacheKey(state = {}) {
  return (Array.isArray(state.team) ? state.team : [])
    .map((slot) => {
      if (!slot) return '';
      const moves = Array.isArray(slot.moves || slot.move_ids)
        ? (slot.moves || slot.move_ids).filter(Boolean).join('/')
        : [slot.move1, slot.move2, slot.move3, slot.move4].filter(Boolean).join('/');
      return [
        slot.pokemon_id || slot.pokemon?.pokemon_id || '',
        slot.ability_id || slot.ability || '',
        slot.item_id || slot.item || '',
        moves
      ].join(':');
    })
    .join(',');
}

export function MetaDexPage(state) {
  metadexCache(state, { ensureFresh: true });
  const view = state.metadex || {};
  const pokemon = filteredPokemon(state, view);
  const groupedCount = getGroupedPokemonOptions(state.data).length;
  const visibleLimit = metadexVisibleLimit(view);
  const visiblePokemon = pokemon.slice(0, visibleLimit);
  const visibleIds = new Set(visiblePokemon.map((pokemonRow) => pokemonRow.pokemon_id));
  if (view.selectedId && !visibleIds.has(resolveGroupedPokemonId(view.selectedId, state.data))) {
    view.selectedId = '';
  }
  const selected = view.selectedId ? selectPokemon(state, pokemon, view.selectedId) : null;
  const hiddenCount = Math.max(0, pokemon.length - visiblePokemon.length);
  const coverageTotal = state.data.requiredGoldFields.length;
  return `<section class="page-stack metadex-page">
    <header class="hero metadex-hero">
      <div>
        <p class="eyebrow">Gold-standard scouting terminal</p>
        <h1>MetaDex</h1>
        <p>Browse each Pokémon by tactical identity, pressure route, board-state fit, matchup risk, and Champions availability.</p>
      </div>
      <div class="analysis-metrics">
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
          <div class="dropdown-panel metadex-dropdown" role="listbox">
            ${searchOptions(state, view).map((pokemonRow) => `<button type="button" class="dropdown-option" data-metadex-select="${escapeAttr(pokemonRow.pokemon_id)}">${escapeText(getPokemonDisplayName(pokemonRow))}</button>`).join('')}
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

    ${selected ? renderMobileSelectedDetailPanel(selected, state) : ''}

    <section class="metadex-layout">
      <section class="dex-grid metadex-grid" aria-label="Pokémon results">
        ${visiblePokemon.map((pokemonRow) => dexTile(pokemonRow, state, selected?.pokemon_id)).join('') || emptyState()}
        ${hiddenCount > 0 ? renderMetadexResultLimitNotice(hiddenCount, view) : ''}
      </section>
      <aside class="card metadex-detail-panel" aria-label="Pokémon details">
        ${selected ? cachedDetailPanel(selected, state) : METADEX_EMPTY_DETAIL}
      </aside>
    </section>
  </section>`;
}


function searchOptions(state = {}, view = {}) {
  const term = normalize(view.search || '');
  const source = getGroupedPokemonOptions(state.data).filter((pokemon) => {
    if (!term) return true;
    return getPokemonSearchAliases(pokemon).some((alias) => normalize(alias).includes(term));
  });
  return source.slice(0, 20);
}


function selectPokemon(state = {}, rows = [], selectedId = '') {
  const resolvedId = resolveGroupedPokemonId(selectedId, state.data) || selectedId;
  return rows.find((pokemon) => pokemon.pokemon_id === resolvedId)
    || getGroupedPokemonOptions(state.data).find((pokemon) => pokemon.pokemon_id === resolvedId)
    || state.data?.indexes?.pokemonById?.[resolvedId]
    || null;
}


function dexTile(pokemon, state = {}, selectedId = '') {
  const displayName = getPokemonDisplayName(pokemon);
  const types = getPokemonTypes(pokemon);
  const identity = tacticalIdentity(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const coverage = scorePokemonGoldCoverage(pokemon, state.data?.requiredGoldFields || []);
  const quality = qualityTier(coverage.completeFields || 0);
  const selected = selectedId === pokemon.pokemon_id;
  const sprite = getPokemonSprite(pokemon, state.data);
  const spriteSrc = typeof sprite === 'string' ? sprite : sprite?.src;
  const spriteAlt = typeof sprite === 'string' ? `${displayName} sprite` : (sprite?.alt || `${displayName} sprite`);
  const form = getPokemonFormLabel(pokemon);
  const primaryRole = role.primaryRole || role.label || identity.identity || identity.primaryPressure || 'Flexible';
  const typeBadges = TypeBadges(pokemon);
  return `<article class="dex-card metadex-tile${selected ? ' selected active' : ''}" data-metadex-card data-metadex-select="${escapeAttr(pokemon.pokemon_id)}" tabindex="0" role="button" aria-pressed="${selected ? 'true' : 'false'}">
    <div class="metadex-card-head">
      <h3 class="metadex-card-name">${escapeText(displayName)}</h3>
      <div class="type-badge-row metadex-card-types">${typeBadges}</div>
    </div>
    <div class="metadex-card-art" aria-hidden="true">
      <img src="${escapeAttr(spriteSrc)}" alt="${escapeAttr(spriteAlt)}" loading="lazy" onerror="this.src='/assets/pokemon-silhouette.svg'; this.classList.add('sprite-fallback');" />
      <span class="metadex-card-orbit"></span>
    </div>
    <p class="metadex-card-role">${escapeText(primaryRole)}</p>
    <div class="metadex-card-meta">
      ${form ? `<span class="score-pill form-pill">${escapeText(form)}</span>` : ''}
      <span class="score-pill">${escapeText(availabilityText(pokemon))}</span>
      <span class="score-pill quality-${escapeAttr(quality.key || 'strong')}">${escapeText(quality.label)}</span>
    </div>
  </article>`;
}

function cachedDetailPanel(pokemon, state = {}) {
  const cache = metadexCache(state).detailPanels;
  const key = `${pokemonCacheKey(pokemon)}|${teamCacheKey(state)}|${metadexViewCacheKey(state.metadex || {})}`;
  if (cache.has(key)) return cache.get(key);
  const html = renderDetailPanel(pokemon, state);
  cache.set(key, html);
  return html;
}

function renderMobileSelectedDetailPanel(pokemon, state = {}) {
  return `<section class="metadex-mobile-detail-panel metadex-selected-detail-panel" aria-label="Selected Pokémon details">${cachedDetailPanel(pokemon, state)}</section>`;
}

function renderDetailPanel(pokemon, state = {}) {
  const identity = tacticalIdentity(pokemon);
  const legalMoveRows = legalMoves(pokemon, state);
  const abilities = legalAbilities(pokemon, state);
  const sprite = getPokemonSprite(pokemon, state.data);
  const spriteSrc = typeof sprite === 'string' ? sprite : sprite?.src;
  const spriteAlt = typeof sprite === 'string' ? 'Pokémon sprite' : (sprite?.alt || 'Pokémon sprite');
  const displayName = getPokemonDisplayName(pokemon);
  const types = getPokemonTypes(pokemon);
  const coverage = scorePokemonGoldCoverage(pokemon, state.data?.requiredGoldFields || []);
  const quality = qualityTier(coverage.completeFields || 0);
  return `<div class="metadex-detail-stack">
    <header class="metadex-detail-header">
      <div class="dex-card-sprite metadex-detail-sprite"><img src="${escapeAttr(spriteSrc)}" alt="${escapeAttr(spriteAlt)}" loading="lazy" onerror="this.src='/assets/pokemon-silhouette.svg';" /></div>
      <div>
        <p class="eyebrow">${escapeText(availabilityText(pokemon))}</p>
        <h2>${escapeText(displayName)}</h2>
        <p class="muted">${escapeText(types.join(' / ') || pokemon.typing || 'Unknown type')}</p>
        <div class="team-guide-chip-row">
          <span class="score-pill">${escapeText(quality.label)}</span>
          <span class="score-pill">${escapeText((identity.identity || identity.primaryPressure || 'Flexible tactical option').toString().slice(0, 80))}</span>
        </div>
      </div>
    </header>
    ${weaknessAnswerFitPanel(pokemon, state)}
    ${quickBuildSummaryPanel(pokemon, identity, state)}
    ${teamValuePanel(pokemon, identity, state)}
    ${teamNeedsPanel(pokemon, identity, state)}
    ${guidedCoachFitPanel(pokemon, identity, state)}
    ${teamFitPanel(pokemon, identity, state)}
    ${choiceGuidancePanel(pokemon, identity, state)}
    ${recommendedBuildOptionsPanel(pokemon, identity, state)}
    ${referenceOptionsPanel(legalMoveRows, abilities)}
    ${metadexGuidedBuilderActions(pokemon, state)}
  </div>`;
}

function filteredPokemon(state, view) {
  const term = normalize(view.search);
  const field = view.field || 'all';
  const legality = view.legality || 'all';
  const answerType = normaliseAnswerType(view.answerType || view.weaknessAnswerType || '');
  const rows = getGroupedPokemonOptions(state.data).filter((pokemon) => {
    if (term && !getPokemonSearchAliases(pokemon).some((alias) => normalize(alias).includes(term))) return false;
    if (legality === 'legal' && yesNo(pokemon.champions_legal) !== 'yes') return false;
    if (legality === 'review' && !pokemon.requiresOfficialReview && String(pokemon.confidenceStatus || '').toLowerCase() !== 'needs champions confirmation') return false;
    if (field !== 'all' && !hasMeaningfulValue(pokemon[field])) return false;
    if (view.megaOnly && !isMegaForm(pokemon)) return false;
    return true;
  });

  const scored = rows.map((pokemon) => ({ pokemon, match: getMetadexFilterMatch(pokemon, state, view, answerType) }));
  const hasActiveFilter = answerType || activeTeamNeed(view) !== 'all' || activeGuideStep(view) !== 'any' || activeTeamFit(view) !== 'any' || activeArchetypeFit(view) !== 'any';
  const confidenceMode = view.roleConfidence || 'strong-secondary';
  const filtered = scored.filter((entry) => {
    if (!hasActiveFilter) return true;
    if (confidenceMode === 'primary-only') return entry.match.primaryScore > 0 || entry.match.answerScore > 0;
    if (confidenceMode === 'hide-low') return entry.match.score >= 35 || entry.match.answerScore > 0;
    return entry.match.score > 0 || entry.match.answerScore > 0;
  });
  const sortMode = view.sort || defaultMetadexSort(view, state);
  return filtered
    .sort((a, b) => sortMetadexEntries(a, b, sortMode))
    .map((entry) => entry.pokemon);
}

function activeTeamNeed(view = {}) { return view.teamNeed || 'all'; }
function activeGuideStep(view = {}) { return view.guideStep || 'any'; }
function activeTeamFit(view = {}) { return view.teamFit || 'any'; }
function activeArchetypeFit(view = {}) { return view.archetypeFit || 'any'; }

function defaultMetadexSort(view = {}, state = {}) {
  if (normaliseAnswerType(view.answerType || view.weaknessAnswerType || '')) return 'weakness-answer';
  if (activeGuideStep(view) !== 'any') return 'guide-step';
  return currentTeamPokemon(state).length ? 'team-fit' : 'alphabetical';
}

function sortMetadexEntries(a, b, sortMode = 'alphabetical') {
  const left = a?.pokemon || {};
  const right = b?.pokemon || {};
  const leftMatch = a?.match || {};
  const rightMatch = b?.match || {};
  const leftFacts = leftMatch.facts || {};
  const rightFacts = rightMatch.facts || {};
  const byName = () => getPokemonDisplayName(left).localeCompare(getPokemonDisplayName(right));
  const byScore = (leftScore, rightScore) => {
    const diff = Number(rightScore || 0) - Number(leftScore || 0);
    return diff || byName();
  };

  switch (sortMode) {
    case 'team-fit':
    case 'guide-step':
      return byScore(leftMatch.totalScore || leftMatch.score, rightMatch.totalScore || rightMatch.score);
    case 'role-confidence':
      return byScore(leftMatch.primaryScore || leftMatch.score, rightMatch.primaryScore || rightMatch.score);
    case 'offense':
      return byScore(Math.max(Number(leftFacts.atk || 0), Number(leftFacts.spa || 0)), Math.max(Number(rightFacts.atk || 0), Number(rightFacts.spa || 0)));
    case 'defensive':
      return byScore((Number(leftFacts.hp || 0) + Number(leftFacts.def || 0) + Number(leftFacts.spd || 0)), (Number(rightFacts.hp || 0) + Number(rightFacts.def || 0) + Number(rightFacts.spd || 0)));
    case 'speed-control':
      return byScore((leftFacts.isFast ? 30 : 0) + (Array.isArray(leftFacts.speedMoves) ? leftFacts.speedMoves.length * 25 : 0) + Number(leftFacts.spe || 0) / 10, (rightFacts.isFast ? 30 : 0) + (Array.isArray(rightFacts.speedMoves) ? rightFacts.speedMoves.length * 25 : 0) + Number(rightFacts.spe || 0) / 10);
    case 'weakness-answer':
      return byScore(leftMatch.answerScore || leftMatch.score, rightMatch.answerScore || rightMatch.score);
    case 'alphabetical':
    default:
      return byName();
  }
}

function metadexVisibleLimit(view = {}) {
  const rawLimit = Number(view.visibleLimit || METADEX_INITIAL_VISIBLE_LIMIT);
  return Number.isFinite(rawLimit) && rawLimit > 0 ? Math.max(METADEX_INITIAL_VISIBLE_LIMIT, rawLimit) : METADEX_INITIAL_VISIBLE_LIMIT;
}

function renderMetadexContextBanner(state = {}) {
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

function hasActiveMetadexFilters(view = {}) {
  return Boolean(
    (view.search && String(view.search).trim()) ||
    (view.legality && view.legality !== 'all') ||
    (view.field && view.field !== 'all') ||
    view.megaOnly ||
    normaliseAnswerType(view.answerType || view.weaknessAnswerType || '') ||
    activeTeamNeed(view) !== 'all' ||
    activeGuideStep(view) !== 'any' ||
    activeTeamFit(view) !== 'any' ||
    activeArchetypeFit(view) !== 'any' ||
    (view.roleConfidence && view.roleConfidence !== 'strong-secondary')
  );
}

function renderMetadexResultLimitNotice(hiddenCount, view = {}) {
  return `<article class="mini-card metadex-result-limit-note" aria-live="polite">
    <h3>${hiddenCount} more matches</h3>
    <p class="muted small-copy">Use search or filters to narrow results, or show more.</p>
    <div class="metadex-limit-actions">
      <button type="button" class="secondary-button compact-button" data-metadex-show-more>Show more</button>
      ${hasActiveMetadexFilters(view) ? '<button type="button" class="ghost-button compact-button" data-action="clear-metadex-all-filters">Clear filters</button>' : ''}
    </div>
  </article>`;
}

function getMetadexFilterMatch(pokemon, state = {}, view = {}, answerType = '') {
  const cache = metadexCache(state).filterMatches;
  const key = `${pokemonCacheKey(pokemon)}|${metadexViewCacheKey(view, answerType)}|${teamCacheKey(state)}`;
  if (cache.has(key)) return cache.get(key);
  const match = evaluateMetadexFilterMatch(pokemon, state, view, answerType);
  cache.set(key, match);
  return match;
}

// RAW CALCULATION / CANDIDATE COMPARISON: evaluates filters against candidate facts and cached shared profile needs.
function evaluateMetadexFilterMatch(pokemon, state = {}, view = {}, answerType = '') {
  const identity = tacticalIdentity(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const fits = inferGuidedCoachFits(pokemon, identity, state).map((fit) => fit.tag);
  const text = flattenContent([pokemon, identity.identity, identity.primaryPressure]).join(' ').toLowerCase();
  const need = activeTeamNeed(view);
  const guideStep = activeGuideStep(view);
  const teamFit = activeTeamFit(view);
  const archetype = activeArchetypeFit(view);
  const scores = [];
  const reasons = [];
  let primaryScore = 0;

  const add = (score, reason, primary = false) => {
    if (score > 0) { scores.push(score); reasons.push(reason); if (primary) primaryScore = Math.max(primaryScore, score); }
  };

  const needScore = scoreTeamNeedMatch(need, pokemon, role, facts, fits, text);
  if (need !== 'all') add(needScore.score, needScore.reason, needScore.primary);
  const stepScore = scoreGuideStepMatch(guideStep, pokemon, role, facts, fits, text);
  if (guideStep !== 'any') add(stepScore.score, stepScore.reason, stepScore.primary);
  const teamScore = scoreTeamFitMatch(teamFit, pokemon, state, role, facts, text);
  if (teamFit !== 'any') add(teamScore.score, teamScore.reason, teamScore.primary);
  const archScore = scoreArchetypeMatch(archetype, pokemon, role, facts, text);
  if (archetype !== 'any') add(archScore.score, archScore.reason, archScore.primary);

  let answerScore = 0;
  if (answerType) {
    const answer = evaluateWeaknessAnswerPokemon(pokemon, answerType, state);
    answerScore = answer.score;
    add(Math.max(0, answer.score), answer.reason, answer.score >= 55);
  }

  if (!reasons.length) {
    const fallback = role.primaryRole || role.label || 'Flexible team member';
    reasons.push(`${fallback}: useful when its role, typing, or legal options fit the plan.`);
  }
  return { score: Math.max(0, ...scores), totalScore: scores.reduce((a,b)=>a+b,0), primaryScore, answerScore, reason: reasons[0], facts };
}


function currentTeamPokemon(state) {
  const team = Array.isArray(state?.team) ? state.team : [];
  return team.filter(Boolean).filter((slot) => slot?.pokemon || slot?.name || slot?.id);
}

function isMegaForm(pokemon = {}) {
  const text = [pokemon.is_mega, pokemon.form_name, pokemon.name, pokemon.pokemon_id, pokemon.tags]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .join(' ')
    .toLowerCase();
  return yesNo(pokemon.is_mega) === 'yes' || /mega/.test(text);
}

// TODO: Replace with shared coaching profile
function scoreTeamNeedMatch(need, pokemon, role, facts, fits, text) {
  const has = (...terms) => facts.hasMove(...terms) || terms.some((term) => text.includes(term));
  const offensive = role.key === 'attacker' || role.key === 'setup' || facts.atk >= 105 || facts.spa >= 105;
  const bulky = role.key === 'bulky' || facts.isBulky;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control');
  const map = {
    main: [offensive || role.key === 'setup', 80, 'Main Pokémon: has a clear pressure or win-condition profile.'],
    partner: [fits.includes('Partner') || support || bulky, 70, 'Core Partner: helps a main Pokémon through support, defensive value, or role compression.'],
    damage: [offensive, 78, 'Damage Pressure: strong attacking stats, setup value, or offensive role evidence.'],
    defensive: [bulky, 74, 'Defensive Switch-in: bulk, recovery, typing, or pivot traits can create safer switches.'],
    speed: [speed, 76, 'Speed Control: has practical speed tools rather than only abstract utility.'],
    disruption: [has('fake out','taunt','encore','will-o-wisp','snarl','parting shot','spore','thunder wave'), 70, 'Fake Out / Disruption: can interrupt opponents or create safer turns.'],
    redirection: [has('follow me','rage powder','protect','wide guard','quick guard','aurora veil','reflect','light screen'), 68, 'Redirection / Protection: offers tools that can protect partners or reduce incoming pressure.'],
    weather: [has('drizzle','drought','snow warning','sand stream','rain dance','sunny day','snowscape','sandstorm','aurora veil'), 75, 'Weather Support: can enable or benefit a weather-based structure.'],
    screens: [has('aurora veil','reflect','light screen'), 78, 'Screens / Aurora Veil: can improve team safety and setup windows.'],
    setup: [facts.setupMoves.length || text.includes('setup'), 70, 'Setup Support: can threaten setup or help create setup turns.'],
    pivot: [has('u-turn','volt switch','parting shot','pivot') || bulky || has('fake out'), 62, 'Pivot / Positioning: can help the team take better board positions.'],
    cleaner: [(facts.isFast && offensive) || /cleaner|late-game|endgame|priority/.test(text), 72, 'Late-game Cleaner: can pressure weakened teams or finish games.'],
    weakness: [fits.includes('Weakness Answer') || bulky || support, 58, 'Weakness Answer: can be checked against exposed matchups through typing, pressure, or support.'],
    secondary: [(role.secondaryRoles || []).length || role.key === 'weather' || role.key === 'setup', 58, 'Secondary Mode: has practical secondary role evidence without auto-building around it.'],
    glue: [support || bulky || speed || has('fake out','snarl','taunt','parting shot','protect'), 66, 'Utility Glue: compresses useful support, safety, or positioning tools.']
  };
  const [ok, score, reason] = map[need] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 72 };
}

// TODO: Replace with shared coaching profile
function scoreGuideStepMatch(step, pokemon, role, facts, fits, text) {
  const offensive = role.key === 'attacker' || role.key === 'setup' || facts.atk >= 105 || facts.spa >= 105;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control');
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const cases = {
    step2: [(offensive || role.key === 'weather' || role.key === 'setup'), 65, 'Fits Step 2: gives the player a clear idea or direction to build around.'],
    step3: [(offensive || support || fits.includes('Partner')), 75, 'Fits Step 3: can form or support the first core.'],
    step4: [(support || speed || bulky || offensive), 70, 'Fits Step 4: adds complementary offense, defense, support, or speed control.'],
    step5: [(bulky || support || speed || fits.includes('Weakness Answer')), 76, 'Fits Step 5: helps patch matchups, add breadth, or answer weaknesses.'],
    step6: [(facts.supportMoves.length || facts.setupMoves.length || facts.weatherMoves.length || /item|ability|tech|coverage/.test(text)), 62, 'Fits Step 6: has meaningful item, move, ability, or tech decisions.'],
    step7: [true, 35, 'Fits Step 7: can be reviewed during playtesting for role overlap and matchup performance.']
  };
  const [ok, score, reason] = cases[step] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 70 };
}

// TODO: Replace with shared coaching profile
function scoreTeamFitMatch(fit, pokemon, state, role, facts, text) {
  const team = currentTeamPokemon(state);
  if (!team.length) return { score: 0, reason: '', primary: false };
  const coachingProfile = getMetadexTeamCoachingProfile(state);
  const concerns = Array.isArray(coachingProfile?.risks) ? coachingProfile.risks : [];
  const covers = concerns.some((risk) => {
    const typeName = risk?.type || risk?.attackingType || '';
    return typeName && (
      calculateDefensiveMultiplier(typeName, getPokemonTypesForAnswer(pokemon)) < 1
      || threatensTypeOffensively(pokemon, typeName, state)
      || hasTypeSpecificSupportIntoPressure(pokemon, typeName, state)
    );
  });
  const worsens = concerns.some((risk) => {
    const typeName = risk?.type || risk?.attackingType || '';
    return typeName && calculateDefensiveMultiplier(typeName, getPokemonTypesForAnswer(pokemon)) > 1;
  });
  const missingSupportText = JSON.stringify(coachingProfile?.recommendations || []).toLowerCase();
  const teamNeedsSpeed = /speed control|tailwind|icy wind|trick room|thunder wave|turn order/.test(missingSupportText) || coachingProfile?.speedProfile?.mode === 'none';
  const teamNeedsBackbone = /defensive|switch-in|pivot|pressure/.test(missingSupportText) || !coachingProfile?.defensiveProfile?.switchIns?.length;
  const teamNeedsUtility = /fake out|taunt|encore|snarl|parting shot|disruption|protect/.test(missingSupportText);
  const hasSpeed = roleHasPracticalRole(role, 'speed-control');
  const hasSupport = roleHasPracticalRole(role, 'support');
  const hasDamage = roleHasPracticalRole(role, 'attacker') || roleHasPracticalRole(role, 'setup') || facts.atk >= 105 || facts.spa >= 105;
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const map = {
    good: [covers || hasSpeed || hasSupport || hasDamage || bulky, 62, 'Fits current team: adds a role, matchup patch, or pressure line requested by the shared team profile.'],
    weakness: [covers, 78, 'Covers current weakness: helps into a risk identified by the shared team profile.'],
    role: [(teamNeedsSpeed && hasSpeed) || (teamNeedsBackbone && bulky) || (teamNeedsUtility && hasSupport) || hasDamage, 64, 'Adds missing role: matches a support or pressure need from the shared team profile.'],
    speed: [hasSpeed && teamNeedsSpeed, 72, 'Adds speed control: helps the current team manage move order.'],
    backbone: [bulky && teamNeedsBackbone, 70, 'Adds defensive backbone: gives the current team a steadier switch or board presence.'],
    pressure: [hasDamage, 70, 'Adds offensive pressure: can improve knockout threat or force respect.'],
    utility: [hasSupport && (teamNeedsUtility || teamNeedsBackbone), 68, 'Adds support utility: brings disruption, protection, or safe-turn tools.'],
    worsen: [worsens, 60, 'May worsen a current shared-profile risk: review this carefully before choosing it.']
  };
  const [ok, score, reason] = map[fit] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 70 };
}


// RAW CALCULATION / CANDIDATE COMPARISON: scores a candidate against the selected archetype filter.
// Kept local to MetaDex so the page can sort/filter candidates without requiring page-level coaching state.
function scoreArchetypeMatch(archetype, pokemon, role, facts, text) {
  const has = (...terms) => facts.hasMove(...terms) || terms.some((term) => text.includes(term));
  const offensive = roleHasPracticalRole(role, 'attacker') || roleHasPracticalRole(role, 'setup') || facts.atk >= 105 || facts.spa >= 105;
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control') || has('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb');
  const weather = has('drizzle', 'drought', 'snow warning', 'sand stream', 'rain dance', 'sunny day', 'snowscape', 'sandstorm', 'aurora veil') || role.key === 'weather';
  const setup = facts.setupMoves.length || roleHasPracticalRole(role, 'setup') || has('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up');
  const pivot = has('u-turn', 'volt switch', 'parting shot', 'flip turn', 'baton pass') || support;

  const snow = has('snow warning', 'snowscape', 'aurora veil', 'blizzard') || /snow|hail|aurora veil/.test(text);
  const rain = has('drizzle', 'rain dance', 'swift swim', 'water spout', 'thunder') || /rain|swift swim/.test(text);
  const sun = has('drought', 'sunny day', 'chlorophyll', 'solar power', 'solar beam') || /sun|drought|chlorophyll|solar power/.test(text);
  const sand = has('sand stream', 'sandstorm', 'sand rush', 'sand force') || /sand|sand rush|sand force/.test(text);

  const cases = {
    balanced: [(offensive && (support || bulky || speed)) || (bulky && support), 70, 'Balanced Offense: contributes pressure while still adding support, speed, or defensive value.'],
    hyper: [offensive && (facts.isFast || setup || speed), 76, 'Hyper Offense: gives fast pressure, setup pressure, or speed support for aggressive teams.'],
    bulkyoffense: [offensive && bulky, 76, 'Bulky Offense: combines damage threat with enough bulk to trade hits.'],
    balance: [bulky || support || pivot || speed, 68, 'Balance: adds stable utility, positioning, speed control, or defensive value.'],
    trickroom: [has('trick room') || (!facts.isFast && (offensive || bulky || support)), 72, 'Trick Room: can set Trick Room or make better use of slower board states.'],
    tailwind: [has('tailwind') || (speed && offensive) || (facts.isFast && offensive), 72, 'Tailwind Offense: benefits from or enables faster offensive turns.'],
    weather: [weather, 74, 'Weather: can set, abuse, or support a weather-based plan.'],
    setup: [setup || (offensive && support), 72, 'Setup Offense: can threaten setup or help create safer setup turns.'],
    snow: [snow, 76, 'Snow: supports Snow, Aurora Veil, Blizzard pressure, or Ice-based weather plans.'],
    rain: [rain, 76, 'Rain: supports rain setting, rain abuse, or rain-enhanced pressure.'],
    sun: [sun, 76, 'Sun: supports sun setting, sun abuse, or sun-enhanced pressure.'],
    sand: [sand, 76, 'Sand: supports sand setting, sand abuse, or sand-based pressure.'],
    momentum: [pivot || speed || has('fake out', 'taunt', 'encore', 'snarl', 'parting shot'), 70, 'Momentum Balance: helps reposition, disrupt, or create safer turns.']
  };

  const [ok, score, reason] = cases[archetype] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 72 };
}

function renderAnswerCategoryBadges(answer = {}) {
  const labels = (answer.categories || []).slice(0, 3);
  if (!labels.length) return '';
  return `<span class="metadex-answer-tags">${labels.map((label) => `<span class="score-pill">${escapeText(label)}</span>`).join('')}</span>`;
}

// TODO: Replace with shared coaching profile
function weaknessAnswerFitPanel(pokemon, state = {}) {
  const answerType = normaliseAnswerType(state?.metadex?.answerType || state?.metadex?.weaknessAnswerType || '');
  if (!answerType) return '';
  const answer = evaluateWeaknessAnswerPokemon(pokemon, answerType, state);
  const categoryLines = answer.categories.length ? answer.categories : ['Soft answer'];
  return `<article class="mini-card metadex-info-card metadex-answer-fit-panel">
    <h3>Answer fit: ${escapeText(answerType)} pressure</h3>
    <p>${escapeText(answer.reason)}</p>
    <div class="team-guide-chip-row">${categoryLines.map((line) => `<span class="score-pill">${escapeText(line)}</span>`).join('')}</div>
    ${answer.warning ? `<p class="notice">${escapeText(answer.warning)}</p>` : ''}
    <p class="muted small-copy">This is a priority sort, not a hard filter. You can still choose Pokémon that fit your main plan better.</p>
  </article>`;
}

// RAW CALCULATION / CANDIDATE COMPARISON: scores a candidate against a requested profile risk/answer type.
// TODO: Replace with shared coaching profile
function evaluateWeaknessAnswerPokemon(pokemon = {}, attackingType = '', state = {}) {
  const typeName = normaliseAnswerType(attackingType);
  const types = getPokemonTypesForAnswer(pokemon);
  const multiplier = calculateDefensiveMultiplier(typeName, types);
  const immune = multiplier === 0;
  const resists = multiplier > 0 && multiplier < 1;
  const weak = multiplier > 1;
  const offensive = threatensTypeOffensively(pokemon, typeName, state);
  const support = hasTypeSpecificSupportIntoPressure(pokemon, typeName, state);
  const bulky = looksBulkyEnough(pokemon, state);
  const categories = [];
  let score = 0;

  if ((immune || resists) && bulky) { categories.push('Safe switch-in'); score += immune ? 90 : 75; }
  else if (immune || resists) { categories.push(immune ? 'Immune pivot' : 'Resist'); score += immune ? 65 : 55; }
  if (offensive) { categories.push('Offensive answer'); score += 35; }
  if (support && !weak) { categories.push('Support answer'); score += 24; }
  if (!categories.length && !weak && (offensive || support || (bulky && multiplier === 1))) { categories.push('Soft answer'); score += 8; }
  if (!categories.length) score = 0;
  if (weak) score -= 45;
  if (multiplier === 1 && !offensive && !support) score = 0;
  const warning = teamContextWarning(pokemon, typeName, state);
  if (warning && score > 0) score -= 12;

  return {
    score,
    categories,
    warning,
    reason: buildAnswerReason(pokemon, typeName, { immune, resists, weak, offensive, support, bulky, categories })
  };
}

function buildAnswerReason(pokemon, typeName, flags) {
  const name = getPokemonDisplayName(pokemon);
  if (flags.immune) return `${name} gives a ${typeName} immunity, making it a strong defensive answer if it still fits your game plan.`;
  if (flags.resists && flags.offensive) return `${name} resists ${typeName} and can also threaten ${typeName}-type Pokémon or common users of that pressure.`;
  if (flags.resists) return `${name} resists ${typeName}, so it can help create safer switching and positioning.`;
  if (flags.offensive && flags.support) return `${name} has relevant pressure and matchup-specific support into ${typeName}, but check whether it is a safe switch-in.`;
  if (flags.offensive) return `${name} is mainly an offensive answer into ${typeName}-type Pokémon rather than a safe switch-in.`;
  if (flags.support) return `${name} has support that specifically helps into ${typeName} pressure, but it may not be a safe switch-in.`;
  if (flags.weak) return `${name} may worsen ${typeName} pressure, so only choose it if it strongly supports the rest of the team plan.`;
  return `${name} is not a direct ${typeName} answer. It should only be considered if it fits your wider team plan.`;
}

function getPokemonTypesForAnswer(pokemon = {}) {
  return [pokemon.type_1, pokemon.type_2, pokemon.type1, pokemon.type2]
    .flatMap((value) => Array.isArray(value) ? value : String(value || '').split(/[\/,&|]+/))
    .map((value) => normaliseAnswerType(value))
    .filter(Boolean);
}

function normaliseAnswerType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  return ATTACKING_TYPES.find((type) => type.toLowerCase() === clean) || '';
}

function threatensTypeOffensively(pokemon = {}, targetType = '', state = {}) {
  const attackingTypes = offensiveAnswerTypesInto(targetType);
  if (getPokemonTypesForAnswer(pokemon).some((type) => attackingTypes.includes(type))) return true;
  const moves = legalMoves(pokemon, state).map((move) => String(move?.name || move?.move_id || move || '').toLowerCase());
  return moves.some((move) => attackingTypes.some((type) => moveSuggestsType(move, type)));
}

function offensiveAnswerTypesInto(defendingType = '') {
  return ATTACKING_TYPES.filter((attackType) => (TYPE_EFFECTIVENESS[attackType]?.[defendingType] || 1) > 1);
}

function moveSuggestsType(moveName = '', type = '') {
  const text = String(moveName || '').toLowerCase();
  const hints = {
    Steel: ['steel', 'iron', 'metal', 'bullet punch', 'flash cannon', 'heavy slam'],
    Poison: ['poison', 'sludge', 'gunk', 'toxic'],
    Fire: ['fire', 'flame', 'heat', 'burn', 'eruption', 'overheat'],
    Water: ['water', 'aqua', 'hydro', 'surf', 'scald'],
    Electric: ['thunder', 'volt', 'electric', 'zap'],
    Grass: ['grass', 'leaf', 'seed', 'giga drain', 'energy ball'],
    Ice: ['ice', 'blizzard', 'freeze', 'frost'],
    Ground: ['earth', 'ground', 'mud', 'stomping'],
    Fighting: ['fighting', 'punch', 'kick', 'close combat', 'aura sphere'],
    Flying: ['flying', 'air', 'aerial', 'hurricane', 'brave bird'],
    Psychic: ['psychic', 'psy', 'zen'],
    Bug: ['bug', 'x-scissor', 'lunge', 'u-turn'],
    Rock: ['rock', 'stone', 'power gem'],
    Ghost: ['ghost', 'shadow', 'phantom'],
    Dragon: ['dragon', 'draco'],
    Dark: ['dark', 'knock off', 'sucker punch', 'crunch'],
    Fairy: ['fairy', 'moon', 'dazzling', 'play rough'],
    Normal: ['normal', 'body slam', 'hyper voice', 'return']
  };
  return (hints[type] || [String(type).toLowerCase()]).some((hint) => text.includes(hint));
}

function hasSupportIntoPressure(pokemon = {}, state = {}) {
  return hasTypeSpecificSupportIntoPressure(pokemon, '', state);
}

function hasTypeSpecificSupportIntoPressure(pokemon = {}, targetType = '', state = {}) {
  const typeName = normaliseAnswerType(targetType);
  const movesText = legalMoves(pokemon, state).map((move) => move?.name || move?.move_id || move).join(' ').toLowerCase();
  const profileText = [
    pokemon.abilities,
    pokemon.ability,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.preferredBoardStates,
    pokemon.supportRequirements
  ].flatMap(flattenContent).join(' ').toLowerCase();
  const text = `${profileText} ${movesText}`;
  const has = (...terms) => terms.some((term) => text.includes(String(term).toLowerCase()));

  // Generic utility is not automatically an answer to a specific attacking type.
  // It only counts here when it is paired with support that actually changes that matchup.
  if (!typeName) {
    return /fake out|follow me|rage powder|redirection|tailwind|trick room|icy wind|thunder wave|snarl|intimidate|parting shot|taunt|encore|aurora veil|reflect|light screen|wide guard|quick guard/.test(text);
  }

  const directTypeSupport = {
    Water: ['water absorb', 'storm drain', 'dry skin', 'drought', 'sunny day', 'desolate land', 'wide guard'],
    Fire: ['flash fire', 'drizzle', 'rain dance', 'primordial sea', 'thick fat', 'wide guard'],
    Electric: ['lightning rod', 'motor drive', 'volt absorb', 'ground', 'wide guard'],
    Grass: ['sap sipper', 'overcoat', 'safety goggles', 'weather support', 'wide guard'],
    Ice: ['thick fat', 'snow warning', 'aurora veil', 'wide guard'],
    Ground: ['levitate', 'flying', 'air balloon', 'grassy terrain', 'wide guard'],
    Dragon: ['fairy', 'misty terrain', 'aurora veil', 'reflect', 'light screen'],
    Fairy: ['steel', 'poison', 'flash fire', 'aurora veil', 'light screen'],
    Rock: ['wide guard', 'reflect', 'intimidate'],
    Fighting: ['ghost', 'fairy', 'psychic terrain', 'intimidate', 'will-o-wisp', 'reflect'],
    Psychic: ['dark', 'taunt', 'encore', 'light screen'],
    Ghost: ['normal', 'dark', 'scrappy', 'light screen'],
    Dark: ['fairy', 'fighting', 'intimidate', 'reflect'],
    Steel: ['fire', 'ground', 'fighting', 'will-o-wisp', 'reflect'],
    Poison: ['steel', 'ground', 'psychic terrain'],
    Flying: ['electric', 'rock', 'ice', 'tailwind', 'wide guard'],
    Bug: ['fire', 'flying', 'rock', 'intimidate', 'reflect'],
    Normal: ['ghost', 'intimidate', 'will-o-wisp', 'reflect']
  };
  if (has(...(directTypeSupport[typeName] || []))) return true;

  const enablesRealAnswer = /fake out|follow me|rage powder|redirection|aurora veil|reflect|light screen|wide guard|quick guard/.test(text);
  const hasRealPartnerLanguage = new RegExp(`${typeName.toLowerCase()}|weakness answer|safe switch|protect teammates|enable.*answer|matchup`).test(profileText);
  return enablesRealAnswer && hasRealPartnerLanguage;
}

function looksBulkyEnough(pokemon = {}, state = {}) {
  const stats = state?.data?.indexes?.statsByPokemon?.[pokemon.pokemon_id] || {};
  const hp = Number(stats.hp || 0), def = Number(stats.def || 0), spd = Number(stats.spd || 0);
  return (hp + Math.max(def, spd)) >= 170 || Math.min(def, spd) >= 85;
}

function teamContextWarning(pokemon = {}, answerType = '', state = {}) {
  const team = Array.isArray(state.team) ? state.team.filter((slot) => slot && slot.pokemon_id) : [];
  if (team.length < 2) return '';
  const profile = calculateWeaknessCoverageProfile(team, state.data || {});
  const concerns = profile.filter((entry) => entry.attackingType !== answerType && ['Exposed', 'Needs Attention'].includes(entry.classification));
  const types = getPokemonTypesForAnswer(pokemon);
  const worsened = concerns.find((entry) => calculateDefensiveMultiplier(entry.attackingType, types) > 1);
  if (!worsened) return '';
  return `This helps against ${answerType} but may worsen your ${worsened.attackingType} matchup.`;
}


function metadexGuidedBuilderActions(pokemon, state) {
  const displayName = getPokemonDisplayName(pokemon);
  return `<article class="mini-card metadex-info-card metadex-builder-actions-panel">
    <h3>Add ${escapeText(displayName)} to your team</h3>
    <p class="muted small-copy">Adds this Pokémon to the next empty Team Builder slot, then returns you to Team Builder. It will not auto-fill items, abilities, moves, nature, or stats.</p>
    <button type="button" class="coach-nav-button compact metadex-builder-action-primary" data-action="metadex-add-to-team" data-pokemon-id="${escapeAttr(pokemon.pokemon_id)}">Add to team</button>
  </article>`;
}


function quickBuildSummaryPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const fits = inferGuidedCoachFits(pokemon, identity, state);
  const itemGroups = suggestedItemGroups(pokemon, role);
  const ability = chooseBeginnerAbility(legalAbilities(pokemon, state), role);
  const moveGroups = suggestedMoveGroups(pokemon, state, role);
  const mainItem = itemGroups[0]?.values?.[0] || itemGroups[0]?.label || 'Choose by role';
  const moveFocus = moveGroups[0]?.label || (role.key === 'attacker' ? 'Reliable damage' : 'Role support');
  const coachStep = fits[0]?.tag || 'Flexible Pick';
  const chips = [
    ['Primary role', role.primaryRole || role.label],
    ['Secondary roles', (role.secondaryRoles || []).join(' / ') || 'None clear'],
    ['Flexible tech', (role.flexibleTech || []).slice(0, 3).join(', ') || 'None highlighted'],
    ['Best guide step', coachStep],
    ['Main item category', mainItem],
    ['Preferred ability', ability || 'Choose by matchup'],
    ['Main move focus', moveFocus],
    ['Role confidence', roleConfidenceLabel(role, pokemon, state)]
  ];

  return `<article class="mini-card metadex-info-card metadex-quick-build-summary">
    <h3>Quick Build Summary</h3>
    <div class="metadex-summary-chip-grid">
      ${chips.map(([label, value]) => `<div class="metadex-summary-chip"><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`).join('')}
    </div>
    ${role.notRecommendedRoles?.length ? `<p class="muted small-copy"><strong>Not recommended as:</strong> ${escapeText(role.notRecommendedRoles.join(', '))}</p>` : ''}
    ${role.roleReason ? `<p class="muted small-copy">Role reason: ${escapeText(role.roleReason)}</p>` : ''}
    ${SHOW_METADEX_ROLE_DEBUG && role.reason && role.reason !== role.roleReason ? `<p class="muted small-copy">Debug role reason: ${escapeText(role.reason)}</p>` : ''}
    ${speedControlEducationLink(pokemon, role, state)}
  </article>`;
}

function speedControlEducationLink(pokemon = {}, role = {}, state = {}) {
  const moves = legalMoves(pokemon, state).map((move) => normalize(move?.name || move?.move_id || move || ''));
  const speedControlMoves = ['tailwind', 'icy wind', 'electroweb', 'trick room', 'fake out', 'thunder wave', 'nuzzle', 'scary face', 'quash', 'after you', 'aqua jet', 'sucker punch', 'extreme speed', 'quick attack', 'bullet punch', 'mach punch', 'shadow sneak', 'vacuum wave', 'grassy glide'];
  const hasSpeedTool = moves.some((move) => speedControlMoves.some((term) => move.includes(term))) || roleHasPracticalRole(role, 'speed-control') || (role.flexibleTech || []).some((tech) => /speed|tailwind|trick room|priority|fake out|paralysis/i.test(String(tech)));
  if (!hasSpeedTool) return '';
  return `<p class="muted small-copy metadex-education-link"><a class="team-guide-inline-link" href="/learning-hub?article=speed-control" data-route="learning-hub" data-learning-article="speed-control">New to Speed Control? Read the guide.</a></p>`;
}

function roleConfidenceLabel(role, pokemon, state) {
  if (role?.roleConfidence) return role.roleConfidence;
  const facts = pokemonFactProfile(pokemon, state);
  if (role?.key && role.key !== 'flex') return 'High';
  if (facts.supportMoves.length || facts.speedMoves.length || facts.setupMoves.length || facts.atk >= 100 || facts.spa >= 100) return 'Medium';
  return 'Low / flexible';
}

function roleHasPracticalRole(role = {}, key = '') {
  if (role.key === key) return true;
  const labels = [role.secondaryRole, ...(role.secondaryRoles || [])].join(' ').toLowerCase();
  if (key === 'speed-control') return /speed control|tailwind|trick room/.test(labels);
  if (key === 'support') return /support|redirection|fake out|pivot|weather|field/.test(labels);
  if (key === 'setup') return /setup/.test(labels);
  if (key === 'bulky') return /defensive|pivot|bulky/.test(labels);
  if (key === 'attacker') return /attacker|damage|cleaner|breaker/.test(labels);
  return false;
}

// UI RENDERER: candidate-specific explanation of what the Pokémon offers.
function teamValuePanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Damage pressure that can force opponents to respect attacks or setup turns.');
  if (role.key === 'bulky') lines.push('A steadier defensive switch-in or longer-field presence.');
  if (facts.speedMoves.length) lines.push(`Speed control through ${facts.speedMoves.slice(0, 2).join(' or ')}.`);
  if (facts.supportMoves.length) lines.push(`Disruption or support such as ${facts.supportMoves.slice(0, 3).join(', ')}.`);
  if (facts.protectionMoves.length) lines.push(`Safer positioning with ${facts.protectionMoves[0]}.`);
  if (facts.setupMoves.length) lines.push(`A setup threat with ${facts.setupMoves.slice(0, 2).join(' or ')}.`);
  if (facts.recoveryMoves.length) lines.push(`Recovery or staying power from ${facts.recoveryMoves.slice(0, 2).join(' or ')}.`);
  if (role.key === 'weather') lines.push('Weather structure that can enable specific teammates or matchup plans.');
  if (!lines.length) lines.push('A specific typing, role, or legal move pool that may fill a team gap.');
  return `<article class="mini-card metadex-info-card"><h3>What this Pokémon gives your team</h3>${buildGuideListBlock('Team value', dedupeLines(lines).slice(0, 6))}</article>`;
}

// SHARED PROFILE DISPLAY: candidate-specific needs panel may reference cached profile.risks/teamFunctions.
function teamNeedsPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const coachingProfile = getMetadexTeamCoachingProfile(state);
  const weaknesses = pokemonTypeWeaknesses(pokemon).slice(0, 4);
  const lines = [];
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Safe turns from Fake Out, redirection, screens, speed control, or strong positioning.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Damage partners that can convert its support turns into real pressure.');
  if (role.key === 'weather') lines.push('Teammates that benefit from the same weather rather than fighting against it.');
  if (facts.isSlow && role.key !== 'bulky') lines.push('Help moving safely before it takes bad trades.');
  if (weaknesses.length) lines.push(`Protection from ${weaknesses.join(', ')} pressure.`);
  const missingFunctions = Object.entries(coachingProfile.teamFunctions || {}).filter(([, entries]) => !entries?.length).map(([key]) => key);
  if (coachingProfile.risks?.[0]) lines.push(`Current team profile is most concerned about ${coachingProfile.risks[0].type} pressure.`);
  if (missingFunctions.includes('speedControl')) lines.push('Your current team profile has no selected speed control yet, so value Pokémon that can add it.');
  if (!facts.protectionMoves.length) lines.push('Careful positioning, because the legal data does not show an obvious Protect-style option.');
  if (!lines.length) lines.push('Partners that cover its typing weaknesses and avoid duplicating the same job too often.');
  return `<article class="mini-card metadex-info-card"><h3>What this Pokémon needs from teammates</h3>${buildGuideListBlock('Support needs', dedupeLines(lines).slice(0, 6))}</article>`;
}


function guidedCoachFitPanel(pokemon, identity, state) {
  const fits = inferGuidedCoachFits(pokemon, identity, state);
  const safeFits = fits.length ? fits : [{
    tag: 'Flexible Pick',
    explanation: 'Can be considered when its typing, moves, or role fills a gap your current team still has.'
  }];

  return `<article class="mini-card metadex-info-card metadex-guided-coach-fit-panel">
    <h3>Team Building Guide Fit</h3>
    <p class="muted small-copy">Use these tags to decide whether this Pokémon fits your current team-building step and why.</p>
    <div class="metadex-coach-fit-list">
      ${safeFits.slice(0, 5).map((fit) => `<div class="metadex-coach-fit-row"><span class="score-pill metadex-coach-fit-tag">${escapeText(fit.tag)}</span><p>${escapeText(fit.explanation)}</p></div>`).join('')}
    </div>
  </article>`;
}

// TODO: Replace with shared coaching profile
function inferGuidedCoachFits(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const moves = legalMoves(pokemon, state).map(normalize);
  const abilities = legalAbilities(pokemon, state).map(normalize);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const strategicText = flattenContent([
    pokemon.role,
    pokemon.roles,
    pokemon.commonBuilds,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.damageProfile,
    identity.identity,
    identity.primaryPressure
  ]).join(' ').toLowerCase();

  const hasMove = (...terms) => moves.some((move) => terms.some((term) => move.includes(term)));
  const hasAbility = (...terms) => abilities.some((ability) => terms.some((term) => ability.includes(term)));
  const mentions = (...terms) => terms.some((term) => strategicText.includes(term));
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const bulk = (Number(stats.hp) || 0) + (Number(stats.def) || 0) + (Number(stats.spd) || 0);

  const strongDamage = atk >= 105 || spa >= 105 || mentions('damage', 'attacker', 'setup attacker', 'cleaner', 'offensive pressure', 'burst');
  const supportMoves = hasMove('fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'reflect', 'light screen', 'aurora veil', 'will-o-wisp', 'snarl', 'parting shot');
  const speedControl = hasMove('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face') || mentions('speed control', 'tailwind', 'trick room');
  const setup = hasMove('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up') || mentions('setup', 'boost');
  const weather = hasAbility('drizzle', 'drought', 'snow warning', 'sand stream') || hasMove('rain dance', 'sunny day', 'snowscape', 'sandstorm') || mentions('weather', 'rain', 'sun', 'snow', 'sand');
  const defensiveFit = bulk >= 265 || hasMove('recover', 'roost', 'wish', 'moonlight', 'slack off') || mentions('bulky', 'defensive', 'pivot', 'survive', 'sustain');
  const fastPressure = spe >= 95 && strongDamage;

  const fits = [];
  const addFit = (tag, explanation) => {
    if (!fits.some((fit) => fit.tag === tag)) fits.push({ tag, explanation });
  };

  if (strongDamage || setup || fastPressure) {
    addFit('Main Pokémon', setup
      ? 'Can be built around as a win condition if the team can create safe setup turns.'
      : 'Can be chosen early when you want your team to focus on its damage or cleanup pressure.');
  }

  if (supportMoves || speedControl || weather || defensiveFit || mentions('partner', 'synergy', 'support requirements')) {
    addFit('Partner', 'Can support a main Pokémon by covering weaknesses, creating safer turns, or adding useful team tools.');
  }

  if (supportMoves || role.key === 'support' || role.key === 'bulky' || defensiveFit) {
    addFit('Support', supportMoves
      ? 'Can help the team with utility moves, disruption, screens, redirection, or safer positioning.'
      : 'Can help the team by staying on the field longer and giving frailer teammates safer turns.');
  }

  if (strongDamage || role.key === 'attacker' || role.key === 'setup') {
    addFit('Damage Pressure', 'Can threaten knockouts or force the opponent to respect its attacks.');
  }

  if (defensiveFit) {
    addFit('Defensive Switch-in', 'Can give the team a safer pivot or bulkier board presence when its typing fits the matchup.');
  }

  if (pokemonTypeWeaknesses(pokemon).length) {
    addFit('Weakness Answer', 'Can be checked as a possible answer when its typing, pressure, or support tools help patch a specific matchup.');
  }

  if (speedControl || supportMoves || weather) {
    addFit('Utility / Speed Control', speedControl
      ? 'Can help control move order with speed control such as Tailwind, Icy Wind, Trick Room, or paralysis.'
      : 'Can offer useful battle control through support, disruption, weather, or protection tools.');
  }

  if (!fits.length || role.key === 'flex' || (fits.length < 2 && defensiveFit)) {
    addFit('Flexible Pick', 'Can be used when you need a specific typing, safer switch, or missing utility piece rather than pure damage.');
  }

  return fits;
}

function buildGuideBlock(title, content) {
  return `<div class="metadex-build-guide-block"><h4>${escapeText(title)}</h4>${content}</div>`;
}

function buildGuideListBlock(title, lines) {
  const safeLines = dedupeLines(lines.filter(Boolean)).slice(0, 4);
  const fallback = 'Use this Pokémon when its role, typing, or moves help cover a gap on your team.';
  return buildGuideBlock(title, `<ul>${(safeLines.length ? safeLines : [fallback]).map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>`);
}

// TODO: Replace with shared coaching profile
function inferBeginnerRole(pokemon, identity, state) {
  const cache = metadexCache(state).roles;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const moves = legalMoves(pokemon, state).map(normalize);
  const abilities = legalAbilities(pokemon, state).map(normalize);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const text = flattenContent([
    pokemon.role,
    pokemon.roles,
    pokemon.commonBuilds,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.damageProfile,
    pokemon.preferredBoardStates,
    pokemon.advancedResourceEconomy,
    identity.identity,
    identity.primaryPressure
  ]).join(' ').toLowerCase();

  const hasMove = (...terms) => moves.some((move) => terms.some((term) => move.includes(term)));
  const hasAbility = (...terms) => abilities.some((ability) => terms.some((term) => ability.includes(term)));
  const mentions = (...terms) => terms.some((term) => text.includes(term));
  const addUnique = (list, value) => { if (value && !list.includes(value)) list.push(value); };

  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const hp = Number(stats.hp) || 0;
  const def = Number(stats.def) || 0;
  const spd = Number(stats.spd) || 0;
  const bestOffense = Math.max(atk, spa);
  const bestBulk = Math.max(def, spd);
  const bulkScore = hp + def + spd;
  const isMega = String(pokemon.is_mega || '').toLowerCase() === 'yes';

  const highPhysicalAttack = atk >= 100 && atk >= spa - 10;
  const highSpecialAttack = spa >= 100 && spa >= atk - 10;
  const veryHighOffense = bestOffense >= 120;
  const extremeOffense = bestOffense >= 140;
  const fast = spe >= 90;
  const veryFast = spe >= 110;
  const slow = spe > 0 && spe <= 60;
  const verySlow = spe > 0 && spe <= 45;
  const highBulk = bulkScore >= 260 || (hp >= 85 && bestBulk >= 95) || (hp >= 70 && def >= 100 && spd >= 100);
  const veryBulky = bulkScore >= 300 || (hp >= 90 && def >= 110 && spd >= 110);
  const bulkyOffense = bestOffense >= 100 && highBulk;
  const megaOffense = isMega && bestOffense >= 110;

  const setupMoves = ['swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up', 'shell smash', 'quiver dance', 'coil', 'shift gear', 'agility'];
  const speedMoves = ['tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face', 'nuzzle'];
  const supportMoves = ['fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'reflect', 'light screen', 'aurora veil', 'spore', 'sleep powder', 'recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'];
  const disruptionMoves = ['fake out', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'spore', 'sleep powder', 'nuzzle', 'thunder wave'];
  const recoveryMoves = ['recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'];

  const hasSetupMove = hasMove(...setupMoves);
  const hasSpeedControlMove = hasMove(...speedMoves);
  const hasSupportMove = hasMove(...supportMoves);
  const hasDisruptionMove = hasMove(...disruptionMoves);
  const hasRecoveryMove = hasMove(...recoveryMoves);
  const hasRedirection = hasMove('follow me', 'rage powder') || mentions('redirection', 'redirect');
  const hasPriorityOrTempo = hasMove('fake out', 'sucker punch', 'extreme speed', 'bullet punch', 'aqua jet', 'ice shard', 'mach punch', 'shadow sneak') || mentions('fake out', 'priority', 'lead pressure', 'tempo');

  const damagePattern = new RegExp(['cleaner', 'sweep' + 'er', 'setup finisher', 'attacker', 'damage', 'pressure', 'offense', 'offensive', 'wa' + 'llbreaker', 'breaker', 'revenge', 'priority cleanup', 'ko pressure', 'late-game', 'endgame', 'cleanup', 'sweep'].join('|'));
  const hasDamageLanguage = damagePattern.test(text);
  const hasCleanerLanguage = /cleaner|cleanup|revenge|priority cleanup|late-game|endgame|fast pressure/.test(text);
  const supportLanguage = /support|utility|disrupt|redirection|redirect|screen support|aurora veil support|pivot|friend guard|prankster|fake out support/.test(text);
  const speedControlLanguage = /speed control|tailwind support|tailwind setter|trick room support|trick room setter|speed enabler|icy wind support/.test(text);
  const setupLanguage = new RegExp(['setup', 'boost', 'win condition', 'sweep' + 'er', 'dragon dance', 'swords dance', 'nasty plot', 'calm mind'].join('|')).test(text);

  const weatherAbility = hasAbility('drizzle', 'drought', 'snow warning', 'sand stream', 'sand spit');
  const terrainAbility = hasAbility('electric surge', 'grassy surge', 'misty surge', 'psychic surge');
  const manualWeather = hasMove('rain dance', 'sunny day', 'snowscape', 'sandstorm') || mentions('manual weather');
  const weatherText = mentions('weather', 'rain', 'sun', 'snow', 'sand', 'aurora veil');
  const screenWeather = hasMove('aurora veil') || mentions('aurora veil', 'screen support');

  const offensiveAbility = hasAbility('huge power', 'pure power', 'adaptability', 'technician', 'sheer force', 'tough claws', 'guts', 'moxie', 'solar power', 'speed boost', 'beast boost', 'parental bond');
  const supportAbility = hasAbility('prankster', 'friend guard', 'intimidate', 'regenerator', 'natural cure', 'sturdy', 'multiscale', 'overcoat', 'magic bounce');
  const defensiveAbility = hasAbility('intimidate', 'regenerator', 'multiscale', 'filter', 'solid rock', 'magic guard', 'unaware', 'fur coat', 'friend guard');

  const offensiveGate = bestOffense >= 100 || offensiveAbility || megaOffense || hasDamageLanguage;
  const setupGate = hasSetupMove && offensiveGate && (fast || highBulk || hasPriorityOrTempo || setupLanguage || hasAbility('speed boost')) && !(bestOffense < 90 && !setupLanguage);
  const tailwindGate = hasMove('tailwind') && (veryFast || highBulk || supportAbility || supportLanguage || speedControlLanguage) && !(veryHighOffense && !supportLanguage && !speedControlLanguage);
  const trickRoomGate = hasMove('trick room') && (slow || highBulk || supportAbility || supportLanguage || speedControlLanguage) && !(fast && !veryBulky && !supportAbility);
  const icyWindGate = hasMove('icy wind', 'electroweb', 'scary face', 'thunder wave', 'nuzzle') && (fast || highBulk || supportAbility || supportLanguage || speedControlLanguage || !offensiveGate) && !(veryHighOffense && !supportLanguage && !speedControlLanguage);
  const speedControlGate = tailwindGate || trickRoomGate || icyWindGate;
  const supportToolCount = [
    hasMove('fake out'), hasRedirection, hasMove('helping hand'), hasMove('wide guard', 'quick guard'), hasMove('reflect', 'light screen', 'aurora veil'),
    hasDisruptionMove, hasRecoveryMove, hasSpeedControlMove, weatherAbility || terrainAbility || screenWeather, supportAbility
  ].filter(Boolean).length;
  const supportGate = supportToolCount >= 2 || hasRedirection || (supportToolCount >= 1 && (supportAbility || highBulk || supportLanguage || bestOffense < 90)) || (screenWeather && (weatherAbility || highBulk || supportLanguage));
  const weatherGate = weatherAbility || terrainAbility || screenWeather || (manualWeather && (supportGate || weatherText));
  const defensiveGate = (highBulk || defensiveAbility || hasRecoveryMove || mentions('defensive', 'pivot', 'switch-in', 'resistances')) && !(bestOffense >= 120 && !defensiveAbility && !hasRecoveryMove && !mentions('bulky', 'pivot'));
  const disruptionGate = hasDisruptionMove && (fast || highBulk || supportAbility || supportLanguage) && !(veryHighOffense && !supportLanguage && !hasMove('fake out'));

  const ignored = [];
  if (hasMove('tailwind') && !tailwindGate) ignored.push('Tailwind was ignored because move access alone is not enough without speed, bulk, support traits, or curated support use.');
  if (hasMove('trick room') && !trickRoomGate) ignored.push('Trick Room was ignored because it lacks the low-Speed, bulk, ability, or support profile of a reliable setter.');
  if (hasMove('icy wind', 'electroweb', 'thunder wave', 'scary face', 'nuzzle') && !icyWindGate) ignored.push('Minor speed-control access was ignored because its practical profile points elsewhere.');
  if (hasMove('taunt') && !disruptionGate) ignored.push('Taunt was ignored as a role by itself because this Pokémon is not primarily a disruption user.');
  if (hasSetupMove && !setupGate) ignored.push('Setup was ignored because boosting moves need matching offense plus speed, bulk, priority, or support synergy.');

  const candidates = [];
  const addCandidate = (key, label, score, reason) => {
    if (score > 0) candidates.push({ key, label, score, reason });
  };

  if (weatherGate) {
    const weatherLabel = weatherAbility || terrainAbility || screenWeather ? 'Weather / field support' : 'Weather utility';
    addCandidate('weather', weatherLabel, (weatherAbility || terrainAbility ? 120 : 55) + (screenWeather ? 35 : 0) + (supportGate ? 20 : 0) + (offensiveGate ? 10 : 0), 'Weather or field-setting is backed by ability, Aurora Veil, support traits, or team-plan text.');
  }

  if (setupGate) {
    addCandidate('setup', 'Setup sweep' + 'er', 78 + Math.max(0, bestOffense - 95) + (fast ? 20 : 0) + (highBulk ? 12 : 0) + (hasPriorityOrTempo ? 10 : 0) + (isMega ? 12 : 0), `Setup is practical because it has boosting moves, ${bestOffense} offense, and enough speed, bulk, priority, or support synergy to use the boost.`);
  }

  if (offensiveGate) {
    let label = 'Attacker';
    if (highPhysicalAttack && highSpecialAttack) label = 'Mixed attacker';
    else if (highPhysicalAttack) label = hasPriorityOrTempo ? 'Offensive tempo attacker' : 'Physical ' + 'attacker';
    else if (highSpecialAttack) label = 'Special ' + 'attacker';
    else if (fast || hasCleanerLanguage) label = 'Fast attacker / cleaner';
    if (bulkyOffense && !fast) label = highPhysicalAttack ? 'Physical wa' + 'llbreaker / bulky ' + 'attacker' : highSpecialAttack ? 'Special bulky ' + 'attacker' : 'Bulky attacker';
    addCandidate('attacker', label, 70 + Math.max(0, bestOffense - 90) + (fast ? 12 : 0) + (offensiveAbility ? 25 : 0) + (isMega ? 22 : 0) + (hasDamageLanguage ? 16 : 0), `Offensive profile is backed by ${bestOffense} offense${isMega ? ', Mega/form stats' : ''}${offensiveAbility ? ', damage-boosting ability' : ''}, so isolated utility moves are not treated as its main role.`);
  }

  if (speedControlGate) {
    const label = trickRoomGate ? 'Trick Room support' : tailwindGate ? 'Tailwind support' : highBulk ? 'Bulky speed control support' : 'Speed control / support';
    addCandidate('speed-control', label, 58 + (speedControlLanguage ? 28 : 0) + (supportGate ? 18 : 0) + (highBulk ? 12 : 0) + (supportAbility ? 14 : 0) - (veryHighOffense && !supportLanguage ? 28 : 0), 'Speed control is backed by the right Speed/bulk/support profile, not move access alone.');
  }

  if (supportGate) {
    const label = hasRedirection ? 'Defensive support / redirection' : hasMove('fake out') && offensiveGate ? 'Fake Out support' : 'Defensive support / pivot';
    addCandidate('support', label, 54 + (supportToolCount * 10) + (supportLanguage ? 18 : 0) + (supportAbility ? 20 : 0) + (highBulk ? 12 : 0) - (extremeOffense && !supportLanguage && !hasRedirection ? 36 : 0), 'Support classification is backed by multiple support tools or a role-defining support tool plus suitable bulk, speed, ability, or low offense.');
  }

  if (defensiveGate) {
    addCandidate('bulky', 'Defensive support / pivot', 48 + (highBulk ? 25 : 0) + (veryBulky ? 15 : 0) + (defensiveAbility ? 18 : 0) + (hasRecoveryMove ? 14 : 0) - (veryHighOffense && !mentions('bulky', 'pivot') ? 22 : 0), 'Defensive pivot role is backed by bulk, recovery, defensive ability, or documented switch-in value.');
  }

  if (disruptionGate && !supportGate) {
    addCandidate('support', 'Disruption support', 50 + (fast ? 15 : 0) + (supportAbility ? 20 : 0) + (highBulk ? 10 : 0), 'Disruption is practical because its speed, bulk, or ability lets it use those tools reliably.');
  }

  candidates.sort((a, b) => b.score - a.score);
  const primary = candidates[0] || { key: 'flex', label: 'Flexible team member', score: 35, reason: 'No single offensive, support, speed-control, weather, or defensive identity clearly dominates.' };
  const secondaryCandidates = candidates
    .filter((candidate) => candidate.key !== primary.key && candidate.score >= 70 && candidate.score >= primary.score - 28)
    .slice(0, 2);
  const secondaryRoles = secondaryCandidates.map((candidate) => candidate.label);
  const secondaryRole = secondaryRoles[0] || '';
  const secondaryKeys = secondaryCandidates.map((candidate) => candidate.key);

  const possibleTechMoves = [
    ['tailwind', 'Tailwind'], ['trick room', 'Trick Room'], ['icy wind', 'Icy Wind'], ['electroweb', 'Electroweb'], ['thunder wave', 'Thunder Wave'], ['nuzzle', 'Nuzzle'],
    ['taunt', 'Taunt'], ['encore', 'Encore'], ['snarl', 'Snarl'], ['will-o-wisp', 'Will-O-Wisp'], ['reflect', 'Reflect'], ['light screen', 'Light Screen'],
    ['aurora veil', 'Aurora Veil'], ['fake out', 'Fake Out'], ['wide guard', 'Wide Guard'], ['quick guard', 'Quick Guard']
  ];
  const flexibleTech = [];
  possibleTechMoves.forEach(([needle, label]) => {
    if (!hasMove(needle)) return;
    const isPrimaryEvidence = (primary.key === 'speed-control' && ['tailwind','trick room','icy wind','electroweb','thunder wave','nuzzle'].includes(needle))
      || (primary.key === 'support' && ['taunt','encore','snarl','will-o-wisp','reflect','light screen','aurora veil','fake out','wide guard','quick guard'].includes(needle))
      || (primary.key === 'weather' && needle === 'aurora veil');
    const isSecondaryEvidence = secondaryKeys.includes('speed-control') && ['tailwind','trick room','icy wind','electroweb','thunder wave','nuzzle'].includes(needle);
    if (!isPrimaryEvidence && !isSecondaryEvidence) addUnique(flexibleTech, label);
  });

  const notRecommendedRoles = [];
  if (hasSpeedControlMove && primary.key !== 'speed-control' && !secondaryKeys.includes('speed-control')) {
    notRecommendedRoles.push('Dedicated speed control support');
  }
  if (hasSupportMove && primary.key !== 'support' && !secondaryKeys.includes('support') && (veryHighOffense || supportToolCount <= 1)) {
    notRecommendedRoles.push('Dedicated support');
  }
  if ((hasSetupMove || setupLanguage) && primary.key !== 'setup' && !secondaryKeys.includes('setup') && !setupGate) {
    notRecommendedRoles.push('Primary setup win condition');
  }

  const otherPossibleRoles = candidates
    .filter((candidate) => candidate.key !== primary.key && !secondaryKeys.includes(candidate.key) && candidate.score >= 58)
    .map((candidate) => candidate.label)
    .slice(0, 3);
  const roleLabels = [primary.label, ...secondaryRoles];
  const secondarySentence = secondaryCandidates.length
    ? ` Strong secondary roles: ${secondaryCandidates.map((candidate) => `${candidate.label} because ${candidate.reason.toLowerCase()}`).join('; ')}.`
    : ' No strong secondary role is shown because no other role passed the practical evidence threshold.';
  const techSentence = flexibleTech.length ? ` Flexible tech: ${flexibleTech.slice(0, 4).join(', ')}.` : '';
  const ignoredSentence = ignored.length ? ` ${ignored.slice(0, 3).join(' ')}` : '';
  const reason = `Primary role is ${primary.label} because ${primary.reason.toLowerCase()} ${secondarySentence} ${techSentence}${ignoredSentence}`.replace(/\s+/g, ' ').trim();
  const roleConfidence = primary.key === 'flex' ? 'Low / flexible' : primary.score >= 95 ? 'High' : primary.score >= 70 ? 'Medium-high' : 'Medium';

  const inferredRole = {
    key: primary.key,
    label: roleLabels.join(' / '),
    primaryRole: primary.label,
    secondaryRole,
    secondaryRoles,
    flexibleTech,
    notRecommendedRoles,
    otherPossibleRoles,
    roleConfidence,
    roleReason: reason,
    score: primary.score,
    secondaryScore: secondaryCandidates[0]?.score || 0,
    reason
  };
  cache.set(key, inferredRole);
  return inferredRole;
}
function pokemonFactProfile(pokemon, state) {
  const cache = metadexCache(state).facts;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const moves = legalMoves(pokemon, state);
  const moveNames = moves.map((name) => ({ name, key: normalize(name) }));
  const hasMove = (...terms) => moveNames.some((move) => terms.some((term) => move.key.includes(term)));
  const pickMoves = (...terms) => moveNames
    .filter((move) => terms.some((term) => move.key.includes(term)))
    .map((move) => move.name);
  const abilities = legalAbilities(pokemon, state);
  const types = [pokemon.type1, pokemon.type2].map((type) => String(type || '').trim()).filter(Boolean);
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const bulkScore = (Number(stats.hp) || 0) + (Number(stats.def) || 0) + (Number(stats.spd) || 0);
  const facts = {
    stats,
    moves,
    abilities,
    types,
    atk,
    spa,
    spe,
    bulkScore,
    damageSide: atk >= spa + 15 ? 'physical' : spa >= atk + 15 ? 'special' : 'mixed',
    isFast: spe >= 95,
    isSlow: spe > 0 && spe <= 55,
    isBulky: bulkScore >= 260,
    hasMove,
    pickMoves,
    supportMoves: pickMoves('fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'reflect', 'light screen', 'aurora veil', 'will-o-wisp', 'snarl', 'parting shot'),
    speedMoves: pickMoves('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face'),
    recoveryMoves: pickMoves('recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'),
    setupMoves: pickMoves('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up'),
    protectionMoves: pickMoves('protect', 'detect', 'wide guard', 'quick guard'),
    weatherMoves: pickMoves('rain dance', 'sunny day', 'snowscape', 'sandstorm', 'aurora veil')
  };
  cache.set(key, facts);
  return facts;
}

function pokemonSpecificSummary(pokemon, state, identity) {
  const name = getPokemonDisplayName(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? `${facts.types.join('/')} typing` : 'its typing';
  const moveHints = [...facts.speedMoves, ...facts.supportMoves, ...facts.recoveryMoves, ...facts.setupMoves].slice(0, 3);
  const statHint = facts.atk || facts.spa
    ? facts.damageSide === 'physical'
      ? `Its Attack is stronger than its Special Attack, so physical builds usually make more sense.`
      : facts.damageSide === 'special'
        ? `Its Special Attack is stronger than its Attack, so special builds usually make more sense.`
        : `Its attacking stats are close enough that the chosen moves should decide the damage style.`
    : '';
  const roleHint = role.key === 'attacker' || role.key === 'setup'
    ? `${name} is best understood as ${articleFor(role.label)} ${role.label.toLowerCase()} with ${typeText}.`
    : `${name} is best understood as ${articleFor(role.label)} ${role.label.toLowerCase()} that uses ${typeText} and its move options to help the team.`;
  return [roleHint, moveHints.length ? `Relevant moves include ${moveHints.join(', ')}.` : statHint, !moveHints.length ? '' : statHint].filter(Boolean).join(' ');
}

function buildUsualPurposeText(pokemon, role, state) {
  const name = getPokemonDisplayName(pokemon);
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? `${facts.types.join('/')} typing` : 'its typing';
  const namedSupport = facts.supportMoves.slice(0, 3).join(', ');
  const namedSpeed = facts.speedMoves.slice(0, 2).join(', ');
  const namedRecovery = facts.recoveryMoves.slice(0, 2).join(', ');
  const namedSetup = facts.setupMoves.slice(0, 2).join(', ');

  if (role.key === 'attacker') {
    const side = facts.damageSide === 'mixed' ? 'the attacking stat that matches its chosen moves' : `${facts.damageSide} damage`;
    return `${name} is usually used to apply ${side}. Its ${typeText} and legal attacks decide which targets it should pressure.`;
  }
  if (role.key === 'setup') return `${name} can work as a setup attacker because it has ${namedSetup || 'boosting moves'}. It needs safe turns before it becomes a real damage threat.`;
  if (role.key === 'support') return `${name} is usually a support or disruption pick. ${namedSupport ? `Moves like ${namedSupport} show the kind of help it can provide.` : `Its value comes from helping teammates rather than only dealing damage.`}`;
  if (role.key === 'speed-control') return `${name} can help control turn order. ${namedSpeed ? `Its speed-control options include ${namedSpeed}.` : `Use it when your team needs help moving before the opponent.`}`;
  if (role.key === 'weather') return `${name} is usually picked for weather support or weather synergy. It works best when the rest of the team benefits from that weather plan.`;
  if (role.key === 'bulky') return `${name} is usually better as a bulky utility Pokémon than as a pure attacker. ${namedRecovery ? `Recovery such as ${namedRecovery} can help it stay useful for longer.` : `Its ${typeText} and bulk make it useful for safer switches and longer games.`}`;
  return `${name} is a flexible option with ${typeText}. Use it when its specific moves, ability, or typing solve a gap on your team.`;
}

function buildPickWhenLines(pokemon, role, state) {
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? facts.types.join(' / ') : 'this Pokémon';
  const lines = [];
  if (role.key === 'attacker') lines.push(`Your team needs more ${facts.damageSide === 'mixed' ? 'direct' : facts.damageSide} damage.`);
  if (role.key === 'setup') lines.push(`Your team can create safe turns for ${facts.setupMoves.slice(0, 2).join(' or ') || 'a setup move'}.`);
  if (role.key === 'support') lines.push(`Your team needs utility such as ${facts.supportMoves.slice(0, 3).join(', ') || 'disruption, protection, or partner support'}.`);
  if (role.key === 'speed-control') lines.push(`Your team wants speed control from ${facts.speedMoves.slice(0, 3).join(', ') || 'moves that change turn order'}.`);
  if (role.key === 'weather') lines.push('Your team is built to benefit from the same weather plan.');
  if (role.key === 'bulky') lines.push(`Your team needs a steadier ${typeText} switch-in or longer-lasting utility piece.`);
  if (facts.isFast && (role.key === 'attacker' || role.key === 'speed-control')) lines.push('You want something that can act before many slower threats.');
  if (facts.isBulky) lines.push('You want a Pokémon that can usually take more than one hit.');
  lines.push(typeWeaknessPartnerText(pokemon) || 'Its typing or moves cover a weakness your team currently has.');
  return lines;
}

function buildItemGuideLines(pokemon, role) {
  const items = itemCompatibility(pokemon).slice(0, 6);
  const fallbackItems = fallbackItemGroupsForRole(role).flatMap((group) => group.values).slice(0, 4);
  const itemText = items.length
    ? [`Documented item options include ${items.join(', ')}.`]
    : [`No curated item list is recorded yet. Safe starting points include ${fallbackItems.join(', ')}.`];
  const byRole = {
    attacker: ['Damage items fit best if this Pokémon is meant to attack often.', 'Focus Sash or safety items make sense if it is frail but important.'],
    setup: ['Defensive, recovery, or safety items help it survive long enough to set up.', 'Damage items are better only if teammates already create safe setup turns.'],
    support: ['Defensive and utility items help it survive long enough to support teammates.', 'Safety items are useful when one key support turn matters.'],
    'speed-control': ['Focus Sash is useful if setting speed control is its main job.', 'Defensive items are better if it needs to control speed more than once.'],
    weather: ['Weather-extending items help only if the whole team depends on weather.', 'Defensive items help it reset or protect the weather plan later.'],
    bulky: ['Recovery or defensive items match a slower, longer-field role.', 'Utility items work if its main job is supporting stronger teammates.'],
    flex: ['Pick a defensive, utility, or damage item based on the exact role you choose.', 'Avoid random damage items unless its stats and moves actually support attacking.']
  };
  return [...itemText, ...(byRole[role.key] || byRole.flex)];
}

function buildAbilityGuideLines(pokemon, state, role) {
  const abilities = legalAbilities(pokemon, state).slice(0, 4);
  const lines = abilities.length
    ? abilities.map((ability) => `${ability}: ${abilityReason(ability, role)}`)
    : ['Choose the ability that best supports the job you want this Pokémon to do.'];
  if (role.key === 'weather') lines.push('Weather abilities matter most when your teammates are also built around that weather.');
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Prefer abilities that increase damage, speed, or setup value if available.');
  if (role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') lines.push('Prefer abilities that help it survive, switch safely, or support teammates if available.');
  return lines;
}

function abilityReason(ability, role) {
  const lower = normalize(ability);
  if (/cloud nine/.test(lower)) return 'Useful when you want to weaken weather-based teams.';
  if (/natural cure/.test(lower)) return 'Helpful if this Pokémon switches in and out while absorbing status.';
  if (/intimidate/.test(lower)) return 'Useful support because it lowers physical damage from opposing attackers.';
  if (/regenerator/.test(lower)) return 'Helps it pivot and recover health when switching out.';
  if (/prankster/.test(lower)) return 'Makes status and support moves easier to use before the opponent acts.';
  if (/drizzle|drought|snow warning|sand stream/.test(lower)) return 'Sets weather, so choose it only when your team benefits from that weather.';
  if (/speed boost/.test(lower)) return 'Helps it become faster over time and pressure later turns.';
  if (/huge power|pure power|adaptability|technician|sheer force|tough claws|guts|moxie|solar power/.test(lower)) return 'Best for a damage-focused build.';
  if (/sturdy|multiscale|overcoat|friend guard|filter|solid rock/.test(lower)) return 'Useful for surviving important turns or protecting the team.';
  if (role.key === 'attacker' || role.key === 'setup') return 'Consider this if it helps the chosen damage or setup plan.';
  if (role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') return 'Consider this if it helps the Pokémon stay useful while supporting the team.';
  return 'Choose this if it activates often in the matchups you expect.';
}

function buildMoveGuideLines(pokemon, state, role) {
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];
  const damageMoves = prioritizeLegalMoves(facts.moves, pokemon).map((entry) => entry.name).filter((move) => ![...facts.protectionMoves, ...facts.speedMoves, ...facts.setupMoves, ...facts.recoveryMoves, ...facts.supportMoves].includes(move)).slice(0, 4);
  const isOffensive = role.key === 'attacker' || role.key === 'setup';

  if (isOffensive) {
    if (damageMoves.length) lines.push(`Prioritize strong attacks and coverage first, starting with ${damageMoves.join(', ')}.`);
    if (facts.setupMoves.length) lines.push(`Setup options such as ${facts.setupMoves.slice(0, 2).join(', ')} are best when partners can create safe turns.`);
    const tempoUtility = facts.supportMoves.filter((move) => /Fake Out|Sucker Punch|Extreme Speed|Bullet Punch|Aqua Jet|Ice Shard|Mach Punch|Shadow Sneak/i.test(move));
    if (tempoUtility.length) lines.push(`${tempoUtility.slice(0, 2).join(', ')} gives tempo pressure, but it is a tool for creating better attack turns rather than the whole role.`);
    if (facts.protectionMoves.length) lines.push(`${facts.protectionMoves[0]} helps preserve positioning while you look for safe damage turns.`);
    const optionalUtility = [...facts.speedMoves, ...facts.supportMoves.filter((move) => !tempoUtility.includes(move))].slice(0, 3);
    if (optionalUtility.length) lines.push(`Can optionally run ${optionalUtility.join(', ')} for speed control or utility if your team needs it.`);
    return dedupeLines(lines).slice(0, 5);
  }

  if (facts.protectionMoves.length) lines.push(`Use ${facts.protectionMoves[0]} to stay safe while a partner attacks, switches, or sets up.`);
  if (facts.speedMoves.length) lines.push(role.key === 'speed-control' ? `Speed control is one of its main jobs, usually with ${facts.speedMoves.slice(0, 3).join(', ')}.` : `Can optionally run ${facts.speedMoves.slice(0, 3).join(', ')} for speed control if your team needs it.`);
  if (facts.setupMoves.length) lines.push(`Setup options include ${facts.setupMoves.slice(0, 2).join(', ')}; only use them when partners can create safe turns.`);
  if (facts.recoveryMoves.length) lines.push(`Recovery such as ${facts.recoveryMoves.slice(0, 2).join(', ')} lets it stay on the field longer.`);
  if (facts.supportMoves.length) lines.push(`Support or disruption moves to check include ${facts.supportMoves.slice(0, 4).join(', ')}.`);
  if (damageMoves.length) lines.push(`For damage, start by checking ${damageMoves.join(', ')}.`);
  if (!lines.length) lines.push('Start with Protect if legal, then add attacks or utility moves that match the role you want.');
  return lines;
}

function buildPartnerGuideLines(pokemon, role) {
  const weakness = typeWeaknessPartnerText(pokemon);
  const lines = [weakness || 'Good partners are Pokémon that cover its biggest weaknesses.'];
  if (role.key === 'attacker') {
    lines.push('Pair it with Pokémon that help it keep attacking safely, such as speed control, redirection, screens, or Fake Out partners.');
    lines.push('Add answers to Intimidate, burns, and the types that threaten it so its damage pressure does not disappear.');
  }
  if (role.key === 'setup') lines.push('Partners that create free turns are important so it can boost safely.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Strong attackers are good partners because they benefit from its support turns.');
  if (role.key === 'weather') lines.push('Use teammates that gain damage, accuracy, speed, or bulk from the same weather.');
  if (role.key === 'bulky') lines.push('Pair it with attackers that enjoy safer switches and longer games.');
  lines.push('Avoid pairing it only with teammates that share the same weaknesses.');
  return lines;
}

// UI RENDERER: candidate-specific type partner hint, not team-wide risk interpretation.
function typeWeaknessPartnerText(pokemon) {
  const types = [pokemon.type1, pokemon.type2].map((type) => String(type || '').trim()).filter(Boolean);
  if (!types.length) return '';
  return `Good partners are Pokémon that cover problems for ${types.join(' / ')} typing.`;
}



// UI RENDERER: candidate-specific team fit wording, not shared team identity detection.
// TODO: Replace with shared coaching profile
function teamFitPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const goodPartners = buildPartnerGuideLines(pokemon, role).slice(0, 3);
  const wantsSupport = [];
  const helpsBy = [];

  if (role.key === 'attacker' || role.key === 'setup') {
    wantsSupport.push('Fake Out, redirection, screens, or speed control to create safer attacking turns.');
  }
  if (role.key === 'support' || role.key === 'speed-control') {
    wantsSupport.push('A clear damage partner that can convert the support turns into knockouts.');
  }
  if (role.key === 'weather') wantsSupport.push('Teammates that benefit from the same weather plan.');
  if (facts.isSlow && role.key !== 'bulky') wantsSupport.push('Positioning help so it is not forced to take bad trades before acting.');
  if (!wantsSupport.length) wantsSupport.push('Partners that cover its typing weaknesses and avoid overlapping the same role.');

  if (facts.speedMoves.length) helpsBy.push(`Controlling speed with ${facts.speedMoves.slice(0, 2).join(' or ')}.`);
  if (facts.supportMoves.length) helpsBy.push(`Creating better turns with ${facts.supportMoves.slice(0, 3).join(', ')}.`);
  if (role.key === 'attacker') helpsBy.push('Adding direct damage pressure so support teammates have something to enable.');
  if (role.key === 'bulky') helpsBy.push('Giving the team a steadier switch-in and longer-field presence.');
  if (!helpsBy.length) helpsBy.push('Filling a specific typing, role, or move gap in the team plan.');

  return `<article class="mini-card metadex-info-card metadex-team-fit-panel">
    <h3>Team Fit</h3>
    <div class="metadex-build-guide-grid">
      ${buildGuideListBlock('Good partners', goodPartners)}
      ${buildGuideListBlock('Wants support from', dedupeLines(wantsSupport).slice(0, 3))}
      ${buildGuideListBlock('Helps teammates by', dedupeLines(helpsBy).slice(0, 3))}
    </div>
  </article>`;
}

function referenceOptionsPanel(legalMoveRows, abilities) {
  const moveBlock = legalOptions('Legal moves', legalMoveRows, 10, '+{count} additional legal moves');
  const abilityBlock = legalOptions('Abilities', abilities, 8, '+{count} additional abilities');
  if (!moveBlock && !abilityBlock) return '';
  return `<article class="mini-card metadex-info-card metadex-reference-panel">
    <h3>Legal Moves and Abilities</h3>
    <p class="muted small-copy">Reference data for deeper manual building. Longer lists stay collapsed so the main guide remains readable.</p>
    <div class="metadex-reference-grid">${moveBlock}${abilityBlock}</div>
  </article>`;
}

function choiceGuidancePanel(pokemon, identity, state) {
  return `<article class="mini-card metadex-info-card metadex-choice-guidance-panel">
    <h3>Choice Guidance</h3>
    <div class="metadex-build-guide-grid metadex-choice-guidance-grid">
      ${buildGuideListBlock('Choose this Pokémon when…', chooseThisPokemonLines(pokemon, identity, state))}
      ${buildGuideListBlock('Be careful choosing this Pokémon when…', cautionChoosingPokemonLines(pokemon, identity, state))}
    </div>
  </article>`;
}

// UI RENDERER: candidate-specific selection guidance.
function chooseThisPokemonLines(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];

  if (role.key === 'attacker') lines.push(`Your team needs more ${facts.damageSide === 'mixed' ? 'direct damage pressure' : `${facts.damageSide} damage pressure`}.`);
  if (role.key === 'setup') lines.push(`Your team can create safe turns for ${facts.setupMoves.slice(0, 2).join(' or ') || 'setup'}.`);
  if (role.key === 'support') lines.push(`Your team needs support or disruption such as ${facts.supportMoves.slice(0, 3).join(', ') || 'utility moves'}.`);
  if (role.key === 'speed-control') lines.push(`Your team needs speed control from ${facts.speedMoves.slice(0, 3).join(', ') || 'moves that change turn order'}.`);
  if (role.key === 'weather') lines.push('Your team already wants to use the same weather plan.');
  if (role.key === 'bulky') lines.push('Your team needs a steadier switch-in or a Pokémon that can stay useful across several turns.');
  if (role.key === 'flex') lines.push('Its typing, ability, or move options fill a specific gap your current team still has.');

  if (facts.isFast && (role.key === 'attacker' || role.key === 'speed-control')) lines.push('You want a Pokémon that can act before many slower threats.');
  if (facts.recoveryMoves.length) lines.push(`You want a Pokémon that can stay on the field longer with ${facts.recoveryMoves[0]}.`);
  if (facts.protectionMoves.length) lines.push(`You want safer turns from ${facts.protectionMoves[0]} while its partner attacks or sets up.`);
  if (facts.types.length) lines.push(`Its ${facts.types.join(' / ')} typing helps your team cover an important matchup.`);

  return dedupeLines(lines).slice(0, 4);
}

// UI RENDERER: candidate-specific caution guidance.
function cautionChoosingPokemonLines(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const weaknesses = pokemonTypeWeaknesses(pokemon).slice(0, 4);
  const lines = [];
  const lowAtk = facts.atk > 0 && facts.atk < 80;
  const lowSpa = facts.spa > 0 && facts.spa < 80;
  const lowBothAttack = lowAtk && lowSpa;

  if ((role.key === 'support' || role.key === 'speed-control' || role.key === 'bulky') && lowBothAttack && !facts.setupMoves.length) {
    lines.push('Your team already lacks damage pressure, because this Pokémon is not naturally built to carry knockouts.');
  }
  if (role.key !== 'attacker' && role.key !== 'setup' && !facts.setupMoves.length) {
    lines.push('You need immediate knockout power from this slot.');
  }
  if (facts.isSlow && role.key !== 'bulky' && role.key !== 'weather') {
    lines.push('Your team cannot protect slower Pokémon or help them move safely.');
  }
  if (weaknesses.length) {
    lines.push(`Your team is already weak to common ${weaknesses.join(', ')} pressure.`);
  }
  if (role.key === 'setup') lines.push('You cannot create safe setup turns with Fake Out, redirection, screens, or speed control.');
  if (role.key === 'weather') lines.push('The rest of your team does not benefit from its weather plan.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Your team already has several support picks and still needs a clear attacker.');
  if (!facts.protectionMoves.length) lines.push('It lacks an obvious Protect-style option in the available move data, so positioning may be less forgiving.');

  return dedupeLines(lines).slice(0, 4);
}

function pokemonTypeWeaknesses(pokemon) {
  const types = getPokemonTypes(pokemon).map((type) => type.toLowerCase());
  if (!types.length) return [];
  const chart = {
    normal: ['Fighting'],
    fire: ['Water', 'Ground', 'Rock'],
    water: ['Electric', 'Grass'],
    electric: ['Ground'],
    grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
    ice: ['Fire', 'Fighting', 'Rock', 'Steel'],
    fighting: ['Flying', 'Psychic', 'Fairy'],
    poison: ['Ground', 'Psychic'],
    ground: ['Water', 'Grass', 'Ice'],
    flying: ['Electric', 'Ice', 'Rock'],
    psychic: ['Bug', 'Ghost', 'Dark'],
    bug: ['Fire', 'Flying', 'Rock'],
    rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
    ghost: ['Ghost', 'Dark'],
    dragon: ['Ice', 'Dragon', 'Fairy'],
    dark: ['Fighting', 'Bug', 'Fairy'],
    steel: ['Fire', 'Fighting', 'Ground'],
    fairy: ['Poison', 'Steel']
  };
  return dedupeLines(types.flatMap((type) => chart[type] || []));
}

function getPokemonTypes(pokemon) {
  const explicit = [pokemon.type1, pokemon.type2, pokemon.type_1, pokemon.type_2, pokemon.primaryType, pokemon.secondaryType]
    .map((type) => String(type || '').trim())
    .filter(Boolean);
  const fromTyping = String(pokemon.typing || '')
    .split(/[\/,&]+/)
    .map((type) => type.trim())
    .filter(Boolean);
  return [...explicit, ...fromTyping]
    .filter((type, index, list) => list.findIndex((entry) => entry.toLowerCase() === type.toLowerCase()) === index);
}

function articleFor(label) {
  return /^[aeiou]/i.test(String(label || '').trim()) ? 'an' : 'a';
}


function recommendedBuildOptionsPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const roles = suggestedRoleLabels(pokemon, identity, state);
  const itemGroups = suggestedItemGroups(pokemon, role);
  const abilityLines = suggestedAbilityLines(pokemon, state, role);
  const moveGroups = suggestedMoveGroups(pokemon, state, role);
  const beginnerBuild = beginnerRecommendedBuild(pokemon, identity, state, role, itemGroups, moveGroups);

  return `<article class="mini-card metadex-info-card metadex-recommended-build-options">
    <h3>Recommended Build Options</h3>
    <p class="muted small-copy">These are suggestions from this Pokémon’s existing legal moves, abilities, items, and role data. They are not applied automatically.</p>
    <div class="metadex-build-guide-grid">
      ${buildGuideListBlock('Other possible roles', roles)}
      ${buildGroupedOptionsBlock('Suggested Items', itemGroups, 'No clear item suggestions are documented yet. Choose an item that matches the role you want.')}
      ${buildGuideListBlock('Suggested Abilities', abilityLines)}
      ${buildGroupedOptionsBlock('Suggested Move Categories', moveGroups, 'Start with Protect if legal, reliable attacks, and one support or coverage move that matches the role.')}
      ${beginnerBuild ? buildBeginnerBuildBlock(beginnerBuild) : buildGuideBlock('Beginner Recommended Build', '<p class="muted">Not enough legal move, item, and ability data exists to suggest a safe full build yet.</p>')}
    </div>
  </article>`;
}

// TODO: Replace with shared coaching profile
function suggestedRoleLabels(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const labels = [role.primaryRole || role.label];
  if (role.secondaryRole) labels.push(role.secondaryRole);
  (role.otherPossibleRoles || []).forEach((label) => {
    if (labels.length < 5 && !labels.includes(label)) labels.push(label);
  });
  if (labels.length < 2 && role.key === 'flex') labels.push('Flexible Pick');
  return labels.slice(0, 5);
}
function suggestedItemGroups(pokemon, role) {
  const items = itemCompatibility(pokemon);
  const groups = [
    { label: 'Staying Power', terms: ['leftovers', 'sitrus', 'figy', 'wiki', 'mago', 'aguav', 'iapapa', 'black sludge', 'shell bell', 'assault vest'], values: [] },
    { label: 'Safety', terms: ['focus sash', 'covert cloak', 'safety goggles', 'clear amulet', 'mental herb', 'lum berry'], values: [] },
    { label: 'Damage', terms: ['life orb', 'choice specs', 'choice band', 'expert belt', 'muscle band', 'wise glasses', 'mystic water', 'charcoal', 'magnet', 'miracle seed', 'black glasses', 'dragon fang', 'spell tag', 'soft sand', 'hard stone', 'sharp beak', 'silk scarf'], values: [] },
    { label: 'Support', terms: ['light clay', 'mental herb', 'eviolite', 'terrain extender', 'icy rock', 'heat rock', 'damp rock', 'smooth rock'], values: [] },
    { label: 'Speed', terms: ['choice scarf', 'booster energy'], values: [] }
  ];

  for (const item of items) {
    const lower = normalize(item);
    const group = groups.find((entry) => entry.terms.some((term) => lower.includes(term)));
    if (group) group.values.push(item);
  }

  const active = groups.filter((group) => group.values.length).map((group) => ({ label: group.label, values: dedupeLines(group.values).slice(0, 5) }));
  if (!active.length && items.length) {
    active.push({ label: role.label, values: items.slice(0, 5) });
  }
  if (!active.length) {
    return fallbackItemGroupsForRole(role);
  }
  return active.slice(0, 5);
}

function fallbackItemGroupsForRole(role) {
  const key = role?.key || 'flex';
  const groupsByRole = {
    attacker: [
      { label: 'Damage', values: ['Life Orb', 'Choice item', 'type-boosting item'] },
      { label: 'Safety', values: ['Focus Sash'] }
    ],
    setup: [
      { label: 'Setup Safety', values: ['Clear Amulet', 'Lum Berry', 'Leftovers'] }
    ],
    support: [
      { label: 'Support Safety', values: ['Sitrus Berry', 'Covert Cloak', 'Mental Herb'] },
      { label: 'Staying Power', values: ['Leftovers'] }
    ],
    'speed-control': [
      { label: 'Speed Control Safety', values: ['Covert Cloak', 'Mental Herb', 'Focus Sash'] }
    ],
    weather: [
      { label: 'Support Safety', values: ['Covert Cloak', 'Mental Herb', 'Focus Sash'] },
      { label: 'Weather Support', values: ['weather-extending item if your whole team depends on weather'] }
    ],
    bulky: [
      { label: 'Bulky Support', values: ['Sitrus Berry', 'Leftovers', 'Covert Cloak', 'Mental Herb'] }
    ],
    flex: [
      { label: 'Flexible build', values: ['choose the item and moves based on the role you need'] }
    ]
  };
  return groupsByRole[key] || groupsByRole.flex;
}

function suggestedAbilityLines(pokemon, state, role) {
  const abilities = legalAbilities(pokemon, state).slice(0, 5);
  if (!abilities.length) return ['Choose the ability that best supports the role you want this Pokémon to fill.'];
  return abilities.map((ability) => `${ability}: ${abilityReason(ability, role)}`);
}

function suggestedMoveGroups(pokemon, state, role) {
  const moves = prioritizeLegalMoves(legalMoves(pokemon, state), pokemon).map((entry) => entry.name);
  const groups = [
    { label: 'Protection', terms: ['protect', 'detect', 'wide guard', 'quick guard'], values: [] },
    { label: 'Speed Control', terms: ['tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face'], values: [] },
    { label: 'Setup', terms: ['swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up', 'coil', 'quiver dance'], values: [] },
    { label: 'Reliable Damage', terms: [], values: [] },
    { label: 'Utility', terms: ['fake out', 'follow me', 'rage powder', 'helping hand', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'roost', 'recover', 'wish', 'leech seed', 'spore', 'sleep powder', 'reflect', 'light screen', 'aurora veil'], values: [] }
  ];

  const protection = groups[0];
  const speed = groups[1];
  const setup = groups[2];
  const damage = groups[3];
  const utility = groups[4];
  const types = [pokemon.type1, pokemon.type2].map(normalize).filter(Boolean);

  for (const move of moves) {
    const lower = normalize(move);
    if (protection.terms.some((term) => lower.includes(term))) protection.values.push(move);
    else if (speed.terms.some((term) => lower.includes(term))) speed.values.push(move);
    else if (setup.terms.some((term) => lower.includes(term))) setup.values.push(move);
    else if (utility.terms.some((term) => lower.includes(term))) utility.values.push(move);
    else if (moveRelevanceScore(move, types) >= 6) damage.values.push(move);
  }

  const active = groups
    .map((group) => ({ label: group.label, values: dedupeLines(group.values).slice(0, group.label === 'Reliable Damage' ? 6 : 4) }))
    .filter((group) => group.values.length);

  if (!active.length && moves.length) active.push({ label: role.label, values: moves.slice(0, 6) });
  return active.slice(0, 5);
}

function beginnerRecommendedBuild(pokemon, identity, state, role, itemGroups, moveGroups) {
  const items = itemGroups.flatMap((group) => group.values);
  const abilities = legalAbilities(pokemon, state);
  const selectedMoves = selectBeginnerMoves(pokemon, state, moveGroups, role);
  if (!abilities.length || selectedMoves.length < 4) return null;
  const safeItems = items.length ? items : fallbackItemGroupsForRole(role).flatMap((group) => group.values);
  return {
    role: role.label,
    item: safeItems[0] || 'Flexible build — choose the item and moves based on the role you need.',
    ability: chooseBeginnerAbility(abilities, role),
    nature: inferBeginnerNature(pokemon, state, role),
    moves: selectedMoves.slice(0, 4),
    explanation: beginnerBuildExplanation(pokemon, role)
  };
}

function selectBeginnerMoves(pokemon, state, moveGroups, role) {
  const allLegal = legalMoves(pokemon, state);
  const picked = [];
  const add = (move) => { if (move && allLegal.includes(move) && !picked.includes(move)) picked.push(move); };
  const group = (label) => moveGroups.find((entry) => entry.label === label)?.values || [];
  const isOffensive = role?.key === 'attacker' || role?.key === 'setup';

  if (isOffensive) {
    group('Reliable Damage').slice(0, 3).forEach(add);
    add(group('Setup')[0]);
    add(group('Protection')[0]);
    group('Utility').filter((move) => /Fake Out|Sucker Punch|Extreme Speed|Bullet Punch|Aqua Jet|Ice Shard|Mach Punch|Shadow Sneak/i.test(move)).slice(0, 1).forEach(add);
    for (const entry of prioritizeLegalMoves(allLegal, pokemon)) add(entry.name);
    group('Utility').slice(0, 2).forEach(add);
    group('Speed Control').slice(0, 1).forEach(add);
    return picked.slice(0, 4);
  }

  add(group('Protection')[0]);
  add(group('Speed Control')[0]);
  add(group('Setup')[0]);
  group('Utility').slice(0, 2).forEach(add);
  group('Reliable Damage').slice(0, 3).forEach(add);
  for (const entry of prioritizeLegalMoves(allLegal, pokemon)) add(entry.name);
  return picked.slice(0, 4);
}

function chooseBeginnerAbility(abilities, role) {
  const scored = abilities.map((ability) => {
    const lower = normalize(ability);
    let score = 0;
    if (role.key === 'weather' && /drizzle|drought|snow warning|sand stream/.test(lower)) score += 80;
    if ((role.key === 'attacker' || role.key === 'setup') && /adaptability|huge power|pure power|technician|sheer force|tough claws|guts|moxie|solar power|speed boost/.test(lower)) score += 60;
    if ((role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') && /intimidate|regenerator|natural cure|sturdy|multiscale|prankster|friend guard|overcoat/.test(lower)) score += 60;
    return { ability, score };
  }).sort((a, b) => b.score - a.score || String(a.ability).localeCompare(String(b.ability)));
  return scored[0]?.ability || abilities[0];
}

function inferBeginnerNature(pokemon, state, role) {
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  if (role.key === 'speed-control' || spe >= 100) return 'Timid / Jolly depending on attacking stat';
  if (role.key === 'attacker' || role.key === 'setup') return spa >= atk ? 'Modest or Timid' : 'Adamant or Jolly';
  if (role.key === 'bulky' || role.key === 'support') return 'Bold, Calm, or Careful depending on needed bulk';
  return 'Choose a nature that boosts its main job';
}

function beginnerBuildExplanation(pokemon, role) {
  const name = getPokemonDisplayName(pokemon);
  if (role.key === 'attacker') return `${name} uses a simple damage-focused build with protection and reliable attacks.`;
  if (role.key === 'setup') return `${name} uses a setup-focused build that needs safe turns from its partner.`;
  if (role.key === 'support' || role.key === 'speed-control') return `${name} uses a simple support build that helps stronger teammates take better turns.`;
  if (role.key === 'bulky') return `${name} uses a steadier build focused on staying useful across multiple turns.`;
  if (role.key === 'weather') return `${name} uses a weather-focused build that works best with teammates that benefit from that weather.`;
  return `${name} uses a flexible starter build based on the safest legal options available.`;
}

function buildGroupedOptionsBlock(title, groups, fallback) {
  const body = groups.length
    ? groups.map((group) => `<div class="metadex-build-option-group"><strong>${escapeText(group.label)}:</strong> ${group.values.map(escapeText).join(', ')}</div>`).join('')
    : `<p class="muted">${escapeText(fallback)}</p>`;
  return buildGuideBlock(title, body);
}

function buildBeginnerBuildBlock(build) {
  return buildGuideBlock('Beginner Recommended Build', `<div class="metadex-beginner-build">
    <p><strong>Role:</strong> ${escapeText(build.role)}</p>
    <p><strong>Item:</strong> ${escapeText(build.item)}</p>
    <p><strong>Ability:</strong> ${escapeText(build.ability)}</p>
    <p><strong>Nature:</strong> ${escapeText(build.nature)}</p>
    <p><strong>Moves:</strong> ${build.moves.map(escapeText).join(', ')}</p>
    <p class="muted">${escapeText(build.explanation)}</p>
  </div>`);
}

function flattenText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(flattenText).join(' ').toLowerCase();
  if (typeof value === 'object') return Object.values(value).map(flattenText).join(' ').toLowerCase();
  return String(value).toLowerCase();
}

function tacticalIdentity(pokemon) {
  if (pokemon && typeof pokemon === 'object' && TACTICAL_IDENTITY_CACHE.has(pokemon)) return TACTICAL_IDENTITY_CACHE.get(pokemon);
  const pressure = firstFrom(pokemon.strategicStrengths?.pressureTypes || pokemon.pressureFlow || pokemon.damageProfile?.preferredDamagePattern);
  const state = firstFrom(pokemon.preferredBoardStates || pokemon.strategicStrengths?.preferredBoardStates || pokemon.boardStateProfiles?.preferredBoards);
  const conversion = firstFrom(pokemon.strategicStrengths?.conversionPatterns || pokemon.strategicStrengths?.endgamePatterns || pokemon.damageProfile?.endgamePressure);
  const core = firstFrom(pokemon.strategicStrengths?.coreStrengths || pokemon.notes || pokemon.confidenceReason);
  const identity = {
    identity: identityPhrase(core || pressure || conversion || 'Tactical role not fully documented'),
    primaryPressure: compactPreview(pressure || core || 'Primary pressure route not documented'),
    preferredState: compactPreview(state || 'Preferred current matchup not documented'),
    conversionPattern: compactPreview(conversion || 'Conversion pattern not documented')
  };
  if (pokemon && typeof pokemon === 'object') TACTICAL_IDENTITY_CACHE.set(pokemon, identity);
  return identity;
}

function identityPhrase(value) {
  const text = compactPreview(value).replace(/\.$/, '');
  if (!text) return 'Tactical role not fully documented';
  return text.length > 74 ? `${text.slice(0, 71).trim()}…` : text;
}

function shortNoun(value) {
  return String(value || '').replace(/^(creates|create|establishes|establish|provides|provide|forces|force|uses|use|enables|enable)\s+/i, '').slice(0, 78).trim();
}

function spriteImage(sprite, pokemon, className) {
  return `<img class="pokemon-sprite ${className}" src="${escapeAttr(sprite.src)}" alt="${escapeAttr(sprite.alt)}" loading="${escapeAttr(sprite.loading)}" decoding="async" fetchpriority="low" width="64" height="64" data-pokemon-sprite data-pokemon-id="${escapeAttr(pokemon.ndex || pokemon.pokemon_id || '')}" data-sprite-stage="home" />`;
}

function section(title, content, options = {}) {
  const displayTitle = normalizeDisplayLabel(title, title);
  const lines = prepareSectionLines(content, options);
  const primary = lines.slice(0, options.primary || 4);
  const additional = lines.slice(primary.length, options.max || 5);

  if (!primary.length) return '';

  return `<article class="mini-card metadex-info-card"><h3>${escapeText(displayTitle)}</h3><ul class="metadex-signal-list">${primary.map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>${additional.length ? `<details class="metadex-additional-notes"><summary>Additional tactical notes</summary><ul>${additional.map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul></details>` : ''}</article>`;
}

function prepareSectionLines(content, options = {}) {
  const seen = options.dedupe || new Set();
  const max = Math.max(options.max || 5, options.primary || 4);
  const raw = flattenContent(content).map(cleanTacticalLine).filter(Boolean);
  const ranked = raw.sort((a, b) => signalScore(b) - signalScore(a));
  const local = [];
  for (const line of ranked) {
    const key = semanticKey(line);
    if (!key || seen.has(key) || local.some((entry) => semanticKey(entry) === key)) continue;
    seen.add(key);
    local.push(line);
    if (local.length >= max) break;
  }
  return local;
}

function cleanTacticalLine(value) {
  let text = normalizeDisplayText(value, { ensureSentence: true });
  text = compressTacticalPhrase(text);
  if (isUnclearGeneratedLine(text)) return '';
  return text;
}

function isUnclearGeneratedLine(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/limited tactical data available|not documented|applicable true|applicable false/i.test(text)) return true;
  if (/no tactical note recorded yet|no benchmark analysis recorded yet|no advanced item interactions documented/i.test(text)) return true;
  if (/conversion pattern|protected positioning|pressure window|resource endgame|forced defensive targeting|tactical threat|opponent constraints|preferred board state|recovery route/i.test(text)) return true;
  if (/\b[A-Za-z]+(?:Active|Pressure|Positioning|Dependency|Route|Window):/i.test(text)) return true;
  if (/\b(converts|establishes|forces board progress)\b/i.test(text) && !/fake out|tailwind|trick room|protect|recover|roost|attack|damage/i.test(text)) return true;
  if (text.split(/\s+/).length < 4 && /pressure|position|tempo|resource|conversion/i.test(text)) return true;
  return false;
}

function compressTacticalPhrase(value) {
  return String(value || '')
    .replace(/spread damage escalation/gi, 'spread escalation')
    .replace(/forcing switches on entry/gi, 'entry positioning')
    .replace(/pressure sequencing/gi, 'momentum sequencing')
    .replace(/priority pressure/gi, 'priority cleanup pressure')
    .replace(/neutral positioning with partner protection/gi, 'protected positioning')
    .replace(/\bpressure pressure\b/gi, 'pressure')
    .replace(/\bpositioning positioning\b/gi, 'positioning')
    .replace(/\s+/g, ' ')
    .trim();
}

function legalOptions(title, rows, limit, overflowTemplate = '+{count} more in the database') {
  const uniqueRows = dedupeLines(rows.map((row) => compactChip(row)).filter(Boolean));
  const visible = uniqueRows.slice(0, limit);
  const overflow = uniqueRows.length - visible.length;

  if (!visible.length) return '';

  return `<article class="mini-card metadex-info-card metadex-legal-card"><h3>${escapeText(title)}</h3><div class="metadex-chip-row">${visible.map((row) => `<span class="score-pill">${escapeText(row)}</span>`).join('')}</div>${overflow > 0 ? `<details class="metadex-additional-notes"><summary>${escapeText(overflowTemplate.replace('{count}', overflow))}</summary><div class="metadex-chip-row metadex-chip-row-muted">${uniqueRows.slice(limit).map((row) => `<span class="score-pill">${escapeText(row)}</span>`).join('')}</div></details>` : ''}</article>`;
}

function legalMoves(pokemon, state) {
  const cache = metadexCache(state).legalMoves;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const moves = (state.data.indexes.movesByPokemon[pokemon.pokemon_id] || [])
    .filter((row) => yesNo(row.is_legal) !== 'no')
    .map((row) => row.move_name || state.data.indexes.movesById[row.move_id]?.name || row.move_id)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  cache.set(key, moves);
  return moves;
}

function prioritizeLegalMoves(moves, pokemon) {
  const types = [pokemon.type1, pokemon.type2].map(normalize).filter(Boolean);
  return moves.map((name) => ({ name, score: moveRelevanceScore(name, types) }))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
}

function moveRelevanceScore(name, types) {
  const lower = normalize(name);
  let score = 0;
  MOVE_PRIORITY_TERMS.forEach((term, index) => { if (lower.includes(term)) score += 120 - index; });
  if (types.some((type) => lower.includes(type))) score += 20;
  if (/beam|blast|punch|kick|storm|crash|edge|quake|gleam|wave|pulse|slam|blade|bomb|ball/i.test(name)) score += 6;
  return score;
}

function legalAbilities(pokemon, state) {
  const cache = metadexCache(state).legalAbilities;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const abilities = (state.data.indexes.abilitiesByPokemon[pokemon.pokemon_id] || [])
    .filter((row) => yesNo(row.is_legal) !== 'no')
    .map((row) => getReadableAbilityName(state.data.indexes.abilitiesById[row.ability_id] || row, 'Unknown Ability'))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  cache.set(key, abilities);
  return abilities;
}

function itemCompatibility(pokemon) {
  const items = new Set();
  for (const build of listFrom(pokemon.commonBuilds)) {
    for (const item of listFrom(build?.itemOptions)) items.add(item);
  }
  return Array.from(items).sort((a, b) => String(a).localeCompare(String(b)));
}

function pressureWindowLines(windows = {}) {
  return [
    ...listFrom(windows.earlyGamePressure).map((item) => `Early: ${item}`),
    ...listFrom(windows.midGamePressure).map((item) => `Mid: ${item}`),
    ...listFrom(windows.lateGamePressure).map((item) => `Late: ${item}`),
    ...listFrom(windows.peakThreatTiming).map((item) => `Peak: ${item}`),
    ...listFrom(windows.decliningValueConditions).map((item) => `Declines when: ${item}`)
  ];
}

function flattenContent(content) {
  if (!content) return [];
  if (Array.isArray(content)) return content.flatMap(flattenContent).filter(Boolean);
  if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') return [String(content)];
  if (typeof content === 'object') {
    if (Array.isArray(content.items)) return flattenContent(content.items);
    return Object.entries(content).flatMap(([key, value]) => {
      if (key === 'confidenceStatus' || key === 'confidenceReason') return [];
      return flattenContent(value).map((line) => `${labelFromKey(key)}: ${line}`);
    });
  }
  return [];
}

function firstFrom(value) {
  return flattenContent(value).map(cleanTacticalLine).filter(Boolean)[0] || '';
}

function signalScore(value) {
  const text = String(value || '').toLowerCase();
  let score = Math.min(60, text.length / 3);
  if (/convert|endgame|win|cleanup|position|tempo|speed|recover|pivot|support|risk|collapse|trade|disrupt|fake out|tailwind|trick room/.test(text)) score += 35;
  if (/generic|available|limited|unknown|not documented|thin evidence/.test(text)) score -= 80;
  if (text.length < 28) score -= 20;
  return score;
}

function semanticKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(pressure|positioning|tactical|strategic|reliable|strong|primary|secondary|creates|enables|supports|through|with|and|the|a|an)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

function dedupeLines(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = semanticKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactPreview(value) {
  const text = compressTacticalPhrase(normalizeDisplayText(value, { ensureSentence: true }))
    .replace(/^Core strengths:\s*/i, '')
    .replace(/^Pressure types:\s*/i, '')
    .replace(/^win patterns:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (isUnclearGeneratedLine(text)) return '';
  return text.length > 118 ? `${text.slice(0, 115).trim()}…` : text;
}

function compactChip(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function qualityTier(completeFields) {
  if (completeFields >= 8) return { key: 'gold', label: QUALITY_LABELS.gold };
  if (completeFields >= 5) return { key: 'strong', label: QUALITY_LABELS.strong };
  if (completeFields >= 3) return { key: 'needs', label: QUALITY_LABELS.needs };
  return { key: 'incomplete', label: QUALITY_LABELS.incomplete };
}

function isEliteEntry(pokemon, coverage) {
  return coverage.completeFields >= 8
    && hasMeaningfulValue(pokemon.strategicStrengths?.conversionPatterns)
    && (flattenContent(pokemon.interactionProfiles).length >= 2 || flattenContent(pokemon.strategicTriggers).length >= 2);
}

function listFrom(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => option(value, label, selected)).join('');
}
function teamNeedOptions(selected) {
  return selectOptions([
    ['all','All needs'],['main','Main Pokémon'],['partner','Core Partner'],['damage','Damage Pressure'],['defensive','Defensive Switch-in'],['speed','Speed Control'],['disruption','Fake Out / Disruption'],['redirection','Redirection / Protection'],['weather','Weather Support'],['screens','Screens / Aurora Veil'],['setup','Setup Support'],['pivot','Pivot / Positioning'],['cleaner','Late-game Cleaner'],['weakness','Weakness Answer'],['secondary','Secondary Mode'],['glue','Utility Glue']
  ], selected);
}
function guideStepOptions(selected) {
  return selectOptions([
    ['any','Any guide step'],['step2','Step 2: Have an idea'],['step3','Step 3: The Core'],['step4','Step 4: Fill out the Core'],['step5','Step 5: Consider Weaknesses and Expand'],['step6','Step 6: Find the Details'],['step7','Step 7: Playtest and Adjust']
  ], selected);
}
function teamFitOptions(selected) {
  return selectOptions([
    ['any','Any fit'],['good','Fits current team well'],['weakness','Covers current weakness'],['role','Adds missing role'],['speed','Adds speed control'],['backbone','Adds defensive backbone'],['pressure','Adds offensive pressure'],['utility','Adds support utility'],['worsen','May worsen current weakness']
  ], selected);
}
function archetypeFitOptions(selected) {
  return selectOptions([
    ['any','Any archetype'],['balanced','Balanced Offense'],['hyper','Hyper Offense'],['bulkyoffense','Bulky Offense'],['balance','Balance'],['trickroom','Trick Room'],['tailwind','Tailwind Offense'],['weather','Weather'],['setup','Setup Offense'],['snow','Snow'],['rain','Rain'],['sun','Sun'],['sand','Sand'],['momentum','Momentum Balance']
  ], selected);
}
function roleConfidenceOptions(selected) {
  return selectOptions([
    ['primary-only','Primary role only'],['strong-secondary','Primary + strong secondary roles'],['flexible','Include flexible/tech roles'],['hide-low','Hide low-confidence role matches']
  ], selected);
}
function sortOptions(selected) {
  return selectOptions([
    ['team-fit','Best team fit'],['guide-step','Best guide-step fit'],['role-confidence','Highest role confidence'],['offense','Strongest offensive pressure'],['defensive','Best defensive fit'],['speed-control','Best speed control fit'],['weakness-answer','Best weakness answer'],['alphabetical','Alphabetical']
  ], selected);
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeText(label)}</option>`;
}

function emptyState() {
  return '<article class="mini-card"><h3>No Pokémon found</h3><p class="muted">Adjust the search or filters to show more entries.</p></article>';
}

function availabilityText(pokemon) {
  if (yesNo(pokemon.champions_legal) === 'yes') return 'Champions legal';
  if (pokemon.requiresOfficialReview) return 'Needs review';
  return 'Availability unclear';
}

function labelFromKey(key) {
  return String(key || '').replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function yesNo(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'legal', 'champions legal'].includes(normalized)) return 'yes';
  if (['false', '0', 'illegal', 'not legal'].includes(normalized)) return 'no';
  return normalized;
}
function normalize(value) { return String(value || '').trim().toLowerCase(); }
function num(value) { return Number.isFinite(Number(value)) ? Number(value) : '—'; }
function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeText(value); }
