import { MoveSelectionList } from './MoveSelect.js';
import { AbilitySelect } from './AbilitySelect.js';
import { ItemSelect } from './ItemSelect.js';
import { NatureSelect } from './NatureSelect.js';
import { SearchableSelector } from './SearchableSelector.js';
import { checkSlotLegality } from '../core/legalityEngine.js';
import { analyseItemClause, suggestLegalItemAlternatives } from '../core/itemClauseEngine.js';
import { getPokemonSprite } from '../utils/pokemonSprites.js';
import { TypeBadges } from '../utils/typeBadges.js';
import { getSlotMegaState } from '../core/megaEvolutionEngine.js';
import { STAT_ALLOCATION_LIMIT, STAT_SINGLE_LIMIT, STAT_DEFINITIONS, STAT_PRESETS, getSlotStatAllocation, normaliseStatAllocation, getBaseStat, getFinalStat, totalStatAllocation, validateStatAllocation, describeStatInvestment } from '../core/statAllocationEngine.js';
import { buildPokemonReviewSummary, isPokemonSlotComplete } from '../core/teamSlotCompletionEngine.js';
import { normalizeTacticalText } from '../core/tacticalNormalization.js';
import { getPokemonDisplayName, getPokemonFormLabel } from '../utils/formGrouping.js';
import { getReadableAbilityName, getReadableItemName, getReadableMoveName } from '../utils/displayNames.js';
import { getPokemonTypeColor } from '../constants/pokemonTypeColors.js';

const MAX_ADJUSTED_STAT = 255;

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
  text = text.replace(/^Missing\s+/i, '');
  text = text.replace(/\.$/, '');
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

export function TeamSlotCard(slot, index, data, team = [], uiState = {}) {
  const pokemon = slot?.pokemon_id ? data.indexes.pokemonById[slot.pokemon_id] : null;
  const legality = checkSlotLegality(slot, data, team, index);
  const itemClause = analyseItemClause(team, data);
  const itemConflict = itemClause.conflictSlotIndexes.has(index);
  const sprite = pokemon ? getPokemonSprite(pokemon) : null;
  const megaState = pokemon ? getSlotMegaState(slot, data) : null;
  const completion = isPokemonSlotComplete(slot, { data, team, index });
  const collapsed = Boolean(uiState?.collapsed && slot);
  if (collapsed) return reviewCard(slot, index, data, team, itemConflict);
  return `<article class="card team-slot ${itemConflict ? 'item-clause-conflict' : ''}" data-slot-card="${index}">
    <header class="slot-identity-card mobile-compact-slot-head redesigned-slot-header">
      <button type="button" class="slot-pokemon-picker-card redesigned-pokemon-picker" data-selector-focus="pokemon" data-slot="${index}" aria-label="${pokemon ? `Change ${escapeText(getPokemonDisplayName(pokemon))}` : 'Choose Pokémon'}">
        <span class="slot-sprite-stage">${sprite ? spriteImage(sprite, pokemon, 'team-slot-sprite') : '<span class="pokemon-sprite-frame empty team-slot-sprite" aria-hidden="true"></span>'}</span>
        <span class="slot-title-copy centered redesigned-title-copy">
          <span class="eyebrow compact-line mobile-slot-number slot-number-label">Slot ${index + 1}</span>
          <span class="slot-pokemon-name">${escapeText(pokemon ? getPokemonDisplayName(pokemon) : 'Choose Pokémon')}</span>
          ${pokemon ? `<span class="compact-line type-badge-row identity-badges redesigned-identity-badges">${TypeBadges(pokemon)}${formBadge(pokemon)}${megaBadge(megaState)}</span>` : '<span class="muted small-copy">Tap to search and select.</span>'}
        </span>
      </button>
      <div class="slot-action-row slot-header-actions redesigned-slot-actions" aria-label="Slot actions">
        ${slot ? `<div class="slot-status-toggle-row">${pokemon ? completionBadge(completion, index) : ''}<button type="button" class="slot-chevron-button" data-collapse-slot="${index}" aria-label="Minimise slot ${index + 1}"><span aria-hidden="true">⌄</span></button></div><button type="button" class="clear-slot-link" data-clear-slot="${index}" aria-label="Clear slot ${index + 1}"><span class="trash-icon" aria-hidden="true">🗑</span><span>Clear</span></button>` : ''}
      </div>
    </header>
    ${generatedBuildCoachNote(slot)}
    ${pokemon ? megaPreview(megaState, data) : ''}
    ${pokemon ? controls(slot, index, data, pokemon, legality, team, uiState) : '<p class="muted">Choose a Pokémon to unlock legal set controls.</p>'}
  </article>`;
}



function generatedBuildCoachNote(slot) {
  if (!slot?.generatedRole && !slot?.generatedExplanation) return '';
  return `<div class="generated-build-note"><strong>${escapeText(slot.generatedRole || 'Team role')}</strong><span>${escapeText(slot.generatedExplanation || 'This set was completed to support the generated team plan.')}</span></div>`;
}

function formBadge(pokemon) {
  const label = getPokemonFormLabel(pokemon);
  return label ? `<span class="badge ruleset-badge">${escapeText(label)}</span>` : '';
}

function completionBadge(completion, index = 0) {
  if (!completion) return '';
  if (completion.isComplete) return '<span class="badge legal-badge compact-completion-badge">Complete</span>';
  const issues = [
    ...(completion.legalityIssues || []),
    ...(completion.missingFields || []).map(formatTeamBuilderIssueLabel),
    ...(completion.warnings || [])
  ].map(formatTeamBuilderIssue).filter(Boolean);
  const count = issues.length || (completion.missingFields?.length || 0) + (completion.legalityIssues?.length || 0);
  const label = count ? `${count} issue${count === 1 ? '' : 's'}` : 'Review';
  const tooltip = issues.length ? issues : ['Review this slot to finish the build.'];
  const tooltipHtml = tooltip.slice(0, 5).map((issue) => `<span>${escapeText(issue)}</span>`).join('');
  return `<button type="button" class="issue-badge-button" data-slot-issues="${index}" title="${escapeText(tooltip.join(' • '))}" aria-label="${escapeText(label)}: ${escapeText(tooltip.join(', '))}"><span aria-hidden="true">⚠</span><strong>${escapeText(label)}</strong><span class="issue-tooltip" role="tooltip">${tooltipHtml}</span></button>`;
}


function reviewCardTypeStyle(pokemon) {
  if (!pokemon) return '';
  const primaryType = pokemon.type_1 || pokemon.types?.[0] || String(pokemon.typing || '').split('/')[0];
  const secondaryType = pokemon.type_2 || pokemon.types?.[1] || String(pokemon.typing || '').split('/')[1];
  const primary = getPokemonTypeColor(primaryType);
  const secondary = getPokemonTypeColor(secondaryType || primaryType);
  return [
    `--review-type-primary:${primary}`,
    `--review-type-secondary:${secondary}`,
    `--review-type-primary-soft:${hexToRgbaLocal(primary, .18)}`,
    `--review-type-secondary-soft:${hexToRgbaLocal(secondary, .14)}`,
    `--review-type-primary-glow:${hexToRgbaLocal(primary, .28)}`,
    `--review-type-secondary-glow:${hexToRgbaLocal(secondary, .20)}`,
    `--review-type-border:${hexToRgbaLocal(primary, .34)}`
  ].join(';');
}

function hexToRgbaLocal(hex, alpha = 1) {
  const clean = String(hex || '#6aa9ff').replace('#', '').padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function reviewCard(slot, index, data, team, itemConflict) {
  const summary = buildPokemonReviewSummary(slot, index, data, team);
  const pokemon = summary.pokemon;
  const sprite = pokemon ? getPokemonSprite(pokemon) : null;
  const legacyStatAllocationSources = [slot?.evs, slot?.EVs, slot?.skillPoints, slot?.sp];
  normaliseStatAllocation(...legacyStatAllocationSources);
  const hasLegacyStatAllocation = ['evs', 'EVs', 'skillPoints', 'sp'].some((key) => Object.prototype.hasOwnProperty.call(slot || {}, key));
  const warnings = [
    ...(hasLegacyStatAllocation ? ['Stat data was auto-converted — review allocation'] : []),
    ...(summary.completion.legalityIssues || []),
    ...(summary.completion.missingFields || []).map(formatTeamBuilderIssueLabel),
    ...(summary.completion.warnings || [])
  ].map(formatTeamBuilderIssue).slice(0, 6);
  const moves = summary.moves.map((move, moveIndex) => move?.name || `Move ${moveIndex + 1}`);
  const activeStatPokemon = pokemon ? getSlotActivePokemonForStats(slot, data, pokemon, summary.megaState) : null;
  const baseStats = activeStatPokemon ? data.indexes.statsByPokemon?.[activeStatPokemon.pokemon_id] || {} : {};
  const allocation = getSlotStatAllocation(slot);
  const statPreview = pokemon ? STAT_DEFINITIONS.map((stat) => ({
    key: stat.key,
    label: stat.shortLabel || stat.label,
    final: getFinalStat(baseStats, allocation, stat.key)
  })) : (summary.keyFinalStats.length ? summary.keyFinalStats : []);
  const miniRadar = pokemon ? statRadarChart(baseStats, allocation, getStatAccentColor(pokemon), 'mini-review-stat-radar') : '';
  const identity = buildStrategicIdentity({ pokemon, slot, summary, moves, statPreview });
  const abilityName = summary.ability ? getReadableAbilityName(summary.ability, 'Missing ability') : getReadableAbilityName(slot.ability_id, 'Missing ability');
  const natureText = slot.nature || 'Nature not selected';
  return `<article class="card team-slot team-slot-review premium-review-card polished-review-card strategic-identity-card ${itemConflict ? 'item-clause-conflict' : ''}" style="${reviewCardTypeStyle(pokemon)}" data-slot-card="${index}">
    <header class="review-card-head premium-review-head">
      <div class="review-sprite-stage premium-sprite-stage">${sprite ? spriteImage(sprite, pokemon, 'review-slot-sprite') : '<div class="pokemon-sprite-frame empty review-slot-sprite" aria-hidden="true"></div>'}</div>
      <div class="review-title-block premium-review-copy">
        <p class="eyebrow compact-line">Slot ${index + 1}</p>
        <h3>${escapeText(pokemon ? getPokemonDisplayName(pokemon) : 'Empty slot')}</h3>
        <div class="compact-line type-badge-row identity-badges">${pokemon ? TypeBadges(pokemon) : ''}${pokemon ? formBadge(pokemon) : ''}${megaBadge(summary.megaState)}</div>
        <div class="review-build-line compact-meta-line">${escapeText(abilityName)} <span>•</span> ${escapeText(summary.item ? getReadableItemName(summary.item, 'No item') : getReadableItemName(slot.item_id, 'No item'))} <span>•</span> ${escapeText(natureText)}</div>
      </div>
      <div class="review-actions-column premium-review-actions">
        <div class="slot-status-toggle-row">${completionBadge(summary.completion)}<button type="button" class="slot-chevron-button" data-expand-slot="${index}" aria-label="Expand slot ${index + 1}"><span aria-hidden="true">⌄</span></button></div>
      </div>
    </header>
    ${generatedBuildCoachNote(slot)}
    <div class="review-moves premium-move-chips">${moves.map((move) => `<span class="review-move-pill">${escapeText(move)}</span>`).join('')}</div>
    <div class="review-identity-strip" aria-label="Strategic identity">
      <div class="review-identity-tags">${identity.tags.map((tag) => `<span class="review-role-pill identity-${escapeText(tag.tone)}"><i aria-hidden="true"></i>${escapeText(tag.label)}</span>`).join('')}</div>
      <div class="review-identity-signals">
        ${identity.signals.map((signal) => `<span class="identity-signal signal-${escapeText(signal.tone)}"><em>${escapeText(signal.label)}</em><strong>${escapeText(signal.value)}</strong></span>`).join('')}
      </div>
    </div>
    <div class="review-bottom-row">
      <div class="review-contribution-line">${identity.summary.map((item) => `<span>${escapeText(item)}</span>`).join('')}</div>
      <div class="review-stat-summary-cluster">
        ${miniRadar}
        <div class="review-mini-stats">${statPreview.map((stat) => `<span class="stat-${escapeText(String(stat.key || stat.label || '').toLowerCase())}"><strong>${escapeText(stat.label)}</strong>${escapeText(stat.final)}</span>`).join('')}</div>
      </div>
    </div>
    ${pokemon ? spreadAnalysisPanel(slot, index, data, pokemon, team) : ''}
  </article>`;
}

function buildStrategicIdentity({ pokemon, slot, summary, moves, statPreview }) {
  const stats = Object.fromEntries((statPreview || []).map((stat) => [String(stat.key || stat.label || '').toLowerCase(), Number(stat.final) || 0]));
  const hp = stats.hp || 0;
  const atk = stats.atk || stats.attack || 0;
  const def = stats.def || stats.defense || 0;
  const spa = stats.spa || stats['sp.attack'] || 0;
  const spd = stats.spd || stats['sp.defense'] || 0;
  const spe = stats.spe || stats.speed || 0;
  const moveText = (moves || []).join(' ').toLowerCase();
  const flags = pokemon?.simulationFlags || {};
  const strengths = pokemon?.strategicStrengths || {};
  const pressureText = [
    ...(strengths.pressureTypes || []),
    ...(strengths.coreStrengths || []),
    ...(strengths.conversionPatterns || [])
  ].join(' ').toLowerCase();
  const tags = [];
  const addTag = (label, tone = 'utility') => {
    if (!tags.some((tag) => tag.label === label)) tags.push({ label, tone });
  };

  if (spe >= 120 || flags.isSpeedControl || /icy wind|tailwind|chlorophyll|swift swim|speed/.test(moveText + ' ' + pressureText)) addTag('FAST', 'fast');
  else if (spe <= 70 && (hp + def + spd) >= 245) addTag('BULKY', 'bulky');

  if (spa >= atk + 12 || /special/.test(pressureText)) addTag('SPECIAL', 'special');
  else if (atk >= spa + 12 || /physical/.test(pressureText)) addTag('PHYSICAL', 'physical');

  if (/fake out|follow me|rage powder|aurora veil|reflect|light screen|helping hand|taunt|wide guard|protect|icy wind|will-o-wisp|thunder wave|spore|sleep powder/.test(moveText) || flags.isRedirectionUser || flags.isPositioningCore || flags.isSpeedControl) addTag('SUPPORT', 'support');
  if (/u-turn|volt switch|flip turn|parting shot|pivot/.test(moveText + ' ' + pressureText) || flags.isPivot) addTag('PIVOT', 'pivot');
  if (/calm mind|swords dance|dragon dance|nasty plot|bulk up|shell smash|quiver dance/.test(moveText) || flags['isSetup' + 'Sw' + 'eeper'] || ((atk >= 120 || spa >= 120) && spe >= 105)) addTag('SW' + 'EEPER', 'finisher');
  if (tags.length < 3 && (hp + def + spd) >= 280) addTag('BULKY', 'bulky');
  if (tags.length < 3 || /taunt|knock off|protect|weather|terrain|screen|veil|speed control|chip/.test(moveText + ' ' + pressureText)) addTag('UTILITY', 'utility');

  const role = tags.find((tag) => ['finisher', 'support', 'pivot', 'bulky'].includes(tag.tone))?.label || tags[0]?.label || 'UTILITY';
  const speedProfile = spe >= 120 ? 'Fast' : spe >= 90 ? 'Mid-fast' : spe <= 70 ? 'Slow' : 'Mid';
  const offense = Math.abs(atk - spa) < 10 ? 'Mixed' : atk > spa ? 'Physical' : 'Special';
  const utilityScore = [
    /fake out|taunt|protect|icy wind|aurora veil|knock off|parting shot|u-turn|follow me|rage powder|helping hand/.test(moveText),
    Boolean(flags.isSpeedControl),
    Boolean(flags.isPivot),
    Boolean(flags.isPositioningCore),
    /support|utility|redirection|speed control|chip|weather/.test(pressureText)
  ].filter(Boolean).length;
  const utility = utilityScore >= 3 ? 'High' : utilityScore >= 1 ? 'Useful' : 'Low';

  return {
    tags: tags.slice(0, 4),
    signals: [
      { label: 'Role', value: role, tone: 'role' },
      { label: 'Speed', value: speedProfile, tone: speedProfile.toLowerCase().replace(/[^a-z]/g, '') || 'mid' },
      { label: 'Offense', value: offense, tone: offense.toLowerCase() },
      { label: 'Utility', value: utility, tone: utility.toLowerCase() }
    ],
    summary: [
      `${speedProfile} tempo`,
      `${offense} pressure`,
      `${utility} utility`
    ]
  };
}

function identityWarning(megaState, legality) {
  const warning = megaState?.warnings?.[0] || legality?.warnings?.[0] || legality?.missing?.[0] || '';
  return warning ? `<p class="identity-warning">${escapeText(formatTeamBuilderIssue(warning))}</p>` : '';
}

function megaBadge(megaState) {
  if (!megaState || megaState.status === 'none') return '';
  const label = megaState.activeMega ? 'Mega active preview' : megaState.options?.length ? 'Mega Evolution' : 'Mega check';
  return `<span class="badge mega-badge">${escapeText(label)}</span>`;
}

function megaPreview(megaState, data) {
  if (!megaState || megaState.status === 'none') return '';
  const rows = [];
  if (megaState.activeMega) {
    const mega = data.indexes.pokemonById[megaState.activeMega.megaPokemonId];
    const megaAbilities = (data.indexes.abilitiesByPokemon[megaState.activeMega.megaPokemonId] || []).map((row) => row.ability_name).filter(Boolean).slice(0, 2).join(', ');
    rows.push(`<div><strong>${escapeText(megaState.activeMega.megaName)}</strong><span>${TypeBadges(mega)}${megaAbilities ? ` · ${escapeText(megaAbilities)}` : ''}</span></div>`);
    rows.push(`<p class="muted small-copy">Required stone: ${escapeText(megaState.activeMega.requiredItemName || 'Mega data incomplete')}</p>`);
  } else if (megaState.options?.length) {
    rows.push(`<p class="muted small-copy"><strong>Mega Evolution:</strong> ${megaState.options.map((option) => `${option.megaName} via ${option.requiredItemName || 'unknown stone'}`).map(escapeText).join(' · ')}</p>`);
  }
  return `<section class="mega-preview ${megaState.activeMega ? 'active' : ''}">${rows.join('')}</section>`;
}

function controls(slot, index, data, pokemon, legality, team, uiState = {}) {
  const buildContent = `<div class="slot-control-grid polished-slot-control-grid desktop-workbench-build-grid">
    <section class="build-editor-section ability-section polished-control-card"><div class="build-section-head"><h4>Ability</h4></div>${AbilitySelect(index, slot, data)}</section>
    <section class="build-editor-section item-section polished-control-card"><div class="build-section-head"><h4>Item</h4></div>${ItemSelect(index, slot, data, team, pokemon)}${itemConflictPanel(slot, index, data, team)}</section>
    <section class="build-editor-section nature-moves-section compact-moves-section polished-control-card"><div class="build-section-head"><h4>Moves</h4><span>Manual selection</span></div>${MoveSelectionList(index, slot, data)}</section>
  </div>`;
  const statsContent = statPanel(slot, index, data.indexes.statsByPokemon[pokemon.pokemon_id], pokemon);
  const buildSummary = currentBuildSummary(slot, index, data, pokemon);
  const spread = spreadAnalysisPanel(slot, index, data, pokemon, team);
  const role = strategicRolePanel(slot, index, pokemon, uiState, team, data);
  return `<div class="build-editor-shell polished-build-editor-shell team-slot-workbench-shell slot-ia-workspace">
    <div class="desktop-slot-workbench slot-ia-grid" aria-label="Expanded competitive build workbench">
      <section class="desktop-workbench-column desktop-workbench-left slot-zone slot-zone-build" aria-label="Build configuration">
        <div class="slot-zone-heading"><span>Build Configuration</span><em>How this Pokémon is built</em></div>
        ${buildSummary}
        ${buildContent}
      </section>
      <section class="desktop-workbench-column desktop-workbench-right slot-zone slot-zone-performance" aria-label="Performance and stats">
        <div class="slot-zone-heading"><span>Performance & Stats</span><em>What these stats accomplish</em></div>
        ${statsContent}
        ${spread}
      </section>
      <section class="desktop-workbench-column slot-zone slot-zone-context" aria-label="Team context">
        <div class="slot-zone-heading"><span>Team Context</span><em>What this Pokémon does for the team</em></div>
        ${role}
      </section>
    </div>
    <div class="mobile-slot-stack slot-ia-mobile-stack">
      <details class="mobile-slot-editor-section mobile-build-section" open><summary><span>Build</span><em>Ability, item, and moves</em></summary><div class="mobile-slot-section-body">${buildSummary}${buildContent}</div></details>
      <details class="mobile-slot-editor-section mobile-stats-section" open><summary><span>Stats + spread analysis</span><em>Numbers, nature, and tradeoffs</em></summary><div class="mobile-slot-section-body">${statsContent}${spread}</div></details>
      ${role}
    </div>
  </div>`;
}


const NATURE_EFFECTS = {
  Adamant: { up: 'Attack', down: 'Sp. Attack' }, Modest: { up: 'Sp. Attack', down: 'Attack' }, Jolly: { up: 'Speed', down: 'Sp. Attack' }, Timid: { up: 'Speed', down: 'Attack' },
  Bold: { up: 'Defense', down: 'Attack' }, Calm: { up: 'Sp. Defense', down: 'Attack' }, Impish: { up: 'Defense', down: 'Sp. Attack' }, Careful: { up: 'Sp. Defense', down: 'Sp. Attack' },
  Brave: { up: 'Attack', down: 'Speed' }, Quiet: { up: 'Sp. Attack', down: 'Speed' }, Relaxed: { up: 'Defense', down: 'Speed' }, Sassy: { up: 'Sp. Defense', down: 'Speed' },
  Naive: { up: 'Speed', down: 'Sp. Defense' }, Hasty: { up: 'Speed', down: 'Defense' }, Mild: { up: 'Sp. Attack', down: 'Defense' }, Rash: { up: 'Sp. Attack', down: 'Sp. Defense' },
  Lonely: { up: 'Attack', down: 'Defense' }, Naughty: { up: 'Attack', down: 'Sp. Defense' }, Lax: { up: 'Defense', down: 'Sp. Defense' }, Gentle: { up: 'Sp. Defense', down: 'Defense' },
  Hardy: null, Docile: null, Serious: null, Bashful: null, Quirky: null
};

const STANDARD_NATURE_HINTS = {
  scizor: { nature: 'Adamant', reason: 'most Technician Scizor sets care more about stronger Bullet Punch damage than trying to win Speed races' },
  milotic: { nature: 'Timid', reason: 'many offensive support Milotic sets like moving before opposing mid-speed threats for Icy Wind, Scald, or Recover timing' }
};

function spreadAnalysisPanel(slot, index, data, pokemon, team = []) {
  if (!pokemon) return '';
  const nature = slot?.nature || '';
  const allocation = getSlotStatAllocation(slot);
  const item = slot?.item_id ? data.indexes.itemsById?.[slot.item_id] : null;
  const standard = getStandardSpreadHint(pokemon);
  const role = inferSlotRole(slot, data, pokemon, allocation);
  const paragraphs = buildSpreadAnalysisCopy({ slot, data, pokemon, team, nature, allocation, item, standard, role });
  const chips = [
    role ? `Role: ${role}` : '',
    standard?.nature ? `Common nature: ${standard.nature}` : '',
    nature ? `Chosen: ${nature}` : 'Nature not selected'
  ].filter(Boolean);
  const labels = ['Nature impact', 'Why this fits the role', 'Tradeoffs', 'When to adjust'];
  return `<details class="spread-analysis-panel build-editor-section segmented-spread-analysis" data-spread-analysis-slot="${index}">
    <summary class="spread-analysis-summary"><span><i aria-hidden="true">◌</i><strong>Spread Analysis</strong><em>Plain-English nature and stat tradeoffs</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
    <div class="spread-analysis-chips">${chips.map((chip) => `<span>${escapeText(chip)}</span>`).join('')}</div>
    <div class="spread-analysis-blocks">
      ${paragraphs.map((line, blockIndex) => `<section class="spread-analysis-block"><h5>${escapeText(labels[blockIndex] || 'Coaching note')}</h5><p>${escapeText(line)}</p></section>`).join('')}
    </div>
  </details>`;
}

function buildSpreadAnalysisCopy({ slot, data, pokemon, team, nature, allocation, item, standard, role }) {
  const name = getPokemonDisplayName(pokemon);
  const effect = NATURE_EFFECTS[nature] || null;
  const lines = [];
  if (!nature) {
    lines.push(`${name} does not have a nature selected yet. Pick the nature that supports its job: Speed natures for moving first, Attack or Sp. Attack natures for damage, and defensive natures for staying on the field longer.`);
  } else if (effect) {
    lines.push(`${nature} nature boosts ${effect.up} and lowers ${effect.down}. For this slot, that means ${natureFitText(effect, role, allocation, slot, data)}.`);
  } else {
    lines.push(`${nature} is a neutral nature, so it does not push ${name} toward damage, bulk, or Speed. That is legal, but usually weaker than choosing a nature that supports this Pokémon's role.`);
  }

  if (standard?.nature && nature && standard.nature !== nature) {
    lines.push(`${nature} is a discussion point rather than an error: the more common competitive direction is ${standard.nature}. ${standard.reason || `That standard choice usually supports ${name}'s most common role more directly.`} The tradeoff is that your version gains ${effect?.up || 'a different focus'} but gives up some of what the standard spread is trying to maximise.`);
  } else if (standard?.nature && nature === standard.nature) {
    lines.push(`${nature} lines up with the common competitive direction for ${name}. ${standard.reason || 'That makes the spread easy to understand and consistent with the role most players expect.'}`);
  } else if (standard?.summary) {
    lines.push(`The database describes the standard spread as: ${standard.summary}`);
  } else {
    lines.push(`No exact standard spread is stored for ${name}, so treat this as a role check: the chosen nature should match the attacks, item, and stat points you are actually using.`);
  }

  const speedLine = speedTradeoffLine({ nature, standard, allocation, team, data, pokemon });
  if (speedLine) lines.push(speedLine);
  const itemLine = itemSpreadLine(item, pokemon, nature, standard);
  if (itemLine) lines.push(itemLine);
  return lines;
}

function natureFitText(effect, role, allocation, slot, data) {
  const moves = (slot?.moves || []).map((id) => data?.indexes?.movesById?.[id]).filter(Boolean);
  const damaging = moves.filter((move) => String(move.category || '').toLowerCase() !== 'status');
  const hasPhysical = damaging.some((move) => /physical/i.test(move.category || ''));
  const hasSpecial = damaging.some((move) => /special/i.test(move.category || ''));
  if (effect.up === 'Speed') return 'it is trying to move earlier, which fits fast attackers, disruption leads, and Pokémon that need to land support before taking a hit';
  if (effect.up === 'Attack') return hasPhysical ? 'its physical moves hit harder, so priority and contact attacks become more threatening' : 'it boosts physical damage, but this set does not currently show many physical attacks to use that boost';
  if (effect.up === 'Sp. Attack') return hasSpecial ? 'its special attacks hit harder, so moves like spread damage, Water/Ice pressure, or special coverage become more punishing' : 'it boosts special damage, but this set does not currently show many special attacks to use that boost';
  if (effect.up === 'Defense' || effect.up === 'Sp. Defense') return `it leans into staying power, which fits ${role && /support|bulky|defensive/i.test(role) ? role.toLowerCase() : 'bulkier board-control roles'}`;
  return `it pushes the build toward ${role || 'a specific role'}`;
}

function getStandardSpreadHint(pokemon) {
  const key = normalizeKey(pokemon?.name || pokemon?.base_species || '');
  if (STANDARD_NATURE_HINTS[key]) return STANDARD_NATURE_HINTS[key];
  const common = pokemon?.commonBuilds;
  const builds = Array.isArray(common) ? common : Array.isArray(common?.builds) ? common.builds : [];
  const build = builds.find((entry) => Array.isArray(entry.natureOptions) && entry.natureOptions.length) || builds[0] || null;
  if (!build) return null;
  const nature = build.primaryNature || build.nature || (Array.isArray(build.natureOptions) ? build.natureOptions[0] : '');
  const summary = build.evSpreadStyle || build.spreadStyle || build.strategicIdentity || build.name || '';
  const reason = build.strategicIdentity || build.analyzerMeaning || build.analyserMeaning || '';
  return { nature, summary, reason };
}

function inferSlotRole(slot, data, pokemon, allocation) {
  const moves = (slot?.moves || []).map((id) => data?.indexes?.movesById?.[id]).filter(Boolean);
  const names = moves.map((move) => String(move.name || '').toLowerCase()).join(' ');
  const categories = moves.map((move) => String(move.category || '').toLowerCase());
  const hasSupport = /protect|tailwind|icy wind|aurora veil|reflect|light screen|taunt|haze|recover|parting shot|fake out|follow me|rage powder|wide guard/.test(names) || categories.filter((cat) => cat === 'status').length >= 2;
  const physical = categories.filter((cat) => cat === 'physical').length + ((allocation.attack || 0) >= 20 ? 1 : 0);
  const special = categories.filter((cat) => cat === 'special').length + ((allocation.specialAttack || 0) >= 20 ? 1 : 0);
  const bulky = (allocation.hp || 0) + (allocation.defense || 0) + (allocation.specialDefense || 0) >= 32;
  const fast = (allocation.speed || 0) >= 20;
  if (hasSupport && fast) return 'fast support';
  if (hasSupport && bulky) return 'bulky support';
  if (physical > special && fast) return 'fast Attack pressure';
  if (special > physical && fast) return 'fast Sp. Attack pressure';
  if (physical > special) return 'Attack pressure';
  if (special > physical) return 'Sp. Attack pressure';
  if (bulky) return 'defensive pivot';
  return 'flex role';
}

function speedTradeoffLine({ nature, standard, allocation, team, data, pokemon }) {
  const speedInvested = (allocation.speed || 0) >= 20;
  const chosenSpeed = ['Jolly','Timid','Naive','Hasty'].includes(nature);
  const standardSpeed = ['Jolly','Timid','Naive','Hasty'].includes(standard?.nature || '');
  const teamSpeedControl = (team || []).some((slot) => (slot?.moves || []).some((id) => /tailwind|icy wind|trick room|electroweb|thunder wave|aurora veil/i.test(data?.indexes?.movesById?.[id]?.name || '')));
  if (standardSpeed && !chosenSpeed) {
    return `The main cost is Speed. Compared with ${standard.nature}, this build may let some opposing mid-speed Pokémon move first. That can be fine when the team already has speed control${teamSpeedControl ? ', which this team appears to have' : ''}, but it is worth watching in practice.`;
  }
  if (chosenSpeed && !standardSpeed) {
    return `The upside is earlier movement. The cost is usually damage or bulk, so this is best when moving first matters more than squeezing out maximum damage.`;
  }
  if (speedInvested && !chosenSpeed) {
    return `You have invested in Speed without a Speed-boosting nature. That is not wrong, but it means the build is partly fast rather than fully committed to winning Speed checks.`;
  }
  return '';
}

function itemSpreadLine(item, pokemon, nature, standard) {
  const itemName = item?.name || '';
  const mon = normalizeKey(pokemon?.name || '');
  if (/king'?s rock/i.test(itemName)) {
    return `${itemName} points the build toward flinch pressure rather than pure consistency. On multi-hit or priority users this can be defensible, but a damage item or safer utility item is usually the more standard competitive choice.`;
  }
  if (/sitrus berry|leftovers/i.test(itemName)) {
    return `${itemName} supports staying on the board longer, so slower or bulkier natures become easier to justify if this Pokémon is meant to stabilise rather than sweep immediately.`;
  }
  if (/life orb|choice specs|choice band|expert belt|muscle band|wise glasses/i.test(itemName)) {
    return `${itemName} reinforces the damage plan, so a damage-boosting nature is easier to justify than a purely defensive one.`;
  }
  return '';
}


function strategicRolePanel(slot, index, pokemon, uiState = {}, team = [], data = {}) {
  const strengths = pokemon?.strategicStrengths || {};
  const contextualRole = buildContextualStrategicRole(slot, index, pokemon, team, data);
  const coreStrengths = contextualRole.coreStrengths.length ? contextualRole.coreStrengths : compactStrategicList(strengths.coreStrengths, 3);
  const pressureTypes = buildSpecificPressureTags(slot, pokemon, data, 4);
  const fallbackBoardStates = compactStrategicList(strengths.preferredBoardStates, 3);
  const preferredBoardStates = auditThrivesWhenText(contextualRole.thrivesWhen, fallbackBoardStates, slot, index, pokemon, team, data);
  const supportRequirements = contextualRole.supportRequirements.length ? contextualRole.supportRequirements : compactStrategicList(strengths.supportRequirements, 3);
  const endgame = contextualRole.footer || firstText(strengths.endgamePatterns || strengths.conversionPatterns);
  const hasAny = coreStrengths.length || pressureTypes.length || preferredBoardStates.length || supportRequirements.length || endgame;
  const open = uiState?.strategicRoleOpen === true;
  const fullAnalysisLabel = pokemon ? `View full ${getPokemonDisplayName(pokemon)} analysis` : 'View full analysis';

  if (!hasAny) {
    return `<details class="strategic-role-panel build-editor-section" data-strategic-role-slot="${index}" ${open ? 'open' : ''}>
      <summary class="strategic-role-summary"><span class="strategic-role-title"><i aria-hidden="true">◇</i><strong>Strategic Role</strong><em>How this Pokémon contributes to the team</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
      <p class="notice strategic-role-empty">Strategic role data is sparse for this entry.</p>
    </details>`;
  }

  return `<details class="strategic-role-panel build-editor-section" data-strategic-role-slot="${index}" ${open ? 'open' : ''}>
    <summary class="strategic-role-summary"><span class="strategic-role-title"><i aria-hidden="true">◇</i><strong>Strategic Role</strong><em>How this Pokémon contributes to the team</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
    <div class="strategic-role-grid">
      ${strategicRoleBlock('✦', 'Core strengths', coreStrengths, contextualRole.coreStrengths.length ? 'text' : 'tag')}
      ${strategicRoleBlock('▣', 'Pressures', pressureTypes, 'pressure')}
      ${strategicRoleBlock('□', 'Thrives when', preferredBoardStates, 'text')}
      ${strategicRoleBlock('♔', 'Needs from team', supportRequirements, 'text')}
    </div>
    <div class="strategic-role-footer">
      ${endgame ? `<span>${escapeText(shortStrategicPhrase(endgame))}</span>` : '<span>Pick this slot for role fit, not only raw stats.</span>'}
      <button type="button" class="strategic-analysis-link" data-nav="metadex" aria-label="${escapeText(fullAnalysisLabel)}">View full analysis →</button>
    </div>
  </details>`;
}




const PRESSURE_SHAPE_MOVES = {
  spread: new Set(['Earthquake','Rock Slide','Blizzard','Heat Wave','Dazzling Gleam','Hyper Voice','Surf','Muddy Water','Discharge','Electroweb','Icy Wind','Snarl','Eruption','Water Spout','Make It Rain','Lava Plume','Sludge Wave','Razor Leaf']),
  setup: new Set(['Swords Dance','Nasty Plot','Calm Mind','Dragon Dance','Quiver Dance','Bulk Up','Iron Defense','Coil','Shell Smash','Belly Drum','Growth','Tailwind','Trick Room','Aurora Veil','Reflect','Light Screen']),
  chip: new Set(['Will-O-Wisp','Toxic','Leech Seed','Salt Cure','Sand Tomb','Fire Spin','Whirlpool','Infestation','Stealth Rock','Spikes','Toxic Spikes','Sandstorm','Hail','G-Max Wildfire']),
  switchForcing: new Set(['Roar','Whirlwind','Dragon Tail','Circle Throw','Parting Shot','Yawn','Encore','Taunt'])
};
const STAB_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

export function buildSpecificPressureTags(slot, pokemon, data = {}, limit = 4) {
  if (!slot || !pokemon) return [];
  const tags = [];
  const seen = new Set();
  const add = (label, priority = 5) => {
    const clean = String(label || '').replace(/\s+/g, ' ').trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    tags.push({ label: clean, priority });
  };
  const moves = (slot.moves || [])
    .map((moveId) => data?.indexes?.movesById?.[moveId] || null)
    .filter(Boolean);

  moves.forEach((move) => {
    const type = STAB_TYPES.includes(move.type) ? move.type : '';
    const category = String(move.category || '').toLowerCase();
    const name = move.name || move.move_name || '';
    const power = Number(move.power || 0);
    const priority = Number(move.priority || 0);
    const lower = name.toLowerCase();
    if (/last respects|rage fist|stored power|power trip|supreme overlord/.test(lower)) {
      add(`${type || 'Endgame'} (scaling)`, 1);
      return;
    }
    if (priority > 0 && type) {
      add(`${type} (priority)`, 2);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.spread.has(name) && type) {
      add(`${type} (spread)`, 2);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.setup.has(name)) {
      add(type ? `${type} (setup)` : 'setup', 3);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.chip.has(name)) {
      add(type ? `${type} (chip)` : 'chip', 3);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.switchForcing.has(name)) {
      add('switch-forcing', 3);
      return;
    }
    if (category === 'status') {
      add(type ? `${type} (status)` : 'status', 4);
      return;
    }
    if (type && power > 0) add(`${type} (single-target)`, 4);
  });

  const ability = normalizeKey(slot.ability || '');
  if (/chlorophyll|swiftswim|slushrush|sandrush|unburden|protosynthesis|quarkdrive/.test(ability)) add('setup/speed-scaling', 2);
  if (/intimidate/.test(ability)) add('Attack control (status)', 3);
  if (/lightningrod|stormdrain|flashfire|sapsipper|levitate/.test(ability)) add('defensive redirection', 3);
  if (/supremeoverlord|commander|costar/.test(ability)) add('endgame (scaling)', 1);

  const typeFallbacks = pokemonTypes(pokemon).filter(Boolean);
  typeFallbacks.forEach((type) => {
    if (tags.length < 2) add(`${type} (single-target)`, 8);
  });
  return tags.sort((a, b) => a.priority - b.priority).slice(0, limit).map((entry) => entry.label);
}

export function buildTeamPressureCoverageSummary(team = [], data = {}) {
  const members = (team || []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null;
    return pokemon ? { slot, pokemon, index, name: getPokemonDisplayName(pokemon), tags: buildSpecificPressureTags(slot, pokemon, data, 4) } : null;
  }).filter(Boolean);
  if (!members.length) return '';
  const typeMap = new Map();
  const shapeMap = new Map();
  members.forEach((member) => {
    member.tags.forEach((tag) => {
      const match = tag.match(/^([A-Za-z]+) \(([^)]+)\)$/);
      if (match && STAB_TYPES.includes(match[1])) {
        const [, type, shape] = match;
        if (!typeMap.has(type)) typeMap.set(type, new Set());
        typeMap.get(type).add(member.name);
        if (!shapeMap.has(shape)) shapeMap.set(shape, new Set());
        shapeMap.get(shape).add(member.name);
      } else if (/switch-forcing|setup|scaling|priority|chip|status/i.test(tag)) {
        const shape = tag.includes('(') ? tag.replace(/^.*\(([^)]+)\).*$/, '$1') : tag;
        if (!shapeMap.has(shape)) shapeMap.set(shape, new Set());
        shapeMap.get(shape).add(member.name);
      }
    });
  });
  const coveredTypes = [...typeMap.keys()];
  const coveredText = coveredTypes.length
    ? coveredTypes.map((type) => `${type} (${[...typeMap.get(type)].slice(0, 3).join(', ')})`).join(', ')
    : 'very little confirmed attacking coverage yet';
  const shapes = [...shapeMap.entries()].map(([shape, names]) => `${shape} pressure from ${[...names].slice(0, 3).join(', ')}`).slice(0, 4).join('; ');
  const missing = STAB_TYPES.filter((type) => !typeMap.has(type));
  const gapNotes = [];
  const has = (type) => typeMap.has(type);
  if (!has('Electric') && !has('Grass')) gapNotes.push('bulky Water-types can be awkward because the team lacks clear Electric or Grass damage into them');
  if (!has('Fire') && !has('Ground') && !has('Fighting')) gapNotes.push('bulky Steel-types can sit in front of you because Fire, Ground, and Fighting are the cleanest ways to punish them');
  if (!has('Ice') && !has('Fairy') && !has('Dragon')) gapNotes.push('Dragon-types may be harder to remove quickly because you are missing the usual anti-Dragon coverage');
  if (!has('Dark') && !has('Ghost')) gapNotes.push('Psychic- and Ghost-type opponents may get more freedom because you lack Dark or Ghost pressure');
  if (!has('Rock') && !has('Electric') && !has('Ice')) gapNotes.push('Flying-types can be annoying if they resist your main damage because Rock, Electric, and Ice are the common answers');
  const gapText = gapNotes.length
    ? gapNotes.slice(0, 2).join('. ') + '.'
    : missing.length ? `No obvious major attacking gap from the selected moves, but you currently lack ${missing.slice(0, 4).join(', ')} coverage.` : 'Your selected attacks cover every major type at least once.';
  return `<section class="team-pressure-coverage-summary"><strong>Pressure coverage</strong><p>Your team currently shows ${coveredText}. ${shapes ? `The main pressure shapes are ${shapes}. ` : ''}${gapText}</p></section>`;
}

function auditThrivesWhenText(contextualValues = [], fallbackValues = [], slot, index, pokemon, team = [], data = {}) {
  const currentValues = (contextualValues || []).filter(Boolean);
  const fallback = (fallbackValues || []).filter(Boolean);
  const candidate = currentValues.length ? currentValues : fallback;
  const hasGeneric = candidate.some(isGenericThrivesWhenText);
  const tooThin = !candidate.length || candidate.every((value) => String(value).length < 46 || /^[-\w\s]+$/.test(String(value)) && String(value).split(/\s+/).length <= 5);
  if (!hasGeneric && !tooThin && currentValues.length) return currentValues.slice(0, 3);
  const specific = buildSpecificThrivesWhen(slot, index, pokemon, team, data);
  if (specific.length) return specific.slice(0, 3);
  return candidate.filter((value) => !isGenericThrivesWhenText(value)).slice(0, 3);
}

function isGenericThrivesWhenText(value) {
  const text = String(value || '').toLowerCase();
  if (!text.trim()) return true;
  return /current battle situations|main pressure is protected|positions where partner support covers immediate weaknesses|offensive neutral states|hyper offense boards|fast tempo openings|neutral positioning|partner protection|intended board states|safe board states|generic pressure|stable positioning/.test(text);
}

function buildSpecificThrivesWhen(slot, index, pokemon, team = [], data = {}) {
  if (!slot || !pokemon) return [];
  const context = buildTeamSynergyContext(team, data, index);
  const current = context.current;
  if (!current) return [];
  const name = current.name || getPokemonDisplayName(pokemon);
  const abilityKey = normalizeKey(current.ability);
  const itemKey = normalizeKey(current.item);
  const moveText = current.moves.join(' | ').toLowerCase();
  const lines = [];
  const add = (value) => { if (value && !lines.includes(value)) lines.push(value); };

  const weatherPartner = findWeatherPartnerForAbility(abilityKey, context.weatherSetters.filter((entry) => entry.index !== index));
  if (weatherPartner) {
    const setterSupport = describeWeatherSupport(weatherPartner, current, context);
    add(`Early game — lead or switch ${name} next to ${weatherPartner.name}. ${weatherPartner.name} sets ${weatherPartner.weather} automatically with ${weatherPartner.ability}, so ${setterSupport}`);
  }

  const ownWeather = context.weatherSetters.find((entry) => entry.index === index);
  if (ownWeather) {
    const beneficiaries = context.allies.filter((ally) => abilityBenefitsFromWeather(normalizeKey(ally.ability), ownWeather.weather));
    const veilUsers = [current, ...context.allies].filter((entry) => entry.moves.some((move) => /aurora veil/i.test(move)));
    if (beneficiaries.length) add(`Early game — bring ${name} in before ${listNames(beneficiaries)}. ${name}'s ${ownWeather.ability} starts ${ownWeather.weather}, which immediately turns ${listNames(beneficiaries)} into faster or safer attackers.`);
    if (veilUsers.length && ownWeather.weather === 'snow') add(`Early game — use ${name}'s snow turns to help ${listNames(veilUsers)} set Aurora Veil, cutting incoming damage while the rest of the team gets into position.`);
  }

  const tailwindUser = context.speedControl.find((entry) => entry.index !== index && /tailwind/i.test(entry.move));
  const icyWindUser = context.speedControl.find((entry) => entry.index !== index && /icy wind/i.test(entry.move));
  const trickRoomUser = context.speedControl.find((entry) => entry.index !== index && /trick room/i.test(entry.move));
  const hasFakeOut = /fake out/i.test(moveText);
  if (hasFakeOut && tailwindUser) {
    add(`Turn 1 — pair ${name} with ${tailwindUser.name}. Use Fake Out to flinch the opponent's biggest threat, which gives ${tailwindUser.name} a safer turn to set Tailwind.`);
  }
  if (tailwindUser && !hasFakeOut && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — bring ${name} in after ${tailwindUser.name} sets Tailwind. Tailwind doubles your team's Speed for a few turns, giving ${name} a cleaner window to attack before the opponent.`);
  }
  if (icyWindUser && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — ${name} likes coming in after ${icyWindUser.name} uses Icy Wind, because the opponent is slowed down and easier to outspeed.`);
  }
  if (trickRoomUser && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — use ${name} after ${trickRoomUser.name} sets Trick Room only if moving under reversed turn order helps this slot attack before faster threats.`);
  }

  const fakeOutAlly = context.fakeOut.find((entry) => entry.index !== index);
  if (fakeOutAlly && likesProtectedTurns(current, pokemon)) {
    add(`Early game — put ${name} beside ${fakeOutAlly.name}. ${fakeOutAlly.name}'s Fake Out buys one safer turn for ${name} to attack, set up, or reposition without taking full pressure.`);
  }

  if (abilityKey === 'unburden') {
    const itemPhrase = itemKey ? `once its ${current.item} is used` : 'once its held item is used';
    add(`After setup — ${name}'s Unburden doubles its Speed ${itemPhrase}, so use that speed boost to start sweeping before the opponent can respond.`);
  }

  const defensiveAbsorb = TYPE_ABSORBING_ABILITIES[abilityKey];
  if (defensiveAbsorb) {
    const protectedAllies = context.allies.filter((ally) => isWeakToType(ally.pokemon, defensiveAbsorb.type));
    if (protectedAllies.length) add(`Mid game — switch ${name} in when ${listNames(protectedAllies)} is likely to be targeted by ${defensiveAbsorb.type} attacks. ${current.ability} redirects that damage and can turn the opponent's move into free value.`);
  }
  const allyAbsorbers = context.allies.filter((ally) => TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)] && isWeakToType(pokemon, TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)].type));
  if (allyAbsorbers.length) {
    const absorber = allyAbsorbers[0];
    const absorb = TYPE_ABSORBING_ABILITIES[normalizeKey(absorber.ability)];
    add(`Mid game — keep ${absorber.name} ready to switch in when opponents aim ${absorb.type} attacks at ${name}. ${absorber.ability} absorbs that pressure so ${name} can stay useful longer.`);
  }

  const redirector = context.redirection.find((entry) => entry.index !== index);
  if (redirector && likesProtectedTurns(current, pokemon)) {
    add(`Setup turn — place ${name} beside ${redirector.name}. ${redirector.name}'s ${redirector.move} pulls attacks away, giving ${name} the breathing room to convert its main job.`);
  }

  if (/last respects/i.test(moveText)) {
    const earlyUtility = context.allies.filter((ally) => ally.moves.some((move) => /fake out|tailwind|icy wind|aurora veil|parting shot|taunt/i.test(move)) || normalizeKey(ally.ability) === 'intimidate').slice(0, 3);
    const feederText = earlyUtility.length ? `${listNames(earlyUtility)} can spend the early turns using utility, taking trades, and chipping opponents` : 'your other five Pokémon can take early trades and chip opponents';
    add(`Endgame — save ${name} until 2–3 teammates have fainted. Last Respects gets stronger each time an ally goes down, so ${feederText} before ${name} cleans up.`);
  }

  if (/misty explosion/i.test(moveText)) {
    const cleaner = context.allies.find((ally) => ally.moves.some((move) => /last respects|close combat|blizzard|shadow ball|dire claw|liquidation/i.test(move)));
    add(`Mid to late game — use Misty Explosion only when ${cleaner ? `${cleaner.name} can switch in afterwards and finish the weakened board` : 'a teammate can enter afterwards and finish the weakened board'}. The sacrifice is valuable because it creates the next attack window.`);
  }

  if (hasFakeOut && !lines.some((line) => /Late game/.test(line))) {
    add(`Late game — ${name}'s Fake Out is strongest when you need one final safe turn, either to stop a threat from moving or to let a partner finish the match.`);
  }

  if (!lines.length && context.allies.length) {
    const support = context.speedControl.find((entry) => entry.index !== index) || context.fakeOut.find((entry) => entry.index !== index) || context.intimidate.find((entry) => entry.index !== index) || context.weatherSetters.find((entry) => entry.index !== index);
    if (support) add(`Mid game — use ${name} after ${support.name} has created support for the team. That gives beginners a clear rule: let ${support.name} create the safer board first, then bring ${name} in to do its main job.`);
  }
  return lines;
}

function describeWeatherSupport(weatherPartner, current, context = {}) {
  const name = current.name;
  const abilityKey = normalizeKey(current.ability);
  const moves = current.moves.join(' | ').toLowerCase();
  const partnerMoves = weatherPartner.moves.join(' | ').toLowerCase();
  if (abilityKey === 'chlorophyll') return `${name}'s Chlorophyll doubles its Speed and turns it into a fast sun win condition.`;
  if (abilityKey === 'swiftswim') return `${name}'s Swift Swim doubles its Speed and lets it attack before most opponents in rain.`;
  if (abilityKey === 'slushrush') return `${name}'s Slush Rush doubles its Speed and lets it clean while snow is active.`;
  if (abilityKey === 'sandrush') return `${name}'s Sand Rush doubles its Speed and gives the team a fast sand mode.`;
  if (/blizzard/i.test(moves) && weatherPartner.weather === 'snow') {
    const veilNote = /aurora veil/i.test(moves) || /aurora veil/i.test(partnerMoves) ? ' Aurora Veil also cuts incoming damage, giving the team a safer opening.' : '';
    return `${name}'s Blizzard becomes 100% accurate in snow.${veilNote}`;
  }
  if (weatherPartner.weather === 'snow' && abilityKey === 'snowcloak') return `${name}'s Snow Cloak is active and its Ice pressure is easier to support while snow is up.`;
  return `${name}'s weather-based ability is active immediately instead of being only conditional.`;
}

function buildContextualStrategicRole(slot, index, pokemon, team = [], data = {}) {
  if (!slot || !pokemon) return { coreStrengths: [], pressures: [], thrivesWhen: [], supportRequirements: [], footer: '' };
  const context = buildTeamSynergyContext(team, data, index);
  const current = context.current;
  const allies = context.allies;
  const name = current?.name || getPokemonDisplayName(pokemon);
  const ability = current?.ability || '';
  const moves = current?.moves || [];
  const moveText = moves.join(' | ').toLowerCase();
  const abilityKey = normalizeKey(ability);
  const coreStrengths = [];
  const pressures = [];
  const thrivesWhen = [];
  const supportRequirements = [];
  const footerNotes = [];
  const add = (target, value) => { if (value && !target.includes(value)) target.push(value); };
  const weatherPartner = findWeatherPartnerForAbility(abilityKey, context.weatherSetters);

  if (weatherPartner) {
    add(coreStrengths, `${name}'s ${ability} ability becomes active because ${weatherPartner.name} sets ${weatherPartner.weather} automatically with ${weatherPartner.ability}.`);
    if (abilityKey === 'chlorophyll') add(pressures, `${name}'s Speed doubles in sun, so ${weatherPartner.name} turns it from a conditional threat into an immediate fast attacker.`);
    else if (abilityKey === 'swiftswim') add(pressures, `${name}'s Speed doubles in rain, letting it pressure opponents before most neutral-speed attackers can move.`);
    else if (abilityKey === 'slushrush') add(pressures, `${name}'s Speed doubles in snow, making it a primary cleaner while ${weatherPartner.name}'s weather is active.`);
    else if (abilityKey === 'sandrush') add(pressures, `${name}'s Speed doubles in sand, giving the team a fast offensive mode instead of a purely defensive weather plan.`);
    else add(pressures, `${name} gains its weather-based value immediately when ${weatherPartner.name} is on the field.`);
    add(thrivesWhen, `Lead or pivot ${name} next to ${weatherPartner.name} when you want the weather mode online straight away.`);
  }

  const weatherSetter = context.weatherSetters.find((entry) => entry.index === index);
  if (weatherSetter) {
    const beneficiaries = allies.filter((ally) => abilityBenefitsFromWeather(normalizeKey(ally.ability), weatherSetter.weather));
    if (beneficiaries.length) {
      add(coreStrengths, `${name} sets ${weatherSetter.weather} automatically with ${weatherSetter.ability}, activating ${listNames(beneficiaries)} without spending a turn.`);
      add(pressures, `Your ${weatherSetter.weather} mode makes ${listNames(beneficiaries)} much harder to outspeed or trade with.`);
      add(thrivesWhen, `${name} gets the most value when it enters before ${listNames(beneficiaries)}, so the boosted partner can attack immediately.`);
    }
  }

  const defensiveAbsorb = TYPE_ABSORBING_ABILITIES[abilityKey];
  if (defensiveAbsorb) {
    const protectedAllies = allies.filter((ally) => isWeakToType(ally.pokemon, defensiveAbsorb.type));
    if (protectedAllies.length) {
      add(coreStrengths, `${name}'s ${ability} draws in ${defensiveAbsorb.type} attacks aimed at the team and turns a weakness into an advantage.`);
      add(pressures, `This is especially important for protecting ${listNames(protectedAllies)}, which dislike taking ${defensiveAbsorb.type} damage.`);
      const boostText = defensiveAbsorb.boost ? ` and can give ${name} ${defensiveAbsorb.boost}` : '';
      add(thrivesWhen, `Switch ${name} in when you expect ${defensiveAbsorb.type} coverage${boostText}.`);
    }
  }

  const allyAbsorbers = allies.filter((ally) => TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)] && isWeakToType(pokemon, TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)].type));
  if (allyAbsorbers.length) {
    const absorber = allyAbsorbers[0];
    const absorb = TYPE_ABSORBING_ABILITIES[normalizeKey(absorber.ability)];
    add(coreStrengths, `${name} can play more aggressively because ${absorber.name}'s ${absorber.ability} protects it from ${absorb.type} attacks.`);
    add(thrivesWhen, `Keep ${absorber.name} available as a pivot when opponents are likely to target ${name}'s ${absorb.type} weakness.`);
  }

  if (context.speedControl.length) {
    const relevant = context.speedControl.filter((entry) => entry.index !== index);
    if (relevant.length && wantsSpeedSupport(current, pokemon)) {
      add(coreStrengths, `${name} benefits from team speed control from ${listNames(relevant)}, giving it safer attack windows.`);
      add(thrivesWhen, `Bring ${name} in after ${relevant[0].move} has slowed or reversed the board so it can move before key threats.`);
    }
  }

  if (context.fakeOut.length && !context.fakeOut.some((entry) => entry.index === index)) {
    const fakeOutUser = context.fakeOut[0];
    if (likesProtectedTurns(current, pokemon)) {
      add(coreStrengths, `${fakeOutUser.name}'s Fake Out can buy ${name} a safe first turn to attack, set up, or reposition.`);
      add(thrivesWhen, `${name} is strongest beside ${fakeOutUser.name} on turns where Fake Out stops the opponent's most dangerous action.`);
    }
  } else if (context.fakeOut.some((entry) => entry.index === index)) {
    const setupPartners = allies.filter((ally) => likesProtectedTurns(ally, ally.pokemon)).slice(0, 2);
    if (setupPartners.length) {
      add(coreStrengths, `${name}'s Fake Out creates a free turn for ${listNames(setupPartners)} to set up or take a safer attack.`);
      add(pressures, `Opponents have to respect Fake Out before they can freely target ${listNames(setupPartners)}.`);
    }
  }

  if (context.redirection.length && !context.redirection.some((entry) => entry.index === index) && likesProtectedTurns(current, pokemon)) {
    const redirector = context.redirection[0];
    add(coreStrengths, `${redirector.name}'s ${redirector.move} can pull attacks away from ${name}, giving it a cleaner turn to convert pressure.`);
    add(thrivesWhen, `Position ${name} beside ${redirector.name} when you need to protect a setup, weather, or cleanup turn.`);
  }

  if (context.intimidate.length) {
    if (context.intimidate.some((entry) => entry.index === index)) {
      const physicalPartners = allies.filter((ally) => isPhysicallyVulnerable(ally.pokemon)).slice(0, 2);
      add(coreStrengths, `${name}'s Intimidate lowers opposing Attack as soon as it enters, making trades safer for the whole team.`);
      if (physicalPartners.length) add(pressures, `That Attack drop helps ${listNames(physicalPartners)} survive physical pressure long enough to do their job.`);
    } else if (isPhysicallyVulnerable(pokemon)) {
      const intimidator = context.intimidate[0];
      add(thrivesWhen, `${name} appreciates ${intimidator.name}'s Intimidate support because it softens physical threats before they can force a KO.`);
    }
  }

  if (/last respects/i.test(moveText)) {
    add(coreStrengths, `${name}'s Last Respects gets stronger every time one of your teammates faints.`);
    add(pressures, `This makes ${name} a late-game finisher rather than an early damage dealer; every traded support Pokémon feeds its cleanup damage.`);
    add(thrivesWhen, `Bring ${name} in once 2–3 teammates are down so Last Respects can threaten a massive cleanup.`);
    add(supportRequirements, `Let utility partners chip, Fake Out, set weather, or control speed early instead of preserving them at all costs.`);
    footerNotes.push('Scaling win condition: teammate KOs increase cleanup power.');
  }

  if (/misty explosion/i.test(moveText)) {
    add(coreStrengths, `${name} can use Misty Explosion as a sacrificial momentum tool, trading itself to open a safer board for the next damage dealer.`);
    add(pressures, `Plan the follow-up slot before using Misty Explosion so the team converts the sacrifice instead of only taking chip damage.`);
    add(thrivesWhen, `${name} thrives when a teammate is ready to enter immediately after the sacrifice and take over the endgame.`);
    footerNotes.push('Sacrificial setup: value comes from the teammate that enters next.');
  }

  const scalingAlly = allies.find((ally) => ally.moves.some((move) => /last respects/i.test(move)) || /supremeoverlord|commander|costar/.test(normalizeKey(ally.ability)));
  if (scalingAlly && !/last respects/i.test(moveText)) {
    add(coreStrengths, `${name}'s early job can be to create chip, tempo, or trades that feed ${scalingAlly.name}'s scaling win condition.`);
    add(thrivesWhen, `Do not over-preserve ${name} if trading it helps ${scalingAlly.name} enter later with stronger cleanup pressure.`);
  }

  return {
    coreStrengths: coreStrengths.slice(0, 3),
    pressures: pressures.slice(0, 3),
    thrivesWhen: thrivesWhen.slice(0, 3),
    supportRequirements: supportRequirements.slice(0, 2),
    footer: footerNotes[0] || ''
  };
}

const WEATHER_SETTER_ABILITIES = {
  drought: 'sun',
  drizzle: 'rain',
  snowwarning: 'snow',
  sandstream: 'sand'
};

const TYPE_ABSORBING_ABILITIES = {
  lightningrod: { type: 'Electric', boost: 'a Special Attack boost' },
  stormdrain: { type: 'Water', boost: 'a Special Attack boost' },
  flashfire: { type: 'Fire', boost: 'stronger Fire attacks' },
  levitate: { type: 'Ground', boost: '' },
  sapsipper: { type: 'Grass', boost: 'an Attack boost' }
};

const TYPE_WEAKNESSES = {
  Normal: ['Fighting'], Fire: ['Water', 'Ground', 'Rock'], Water: ['Electric', 'Grass'], Electric: ['Ground'], Grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'], Ice: ['Fire', 'Fighting', 'Rock', 'Steel'], Fighting: ['Flying', 'Psychic', 'Fairy'], Poison: ['Ground', 'Psychic'], Ground: ['Water', 'Grass', 'Ice'], Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'], Bug: ['Fire', 'Flying', 'Rock'], Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'], Ghost: ['Ghost', 'Dark'], Dragon: ['Ice', 'Dragon', 'Fairy'], Dark: ['Fighting', 'Bug', 'Fairy'], Steel: ['Fire', 'Fighting', 'Ground'], Fairy: ['Poison', 'Steel']
};

function buildTeamSynergyContext(team = [], data = {}, currentIndex = 0) {
  const slots = (team || []).map((teamSlot, slotIndex) => buildSlotSynergyProfile(teamSlot, slotIndex, data)).filter(Boolean);
  const current = slots.find((entry) => entry.index === currentIndex) || null;
  const allies = slots.filter((entry) => entry.index !== currentIndex);
  return {
    slots,
    current,
    allies,
    weatherSetters: slots.filter((entry) => WEATHER_SETTER_ABILITIES[normalizeKey(entry.ability)]).map((entry) => ({ ...entry, weather: WEATHER_SETTER_ABILITIES[normalizeKey(entry.ability)] })),
    speedControl: slots.flatMap((entry) => entry.moves.filter((move) => /tailwind|trick room|icy wind/i.test(move)).map((move) => ({ ...entry, move }))),
    intimidate: slots.filter((entry) => normalizeKey(entry.ability) === 'intimidate'),
    redirection: slots.flatMap((entry) => entry.moves.filter((move) => /follow me|rage powder/i.test(move)).map((move) => ({ ...entry, move }))),
    fakeOut: slots.flatMap((entry) => entry.moves.filter((move) => /fake out/i.test(move)).map((move) => ({ ...entry, move })))
  };
}

function buildSlotSynergyProfile(teamSlot, index, data = {}) {
  if (!teamSlot?.pokemon_id) return null;
  const pokemon = data.indexes?.pokemonById?.[teamSlot.pokemon_id];
  if (!pokemon) return null;
  const ability = teamSlot.ability_id ? getReadableAbilityName(data.indexes?.abilitiesById?.[teamSlot.ability_id] || teamSlot.ability_id, '') : '';
  const moves = (teamSlot.moves || []).map((moveId) => getReadableMoveName(data.indexes?.movesById?.[moveId] || moveId, '')).filter(Boolean);
  const item = teamSlot.item_id ? getReadableItemName(data.indexes?.itemsById?.[teamSlot.item_id] || teamSlot.item_id, '') : '';
  return { index, slot: teamSlot, pokemon, name: getPokemonDisplayName(pokemon), ability, moves, item };
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findWeatherPartnerForAbility(abilityKey, weatherSetters = []) {
  const requiredWeather = { chlorophyll: 'sun', solarpower: 'sun', harvest: 'sun', swiftswim: 'rain', raindish: 'rain', dryskin: 'rain', slushrush: 'snow', snowcloak: 'snow', icebody: 'snow', sandrush: 'sand', sandforce: 'sand', sandveil: 'sand' }[abilityKey];
  return requiredWeather ? weatherSetters.find((setter) => setter.weather === requiredWeather) : null;
}

function abilityBenefitsFromWeather(abilityKey, weather) {
  const partner = findWeatherPartnerForAbility(abilityKey, [{ weather }]);
  return Boolean(partner);
}

function pokemonTypes(pokemon) {
  return [pokemon?.type_1, pokemon?.type_2, ...(pokemon?.types || []), ...String(pokemon?.typing || '').split(/[\/,]/)].map((type) => String(type || '').trim()).filter(Boolean).map((type) => type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
}

function isWeakToType(pokemon, attackType) {
  const target = String(attackType || '').toLowerCase();
  return pokemonTypes(pokemon).some((type) => (TYPE_WEAKNESSES[type] || []).some((weakness) => weakness.toLowerCase() === target));
}

function wantsSpeedSupport(profile, pokemon) {
  const text = `${profile?.moves?.join(' ') || ''} ${JSON.stringify(pokemon?.strategicStrengths || {})}`.toLowerCase();
  return /clean|pressure|setup|last respects|blizzard|eruption|water spout|speed|outspeed|tailwind|trick room/.test(text);
}

function likesProtectedTurns(profile, pokemon) {
  const text = `${profile?.moves?.join(' ') || ''} ${profile?.ability || ''} ${JSON.stringify(pokemon?.strategicStrengths || {})}`.toLowerCase();
  return /swords dance|nasty plot|dragon dance|calm mind|quiver dance|shell smash|belly drum|last respects|trick room|tailwind|weather|clean|setup|protect/.test(text);
}

function isPhysicallyVulnerable(pokemon) {
  const text = JSON.stringify(pokemon?.strategicStrengths || {}).toLowerCase();
  return /physical|contact|intimidate|bulk|survive|chip|priority/.test(text) || pokemonTypes(pokemon).some((type) => ['Ice', 'Rock', 'Dark', 'Normal'].includes(type));
}

function listNames(entries = []) {
  const names = entries.map((entry) => entry.name).filter(Boolean);
  if (names.length <= 1) return names[0] || 'that partner';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function strategicRoleBlock(icon, title, values, mode = 'text') {
  if (!values.length) return '';
  const body = mode === 'tag' || mode === 'pressure'
    ? `<div class="strategic-role-tags ${mode === 'pressure' ? 'pressure-tags' : ''}">${values.map((value) => `<span>${escapeText(value)}</span>`).join('')}</div>`
    : `<p>${values.map(escapeText).join(' · ')}</p>`;
  return `<section class="strategic-role-block ${mode}"><h5><span aria-hidden="true">${icon}</span>${escapeText(title)}</h5>${body}</section>`;
}

function compactStrategicList(value, limit = 3) {
  const source = Array.isArray(value) ? value : value ? Object.values(value) : [];
  return source.map(firstText).map(shortStrategicPhrase).filter(Boolean).slice(0, limit);
}

function shortStrategicPhrase(value) {
  return normalizeTeamSlotSidebarText(String(value || ''))
    .replace(/\bwith a weather-setting partner\b/gi, 'with weather support')
    .replace(/\bOpponent forced to respect\b/gi, 'respect')
    .replace(/\bPartners that\b/gi, 'partners to')
    .replace(/\.$/, '')
    .trim();
}

function currentBuildSummary(slot, index, data, pokemon) {
  const item = slot?.item_id ? data.indexes.itemsById?.[slot.item_id] : null;
  const ability = slot?.ability_id ? data.indexes.abilitiesById?.[slot.ability_id] : null;
  const moves = [0, 1, 2, 3].map((moveIndex) => {
    const move = slot?.moves?.[moveIndex] ? data.indexes.movesById?.[slot.moves[moveIndex]] : null;
    return move?.name || '—';
  });
  return `<section class="current-build-summary build-editor-section compact-build-overview">
    <div class="build-section-head"><h4>Build Overview</h4><span>Selected set</span></div>
    <div class="compact-build-grid overview-only">
      <div class="compact-build-copy">
        <p class="current-build-title"><strong>${escapeText(getPokemonDisplayName(pokemon))}</strong> <span>@ ${escapeText(item ? getReadableItemName(item, 'No item') : 'No item')}</span></p>
        <div class="current-build-grid">
          <span><strong>Ability:</strong> ${escapeText(ability?.name || '—')}</span>
          <span><strong>Nature:</strong> ${escapeText(slot?.nature || '—')}</span>
          <span class="moves-line"><strong>Moves:</strong> ${moves.map(escapeText).join(' / ')}</span>
        </div>
      </div>
    </div>
  </section>`;
}

function buildIssueChips(legality) {
  const issues = [...(legality?.warnings || []), ...(legality?.missing || [])].map(formatTeamBuilderIssue).filter(Boolean).slice(0, 8);
  if (!issues.length) return '';
  return `<section class="build-issue-chips" aria-label="Build issues"><strong>Build Issues</strong><div>${issues.map((issue) => `<span class="badge warning-badge compact-warning">${escapeText(issue)}</span>`).join('')}</div></section>`;
}

function itemConflictPanel(slot, index, data, team) {
  if (!slot?.item_id) return '';
  const clause = analyseItemClause(team, data);
  const conflict = clause.duplicates.find((entry) => entry.itemId === slot.item_id && entry.slots.includes(index));
  if (!conflict) return '';
  const alternatives = suggestLegalItemAlternatives(slot.item_id, team, data, index, 4);
  return `<div class="item-clause-panel"><strong>Duplicate item indicator</strong><p class="warning">${escapeText(conflict.itemName)} is already used by ${conflict.pokemonNames.filter((_, i) => conflict.slots[i] !== index).map(escapeText).join(', ')}.</p>${alternatives.length ? `<p class="muted small-copy">Legal alternatives: ${alternatives.map((item) => escapeText(item.name || item.item_id)).join(', ')}</p>` : '<p class="muted small-copy">No unused legal alternative found in the current item data.</p>'}</div>`;
}

function spriteImage(sprite, pokemon, className) {
  return `<img class="pokemon-sprite ${className}" src="${escapeText(sprite.src)}" alt="${escapeText(sprite.alt)}" loading="${escapeText(sprite.loading)}" decoding="async" fetchpriority="low" width="80" height="80" data-pokemon-sprite data-pokemon-id="${escapeText(pokemon.ndex || pokemon.pokemon_id || '')}" data-sprite-stage="home" />`;
}

function statPanel(slot, index, baseStats, pokemon) {
  const allocation = getSlotStatAllocation(slot);
  const validation = validateStatAllocation(allocation);
  const used = totalStatAllocation(allocation);
  const investmentNotes = describeStatInvestment(slot, pokemon).slice(0, 2);
  const presetLabels = { fastAttacker: 'Fast Attacker', fastSpecialAttacker: 'Fast Sp. Attacker', bulkyAttacker: 'Bulky Attacker', defensive: 'Defensive', balanced: 'Balanced' };
  const matchedPreset = getMatchedStatPreset(allocation);
  const presetValue = matchedPreset || (used ? 'custom' : '');
  const statAccent = getStatAccentColor(pokemon);
  const bst = STAT_DEFINITIONS.reduce((sum, stat) => sum + getBaseStat(baseStats, stat.key), 0);
  const nature = slot?.nature || '';
  const natureEffect = NATURE_EFFECTS[nature] || null;
  const natureCopy = nature ? `${nature}${natureEffect?.up && natureEffect?.down ? ` (+${natureEffect.up}, -${natureEffect.down})` : ' (neutral)'}` : 'Nature not set';

  return `<section class="stat-panel showdown-stat-editor unified-stat-block build-editor-section" aria-label="Stat allocation" style="--stat-max-accent:${escapeText(statAccent)};">
    <div class="unified-stat-header">
      <div class="unified-stat-heading">
        <h4>Stats</h4>
        <p class="unified-stat-summary">BST ${bst} <span aria-hidden="true">•</span> SP ${used} / ${STAT_ALLOCATION_LIMIT} <span aria-hidden="true">•</span> ${escapeText(natureCopy)}</p>
        <p class="muted small-copy">Base shown in grey · coloured fill = EVs applied</p>
      </div>
      <div class="unified-stat-actions">
        <div class="inline-nature-select">${NatureSelect(index, slot)}</div>
        <div class="inline-preset-select">${StatPresetSelect(index, presetValue, presetLabels)}</div>
        <button type="button" class="tiny-button reset-stats-button" data-reset-stats="${index}">Reset Stats</button>
      </div>
    </div>
    ${validation.errors.map((error) => `<p class="warning compact-line">${escapeText(error)}</p>`).join('')}
    <div class="unified-stat-body">
      ${statRadarChart(baseStats, allocation, statAccent)}
      <div class="showdown-stat-table unified-stat-table" role="table" aria-label="Stat points and final stats">
        ${STAT_DEFINITIONS.map((stat) => statControl(index, stat, baseStats, allocation, validation, Math.max(...STAT_DEFINITIONS.map((candidate) => getFinalStat(baseStats, allocation, candidate.key)), 1), statAccent, natureEffect)).join('')}
      </div>
    </div>
    ${investmentNotes.length ? `<details class="stat-details"><summary>Investment notes</summary>${investmentNotes.map((line) => `<p>${escapeText(line)}</p>`).join('')}</details>` : ''}
  </section>`;
}


function StatPresetSelect(slotIndex, presetValue, presetLabels) {
  const options = [
    { value: '', label: 'Preset' },
    ...Object.entries(presetLabels).map(([value, label]) => ({ value, label })),
    { value: 'custom', label: 'Custom' }
  ];
  return `<label class="native-inline-select native-preset-select">
    <span>Preset</span>
    <select data-stat-preset-select-slot="${slotIndex}" aria-label="Stat preset selector">
      ${options.map((option) => `<option value="${escapeText(option.value)}" ${option.value === presetValue ? 'selected' : ''}>${escapeText(option.label)}</option>`).join('')}
    </select>
  </label>`;
}

function getMatchedStatPreset(allocation) {
  return Object.entries(STAT_PRESETS).find(([, preset]) => STAT_DEFINITIONS.every((stat) => Number(allocation?.[stat.key] || 0) === Number(preset?.[stat.key] || 0)))?.[0] || '';
}

function getSlotActivePokemonForStats(slot, data, fallbackPokemon, megaState = null) {
  const activeMegaId = megaState?.activeMega?.megaPokemonId;
  if (activeMegaId) return data?.indexes?.pokemonById?.[activeMegaId] || fallbackPokemon;
  return fallbackPokemon;
}

function statRadarChart(baseStats, allocation, statAccent = '#67e8f9', extraClass = '') {
  const finalValues = STAT_DEFINITIONS.map((stat) => getFinalStat(baseStats, allocation, stat.key));
  const minValue = Math.min(...finalValues);
  const maxValue = Math.max(...finalValues);
  const spread = Math.max(1, maxValue - minValue);
  const center = 100;
  const maxRadius = 70;
  const minRadius = 22;
  const points = finalValues.map((value, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const radius = minRadius + ((value - minValue) / spread) * (maxRadius - minRadius);
    return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
  const rings = [0.33, 0.66, 1].map((scale) => STAT_DEFINITIONS.map((_, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const radius = maxRadius * scale;
    return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' '));
  const axes = STAT_DEFINITIONS.map((stat, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const x = (center + Math.cos(angle) * maxRadius).toFixed(1);
    const y = (center + Math.sin(angle) * maxRadius).toFixed(1);
    const labelX = (center + Math.cos(angle) * 84).toFixed(1);
    const labelY = (center + Math.sin(angle) * 84).toFixed(1);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" /><text x="${labelX}" y="${labelY}" dominant-baseline="middle" text-anchor="middle">${escapeText(stat.shortLabel || stat.label)}</text>`;
  }).join('');

  const className = ['stat-radar-wrap', extraClass].filter(Boolean).join(' ');
  return `<div class="${escapeText(className)}" aria-hidden="true" style="--radar-accent:${escapeText(statAccent)};">
    <svg class="stat-radar-chart" viewBox="0 0 200 200" focusable="false">
      <g class="stat-radar-grid">
        ${rings.map((ring) => `<polygon points="${ring}" />`).join('')}
        ${axes}
      </g>
      <polygon class="stat-radar-shape" points="${points}" />
    </svg>
  </div>`;
}

function getStatAccentColor(pokemon) {
  return getPokemonTypeColor(pokemon?.type_1 || pokemon?.type1 || pokemon?.typing?.split('/')?.[0] || 'Ice') || '#67e8f9';
}

function statControl(index, stat, baseStats, allocation, validation, highestFinalStat = 1, statAccent = '#67e8f9', natureEffect = null) {
  const base = getBaseStat(baseStats, stat.key);
  const value = Number(allocation?.[stat.key] || 0);
  const finalValue = getFinalStat(baseStats, allocation, stat.key);
  const plusDisabled = value >= STAT_SINGLE_LIMIT || validation.remainingPoints <= 0;
  const minusDisabled = value <= 0;
  const sliderMax = Math.min(STAT_SINGLE_LIMIT, value + validation.remainingPoints);
  const status = value >= STAT_SINGLE_LIMIT ? '<span class="showdown-stat-limit"><span aria-hidden="true">❄</span> Max</span>' : '';
  const hasPoints = value > 0 ? 'has-points' : '';
  const barPercent = Math.max(0, Math.min(100, Math.round((finalValue / highestFinalStat) * 100)));
  const barColor = value >= STAT_SINGLE_LIMIT ? statAccent : '#3d91e5';
  const basePercent = Math.max(0, Math.min(100, Math.round((base / highestFinalStat) * 100)));

  const indicator = natureEffect?.up === stat.label
    ? '<span class="nature-indicator boosted" aria-label="Nature boosted">▲</span>'
    : natureEffect?.down === stat.label
      ? '<span class="nature-indicator dropped" aria-label="Nature lowered">▼</span>'
      : '';

  return `<div class="showdown-stat-row ${hasPoints} ${value >= STAT_SINGLE_LIMIT ? 'is-stat-maxed' : ''}" role="row">
    <div class="showdown-stat-name" role="cell"><strong>${escapeText(stat.label)}${indicator}</strong></div>
    <div class="showdown-stat-visual" role="cell" style="--base-pct: ${basePercent}%; --bar-pct: ${barPercent}%; --bar-color: ${barColor};">
      <input class="showdown-stat-range" type="range" min="0" max="${sliderMax}" step="1" value="${value}" data-stat-slot="${index}" data-stat-key="${stat.key}" aria-label="${escapeText(stat.label)} slider" />
      ${status}
    </div>
    <div class="showdown-stat-equation" role="cell"><span class="stat-base-value">${base}</span><span> + </span><input class="showdown-stat-input" type="number" inputmode="numeric" min="0" max="${STAT_SINGLE_LIMIT}" step="1" value="${value}" data-stat-slot="${index}" data-stat-key="${stat.key}" aria-label="${escapeText(stat.label)} invested points" /><span> = </span><strong>${finalValue}</strong></div>
    <button type="button" class="tiny-button stat-button showdown-stat-minus" role="cell" data-stat-dec-slot="${index}" data-stat-key="${stat.key}" ${minusDisabled ? 'disabled' : ''} aria-label="Remove one ${escapeText(stat.label)} point">−</button>
    <button type="button" class="tiny-button stat-button showdown-stat-plus" role="cell" data-stat-inc-slot="${index}" data-stat-key="${stat.key}" ${plusDisabled ? 'disabled' : ''} aria-label="Add one ${escapeText(stat.label)} point">+</button>
  </div>`;
}

function chainPreview(pokemon) {
  const lines = [];
  pushFrom(lines, pokemon?.strategicStrengths?.conversionPatterns, 'Gameplan');
  pushFrom(lines, pokemon?.pressureFlow?.openingPressure || pokemon?.pressureFlow?.earlyGamePressure, 'Opening');
  pushFrom(lines, pokemon?.preferredBoardStates?.preferredBoards || pokemon?.strategicStrengths?.preferredBoardStates, 'Board');
  pushFrom(lines, pokemon?.failureChains, 'Risk');
  if (!lines.length) return '<p class="notice">Strategic chain data is sparse for this entry.</p>';
  return `<h4>Tactical notes</h4><ul>${lines.slice(0, 4).map((line) => `<li>${escapeText(normalizeTeamSlotSidebarText(line))}</li>`).join('')}</ul>`;
}

function pushFrom(lines, value, label) {
  const text = firstText(value);
  if (text) lines.push(normalizeTeamSlotSidebarText(`${label}: ${text}`));
}

function normalizeTeamSlotSidebarText(value) {
  return normalizeTacticalText(value, { diversify: false })
    .replace(/\bCollapse cue\b/gi, 'Risk point')
    .replace(/\bdisruption trigger windows\b/gi, 'disruption timing')
    .replace(/\bdisruption trigger window\b/gi, 'disruption timing')
    .trim();
}

function firstText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(firstText).find(Boolean) || '';
  if (typeof value === 'object') return Object.values(value).map(firstText).find(Boolean) || '';
  return String(value);
}

function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
