import { TeamSlotCard, buildSpecificPressureTags } from '../components/TeamSlotCard.js';
import { SearchableSelector } from '../components/SearchableSelector.js';
import { TypeBadges, pokemonTypes } from '../utils/typeBadges.js';
import { CompactStatBars } from '../utils/compactStats.js';
import { getPokemonSprite } from '../utils/pokemonSprites.js';
import { checkSlotLegality, checkPokemonLegality, legalPokemon, analyseTeamValidation } from '../core/legalityEngine.js';
import { analyseItemClause } from '../core/itemClauseEngine.js';
import { analyseTeamMegaState, getMegaOptions, getMegaRequirement, candidateConflictsWithTeamMega } from '../core/megaEvolutionEngine.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../utils/formGrouping.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';

const TEAM_BUILDER_LABELS = {
  'Stat allocation reviewed': 'EV allocation missing',
  'stat allocation reviewed': 'EV allocation missing',
  'damageBenchmarks coverage': 'Missing tactical benchmarks',
  'damageBenchmarks coverage.': 'Missing tactical benchmarks',
  Nature: 'Nature not selected',
  nature: 'Nature not selected'
};

function formatTeamBuilderIssueLabel(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text.replace(/^Missing\s+/i, '').replace(/\.$/, '');
  const direct = TEAM_BUILDER_LABELS[text] || TEAM_BUILDER_LABELS[`${text}.`];
  if (direct) return direct;
  if (/^damageBenchmarks\s+coverage$/i.test(text)) return 'Missing tactical benchmarks';
  if (/^stat\s+allocation\s+reviewed$/i.test(text)) return 'EV allocation missing';
  if (/^nature$/i.test(text)) return 'Nature not selected';
  return `Missing ${text.replace(/([a-z])([A-Z])/g, '$1 $2')}`;
}

function formatTeamBuilderIssue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/Missing\s+([^:.]+(?:\s+coverage)?\.?)/gi, (_, field) => formatTeamBuilderIssueLabel(field));
}

export function TeamBuilderPage(state) {
  return `<section class="page-stack team-builder-page" data-team-builder-page>
    <header class="hero builder-hero tactical-primary-panel">
      <div><h1>Team Builder</h1><p>Build six legal sets with clear tactical roles, pressure plans, defensive support, and endgame structure.</p></div>
      <div class="hero-actions"><button type="button" data-action="copy-share-link">Copy share link</button><button type="button" data-action="collapse-completed-slots">Minimise completed slots</button><button type="button" data-action="expand-all-slots">Expand all</button><button type="button" data-action="clear-team">Clear team</button></div>
    </header>
    ${shareUrlFeedback(state)}
    ${teamBuilderAnalysisLinkCard()}
    ${teamBuildingGuideLinkCard()}
    <section class="builder-workspace tactical-builder-workspace priority-builder-workspace">
      <div class="mobile-team-status-zone" data-team-builder-mobile-status-region>${renderTeamBuilderMobileStatusRegion(state)}</div>
      <div class="team-slots-priority-zone" data-team-builder-slots-region>${renderTeamBuilderSlotsRegion(state)}</div>
      <aside class="builder-side builder-priority-side">
        <div data-team-builder-desktop-status-region>${renderTeamBuilderDesktopStatusRegion(state)}</div>
        <div data-team-builder-snapshot-region>${renderTeamBuilderSnapshotRegion(state)}</div>
        <div data-team-builder-filters-region>${renderTeamBuilderStrategicFiltersRegion(state)}</div>
      </aside>
    </section>
  </section>`;
}

export function renderTeamBuilderSlotsRegion(state) {
  const selected = (Array.isArray(state?.team) ? state.team : [])
    .filter(Boolean)
    .map((slot) => state.data.indexes?.pokemonById?.[slot.pokemon_id])
    .filter(Boolean);
  return `<div class="workspace-section-head team-slots-head"><div><p class="eyebrow">Highest priority</p><h2>Current Team Slots</h2></div><span class="badge">${selected.length}/6 selected</span></div>
    <div class="slot-column">${(state.team || []).map((slot, index) => TeamSlotCard(slot, index, state.data, state.team, state.slotUiState?.[index])).join('')}</div>`;
}

export function renderTeamBuilderMobileStatusRegion(state) {
  return teamStatus(state, { mobile: true });
}

export function renderTeamBuilderDesktopStatusRegion(state) {
  return teamStatus(state, { mobile: false });
}

export function renderTeamBuilderSnapshotRegion(state) {
  return teamSnapshotPanel(state);
}

export function renderTeamBuilderStrategicFiltersRegion(state) {
  return strategicFilters(state);
}




function shareUrlFeedback(state) {
  const notice = state.shareUrlNotice || '';
  const warning = state.shareUrlWarning || '';
  if (!notice && !warning) return '';
  return `<section class="card compact-card share-team-url-feedback ${warning ? 'warning-panel' : 'success-panel'}">
    ${notice ? `<p class="success">${escapeText(notice)}</p>` : ''}
    ${warning ? `<p class="warning">${escapeText(warning)}</p>` : ''}
  </section>`;
}

function teamBuilderAnalysisLinkCard() {
  return `<section class="card compact-card team-builder-analysis-link-card">
    <div>
      <p class="eyebrow">Team-level diagnostics</p>
      <h2>View team analysis</h2>
      <p class="muted">Use the Analysis Desk for archetype detection, gameplans, pressure coverage, weaknesses, risks, synergies, leads, and full-team summaries.</p>
    </div>
    <a class="secondary-button" href="/analysis-desk" data-route="analysis-desk">View team analysis</a>
  </section>`;
}

function teamBuildingGuideLinkCard() {
  return `<section class="card compact-card team-builder-guide-link-card">
    <div>
      <p class="eyebrow">Need planning help?</p>
      <h2>Open the Team Building Guide</h2>
      <p class="muted">Use the dedicated 7-step workflow to plan your idea, core, weaknesses, details, and playtesting without cluttering the team editor.</p>
    </div>
    <a class="secondary-button" href="/team-building-guide" data-route="team-building-guide">Open Team Building Guide</a>
  </section>`;
}


function teamStatus(state, options = {}) {
  const checks = state.team.map((slot, index) => checkSlotLegality(slot, state.data, state.team, index));
  const mega = analyseTeamMegaState(state.team, state.data);
  const itemClause = analyseItemClause(state.team, state.data);
  const warnings = checks.flatMap((check, index) => check.warnings.map((warning) => `Slot ${index + 1}: ${formatTeamBuilderIssue(warning)}`));
  const missing = checks.flatMap((check, index) => check.missing.map((warning) => `Slot ${index + 1}: ${formatTeamBuilderIssue(warning)}`));
  warnings.push(...mega.warnings);
  warnings.push(...itemClause.warnings.map((warning) => `Item Clause: ${warning}`));
  const teamValidation = analyseTeamValidation(state.team, state.data);
  warnings.push(...teamValidation.errors.map((issue) => issue.message));
  const selectedCount = state.team.filter(Boolean).length;
  const legalBadge = warnings.length ? 'Needs attention' : 'Looks legal';
  const shellClass = options.mobile ? 'mobile-team-status-card' : 'desktop-team-status-card';
  const expanded = warnings.length || itemClause.warnings.length || mega.conflict;
  const quickText = warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'} need review` : missing.length ? `${missing.length} prep note${missing.length === 1 ? '' : 's'}` : 'No major warnings';
  const body = `<div class="team-coaching-profile-body builder-slot-status-body">
    <p class="muted small-copy">Builder status only shows construction and legality issues. Team strategy, risks, leads, and synergies now live in the Analysis Desk.</p>
    ${itemClause.legal ? '<p class="muted">Item Clause clear: every held item is unique.</p>' : `<div class="item-clause-panel"><strong>Item Clause warning</strong>${itemClause.duplicates.map((entry) => `<p class="warning">${escapeText(entry.itemName)}: ${entry.pokemonNames.map(escapeText).join(' + ')}</p>`).join('')}</div>`}
    ${mega.primaryMega ? `<p class="notice mega-team-note"><strong>Mega:</strong> ${escapeText(mega.primaryMega.megaName)} selected. ${mega.conflict ? 'Mega slot conflict detected.' : 'Single Mega slot claimed.'}</p>` : '<p class="muted">No Mega Evolution slot claimed.</p>'}
    ${warnings.length ? `<div class="warning-stack">${warnings.slice(0, 10).map((warning) => `<p class="warning">${escapeText(warning)}</p>`).join('')}</div>` : '<p class="muted">No legality warnings for selected slots.</p>'}
    ${missing.length ? `<details><summary>Additional slot prep notes</summary>${missing.slice(0, 18).map((warning) => `<p class="notice">${escapeText(warning)}</p>`).join('')}</details>` : '<p class="muted">Required gold-standard fields are populated for selected slots.</p>'}
  </div>`;
  if (options.mobile) {
    return `<details class="card compact-card tactical-secondary-panel ${shellClass}" ${expanded ? 'open' : ''}>
      <summary class="mobile-team-status-summary">
        <span><strong>Builder status</strong><em>${escapeText(quickText)}</em></span>
        <span class="mobile-status-chips"><b class="badge">${selectedCount}/6</b><b class="badge ${warnings.length ? 'warning-badge' : 'legal-badge'}">${warnings.length} warning${warnings.length === 1 ? '' : 's'}</b><b class="badge">${missing.length} notes</b></span>
        <span class="mobile-status-toggle" aria-hidden="true"><span class="show-label">Show details</span><span class="hide-label">Hide details</span></span>
      </summary>
      <div class="mobile-team-status-body">${body}</div>
    </details>`;
  }
  return `<section class="card compact-card tactical-secondary-panel ${shellClass}"><div class="card-head"><h2>Builder status</h2><span class="badge ${warnings.length ? 'warning-badge' : 'legal-badge'}">${legalBadge}</span><span class="badge">${selectedCount}/6</span></div>${body}</section>`;
}


const TEAM_SNAPSHOT_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

const TEAM_SNAPSHOT_TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A', Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD'
};

function teamSnapshotPanel(state) {
  const selected = getTeamSnapshotSelectedTeam(state?.team);
  if (!selected.length) return '';
  const profile = buildTeamCoachingProfile(state.team, { data: state.data });
  const pressure = buildTeamSnapshotPressureCoverage(state.team, state.data);
  const weaknessEntries = profile?.defensiveProfile?.rawWeaknessCoverage || [];
  const weakness = Array.isArray(weaknessEntries) && weaknessEntries.length >= 18
    ? TEAM_SNAPSHOT_TYPES.map((type) => weaknessEntries.find((entry) => normalizeTeamSnapshotType(entry?.attackingType) === type) || { attackingType: type, memberResults: [] })
    : [];
  const pressureSummary = pressure.summary || 'Select moves to build a quick offensive pressure map.';
  const weaknessSummary = summarizeTeamSnapshotWeakness(weakness);
  return `<section class="card compact-card tactical-secondary-panel team-builder-snapshot-panel" aria-label="Team Snapshot">
    <div class="card-head"><div><p class="eyebrow">Wide-screen dashboard</p><h2>Team Snapshot</h2></div><span class="badge">Charts</span></div>
    <div class="team-builder-snapshot-block">
      <div class="team-builder-snapshot-heading"><h3>Pressure Coverage</h3><p>${escapeText(pressureSummary)}</p></div>
      <div class="team-builder-mini-type-grid team-builder-pressure-grid" aria-label="Compact team offensive pressure coverage">
        ${pressure.types.map((entry) => renderTeamSnapshotPressureTile(entry)).join('')}
      </div>
    </div>
    <div class="team-builder-snapshot-block">
      <div class="team-builder-snapshot-heading"><h3>Weakness Coverage</h3><p>${escapeText(weaknessSummary)}</p></div>
      ${weakness.length ? `<div class="team-builder-mini-type-grid team-builder-weakness-grid" aria-label="Compact team defensive weakness coverage">
        ${weakness.map((entry) => renderTeamSnapshotWeaknessTile(entry)).join('')}
      </div>` : '<p class="muted small-copy">Weakness coverage appears once selected Pokémon have complete typing data.</p>'}
    </div>
  </section>`;
}

function getTeamSnapshotSelectedTeam(team = []) {
  return (Array.isArray(team) ? team : []).filter((slot) => slot && slot.pokemon_id);
}

function buildTeamSnapshotPressureCoverage(team = [], data = {}) {
  const pokemonById = data?.indexes?.pokemonById || {};
  const movesById = data?.indexes?.movesById || {};
  const byType = new Map(TEAM_SNAPSHOT_TYPES.map((type) => [type, []]));
  getTeamSnapshotSelectedTeam(team).forEach((slot) => {
    const pokemon = pokemonById[slot?.pokemon_id];
    if (!pokemon) return;
    const name = getPokemonDisplayName(pokemon);
    const tags = buildSpecificPressureTags(slot, pokemon, data, 12);
    const moveIds = Array.isArray(slot?.moves) ? slot.moves : [slot?.move1, slot?.move2, slot?.move3, slot?.move4];
    moveIds.filter(Boolean).forEach((moveId) => {
      const move = movesById[moveId] || (typeof moveId === 'object' ? moveId : null);
      const type = normalizeTeamSnapshotType(move?.type);
      if (!type || !byType.has(type)) return;
      const shape = teamSnapshotMoveShape(move, tags);
      byType.get(type).push({ pokemon: name, shape });
    });
  });
  const types = TEAM_SNAPSHOT_TYPES.map((type) => {
    const details = byType.get(type) || [];
    const contributors = [...new Set(details.map((item) => item.pokemon).filter(Boolean))];
    const strength = contributors.length >= 2 ? 'covered' : contributors.length === 1 ? 'light' : 'none';
    return { type, contributors, strength };
  });
  const covered = types.filter((entry) => entry.strength === 'covered').length;
  const light = types.filter((entry) => entry.strength === 'light').length;
  const none = types.filter((entry) => entry.strength === 'none').length;
  return { types, summary: `${covered} strong, ${light} light, ${none} uncovered attacking types.` };
}

function renderTeamSnapshotPressureTile(entry = {}) {
  const count = entry.contributors?.length || 0;
  const metric = count ? '●'.repeat(Math.min(3, count)) : '—';
  const title = count ? `${entry.type}: ${entry.contributors.join(', ')}` : `${entry.type}: no selected damage move`;
  return `<article class="team-builder-mini-type-tile pressure-${escapeAttr(entry.strength || 'none')}" style="--type-color: ${escapeAttr(TEAM_SNAPSHOT_TYPE_COLORS[entry.type] || '#64748b')}" title="${escapeAttr(title)}"><strong>${escapeText(entry.type)}</strong><span>${escapeText(metric)}</span></article>`;
}

function renderTeamSnapshotWeaknessTile(entry = {}) {
  const typeName = normalizeTeamSnapshotType(entry?.attackingType) || entry?.attackingType || 'Unknown';
  const score = defensiveTeamSnapshotScore(entry);
  const metric = score > 0 ? `+${score}` : `${score}`;
  const tone = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const title = `${typeName}: ${Number(entry?.resistCount || 0)} resist, ${Number(entry?.immuneCount || 0)} immune, ${Number(entry?.weakCount || 0)} weak`;
  return `<article class="team-builder-mini-type-tile weakness-${tone}" style="--type-color: ${escapeAttr(TEAM_SNAPSHOT_TYPE_COLORS[typeName] || '#64748b')}" title="${escapeAttr(title)}"><strong>${escapeText(typeName)}</strong><span>${escapeText(metric)}</span></article>`;
}

function defensiveTeamSnapshotScore(entry = {}) {
  return (Array.isArray(entry.memberResults) ? entry.memberResults : []).reduce((score, member) => {
    const multiplier = Number(member?.multiplier);
    if (multiplier === 0) return score + 2;
    if (multiplier <= 0.25) return score + 2;
    if (multiplier < 1) return score + 1;
    if (multiplier >= 4) return score - 2;
    if (multiplier > 1) return score - 1;
    return score;
  }, 0);
}

function summarizeTeamSnapshotWeakness(entries = []) {
  if (!entries.length) return 'Defensive scores appear once typing data is available.';
  const worst = [...entries].sort((a, b) => defensiveTeamSnapshotScore(a) - defensiveTeamSnapshotScore(b))[0];
  const best = [...entries].sort((a, b) => defensiveTeamSnapshotScore(b) - defensiveTeamSnapshotScore(a))[0];
  const worstType = normalizeTeamSnapshotType(worst?.attackingType) || 'None';
  const bestType = normalizeTeamSnapshotType(best?.attackingType) || 'None';
  return `Lowest score: ${worstType}. Best covered: ${bestType}.`;
}

function normalizeTeamSnapshotType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  return TEAM_SNAPSHOT_TYPES.find((type) => type.toLowerCase() === clean) || '';
}

function teamSnapshotMoveShape(move = {}, tags = []) {
  const name = String(move?.name || move?.move_name || '').toLowerCase();
  if (/fake out|taunt|encore|parting shot|whirlwind|roar|disable|spore|will-o-wisp|will o wisp|thunder wave|nuzzle/.test(name)) return 'disruption';
  if (Number(move?.priority || 0) > 0) return 'priority';
  if (/heat wave|blizzard|dazzling gleam|earthquake|rock slide|surf|muddy water|discharge|icy wind|snarl|hyper voice|eruption|water spout/.test(name)) return 'spread';
  const tagText = (Array.isArray(tags) ? tags : []).join(' ').toLowerCase();
  if (tagText.includes('priority')) return 'priority';
  return String(move?.category || '').toLowerCase() === 'status' ? 'status' : 'single-target';
}

function strategicFilters(state) {
  const active = new Set(state.builderFocus || []);
  const filters = [
    ['speed', 'Speed control'], ['pivot', 'Pivot loops'], ['recovery', 'Recovery routes'], ['protect', 'Protect cycles'], ['weather', 'Weather chains'], ['priority', 'Priority risk'], ['endgame', 'Endgame cleanup'], ['positioning', 'Positioning']
  ];
  const activeCount = active.size;
  const activeBadge = activeCount ? `<span class="badge">${activeCount} active</span>` : '';
  const activeExplanations = filters
    .filter(([id]) => active.has(id))
    .map(([id]) => `<li>${escapeText(BUILDER_FOCUS_EXPLANATIONS[id] || `Boosting recommendations with ${id} evidence by +5 score`)}</li>`)
    .join('');
  const influenceBlock = activeExplanations
    ? `<div class="advanced-filter-effects" aria-live="polite"><strong>Active recommendation bias</strong><ul>${activeExplanations}</ul></div>`
    : '<p class="muted small-copy advanced-filter-effects-empty">No advanced bias selected. Recommendations use the shared team profile only.</p>';
  return `<details class="card compact-card tactical-secondary-panel advanced-recommendation-filters">
    <summary class="advanced-filter-summary">
      <span class="advanced-filter-title"><strong>Advanced recommendation filters</strong><em>Optional filters for narrowing MetaDex-style suggestions.</em></span>
      <span class="advanced-filter-meta">${activeBadge}<span class="advanced-filter-chevron" aria-hidden="true">⌄</span></span>
    </summary>
    <div class="advanced-filter-body">
      <div class="card-head advanced-filter-head"><p class="muted small-copy">Active chips add +5 recommendation score when a candidate's gold-standard evidence contains that focus term. They do not override legality, missing-data penalties, shared profile risks, or item clause warnings.</p><button type="button" class="tiny-button" data-action="clear-builder-focus">Reset</button></div>
      <div class="filter-grid">${filters.map(([id, label]) => `<button type="button" class="filter-chip ${active.has(id) ? 'active' : ''}" data-builder-focus="${id}">${label}</button>`).join('')}</div>
      ${influenceBlock}
    </div>
  </details>`;
}

const BUILDER_FOCUS_EXPLANATIONS = {
  speed: 'Boosting speed-control recommendations by +5 when speed evidence is found.',
  pivot: 'Boosting pivot-loop and safe-switch recommendations by +5 when pivot evidence is found.',
  recovery: 'Prioritising recovery and sustain options by +5 when recovery evidence is found.',
  protect: 'Boosting Protect-cycle recommendations by +5 when Protect evidence is found.',
  weather: 'Boosting weather-chain recommendations by +5 when weather evidence is found.',
  priority: 'Boosting priority users for emergency speed control by +5 when priority evidence is found.',
  endgame: 'Boosting endgame cleanup options by +5 when endgame evidence is found.',
  positioning: 'Boosting positioning and board-state options by +5 when positioning evidence is found.'
};

function shortSharedSentence(value = '', maxLength = 132) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  return firstSentence.length > maxLength ? `${firstSentence.slice(0, maxLength - 1).trim()}…` : firstSentence;
}

function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeText(value); }
