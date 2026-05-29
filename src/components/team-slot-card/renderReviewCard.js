import { buildPokemonReviewSummary } from '../../core/teamSlotCompletionEngine.js';
import { normaliseStatAllocation, STAT_DEFINITIONS, getSlotStatAllocation, getFinalStat } from '../../core/statAllocationEngine.js';
import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { getReadableAbilityName, getReadableItemName } from '../../utils/displayNames.js';
import { getPokemonTypeColor } from '../../constants/pokemonTypeColors.js';
import { generatedBuildCoachNote, formBadge, completionBadge, megaBadge, spriteImage, escapeText, formatTeamBuilderIssueLabel, formatTeamBuilderIssue } from './teamSlotCardCommon.js';
import { spreadAnalysisPanel } from './spreadAnalysisPanel.js';
import { getSlotActivePokemonForStats, statRadarChart, getStatAccentColor } from './renderStatPanel.js';

export function reviewCardTypeStyle(pokemon) {
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

export function reviewCard(slot, index, data, team, itemConflict) {
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
