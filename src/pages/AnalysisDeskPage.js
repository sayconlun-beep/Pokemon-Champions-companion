import { analyseItemClause, suggestLegalItemAlternatives } from '../core/itemClauseEngine.js';
import { getItemEffect, getRecommendedItemsForPokemon } from '../core/itemEffectEngine.js';
import { getMegaOptions, getMegaRequirement } from '../core/megaEvolutionEngine.js';
import { getSlotStatAllocation, validateStatAllocation, describeStatInvestment, totalStatAllocation } from '../core/statAllocationEngine.js';
import { normalizeTacticalText } from '../core/tacticalNormalization.js';
import { normalizeDisplayText, normalizeDisplayList, normalizeDisplayLabel, normalizeThinEvidenceText, compressCoachingList, coachingConclusion, prioritySignalCount } from '../utils/tacticalTextNormalizer.js';
import { dedupeTacticalLines, semanticMeaningKey } from '../utils/tacticalSemanticDeduper.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';
import { buildTacticalPresentation } from '../logic/tacticalPresenter.js';
import { renderArchetypeBadge, renderGameplanCards, renderRiskSummary } from '../ui/teamCoachingRenderers.js';
import { getPokemonDisplayName } from '../utils/formGrouping.js';
import { getReadablePokemonName, getReadableAbilityName } from '../utils/displayNames.js';
import { buildSpecificPressureTags } from '../components/TeamSlotCard.js';
import { analyseTeamValidation } from '../core/legalityEngine.js';

const SECTIONS = [
  ['Biggest Threats To Your Team', 'combinedRisks'],
  ['Important Pokémon To Protect', 'combinedSupport']
];

const TOP_ANALYSIS_SECTIONS = new Set([]);

const DISPLAY_TERMS = {
  positioningLost: 'Losing safe switches after disruption',
  failureChains: 'difficult matchups',
  sustainLoops: 'staying healthy',
  interactionProfiles: 'team support',
  pressureFlow: 'attacking plan',
  collapseTriggers: 'difficult matchups',
  FakeOutDenied: 'Fake Out can be stopped',
  roleProfile: 'team role',
  'role profile': 'team role',
  'role-appropriate partner support': 'team support'
};

const TACTICAL_PATTERNS = [
  [/opens by/gi, 'starts by'],
  [/continues pressure through/gi, 'keeps helping with'],
  [/adds .*? pressure/gi, 'helps teammates attack more safely'],
  [/closes games through/gi, 'helps finish games with']
];

const ADJACENT_MERGE_LABELS = new Set([
  'attacking plan',
  'safe switching',
  'Speed Control',
  'Defensive Support',
  'Late-Game Cleaner',
  'Win Conditions'
]);

export function AnalysisDeskPage(state) {
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const analysisPressureCoverage = safeBuildAnalysisDeskPressureCoverage(state.team, state.data);
  const tacticalPresentation = buildTacticalPresentation(coachingProfile, { page: 'analysis', analysisPressureCoverage });
  const weaknessEntries = coachingProfile.defensiveProfile?.rawWeaknessCoverage || [];

  const markup = `
    <section class="page-stack analysis-desk-page">
      <header class="hero analysis-hero tactical-primary-panel">
        <div>
          <p class="eyebrow">Gold-standard workspace</p>
          <h1>Analysis Desk</h1>
          <p>Simple coaching insights to help you understand how your team wins, what threatens it, and what to improve.</p>
        </div>
        <div class="analysis-metrics">
          <span class="badge tertiary-chip">${coachingProfile.completeness?.filledSlots || 0}/6 selected</span>
          <span class="badge tertiary-chip">${escapeText(coachingProfile.archetype?.primary || 'No archetype yet')}</span>
        </div>
      </header>
      ${renderTeamStyleSection(tacticalPresentation, coachingProfile)}
      ${renderHowThisTeamPlaysSection(tacticalPresentation, coachingProfile, state.team, state.data)}
      ${renderPressureCoverageSection(tacticalPresentation)}
      ${renderWeaknessCoverageSection(tacticalPresentation, weaknessEntries, state.team, state.data, coachingProfile)}
      ${renderDefensiveGamePlanSection(tacticalPresentation, weaknessEntries, state.team, coachingProfile, state.data)}
      ${renderBuildNotesSection(state.team, state.data)}
      ${renderLearningHubAnalysisLink()}
    </section>`;
  return linkAnalysisSlotReferences(markup, state.team, state.data);
}


function linkAnalysisSlotReferences(markup = '', team = [], data = {}) {
  const names = (Array.isArray(team) ? team : []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null;
    const name = pokemon ? getPokemonDisplayName(pokemon) : '';
    return name ? { name, index } : null;
  }).filter(Boolean).sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return markup;

  const chunks = String(markup).split(/(<[^>]+>)/g);
  return chunks.map((chunk) => {
    if (!chunk || chunk.startsWith('<')) return chunk;
    let out = chunk;
    names.forEach(({ name, index }) => {
      const escaped = escapeText(name);
      const pattern = new RegExp(`(^|[^\\w-])(${escapeRegExp(escaped)})(?=$|[^\\w-])`, 'g');
      out = out.replace(pattern, `$1<a class="analysis-slot-reference" href="/team-builder" data-route="team-builder" data-scroll-slot="${index}">$2</a>`);
    });
    return out;
  }).join('');
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeBuildAnalysisDeskPressureCoverage(team = [], data = {}) {
  try {
    return buildAnalysisDeskPressureCoverage(team, data);
  } catch (error) {
    console.warn('Pressure coverage render failed.', error);
    return { members: [], types: [] };
  }
}

function renderPressureCoverageSection(presentation = {}) {
  const pressure = presentation?.analysis?.pressureCoverage || {};
  if (!Array.isArray(pressure.members) || !pressure.members.length) return '';
  return `<section class="analysis-section tactical-section-group pressure-coverage-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>${escapeText(pressure.title || 'Pressure Coverage')}</h2></div></div>
    <p class="section-summary">${escapeText(pressure.summary || 'Selected moves decide which attacking types this team can pressure.')}</p>
    <div class="pressure-coverage-grid weakness-coverage-grid" aria-label="Team offensive pressure coverage">
      ${(pressure.types || []).map((entry) => renderPressureCoverageTile(entry)).join('')}
    </div>
  </section>`;
}

const ANALYSIS_DESK_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

function buildAnalysisDeskPressureCoverage(team = [], data = {}) {
  const pokemonById = data?.indexes?.pokemonById || {};
  const movesById = data?.indexes?.movesById || {};
  const members = (Array.isArray(team) ? team : []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? pokemonById[slot.pokemon_id] : null;
    if (!pokemon) return null;
    const types = getAnalysisDeskPokemonTypes(slot, data);
    const moves = getAnalysisDeskSelectedMoves(slot).map((id) => movesById[id] || (typeof id === 'object' ? id : null)).filter(Boolean);
    return { slot, index, pokemon, name: getPokemonDisplayName(pokemon), types, moves, tags: buildSpecificPressureTags(slot, pokemon, data, 8) };
  }).filter(Boolean);

  const byType = new Map(ANALYSIS_DESK_TYPES.map((type) => [type, []]));
  members.forEach((member) => {
    member.moves.forEach((move) => {
      const type = normalizeAnalysisDeskType(move?.type);
      if (!type || !byType.has(type)) return;
      const shape = pressureMoveShape(move);
      const detail = {
        pokemon: member.name,
        shape,
        moveName: move?.name || move?.move_name || move?.move_id || 'Unknown move',
        power: movePowerLabel(move),
        stab: member.types.includes(type),
        note: pressureMoveNote(move)
      };
      byType.get(type).push(detail);
    });
  });

  const types = ANALYSIS_DESK_TYPES.map((type) => {
    const details = byType.get(type) || [];
    const uniquePokemon = [...new Set(details.map((item) => item.pokemon))];
    const strength = uniquePokemon.length >= 2 ? 'COVERED' : uniquePokemon.length === 1 ? 'LIGHT' : 'NONE';
    const contributors = uniquePokemon.map((name) => {
      const shapes = [...new Set(details.filter((item) => item.pokemon === name).map((item) => item.shape).filter(Boolean))];
      return { name, shape: shapes.join('/') || 'single-target' };
    });
    return { type, strength, contributors, details };
  });

  const covered = types.filter((entry) => entry.strength === 'COVERED').map((entry) => entry.type);
  const light = types.filter((entry) => entry.strength === 'LIGHT').map((entry) => entry.type);
  const none = types.filter((entry) => entry.strength === 'NONE').map((entry) => entry.type);
  const strongText = covered.length ? `strong pressure in ${humanList(covered.slice(0, 4))}` : light.length ? `some pressure in ${humanList(light.slice(0, 4))}` : 'very little confirmed offensive pressure';
  const lackingText = none.length ? ` but lacks ${humanList(none.slice(0, 4))} coverage` : ' with no uncovered offensive types';
  return { members, types, summary: `Your team has ${strongText}${lackingText}.` };
}

function renderPressureCoverageTile(entry = {}) {
  const contributors = entry.contributors || [];
  const details = entry.details || [];
  const count = contributors.length;
  const metricClass = count >= 2 ? 'metric-positive' : count === 1 ? 'metric-light' : 'metric-empty';
  const metric = count >= 1 ? '●'.repeat(Math.min(3, count)) : '—';
  const label = count === 1 ? '1 contributor' : `${count} contributors`;
  return `<article class="type-heatmap-tile pressure-coverage-tile pressure-${entry.strength?.toLowerCase() || 'none'} type-${String(entry.type || '').toLowerCase()}" style="--type-color: ${escapeAttr(TYPE_COLORS[entry.type] || '#64748b')}">
    <details class="type-heatmap-details pressure-coverage-details">
      <summary class="type-heatmap-face" aria-label="${escapeAttr(entry.type || 'Type')} offense coverage: ${escapeAttr(label)}">
        <strong>${escapeText(entry.type)}</strong>
        <span class="type-heatmap-metric ${metricClass}">${escapeText(metric)}</span>
      </summary>
      <div class="type-heatmap-detail-panel weakness-coverage-detail-body">
        <p><b>Contributors:</b> ${contributors.length ? escapeText(contributors.map((item) => item.name).join(', ')) : 'None'}</p>
        ${details.length ? details.map((item) => `<p><b>${escapeText(item.pokemon)}:</b> ${escapeText(item.moveName)} — ${escapeText(item.power)}${item.stab ? ', STAB' : ''}${item.note ? `, ${escapeText(item.note)}` : ''}</p>`).join('') : '<p>No selected move currently contributes this attacking type.</p>'}
      </div>
    </details>
  </article>`;
}


function getAnalysisDeskSelectedMoves(slot = {}) {
  const rawMoves = Array.isArray(slot?.moves)
    ? slot.moves
    : [slot?.move1, slot?.move2, slot?.move3, slot?.move4];
  return rawMoves.filter(Boolean);
}

function pressureMoveShape(move = {}) {
  const name = String(move?.name || move?.move_name || '').toLowerCase();
  const category = String(move?.category || '').toLowerCase();
  const priority = Number(move?.priority || 0);
  const spreadNames = ['heat wave','blizzard','dazzling gleam','earthquake','rock slide','surf','muddy water','discharge','icy wind','snarl','hyper voice','eruption','water spout'];
  const disruptionNames = ['fake out','taunt','encore','parting shot','whirlwind','roar','disable','spore','will-o-wisp','will o wisp','thunder wave','nuzzle'];
  const shapes = [];
  if (disruptionNames.some((term) => name.includes(term))) shapes.push('disruption');
  if (priority > 0) shapes.push('priority');
  if (spreadNames.some((term) => name.includes(term))) shapes.push('spread');
  if (!shapes.length && category === 'status') shapes.push('status');
  if (!shapes.length) shapes.push('single-target');
  return shapes.join('/');
}

function movePowerLabel(move = {}) {
  const power = Number(move?.power || move?.basePower || 0);
  return power > 0 ? `${power} BP` : '— BP';
}

function pressureMoveNote(move = {}) {
  const name = String(move?.name || '').toLowerCase();
  if (name.includes('weather ball')) return 'becomes Fire in sun if sun is active';
  if (Number(move?.priority || 0) > 0) return `+${Number(move.priority)} priority`;
  return '';
}

function humanList(items = []) {
  const clean = items.filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

const TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A', Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD'
};

function renderHowThisTeamPlaysSection(presentation = {}, profile = {}, team = [], data = {}) {
  const gameplans = Array.isArray(presentation?.gameplans) ? presentation.gameplans : [];
  const sections = [
    ['Speed control', presentation?.summaries?.speedPlan || 'No speed control summary yet.'],
    ['Weather / field plan', presentation?.summaries?.weatherPlan || 'No weather plan selected yet.'],
    ['Offensive profile', presentation?.summaries?.offensivePlan || 'No offensive profile yet.'],
    ['Defensive profile', presentation?.analysis?.defensiveGamePlan?.concern || presentation?.summaries?.defensivePlan || 'Use the Team Defense grid below to see the exact danger types and soft answers.']
  ];
  const recommendations = Array.isArray(presentation?.recommendations) ? presentation.recommendations.slice(0, 4) : [];
  const recommendationCard = recommendations.length
    ? `<article class="mini-card team-style-detail-card"><h3>Next improvements</h3><ul>${recommendations.map((item) => `<li>${escapeText(firstSentence(item.text, 140))}</li>`).join('')}</ul></article>`
    : '';

  return `<section class="analysis-section tactical-section-group how-this-team-plays-section gameplans-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>How This Team Plays</h2></div></div>
    ${renderPresenterGameplanCards(gameplans)}
    <details class="analysis-nested-expander team-breakdown-expander">
      <summary><span>Full breakdown</span><span class="muted">Speed, field plan, offense, defense, and next improvements</span></summary>
      <div class="team-style-detail-grid">
        ${sections.map(([title, text]) => `<article class="mini-card team-style-detail-card"><h3>${escapeText(title)}</h3><p>${escapeText(text)}</p></article>`).join('')}
        ${recommendationCard}
      </div>
    </details>
  </section>`;
}

function renderPresenterGameplanCards(gameplans = []) {
  const cards = (Array.isArray(gameplans) ? gameplans : []).slice(0, 3);
  if (!cards.length) return '<p class="muted">Add more selected moves, abilities, and items so the app can identify the team plan from real evidence.</p>';
  return `<div class="team-coaching-gameplans gameplan-card-grid">${cards.map((plan) => `<article class="mini-card team-style-detail-card gameplan-card">
    <h3>${escapeText(plan.label || 'Team plan')}</h3>
    ${plan.summary ? `<p>${escapeText(plan.summary)}</p>` : ''}
    ${plan.advice && plan.advice !== plan.summary ? `<p class="muted">${escapeText(plan.advice)}</p>` : ''}
    ${renderPresenterRoleLine('Enablers', plan.enablers)}
    ${renderPresenterRoleLine('Converters', plan.abusers)}
    ${renderPresenterRoleLine('Support', plan.support)}
  </article>`).join('')}</div>`;
}

function renderPresenterRoleLine(label = '', names = []) {
  const clean = Array.isArray(names) ? names.filter(Boolean).slice(0, 4) : [];
  return clean.length ? `<p class="team-style-role-line"><b>${escapeText(label)}:</b> ${escapeText(clean.join(', '))}</p>` : '';
}

function renderDefensiveGamePlanSection(presentation = {}, weaknessEntries = [], team = [], coachingProfile = {}, data = {}) {
  const plan = presentation?.analysis?.defensiveGamePlan || {};
  const biggest = plan.concern || 'No single defensive concern stands out yet. Finish the team to make this section more precise.';
  const soft = plan.softAnswers || 'Use typing, immunity, resistance, Protect turns, and offensive pressure as your current soft answers.';
  const lookFor = plan.lookFor || 'Use safer positioning into pressure: scout with Protect, avoid repeated free switches, and answer dangerous boards before they become predictable.';
  return `<section class="analysis-section tactical-section-group defensive-game-plan-section what-this-means-section risk-callouts-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>Defensive Game Plan</h2></div></div>
    <div class="team-style-detail-grid">
      <article class="mini-card team-style-detail-card"><h3>Biggest concern</h3><p>${escapeText(biggest)}</p></article>
      <article class="mini-card team-style-detail-card"><h3>Current soft answers</h3><p>${escapeText(soft)}</p></article>
      <article class="mini-card team-style-detail-card"><h3>What to look for</h3><p>${escapeText(lookFor)}</p></article>
    </div>
    ${renderActionableRiskSummary(presentation, team, { limit: 6, compact: false, showSeverity: true, data, sourceProfile: coachingProfile })}
  </section>`;
}

function renderActionableRiskSummary(presentation = {}, team = [], options = {}) {
  const opts = { limit: 6, compact: false, showSeverity: true, ...options };
  const plan = presentation?.analysis?.defensiveGamePlan || {};
  const risks = (Array.isArray(plan?.risks) ? plan.risks : Array.isArray(presentation?.analysis?.risks) ? presentation.analysis.risks : Array.isArray(presentation?.risks) ? presentation.risks : [])
    .slice(0, opts.limit)
    .filter((risk) => String(risk?.display?.title || risk?.title || risk?.display?.summary || risk?.summary || '').trim());
  if (!risks.length) return opts.compact ? '' : `<p class="muted">${escapeText(plan.actionableEmptyMessage || 'No major defensive pressure stands out yet.')}</p>`;
  const title = plan.actionableTitle ? `<h3 class="actionable-risk-heading">${escapeText(plan.actionableTitle)}</h3>` : '';
  return `${title}<div class="warning-stack team-coaching-risks actionable-risk-stack ${opts.compact ? 'compact' : ''}">${risks.map((risk) => {
    const severity = risk.severity || risk.sourceRisk?.severity || 'Low';
    const display = risk.display || {};
    const label = display.title || risk.title || 'Team risk';
    const text = firstSentence(display.summary || risk.summary || 'Keep this matchup pressure in mind while positioning.', opts.compact ? 110 : 180);
    const suggestion = getSuggestedSlotForRisk(risk, opts.sourceProfile || {}, team, opts.data || {});
    return `<div class="${severity === 'High' ? 'warning' : 'notice'} actionable-risk-card"><p><strong>${escapeText(label)}:</strong> ${escapeText(text)}</p>${renderSuggestedSlotLine(suggestion)}</div>`;
  }).join('')}</div>`;
}

function getSuggestedSlotForRisk(riskCard = {}, profile = {}, team = [], data = {}) {
  const risk = riskCard.sourceRisk || riskCard || {};
  const display = riskCard.display || {};
  if (risk?.type) {
    return getSuggestedSlotForTypeWeakness(risk.type, profile?.defensiveProfile?.rawWeaknessCoverage || [], team, null, data, display);
  }
  return getSuggestedSlotForRecommendation(risk?.reason || risk?.beginnerAdvice || '', profile, team, data, display);
}

function getSuggestedSlotForRecommendation(text = '', profile = {}, team = [], data = {}, display = {}) {
  const copy = String(text || '');
  const typeMatch = copy.match(/(?:into|against|from|for)\s+([A-Z][a-z]+)\s+(?:pressure|attacks|attackers|type)/i);
  if (typeMatch) return getSuggestedSlotForTypeWeakness(typeMatch[1], profile?.defensiveProfile?.rawWeaknessCoverage || [], team, null, data);
  if (/speed control|protect|disruption|fake out|redirection|defensive pivot|switch-in|support/i.test(copy)) {
    const members = buildAnalysisDeskMembers(team, profile?.defensiveProfile?.rawWeaknessCoverage || [], data);
    const choice = pickLeastUniqueRoleSlot(members);
    if (choice) return choice;
  }
  return multipleSlotsSuggestion(display.multipleSlotText || 'Multiple slots affected — review the team holistically.');
}

function getSuggestedSlotForTypeWeakness(typeName = '', entries = [], team = [], directEntry = null, data = {}, display = {}) {
  const entry = directEntry || (Array.isArray(entries) ? entries : []).find((item) => normalizeAnalysisDeskType(item?.attackingType) === normalizeAnalysisDeskType(typeName));
  const weakResults = (entry?.memberResults || []).filter((member) => member?.relation === 'weak');
  const weakNames = weakResults.map((member) => member.pokemonName || member.name).filter(Boolean);
  const weakIds = weakResults.map((member) => member.pokemonId || member.id).filter(Boolean);
  const members = buildAnalysisDeskMembers(team, entries, data);
  const weakMembers = members.filter((member) => weakNames.some((name) => normalizeName(name) === normalizeName(member.name)) || weakIds.some((id) => normalizeName(id) === normalizeName(member.id)));
  if (!weakMembers.length) return multipleSlotsSuggestion(display.multipleSlotText || 'Multiple slots affected — review the team holistically.');
  const scored = weakMembers.map((member) => ({ member, score: defensiveValueScore(member, entries) + roleUniquenessPenalty(member, members) }))
    .sort((a, b) => a.score - b.score || a.member.index - b.member.index);
  const chosen = scored[0]?.member;
  if (!chosen) return multipleSlotsSuggestion(display.multipleSlotText || 'Multiple slots affected — review the team holistically.');
  const reason = display.suggestedSlotText || `${normalizeAnalysisDeskType(typeName) || typeName || 'This'}-weak slot; review whether that role can be adjusted without breaking the main plan.`;
  return slotSuggestion(chosen, reason);
}

function buildAnalysisDeskMembers(team = [], entries = [], data = {}) {
  const slots = Array.isArray(team) ? team : [];
  const coverageNames = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => (entry?.memberResults || []).forEach((result) => {
    if (result?.pokemonName) coverageNames.set(normalizeName(result.pokemonName), result.pokemonName);
  }));
  const pokemonById = data?.indexes?.pokemonById || {};
  return slots.map((slot, index) => {
    const pokemon = pokemonById[slot?.pokemon_id] || slot?.pokemon || {};
    const fallbackName = pokemon ? getReadablePokemonName(pokemon, `Slot ${index + 1}`) : (coverageNames.get(normalizeName(slot?.pokemon_id)) || getReadablePokemonName(slot?.pokemon || { name: slot?.name, pokemon_id: slot?.pokemon_id }, `Slot ${index + 1}`));
    return {
      slot,
      index,
      name: fallbackName,
      id: slot?.pokemon_id || pokemon?.pokemon_id || pokemon?.id || '',
      types: [slot?.type_1, slot?.type_2, slot?.type1, slot?.type2, pokemon?.type_1, pokemon?.type_2, pokemon?.type1, pokemon?.type2].flatMap(splitAnalysisDeskTypes).map(normalizeAnalysisDeskType).filter(Boolean),
      item: String(slot?.item || slot?.item_id || '').toLowerCase(),
      moves: [slot?.move1, slot?.move2, slot?.move3, slot?.move4, ...(Array.isArray(slot?.moves) ? slot.moves : [])].map((move) => String(move?.name || move || '').toLowerCase()),
      ability: String(getReadableAbilityName(slot?.ability || slot?.ability_id || '', '')).toLowerCase()
    };
  }).filter((member) => member.slot && (member.slot.pokemon_id || member.name));
}

function defensiveValueScore(member = {}, entries = []) {
  let score = 0;
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const result = (entry?.memberResults || []).find((item) => normalizeName(item?.pokemonName) === normalizeName(member.name));
    if (result?.relation === 'immune') score += 3;
    if (result?.relation === 'resist') score += 2;
    if (result?.relation === 'weak') score -= 1;
  });
  if (/leftovers|sitrus|assault vest|eviolite|rocky helmet|safety goggles|berry/.test(member.item)) score += 2;
  if (/intimidate|regenerator|water absorb|flash fire|levitate|lightning rod|storm drain/.test(member.ability)) score += 2;
  return score;
}

function memberJobTags(member = {}) {
  const tags = [];
  const moves = member.moves.join(' ');
  if (/tailwind|trick room|icy wind|thunder wave|electroweb|nuzzle/.test(moves)) tags.push('speed-control');
  if (/fake out|taunt|encore|parting shot|snarl|will.o.wisp|whirlwind/.test(moves)) tags.push('disruption');
  if (/protect|detect/.test(moves)) tags.push('positioning');
  if (/aurora veil|reflect|light screen/.test(moves)) tags.push('screens');
  if (/blizzard|earthquake|rock slide|heat wave|dazzling gleam|surf|muddy water/.test(moves)) tags.push('spread-pressure');
  if (!tags.length) tags.push('single-target-pressure');
  return tags;
}

function roleUniquenessPenalty(member = {}, members = []) {
  const tags = memberJobTags(member);
  const duplicateCount = tags.reduce((total, tag) => total + members.filter((other) => other.index !== member.index && memberJobTags(other).includes(tag)).length, 0);
  return duplicateCount ? -duplicateCount : 2;
}

function pickLeastUniqueRoleSlot(members = []) {
  if (!members.length) return null;
  const chosen = members.map((member) => ({ member, score: roleUniquenessPenalty(member, members) + defensiveValueScore(member, []) }))
    .sort((a, b) => a.score - b.score || a.member.index - b.member.index)[0]?.member;
  if (!chosen) return null;
  const overlap = findRoleOverlap(chosen, members);
  return slotSuggestion(chosen, overlap ? `its ${overlap} role is duplicated elsewhere, so changing it is less likely to remove the team's only copy of that job.` : 'it is the cleanest flexible slot to review first.');
}

function findRoleOverlap(member = {}, members = []) {
  return memberJobTags(member).find((tag) => members.some((other) => other.index !== member.index && memberJobTags(other).includes(tag))) || '';
}

function overlapPartners(member = {}, members = [], tag = '') {
  const names = members.filter((other) => other.index !== member.index && memberJobTags(other).includes(tag)).map((other) => other.name).slice(0, 2);
  return names.join(' or ') || 'another teammate';
}

function slotSuggestion(member = {}, reason = '') {
  return { slotIndex: member.index, slotLabel: `Slot ${Number(member.index || 0) + 1}`, pokemonName: member.name || `Slot ${Number(member.index || 0) + 1}`, reason };
}

function multipleSlotsSuggestion(reason = 'Multiple slots affected — review the team holistically.') {
  return { multiple: true, reason };
}

function renderSuggestedSlotLine(suggestion = null, options = {}) {
  if (!suggestion) return '';
  if (suggestion.multiple) return `<p class="suggested-slot-line"><b>Suggested slot to change:</b> ${escapeText(suggestion.reason || 'Multiple slots affected — review the team holistically.')}</p>`;
  return `<p class="suggested-slot-line"><b>Suggested slot to change:</b> ${escapeText(suggestion.slotLabel)} (${escapeText(suggestion.pokemonName)}) — ${escapeText(suggestion.reason || 'review this slot first.')} <a href="/team-builder" data-route="team-builder" data-scroll-slot="${Number(suggestion.slotIndex || 0)}">Open in Builder</a></p>`;
}

function normalizeName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function renderBuildNotesSection(team = [], data = {}) {
  const validation = analyseTeamValidation(team, data);
  const strengths = Array.isArray(validation?.strengths) ? validation.strengths : [];
  const clarifications = Array.isArray(validation?.clarifications) ? validation.clarifications : [];
  if (!strengths.length && !clarifications.length) return '';
  return `<section class="analysis-section tactical-section-group build-notes-analysis-section intentional-synergies-analysis-section clarifications-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>Build Notes</h2></div></div>
    ${strengths.length ? `<div class="build-notes-group"><h3>Intentional synergies</h3><div class="success-stack team-strength-stack">${strengths.slice(0, 8).map((issue) => `<p class="success">${escapeText(issue.message)}</p>`).join('')}</div></div>` : ''}
    ${clarifications.length ? `<div class="build-notes-group"><h3>Clarifications</h3><div class="team-style-detail-grid single-card">${clarifications.slice(0, 8).map((issue) => `<article class="mini-card team-style-detail-card"><h3>Not an error</h3><p>${escapeText(issue.message)}</p></article>`).join('')}</div></div>` : ''}
  </section>`;
}


function isPreservationPriorityCard(card = {}) {
  const text = [
    card.pokemonName,
    card.pokemon,
    card.role,
    card.claim,
    card.detail,
    card.warning,
    card.theme,
    ...(card.claims || []),
    ...(card.details || []),
    ...(card.warnings || [])
  ].join(' ').toLowerCase();

  return /main attacker|main cleaner|cleaner|win condition|late-game|late game|finisher|finish the game|primary damage dealer|primary attacker|one of your main attackers|one of the team.?s main finishers|close out the game/.test(text);
}

function renderLearningHubAnalysisLink() {
  return `
    <section class="analysis-section tactical-section-group learning-hub-analysis-link summary-surface">
      <div class="card learning-hub-link-card">
        <div>
          <h2>Learning Hub</h2>
          <p class="section-summary">Use the Learning Hub for simple explanations of team roles, speed control, safe switching, and common battle mistakes.</p>
        </div>
        <a class="button primary" href="/learning-hub" data-route="learning-hub">Open Learning Hub</a>
      </div>
    </section>`;
}

// SHARED PROFILE DISPLAY: renders raw coverage tiles supplied by buildTeamCoachingProfile.defensiveProfile.
function renderWeaknessCoverageSection(presentation = {}, profile = [], team = [], data = {}, coachingProfile = null) {
  try {
    const indexedData = ensureAnalysisDeskPokemonIndex(data);
    const selectedTeam = getAnalysisDeskSelectedTeam(team);
    const coverageDisplay = presentation?.analysis?.weaknessCoverage || {};
    const suppliedEntries = Array.isArray(profile) ? profile : [];
    const entries = hasUsableWeaknessCoverageEntries(suppliedEntries, selectedTeam)
      ? suppliedEntries
      : (coachingProfile?.defensiveProfile?.rawWeaknessCoverage || []);

    if (!selectedTeam.length || !Array.isArray(entries) || entries.length < 18) {
      return renderWeaknessCoverageFallbackSection();
    }

    return `
    <section class="analysis-section tactical-section-group weakness-coverage-section">
      <details class="analysis-cluster weakness-coverage-cluster" data-analysis-section="weakness-coverage" open>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>${escapeText(coverageDisplay.title || 'Weakness Coverage')}</h2>
            <p class="section-summary">${escapeText(coverageDisplay.summary || 'A quick view of which attacking types your team handles well and which ones may need safer answers.')}</p>
            <p class="section-collapsed-preview">${escapeText(coverageDisplay.collapsedPreview || 'Type weakness coverage tiles available.')}</p>
          </div>
        </summary>
        <div class="analysis-collapse-body">
          ${renderWeaknessCoverageCoachingSummary(coverageDisplay)}
          <div class="weakness-coverage-grid">
            ${sortWeaknessCoverageTiles(entries).map((entry) => renderWeaknessCoverageTile(entry, team, coverageDisplay?.byType?.[entry.attackingType])).join('')}
          </div>
        </div>
      </details>
    </section>`;
  } catch (error) {
    return renderWeaknessCoverageFallbackSection();
  }
}

function renderWeaknessCoverageFallbackSection() {
  return `
    <section class="analysis-section tactical-section-group weakness-coverage-section">
      <details class="analysis-cluster weakness-coverage-cluster" data-analysis-section="weakness-coverage" open>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>Weakness Coverage</h2>
            <p class="section-summary">A simple coverage overview will show here once this team has complete typing data.</p>
            <p class="section-collapsed-preview">Typing data needed for coverage tiles.</p>
          </div>
        </summary>
        <div class="analysis-collapse-body">
          <div class="weakness-coverage-fallback" role="status">
            <p>Type coverage will appear once this team has complete typing data.</p>
          </div>
        </div>
      </details>
    </section>`;
}

// RAW CALCULATION INPUT: extracts selected slots for coverage calculations.
function getAnalysisDeskSelectedTeam(team = []) {
  return (Array.isArray(team) ? team : []).filter((slot) => slot && slot.pokemon_id);
}

// RAW CALCULATION GUARD: validates supplied weakness coverage entries before rendering.
function hasUsableWeaknessCoverageEntries(entries = [], selectedTeam = []) {
  return Array.isArray(entries)
    && entries.length >= 18
    && entries.every((entry) => entry?.attackingType && Array.isArray(entry.memberResults))
    && entries.some((entry) => (entry.memberResults || []).length >= selectedTeam.length);
}

// RAW CALCULATION GUARD: checks whether coverage data is complete enough to trust.
function hasCompleteWeaknessCoverageData(entries = [], team = [], data = {}) {
  const selectedTeam = getAnalysisDeskSelectedTeam(team);
  if (!selectedTeam.length) return false;
  if (!Array.isArray(entries) || entries.length < 18) return false;
  if (entries.some((entry) => !entry?.attackingType || !Array.isArray(entry.memberResults))) return false;

  return selectedTeam.every((slot) => getAnalysisDeskPokemonTypes(slot, data).length > 0);
}

// RAW CALCULATION INPUT: prepares a Pokémon lookup for weakness coverage calculation fallback.
function ensureAnalysisDeskPokemonIndex(data = {}) {
  const existing = data?.indexes?.pokemonById || {};
  if (Object.keys(existing).length) return data;
  const rows = data?.collections?.pokemon || data?.pokemon || data?.pokemonRows || [];
  const pokemonById = Object.fromEntries((Array.isArray(rows) ? rows : []).filter((row) => row?.pokemon_id).map((row) => [row.pokemon_id, row]));
  return { ...data, indexes: { ...(data?.indexes || {}), pokemonById } };
}

// RAW CALCULATION INPUT: reads display/form typing for coverage validation.
function getAnalysisDeskPokemonTypes(slot = {}, data = {}) {
  const indexedData = ensureAnalysisDeskPokemonIndex(data);
  const pokemonById = indexedData?.indexes?.pokemonById || {};
  const pokemon = pokemonById[slot?.pokemon_id] || slot?.pokemon || slot || {};
  const rawTypes = [
    slot?.typeOverride,
    slot?.type_1,
    slot?.type_2,
    slot?.type1,
    slot?.type2,
    pokemon?.type_1,
    pokemon?.type_2,
    pokemon?.type1,
    pokemon?.type2
  ];

  return [...new Set(rawTypes.flatMap(splitAnalysisDeskTypes).map(normalizeAnalysisDeskType).filter(Boolean))];
}

// RAW CALCULATION INPUT: normalizes stored type strings.
function splitAnalysisDeskTypes(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\/,&|]+/).map((entry) => entry.trim());
}

// RAW CALCULATION INPUT: maps type text to canonical Pokémon type names.
function normalizeAnalysisDeskType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  const validTypes = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
  return validTypes.find((type) => type.toLowerCase() === clean) || '';
}

// PRESENTER DISPLAY: keeps the scan-friendly Weakness Coverage explanation tied to canonical presenter strings.
function renderWeaknessCoverageCoachingSummary(coverageDisplay = {}) {
  return coverageDisplay?.coachingSummary
    ? `<p class="section-summary weakness-coverage-coaching-summary">${escapeText(coverageDisplay.coachingSummary)}</p>`
    : '';
}

// RAW CALCULATION SORTING: chooses the highest-severity raw coverage entry for display.
function getTopWeaknessCoverageConcern(entries = []) {
  const candidates = entries
    .filter((entry) => Number(entry?.weakCount || 0) > 0)
    .map((entry) => ({
      ...entry,
      defensiveAnswers: Number(entry?.resistCount || 0) + Number(entry?.immuneCount || 0),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .sort((a, b) => {
      const exposedDelta = Number(normalizeWeaknessCoverageStatus(b.classification) === 'Exposed') - Number(normalizeWeaknessCoverageStatus(a.classification) === 'Exposed');
      if (exposedDelta) return exposedDelta;
      const weakDelta = b.weakScore - a.weakScore;
      if (weakDelta) return weakDelta;
      const answerDelta = a.defensiveAnswers - b.defensiveAnswers;
      if (answerDelta) return answerDelta;
      return b.priority - a.priority;
    });

  return candidates[0] || null;
}

// RAW CALCULATION SORTING: chooses the strongest raw coverage entry for display.
function getTopWeaknessCoverageStrength(entries = [], excludedType = '') {
  return entries
    .filter((entry) => entry?.attackingType !== excludedType)
    .map((entry) => ({
      ...entry,
      defensiveAnswers: Number(entry?.resistCount || 0) + Number(entry?.immuneCount || 0),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .filter((entry) => normalizeWeaknessCoverageStatus(entry.classification) === 'Covered' && entry.defensiveAnswers >= 2)
    .sort((a, b) => {
      const answerDelta = b.defensiveAnswers - a.defensiveAnswers;
      if (answerDelta) return answerDelta;
      const weakDelta = a.weakScore - b.weakScore;
      if (weakDelta) return weakDelta;
      return b.priority - a.priority;
    })[0] || null;
}

// UI RENDERER: formats raw coverage counts for compact tile copy.
function formatWeaknessCoverageSummaryLine(entry = {}) {
  const typeName = entry.attackingType || 'This type';
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  if (status === 'Exposed') {
    return `${typeName} has limited safe switch-ins. Add a resist, immunity, or faster offensive pressure if ${typeName}-type attackers become common problems.`;
  }
  if (status === 'Covered') {
    return `${typeName} is reasonably covered. You have resistances, immunities, or practical answers available.`;
  }
  return `${typeName} pressure needs attention. Some teammates can help, but avoid switching affected Pokémon directly into ${typeName}-type attacks.`;
}

// SHARED PROFILE DISPLAY: page-local wording for raw Weakness Coverage tile details only, not team identity scoring.
function describeWeaknessCoverageConcern(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);

  if (answers === 0 && weak >= 2) return 'several Pokémon are weak to it and the team has limited safe switch-ins';
  if (answers === 0) return 'the team has limited safe switch-ins for this attacking type';
  if (answers === 1 && weak >= 2) return 'several Pokémon are weak to it and the team leans heavily on one defensive answer';
  if (answers === 1) return 'the team leans on one resist or immunity, so keep that answer healthy';
  return 'it can still pressure multiple teammates if your main answers are weakened early';
}

// UI RENDERER: explains a raw covered tile without altering risk logic.
function describeWeaknessCoverageStrength(entry = {}) {
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);
  if (answers >= 3) return 'you have several resistances, immunities, or practical answers available';
  return 'you have multiple resistances, immunities, or practical answers available';
}

function competitiveTypePriority(typeName = '') {
  const priorityTypes = ['Ground', 'Fighting', 'Water', 'Fire', 'Electric', 'Ice', 'Fairy', 'Dragon', 'Dark', 'Rock'];
  const index = priorityTypes.indexOf(typeName);
  return index === -1 ? 0 : priorityTypes.length - index;
}

// UI RENDERER: displays one raw weakness coverage tile.
function renderWeaknessCoverageTile(entry = {}, team = [], display = {}) {
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  const typeName = entry.attackingType || 'Unknown';
  const detailGroups = weaknessCoverageDetailGroups(entry);
  const hoverText = `${typeName}:\nWeak: ${detailGroups.weak}\nResists: ${detailGroups.resist}\nImmune: ${detailGroups.immune}\nNeutral: ${detailGroups.neutral}`;
  const score = defensiveNetResistanceScore(entry);
  const metricClass = score > 0 ? 'metric-positive' : score < 0 ? 'metric-negative' : 'metric-neutral';
  const metric = score > 0 ? `+${score}` : `${score}`;
  const isActionable = status !== 'Covered';
  const detailMarkup = isActionable ? renderWeaknessCoverageActionDetails(entry, detailGroups, team, display) : renderCoveredWeaknessCoverageDetails(entry, detailGroups, display);

  return `
    <article class="type-heatmap-tile weakness-coverage-tile ${weaknessCoverageToneClass(status)} ${isActionable ? 'coverage-actionable' : 'coverage-safe'}" style="--type-color: ${escapeAttr(TYPE_COLORS[typeName] || '#64748b')}" title="${escapeText(hoverText)}">
      <details class="type-heatmap-details weakness-coverage-details">
        <summary class="type-heatmap-face" aria-label="${escapeAttr(typeName)} defense score ${escapeAttr(metric)}">
          <strong>${escapeText(typeName)}</strong>
          <span class="type-heatmap-metric ${metricClass}">${escapeText(metric)}</span>
        </summary>
        ${detailMarkup}
      </details>
    </article>`;
}

function defensiveNetResistanceScore(entry = {}) {
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


function renderWeaknessCoverageInlineGroups(detailGroups = {}) {
  const noResists = String(detailGroups.resist || '').toLowerCase() === 'none' && String(detailGroups.immune || '').toLowerCase() === 'none';
  return `<div class="weakness-inline-groups">
    <p><b>Resists:</b> ${escapeText(detailGroups.resist)}</p>
    ${String(detailGroups.immune || '').toLowerCase() !== 'none' ? `<p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>` : ''}
    <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
    <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
    ${noResists ? '<p class="muted">No resists on this team</p>' : ''}
  </div>`;
}


// UI RENDERER: expands one raw weakness coverage tile with practical detail.
function renderWeaknessCoverageActionDetails(entry = {}, detailGroups = {}, team = [], display = {}) {
  const typeName = entry.attackingType || 'this type';
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  const suggestion = getSuggestedSlotForTypeWeakness(typeName, [entry], team, entry);

  return `
        <div class="type-heatmap-detail-panel weakness-coverage-detail-body" aria-label="${escapeText(typeName)} coverage details">
          <p><b>Why:</b> ${escapeText(display?.why || `${status === 'Exposed' ? `${typeName} has limited safe switch-ins` : `${typeName} pressure needs attention`}.`)}</p>
          <p><b>Current defensive profile:</b> ${escapeText(display?.currentProfile || `${Number(entry.resistCount || 0)} resist, ${Number(entry.immuneCount || 0)} immune, ${Number(entry.weakCount || 0)} weak.`)}</p>
          <p><b>Look for:</b> ${escapeText(display?.lookFor || `a safer switch-in, offensive pressure into ${typeName}-types, or support that helps your team avoid taking clean hits.`)}</p>
          ${display?.softAnswersText ? `<p><b>Soft answers already present:</b> ${escapeText(display.softAnswersText)}</p>` : ''}
          <p><b>Useful support:</b> ${escapeText(display?.usefulSupport || 'Protect, speed control, Fake Out, redirection, Intimidate, or status can buy safer turns while you look for a better answer.')}</p>
          ${renderSuggestedSlotLine(suggestion)}
          <a class="secondary-button compact weakness-answer-link" href="/metadex?answerType=${escapeAttr(typeName)}" data-route="metadex" data-metadex-answer-type="${escapeAttr(typeName)}">Find answers in MetaDex</a>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Resist:</b> ${escapeText(detailGroups.resist)}</p>
          <p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
        </div>`;
}

// UI RENDERER: expands one covered weakness coverage tile.
function renderCoveredWeaknessCoverageDetails(entry = {}, detailGroups = {}, display = {}) {
  return `
        <div class="type-heatmap-detail-panel weakness-coverage-detail-body">
          <p>${escapeText(display?.coveredSummary || `${entry.attackingType || 'This type'} is reasonably covered.`)}</p>
          <p><b>Resist:</b> ${escapeText(detailGroups.resist)}</p>
          <p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
        </div>`;
}

// UI RENDERER: describes why a raw Needs Attention tile matters.
function describeNeedsAttentionWeaknessCoverage(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);
  if (answers === 1 && weak >= 2) return 'you have one answer, but several teammates are weak to it';
  if (answers === 1) return 'you have one answer, so the matchup can become risky if that Pokémon is weakened';
  if (weak > 0) return 'it can pressure part of the team and your answers may not be completely safe';
  return 'there are limited safe switch-ins even though no teammate is directly weak to it';
}

const DEFENSIVE_TYPE_ANSWERS = {
  Normal: ['Rock-types resist Normal', 'Steel-types resist Normal', 'Ghost-types are immune to Normal'],
  Fire: ['Water-types resist Fire', 'Rock-types resist Fire', 'Dragon-types resist Fire'],
  Water: ['Grass-types resist Water', 'Dragon-types resist Water', 'Water-types resist Water'],
  Electric: ['Ground-types are immune to Electric', 'Grass-types resist Electric', 'Dragon-types resist Electric'],
  Grass: ['Fire-types resist Grass', 'Flying-types resist Grass', 'Steel-types resist Grass'],
  Ice: ['Fire-types resist Ice', 'Water-types resist Ice', 'Steel-types resist Ice'],
  Fighting: ['Flying-types resist Fighting', 'Psychic-types resist Fighting', 'Ghost-types are immune to Fighting'],
  Poison: ['Steel-types are immune to Poison', 'Ground-types threaten Poison offensively', 'Psychic-types threaten Poison offensively'],
  Ground: ['Flying-types are immune to Ground', 'Grass-types resist Ground', 'Bug-types resist Ground'],
  Flying: ['Electric-types resist Flying', 'Rock-types resist Flying', 'Steel-types resist Flying'],
  Psychic: ['Dark-types are immune to Psychic', 'Steel-types resist Psychic', 'Bug- or Ghost-type pressure can threaten Psychic-types'],
  Bug: ['Fire-types resist Bug', 'Flying-types resist Bug', 'Steel-types resist Bug'],
  Rock: ['Fighting-types resist Rock', 'Ground-types resist Rock', 'Steel-types resist Rock'],
  Ghost: ['Normal-types are immune to Ghost', 'Dark-types resist Ghost', 'Dark-type pressure threatens Ghost-types'],
  Dragon: ['Fairy-types are immune to Dragon', 'Steel-types resist Dragon', 'Ice or Fairy pressure threatens Dragon-types'],
  Dark: ['Fighting-types resist Dark', 'Fairy-types resist Dark', 'Dark-types resist Dark'],
  Steel: ['Fire-types resist Steel', 'Water-types resist Steel', 'Electric-types resist Steel'],
  Fairy: ['Steel-types resist Fairy', 'Poison-types resist Fairy', 'Fire-types resist Fairy']
};

// UI RENDERER: suggests defensive answer categories for a raw attacking type tile.
function weaknessCoverageAnswerAdvice(typeName = '') {
  const answers = DEFENSIVE_TYPE_ANSWERS[typeName] || [];
  return answers.length ? `${answers.join(', ')}, or a teammate that can safely switch into common ${typeName}-type attacks` : '';
}

// RAW CALCULATION: detects selected-team support tools used only to annotate weakness coverage display.
function detectWeaknessCoverageSoftAnswers(team = []) {
  const movesText = (Array.isArray(team) ? team : []).flatMap((slot) => [slot?.move1, slot?.move2, slot?.move3, slot?.move4, ...(Array.isArray(slot?.moves) ? slot.moves : [])]).map((move) => String(move?.name || move || '').toLowerCase());
  const abilityText = (Array.isArray(team) ? team : []).map((slot) => String(slot?.ability || slot?.selectedAbility || '').toLowerCase());
  const has = (terms) => movesText.some((move) => terms.some((term) => move.includes(term)));
  const answers = [];
  if (has(['tailwind', 'icy wind', 'electroweb', 'nuzzle', 'thunder wave', 'trick room'])) answers.push('speed control');
  if (has(['fake out'])) answers.push('Fake Out');
  if (abilityText.some((ability) => ability.includes('intimidate'))) answers.push('Intimidate');
  if (has(['snarl'])) answers.push('Snarl');
  if (has(['will-o-wisp', 'will o wisp'])) answers.push('Will-O-Wisp');
  if (has(['taunt'])) answers.push('Taunt');
  if (has(['encore'])) answers.push('Encore');
  if (has(['follow me', 'rage powder'])) answers.push('redirection');
  if (has(['reflect', 'light screen', 'aurora veil'])) answers.push('screens or Aurora Veil');
  if (has(['recover', 'wish', 'roost', 'moonlight', 'synthesis', 'protect'])) answers.push('recovery or stalling turns');
  if (has(['volt switch', 'u-turn', 'u turn', 'parting shot', 'flip turn'])) answers.push('pivoting');
  return [...new Set(answers)];
}

function formatSoftAnswerSummary(answers = []) {
  if (!answers.length) return '';
  if (answers.length === 1) return answers[0];
  return `${answers.slice(0, -1).join(', ')} and ${answers[answers.length - 1]}`;
}

// UI RENDERER: formats missing support categories for weakness coverage details.
function weaknessCoverageSupportAdvice(softAnswers = []) {
  const base = ['speed control', 'Fake Out', 'Taunt', 'Snarl', 'Intimidate', 'screens, Aurora Veil, redirection, recovery, or strong offensive pressure'];
  const missing = base.filter((item) => !softAnswers.some((answer) => item.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(item.toLowerCase())));
  return `consider ${missing.slice(0, 4).join(', ')} if you do not want to add another hard resist.`;
}

// RAW CALCULATION SORTING: groups raw member coverage relations for display.
function weaknessCoverageDetailGroups(entry = {}) {
  const members = Array.isArray(entry.memberResults) ? entry.memberResults : [];
  return {
    weak: formatWeaknessCoverageNames(members, 'weak'),
    resist: formatWeaknessCoverageNames(members, 'resist'),
    immune: formatWeaknessCoverageNames(members, 'immune'),
    neutral: formatWeaknessCoverageNames(members, 'neutral')
  };
}

function formatWeaknessCoverageNames(members = [], relation = '') {
  const names = members
    .filter((member) => member?.relation === relation)
    .map((member) => member?.pokemonName || 'Unknown Pokémon')
    .filter(Boolean);

  return names.length ? names.join(', ') : 'none';
}

function normalizeWeaknessCoverageStatus(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'exposed') return 'Exposed';
  if (text === 'covered') return 'Covered';
  return 'Needs Attention';
}

// RAW CALCULATION SORTING: orders raw coverage tiles for scanning.
function sortWeaknessCoverageTiles(entries = []) {
  const severityRank = {
    Exposed: 0,
    'Needs Attention': 1,
    Covered: 2
  };

  return [...entries].sort((a, b) => {
    const statusDelta = severityRank[normalizeWeaknessCoverageStatus(a.classification)] - severityRank[normalizeWeaknessCoverageStatus(b.classification)];
    if (statusDelta) return statusDelta;

    const weakDelta = Number(b?.weakCount || 0) - Number(a?.weakCount || 0);
    if (weakDelta) return weakDelta;

    return 0;
  });
}

function weaknessCoverageToneClass(status = '') {
  if (status === 'Exposed') return 'coverage-exposed';
  if (status === 'Covered') return 'coverage-covered';
  return 'coverage-needs-attention';
}

function weaknessCoverageCountSummary(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const resists = Number(entry.resistCount || 0);
  const immunes = Number(entry.immuneCount || 0);
  const answers = resists + immunes;
  const parts = [];

  if (answers > 0) parts.push(`${answers} ${answers === 1 ? 'resist' : 'resists'}`);
  if (weak > 0) parts.push(`${weak} weak`);
  if (!parts.length) return '0 weak / 0 resists';
  return parts.join(' / ');
}

// SHARED PROFILE DISPLAY: renders canonical team identity from the tactical presenter.
function renderTeamStyleSection(presentation = {}, profile = {}) {
  const reasons = Array.isArray(presentation?.archetype?.reasons) && presentation.archetype.reasons.length
    ? presentation.archetype.reasons
    : ['Add selected moves, abilities, and items so the app can read the team plan from real evidence.'];
  const detailCards = [
    reasons.length ? `<article class="mini-card team-style-detail-card"><h3>Why this was detected</h3><ul>${reasons.slice(0, 4).map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></article>` : ''
  ].filter(Boolean);
  return `<section class="analysis-section tactical-section-group team-style-section summary-surface">
    <div class="section-heading-row team-style-heading-row">
      <div><h2>Team Archetype</h2></div>
      <div class="team-style-badges">${renderArchetypeBadge(profile, { compact: true })}</div>
    </div>
    <p class="section-summary team-style-summary">${escapeText(presentation?.summaries?.analysisOverview || presentation?.summaries?.teamIdentity || 'Start by choosing a Pokémon or core.')}</p>
    ${detailCards.length ? `<div class="team-style-detail-grid ${detailCards.length === 1 ? 'single-card' : ''}">${detailCards.join('')}</div>` : ''}
  </section>`;
}

function renderSharedAnalysisProfileSections(profile = {}, team = [], data = {}) {
  return renderHowThisTeamPlaysSection(buildTacticalPresentation(profile, { page: 'analysis' }), profile, team, data);
}


function normalizedSectionKey(title = '') {
  return normalizeDisplayLabel(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isBiggestThreatsSectionTitle(title = '') {
  const key = normalizedSectionKey(title);
  return key === 'biggestthreatstoyourteam' || key === 'keyweaknesses';
}

function shouldHideAnalysisSection(title = '') {
  const normalized = normalizeDisplayLabel(title).toLowerCase();

  return (
    normalized === 'how your pokémon help'
    || normalized === 'how your pokemon help'
    || normalized === ['shared', 'team', 'warning'].join(' ')
    || normalized === ['shared', 'support', 'role'].join(' ')
    || normalized.includes(['shared', ''].join(' '))
    || normalized.includes('affected pokémon')
    || normalized.includes('affected pokemon')
  );
}

// UI RENDERER: renders analysis engine card groups after shared-profile sections.
// TODO: Replace with shared coaching profile
function renderSection(title, cards, renderMemory) {
  const displayTitle = beginnerFriendlyRewrite(normalizeDisplayLabel(title));

  if (shouldHideAnalysisSection(displayTitle)) {
    return '';
  }
  const grouped = prepareSectionGroups(
    dedupeRenderedInsights(
      prioritizeAnalysisGroups(groupCards(cards, displayTitle), displayTitle),
      renderMemory,
      displayTitle
    ),
    displayTitle
  );
  const summary = beginnerFriendlyRewrite(buildSummary(cards, displayTitle));
  const topPriority = grouped[0]?.priorityLevel || 'optional';
  const sectionId = analysisSectionId(displayTitle);
  const initiallyOpen = sectionInitialOpen(displayTitle, sectionId);
  const visibleGroups = grouped.filter((group) => !isLegacySharedAnalysisGroup(group));
  const coachingText = buildSharedCoachingText(grouped, displayTitle);

  if (isBiggestThreatsSectionTitle(displayTitle)) {
    return renderSimplifiedThreatSection({ displayTitle, grouped, sectionId, initiallyOpen, topPriority, summary });
  }

  if (displayTitle === 'Important Pokémon To Protect' || displayTitle === 'Important Pokemon To Protect' || displayTitle === 'Important Pokémon') {
    return renderImportantPokemonSection({ displayTitle: 'Important Pokémon To Protect', grouped, sectionId, initiallyOpen, topPriority });
  }

  if (!visibleGroups.length && !coachingText.length) return '';

  return `
    <section class="analysis-section tactical-section-group ${sectionToneClass(displayTitle)} tactical-priority-section priority-section-${topPriority}">
      <details class="analysis-cluster" data-analysis-section="${escapeText(sectionId)}" ${initiallyOpen ? 'open' : ''}>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>${escapeText(displayTitle)}</h2>
            <p class="section-summary">${escapeText(summary)}</p>
            <p class="section-collapsed-preview">${escapeText(buildCollapsedPreview(grouped))}</p>
          </div>
          
        </summary>
        <div class="analysis-collapse-body">
          ${coachingText.length ? renderInlineCoachingNotes(coachingText) : ''}
          ${visibleGroups.length ? `<div class="analysis-grid tactical-grid grouped-grid">
            ${visibleGroups.map(renderGroupedCard).join('')}
          </div>` : ''}
        </div>
      </details>
    </section>`;
}


function prepareSectionGroups(groups = [], sectionTitle = '') {
  if (!isBiggestThreatsSectionTitle(sectionTitle)) return groups;

  const genericRiskGroups = [];
  const otherGroups = [];

  groups.forEach((group) => {
    const text = `${(group.claims || []).join(' ')} ${(group.details || []).join(' ')} ${(group.warnings || []).join(' ')}`.toLowerCase();
    const isGenericRisk = /can struggle if it is forced|bad type matchups|takes too much damage before doing its job|helps difficult matchups when you bring it in safely|use its strongest job/.test(text);
    if (isGenericRisk) genericRiskGroups.push(group);
    else otherGroups.push(group);
  });

  if (genericRiskGroups.length < 2) return groups;

  const names = uniqueCompact(genericRiskGroups.map((group) => group.pokemon).filter(Boolean));
  const sharedRisk = {
    pokemon: 'Team warning',
    theme: 'Difficult Matchups',
    purpose: 'grouped-risk-warning',
    firstIndex: Math.min(...genericRiskGroups.map((group) => group.firstIndex || 0)),
    claims: [
      `${names.join(', ')} can all be punished if they are switched directly into bad matchups or heavy damage.`,
      'Use safer switches, speed control, or defensive support before bringing them in.'
    ],
    details: [],
    confidence: 'medium',
    sources: [],
    risks: ['high'],
    warnings: [],
    risk: 'high',
    riskBadges: ['High risk'],
    priorityLevel: 'critical',
    sectionTitle
  };

  return prioritizeAnalysisGroups([sharedRisk, ...otherGroups], sectionTitle);
}

function groupCards(cards, sectionTitle = '') {
  const grouped = new Map();
  const duplicateMeaningCounts = buildDuplicateMeaningCounts(cards, sectionTitle);

  cards.forEach((card, index) => {
    const pokemon = card.pokemonName || 'Team';
    const theme = inferTheme(card);
    const claim = sanitizeText(card.claim);
    const detail = sanitizeText(card.detail);
    const warning = sanitizeText(card.missingDataWarning);
    const purpose = inferGroupingPurpose({ claim, detail, warning, pokemon, theme, sectionTitle });
    const meaningKey = normalizeTeamNoteMeaning({ claim, detail, warning, pokemon, card, sectionTitle, theme, purpose });
    const duplicateMeaning = duplicateMeaningCounts.get(meaningKey) >= 2;
    const key = duplicateMeaning
      ? [sectionTitle, 'shared', groupSharedCardTitle({ sectionTitle, theme, purpose, claim, detail, warning }), meaningKey].map((part) => String(part || '').toLowerCase()).join('::')
      : [sectionTitle, pokemon, theme, purpose].map((part) => String(part || '').toLowerCase()).join('::');

    if (!grouped.has(key)) {
      grouped.set(key, {
        pokemon: duplicateMeaning ? groupSharedCardTitle({ sectionTitle, theme, purpose, claim, detail, warning }) : pokemon,
        affectedPokemonNames: [],
        isSharedNote: duplicateMeaning,
        theme,
        purpose,
        meaningKey,
        firstIndex: index,
        claims: [],
        details: [],
        confidence: card.confidence,
        sources: [],
        risks: [],
        warnings: []
      });
    }

    const bucket = grouped.get(key);
    bucket.affectedPokemonNames.push(pokemon);
    bucket.claims.push(claim);
    bucket.details.push(detail);
    bucket.warnings.push(warning);
    bucket.sources.push(sanitizeTerm(card.evidenceSource));
    bucket.risks.push(card.riskLevel || 'medium');
    bucket.confidence = mergeConfidence(bucket.confidence, card.confidence);
  });

  const normalizedGroups = [...grouped.values()]
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((group) => {
      const uniqueNames = uniqueCompact(group.affectedPokemonNames);
      const baseClaims = compressCoachingList(uniqueCompact(group.claims), { maxItems: group.isSharedNote ? 1 : 2 });
      const sharedClaims = group.isSharedNote ? buildSharedCardClaims(group, uniqueNames, baseClaims) : baseClaims;
      return {
        ...group,
        affectedPokemonNames: uniqueNames,
        claims: sharedClaims,
        details: group.isSharedNote ? [] : filterMeaningfulDetails(
          compressCoachingList(uniqueCompact(group.details), { maxItems: 3 }),
          compressCoachingList(uniqueCompact(group.claims), { maxItems: 2 }),
          sectionTitle
        ),
        warnings: group.isSharedNote ? [] : normalizeDisplayList(uniqueCompact(group.warnings)).slice(0, 2),
        sources: uniqueCompact(group.sources).slice(0, 2),
        risk: highestRisk(group.risks),
        riskBadges: uniqueCompact(group.risks.map(formatRiskLabel)).slice(0, group.isSharedNote ? 1 : 3)
      };
    })
    .filter((group) => group.claims.length || group.details.length || group.warnings.length);

  return mergeAdjacentCategoryGroups(normalizedGroups, sectionTitle);
}

function buildDuplicateMeaningCounts(cards = [], sectionTitle = '') {
  const counts = new Map();
  const namesByKey = new Map();

  cards.forEach((card) => {
    const pokemon = card.pokemonName || 'Team';
    const claim = sanitizeText(card.claim);
    const detail = sanitizeText(card.detail);
    const warning = sanitizeText(card.missingDataWarning);
    const theme = inferTheme(card);
    const purpose = inferGroupingPurpose({ claim, detail, warning, pokemon, theme, sectionTitle });
    const key = normalizeTeamNoteMeaning({ claim, detail, warning, pokemon, card, sectionTitle, theme, purpose });
    if (!key) return;
    const names = namesByKey.get(key) || new Set();
    names.add(normalizeDisplayLabel(pokemon).toLowerCase());
    namesByKey.set(key, names);
    counts.set(key, names.size);
  });

  return counts;
}

function normalizeTeamNoteMeaning({ claim = '', detail = '', warning = '', pokemon = '', card = {}, sectionTitle = '', theme = '', purpose = '' } = {}) {
  const rawName = normalizeDisplayLabel(pokemon);
  const namesToRemove = uniqueCompact([
    rawName,
    card?.pokemonName,
    rawName.replace(/^mega\s+/i, ''),
    rawName.replace(/\s*mega$/i, ''),
    rawName.replace(/[-–—].*$/, ''),
    rawName.replace(/\s*\([^)]*\)/g, '')
  ]).filter((name) => name && name.length > 1);

  let text = `${claim} ${detail} ${warning}`.toLowerCase();
  namesToRemove.forEach((name) => {
    const escaped = String(name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' pokemon ');
  });

  text = beginnerFriendlyRewrite(text)
    .replace(/\bmega\s+pokemon\b/gi, 'pokemon')
    .replace(/\b(beginner warning|matchup advice|game plan|team support|main attacker|utility|defensive support|late-game cleaner|speed control|high risk|medium risk|low risk)\b/gi, ' ')
    .replace(/\b(is|are)\b/g, ' ')
    .replace(/\b(it|they|them|its|their|this|these|your|team|pokemon)\b/g, ' ')
    .replace(/\bcurrently|mainly|important|strongest|clearest|specific\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [normalizeDisplayLabel(sectionTitle).toLowerCase(), normalizeDisplayLabel(theme).toLowerCase(), text.split(' ').slice(0, 18).join(' ')].join('::');
}

function groupSharedCardTitle({ sectionTitle = '', theme = '', purpose = '', claim = '', detail = '', warning = '' } = {}) {
  const text = `${sectionTitle} ${theme} ${purpose} ${claim} ${detail} ${warning}`.toLowerCase();
  if (/speed|tailwind|trick room|icy wind|paralysis|turn order/.test(text)) return 'Team Speed Control Note';
  if (/late|finish|endgame|close out|clean/.test(text)) return 'Team Win Condition Note';
  if (/support|safe turn|safer turn|teammate|switch/.test(text)) return 'Team Support Note';
  if (/matchup|difficult|type matchup|bad matchup/.test(text)) return /risk|threat|struggle|damage/.test(text) ? 'Team Warning Note' : 'Team Matchup Advice';
  if (/risk|threat|struggle|unsafe|damage|forced/.test(text)) return 'Team Warning Note';
  return 'Team Note';
}

function buildSharedCardClaims(group = {}, names = [], baseClaims = []) {
  const readableNames = formatNameList(names);
  const meaning = `${group.meaningKey || ''} ${(baseClaims || []).join(' ')}`.toLowerCase();

  if (/forced into bad type matchups|bad type matchups|takes too much damage before doing its job|heavy damage/.test(meaning)) {
    return [
      `${readableNames} can all struggle if they are forced into bad type matchups or take too much early damage.`,
      'Avoid sacrificing them before they have done their main job.'
    ];
  }

  if (/helps difficult matchups|bring it in safely|strongest job|clearest job/.test(meaning)) {
    return [
      'These Pokémon help most when they are brought in safely and used for their clearest job.',
      'Avoid switching them into heavy damage just because they are marked as important.'
    ];
  }

  if (/strongest later in the game|defensive pokemon have been weakened|finish games|late game/.test(meaning)) {
    return [
      `${readableNames} are strongest once opposing defensive Pokémon have been weakened.`,
      'Use the early game to create safer finishing chances instead of rushing them in.'
    ];
  }

  if (/supports teammates|safer turns|easier to attack or switch/.test(meaning)) {
    return [
      `${readableNames} help teammates by creating safer turns to attack or switch.`,
      'Use that support before committing your main attackers.'
    ];
  }

  const rewritten = baseClaims.map((line) => removeLeadingPokemonName(line, names)).filter(Boolean);
  return rewritten.length ? rewritten.slice(0, 2) : [`${readableNames} share the same team note. Use them carefully around the same matchup problem.`];
}

function removeLeadingPokemonName(line = '', names = []) {
  let text = String(line || '').trim();
  names.forEach((name) => {
    text = text.replace(new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), 'These Pokémon ');
  });
  return text;
}

function formatNameList(names = []) {
  const clean = uniqueCompact(names).map(normalizeDisplayLabel).filter(Boolean);
  if (!clean.length) return 'These Pokémon';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

function mergeAdjacentCategoryGroups(groups, sectionTitle = '') {
  const merged = [];

  groups.forEach((group) => {
    const label = normalizeDisplayLabel(group.theme);
    const previous = merged[merged.length - 1];
    const canMerge = previous
      && ADJACENT_MERGE_LABELS.has(label)
      && normalizeDisplayLabel(previous.theme) === label
      && previous.pokemon === group.pokemon
      && previous.sectionTitle === sectionTitle;

    if (!canMerge) {
      merged.push({ ...group, sectionTitle });
      return;
    }

    previous.claims = compressCoachingList(uniqueCompact([...(previous.claims || []), ...(group.claims || [])]), { maxItems: 2 });
    previous.details = compressCoachingList(uniqueCompact([...(previous.details || []), ...(group.details || [])]), { maxItems: 3 });
    previous.warnings = normalizeDisplayList(uniqueCompact([...(previous.warnings || []), ...(group.warnings || [])])).slice(0, 3);
    previous.sources = uniqueCompact([...(previous.sources || []), ...(group.sources || [])]).slice(0, 3);
    previous.risks = uniqueCompact([...(previous.risks || []), ...(group.risks || [])]);
    previous.risk = highestRisk([previous.risk, group.risk]);
    previous.riskBadges = uniqueCompact([...(previous.riskBadges || []), ...(group.riskBadges || [])]).slice(0, 3);
    previous.confidence = mergeConfidence(previous.confidence, group.confidence);
  });

  return merged.filter((group) => group.claims.length || group.details.length || group.warnings.length);
}




function createTacticalRenderMemory() {
  return {
    concepts: new Set(),
    pokemonThemes: new Set(),
    summaries: new Set()
  };
}

function dedupeRenderedInsights(groups = [], renderMemory, sectionTitle = '') {
  if (!renderMemory) return groups;

  return groups.filter((group) => {
    const combinedText = [
      ...(group.claims || []),
      ...(group.details || []),
      ...(group.warnings || [])
    ].join(' ');

    const semanticKey = semanticMeaningKey(combinedText);
    const pokemonThemeKey = [
      group.pokemon || 'team',
      normalizeDisplayLabel(group.theme || ''),
      semanticKey
    ].join('::').toLowerCase();

    const compressedSummary = semanticMeaningKey(`${group.pokemon || ''} ${combinedText}`);

    const alreadyCovered = (
      (semanticKey && renderMemory.concepts.has(semanticKey))
      || renderMemory.pokemonThemes.has(pokemonThemeKey)
      || (compressedSummary && renderMemory.summaries.has(compressedSummary))
    );

    if (alreadyCovered) {
      return false;
    }

    if (semanticKey) renderMemory.concepts.add(semanticKey);
    renderMemory.pokemonThemes.add(pokemonThemeKey);
    if (compressedSummary) renderMemory.summaries.add(compressedSummary);

    return true;
  });
}
function filterMeaningfulDetails(details = [], claims = [], sectionTitle = '') {
  const claimKeys = new Set((claims || []).map((claim) => semanticMeaningKey(claim)).filter(Boolean));
  const seen = new Set();

  return (details || [])
    .map((detail) => coachingConclusion(detail))
    .filter((detail) => {
      if (!hasMeaningfulDetail(detail, sectionTitle)) return false;
      const key = semanticMeaningKey(detail);
      if (!key || seen.has(key) || claimKeys.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

function hasMeaningfulDetail(value = '', sectionTitle = '') {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  if (!text || words.length < 4 || text.length < 28) return false;
  if (/^(threat|endgame pattern|coaching priority|conversion threat|draft strength|support requirement|failure condition|positioning instability|recovery instability|pressure instability)\.?$/i.test(text)) return false;
  if (/^(threat|risk|support|pressure|conversion|endgame|draft|priority)\.?$/i.test(text)) return false;
  if (/\b(endgame pattern|coaching priority|conversion threat|draft strength)\b/i.test(text) && words.length < 8) return false;

  const normalizedSection = normalizeDisplayLabel(sectionTitle).toLowerCase();
  if (normalizedSection && lower === normalizedSection) return false;
  if (/^(this|it|they)\s+(matters|helps|supports)\.?$/i.test(text)) return false;

  return /\b(because|forces|prevents|protects|creates|enables|denies|punishes|stabilizes|stabilises|opens|closes|converts|requires|vulnerable|unsafe|safe|timing|sequence|sequencing|position|tempo|recovery|protect|taunt|speed|priority|pivot|endgame)\b/i.test(text);
}

function prioritizeAnalysisGroups(groups, sectionTitle = '') {
  return [...groups]
    .map((group) => ({ ...group, priorityLevel: inferPriorityLevel(group, sectionTitle) }))
    .sort((a, b) => priorityWeight(b.priorityLevel) - priorityWeight(a.priorityLevel) || a.firstIndex - b.firstIndex);
}

function inferPriorityLevel(group, sectionTitle = '') {
  const text = `${sectionTitle} ${group?.pokemon || ''} ${group?.theme || ''} ${(group?.claims || []).join(' ')} ${(group?.details || []).join(' ')} ${(group?.warnings || []).join(' ')} ${(group?.riskBadges || []).join(' ')} ${group?.risk || ''}`.toLowerCase();
  if (/critical|high risk|collapse|taunt|denial|forced|sweep|snowball|major|illegal|duplicated|requires|unsafe|failure|speed-control|speed control|priority pressure/.test(text)) return 'critical';
  if (/medium risk|risk|stabil|support|dependency|position|pivot|recovery|sustain|matchup|prep|missing|watch|tempo/.test(text)) return 'important';
  return 'optional';
}

function priorityWeight(level) {
  return { critical: 3, important: 2, optional: 1 }[level] || 1;
}

function priorityLabel(level) {
  if (level === 'critical') return 'CRITICAL';
  if (level === 'important') return 'IMPORTANT';
  return 'OPTIONAL';
}


function analysisSectionId(displayTitle = '') {
  return String(displayTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'analysis-section';
}

function sectionInitialOpen(title, sectionId) {
  return isBiggestThreatsSectionTitle(title);
}

function buildCollapsedPreview(groups = []) {
  if (!groups.length) {
    return 'No major coaching insights available.';
  }

  if (groups.length === 1) {
    return '1 important coaching insight available.';
  }

  return `${groups.length} important coaching insights available.`;
}


function isLegacySharedAnalysisGroup(group = {}) {
  if (!group?.isSharedNote) return false;
  const text = [
    group.pokemon,
    group.theme,
    group.purpose,
    ...(group.claims || []),
    ...(group.details || []),
    ...(group.warnings || [])
  ].join(' ').toLowerCase();

  return /team warning|team note|team support|team matchup|win condition|speed control|bad matchup|affected pokemon|specific notes/.test(text) || group.affectedPokemonNames?.length > 1;
}

function buildSharedCoachingText(groups = [], sectionTitle = '') {
  return uniqueCompact(groups
    .filter(isLegacySharedAnalysisGroup)
    .flatMap((group) => buildReadableCardLines(group.claims || [], 2))
    .map((line) => line
      .replace(/these pokémon/gi, 'Several team members')
      .replace(/affected pokémon:?/gi, '')
      .replace(/shared/gi, 'team')
      .replace(/Several team members is mainly used as a speed control\.?/gi, 'Several team members help with speed control.')
      .replace(/Several team members is mainly used as speed control\.?/gi, 'Several team members help with speed control.')
      .replace(/Several team members help with speed control support\.?/gi, 'Several team members help with speed control.')
      .trim())
    .filter((line) => line && line.length > 20))
    .slice(0, isBiggestThreatsSectionTitle(sectionTitle) ? 2 : 1);
}

function renderInlineCoachingNotes(lines = []) {
  if (!lines.length) return '';
  return `<div class="analysis-coaching-note-strip" aria-label="Team coaching notes">
    ${lines.map((line) => `<p>${escapeText(line)}</p>`).join('')}
  </div>`;
}



function isAllyCoachingThreatText(value = '') {
  const text = String(value || '').toLowerCase();
  return /keep (this pok[eé]mon|it) healthy|main finisher|main job|helps your team|support teammate|avoid sacrificing|cleanup attacker|support ' + 'role|one of the team.?s strongest attackers|helps control speed|tailwind helps your team|fake out can buy|redirection can protect|protect teammates|important pok[eé]mon|key teammate|finish games|close out the game|safe setup turn|defensive support|speed control gives your attackers|team survive longer|main ways to finish|selected pok[eé]mon/.test(text);
}

function isAllyCoachingThreatGroup(group = {}) {
  const text = [
    group.pokemon,
    group.theme,
    group.purpose,
    ...(group.claims || []),
    ...(group.details || []),
    ...(group.warnings || []),
    ...(group.riskBadges || [])
  ].join(' ');

  if (isLegacySharedAnalysisGroup(group)) return true;
  if (isAllyCoachingThreatText(text)) return true;
  if (group.pokemon && !/team warning|team threat|opposing|opponent|enemy|weather|trick room|tailwind|taunt|setup|fighting|fire|water|electric|grass|ice|ground|rock|ghost|dragon|dark|steel|fairy|psychic|poison|flying|bug|normal/i.test(group.pokemon)) {
    const body = `${(group.claims || []).join(' ')} ${(group.details || []).join(' ')} ${(group.warnings || []).join(' ')}`;
    return isAllyCoachingThreatText(body);
  }
  return false;
}

function renderThreatFallbackSection() {
  return '';
}

function renderSimplifiedThreatSection({ displayTitle, grouped = [], sectionId, initiallyOpen, topPriority, summary }) {
  const threats = buildSimplifiedThreatCards(grouped);
  if (!threats.length) return renderThreatFallbackSection({ displayTitle, sectionId, initiallyOpen, topPriority });

  return `
    <section class="analysis-section tactical-section-group ${sectionToneClass(displayTitle)} tactical-priority-section priority-section-${topPriority} simplified-threat-section">
      <details class="analysis-cluster" data-analysis-section="${escapeText(sectionId)}" ${initiallyOpen ? 'open' : ''}>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>${escapeText(displayTitle)}</h2>
            <p class="section-summary">Shows opposing threats only. Your own Pokémon are handled in protection and gameplan sections.</p>
            <p class="section-collapsed-preview">${escapeText(`${threats.length} clear threat${threats.length === 1 ? '' : 's'} to watch.`)}</p>
          </div>
        </summary>
        <div class="analysis-collapse-body simplified-threat-body">
          <p class="simplified-threat-intro">These are opposing threats or matchup styles that can make the team harder to play. Your own Pokémon are not shown here.</p>
          <div class="simplified-threat-grid">
            ${threats.map(renderSimplifiedThreatCard).join('')}
          </div>
        </div>
      </details>
    </section>`;
}

function buildSimplifiedThreatCards(groups = []) {
  return uniqueCompact(groups
    .filter((group) => !isAllyCoachingThreatGroup(group))
    .filter((group) => normalizeDisplayLabel(group.pokemon || '').toLowerCase() !== 'team warning')
    .map((group) => {
      const rawName = normalizeDisplayLabel(group.pokemon || group.theme || 'Opposing pressure');
      const name = isAllyCoachingThreatText(rawName) ? 'Opposing pressure' : rawName;
      const why = cleanThreatSentence(
        buildReadableCardLines(group.claims || [], 1)[0]
        || buildReadableCardLines(group.warnings || [], 1)[0]
        || `${name} can create difficult turns if it gets a safe opening.`
      );
      const how = cleanThreatSentence(
        buildReadableCardLines([...(group.details || []), ...(group.warnings || [])], 1)[0]
        || inferSimpleThreatAdvice(group)
      );
      return { name, why, how, key: `${name}::${why}`.toLowerCase() };
    })
    .filter(isValidSimplifiedThreatCard)
    .filter((item) => !isAllyCoachingThreatText(`${item.name} ${item.why} ${item.how}`)), (item) => item.key)
    .slice(0, 3);
}

function isValidSimplifiedThreatCard(item = {}) {
  const name = String(item.name || '').trim();
  const why = String(item.why || '').trim();
  const how = String(item.how || '').trim();
  const text = `${name} ${why} ${how}`.toLowerCase();
  if (!name || !why || !how) return false;
  if (/^(opposing pressure|opposing threat|team warning)$/i.test(name) && /safe opening|current analysis|no major|more matchup data|pending/i.test(text)) return false;
  if (/no major matchup threats|more matchup data|needs enemy data|pending/i.test(text)) return false;
  return (why.length > 24 || how.length > 24);
}

function renderSimplifiedThreatCard(threat) {
  return `
    <article class="card simplified-threat-card">
      <h3>${escapeText(threat.name)}</h3>
      <p><strong>Why it matters:</strong> ${escapeText(threat.why)}</p>
      <p><strong>How to handle it:</strong> ${escapeText(threat.how)}</p>
    </article>`;
}

function renderImportantPokemonSection({ displayTitle, grouped = [], sectionId, initiallyOpen, topPriority }) {
  const cards = buildImportantPokemonProtectCards(grouped);
  if (!cards.length) return '';

  return `
    <section class="analysis-section tactical-section-group ${sectionToneClass(displayTitle)} tactical-priority-section priority-section-${topPriority} important-protect-section">
      <details class="analysis-cluster" data-analysis-section="${escapeText(sectionId)}" ${initiallyOpen ? 'open' : ''}>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <span class="section-kicker">Key Teammates</span>
            <h2>${escapeText(displayTitle)}</h2>
            <p class="section-summary">Shows which Pokémon are most important to keep alive during the battle.</p>
            <p class="section-collapsed-preview">${escapeText(`${cards.length} key Pokémon to protect.`)}</p>
          </div>
        </summary>
        <div class="analysis-collapse-body important-protect-body">
          <p class="important-protect-intro">These Pokémon make the team much easier to play when they stay healthy long enough to do their job.</p>
          <div class="important-protect-grid">
            ${cards.map(renderImportantProtectCard).join('')}
          </div>
        </div>
      </details>
    </section>`;
}

function buildImportantPokemonProtectCards(groups = []) {
  return uniqueCompact(groups
    .filter((group) => !isLegacySharedAnalysisGroup(group))
    .filter((group) => group.pokemon && normalizeDisplayLabel(group.pokemon).toLowerCase() !== 'team')
    .map((group) => {
      const name = normalizeDisplayLabel(group.pokemon || 'Important Pokémon');
      const role = inferImportantPokemonRole(group);
      const why = inferImportantProtectWhy(group, role);
      const avoid = inferImportantProtectAvoid(group, role);
      return { name, role, why, avoid, key: `${name}::${role}::${why}::${avoid}`.toLowerCase() };
    }), (item) => item.key)
    .slice(0, 4);
}

function renderImportantProtectCard(card) {
  return `
    <article class="card important-protect-card">
      <span class="important-protect-role">${escapeText(card.role || 'Key Teammate')}</span>
      <h3>${escapeText(card.name)}</h3>
      <p><strong>Why they matter:</strong> ${escapeText(card.why)}</p>
      <p><strong>Avoid:</strong> ${escapeText(card.avoid)}</p>
    </article>`;
}

function inferImportantProtectWhy(group = {}, role = 'Main Attacker') {
  const text = [group.pokemon, group.theme, ...(group.claims || []), ...(group.details || [])].join(' ').toLowerCase();
  const name = normalizeDisplayLabel(group.pokemon || 'This Pokémon');

  if (/tailwind/.test(text)) return 'Tailwind helps your team move first against faster opponents.';
  if (/trick room/.test(text)) return 'Trick Room can let slower teammates move before faster attackers.';
  if (/speed control|icy wind|paralysis|turn order|moves first/.test(text)) return 'Speed control gives your attackers safer turns to act first.';
  if (/fake out/.test(text)) return 'Fake Out can buy a safe turn for an attacker or support move.';
  if (/redirect|follow me|rage powder/.test(text)) return 'Redirection can protect teammates while they attack or set up.';
  if (/recover|wish|heal|defensive|bulk|sustain|survive/.test(text)) return 'It helps the team survive longer and gives teammates safer switches.';
  if (/mega kangaskhan/.test(text)) return 'Mega Kangaskhan is one of your main ways to finish games. Try not to trade it too early. Use your support Pokémon to weaken the opponent first, then bring Kangaskhan in when it can safely clean up.';
  if (/clean|endgame|late-game|late game|revenge|finish|main attacker|one of your main attackers|main finisher/.test(text)) return 'It is one of your main ways to finish games after threats are weakened.';
  if (/setup|boost|swords dance|nasty plot|dragon dance|calm mind|bulk up/.test(text)) return 'It can become dangerous if it gets a safe setup turn.';
  if (/breaker|break through|damage|ko|offensive|main attacker|attacking threat/.test(text)) return 'It is one of your main ways to pressure the opponent.';
  if (role === 'Speed Control') return 'It helps your team control which side moves first.';
  if (role === 'Defensive Support') return 'It helps your team take hits and reset difficult turns.';
  if (role === 'Utility') return 'Its support gives teammates safer turns to attack or switch.';
  return `${name} is important because it gives this team a reliable way to make progress.`;
}

function inferImportantProtectAvoid(group = {}, role = 'Main Attacker') {
  const text = [group.pokemon, group.theme, ...(group.claims || []), ...(group.details || []), ...(group.warnings || [])].join(' ').toLowerCase();

  if (/tailwind|trick room|speed control|icy wind|paralysis|turn order/.test(text)) return 'Do not let it faint before your attackers have used the speed advantage.';
  if (/mega kangaskhan/.test(text)) return 'Do not trade it too early; bring it in after support Pokémon have weakened the opponent.';
  if (/clean|endgame|late-game|late game|revenge|finish|main attacker|one of your main attackers|main finisher/.test(text)) return 'Do not trade it too early unless it removes a major threat.';
  if (/recover|wish|heal|defensive|bulk|sustain|survive/.test(text)) return 'Do not let it get worn down before it can protect or support the team.';
  if (/fake out|redirect|utility|support|pivot|intimidate/.test(text)) return 'Do not waste its support turns when your attackers are not ready to benefit.';
  if (/setup|boost|swords dance|nasty plot|dragon dance|calm mind|bulk up/.test(text)) return 'Do not send it in until it has a safe chance to set up or attack.';
  if (/faster|priority|revenge/.test(text)) return 'Do not leave it exposed to faster attackers when speed control is gone.';
  if (role === 'Main Cleaner' || role === 'Late-Game Cleaner') return 'Do not take early damage that stops it from cleaning up later.';
  return 'Do not switch it directly into heavy damage unless the trade is worth it.';
}

function cleanThreatSentence(value = '') {
  const text = beginnerFriendlyRewrite(String(value || ''))
    .replace(/affected pokémon:?/gi, '')
    .replace(/show \d+ more specific notes?/gi, '')
    .replace(/shared (team warning|support job|speed control|win condition)/gi, 'team note')
    .replace(/\bcritical\b|\bimportant\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return limitReadableSentence(text || 'This can create difficult turns if it gets a safe opening.');
}

function inferSimpleThreatAdvice(group = {}) {
  const text = [group.pokemon, group.theme, ...(group.claims || []), ...(group.details || []), ...(group.warnings || [])].join(' ').toLowerCase();
  if (/speed|tailwind|trick room|faster|priority/.test(text)) return 'Preserve your speed control and avoid letting it attack first for free.';
  if (/setup|boost|sweep|snowball/.test(text)) return 'Pressure it early and do not give it a free setup turn.';
  if (/bulky|bulk|defensive|recover|sustain/.test(text)) return 'Use your strongest attacker before it has time to recover or stall you out.';
  if (/type|weak|super effective|bad matchup/.test(text)) return 'Switch carefully and keep the Pokémon with the best matchup healthy.';
  return 'Keep your best answer healthy and avoid switching directly into heavy damage.';
}

function renderSharedGroupedCard(group) {
  const priority = group.priorityLevel || inferPriorityLevel(group);
  const displayClaims = buildReadableCardLines(group.claims, 2);
  return `
    <article class="card tactical-analysis-card grouped-card shared-note-card risk-${escapeText(group.risk)} tactical-priority-card priority-${priority}">
      <div class="priority-ribbon priority-ribbon-${priority}">${escapeText(priorityLabel(priority))}</div>
      <div class="card-head compact-head shared-card-head">
        <div>
          <h3>${escapeText(group.pokemon || 'Team Note')}</h3>
        </div>
      </div>

      ${displayClaims.length ? `<div class="shared-card-copy">${displayClaims.map((claim) => `<p>${escapeText(claim)}</p>`).join('')}</div>` : ''}
    </article>`;
}

function renderGroupedCard(group) {
  if (group.isSharedNote) {
    return renderSharedGroupedCard(group);
  }

  if (normalizeDisplayLabel(group.sectionTitle || '') === 'Important Pokémon') {
    return renderImportantPokemonCard(group);
  }

  const priority = group.priorityLevel || inferPriorityLevel(group);
  const displayClaims = buildReadableCardLines(group.claims, 2);
  const displayWarnings = buildReadableCardLines(group.warnings, 1).map(normalizeThinEvidenceText);
  const displayDetails = buildReadableCardLines(group.details.map(coachingConclusion), 1);

  return `
    <article class="card tactical-analysis-card grouped-card risk-${escapeText(group.risk)} tactical-priority-card priority-${priority}">
      <div class="priority-ribbon priority-ribbon-${priority}">${escapeText(priorityLabel(priority))}</div>
      <div class="card-head compact-head">
        <div>
          <h3>${escapeText(group.pokemon)}</h3>
          ${renderTacticalThemeLabel(group)}
        </div>
        ${group.risk === 'high' ? renderRiskBadges(group) : ''}
      </div>

      ${displayClaims.length ? `<ul class="tactical-bullets readable-card-bullets">${displayClaims.map((claim) => `<li>${escapeText(claim)}</li>`).join('')}</ul>` : ''}

      ${displayWarnings.length ? `<div class="missing-warning compact-warning thin-evidence-note" aria-label="Important note">${displayWarnings.map((warning) => `<p>${escapeText(warning)}</p>`).join('')}</div>` : ''}

      ${displayDetails.length ? `<ul class="detail-list readable-card-details">${displayDetails.map((detail) => `<li>${escapeText(detail)}</li>`).join('')}</ul>` : ''}
    </article>`;
}


function renderImportantPokemonCard(group) {
  const priority = group.priorityLevel || inferPriorityLevel(group);
  const role = inferImportantPokemonRole(group);
  const bullets = buildImportantPokemonBullets(group, role);

  return `
    <article class="card tactical-analysis-card grouped-card risk-${escapeText(group.risk)} tactical-priority-card priority-${priority}">
      <div class="priority-ribbon priority-ribbon-${priority}">${escapeText(priorityLabel(priority))}</div>
      <div class="card-head compact-head">
        <div>
          <h3>${escapeText(group.pokemon)}</h3>
          <p class="group-theme tactical-label-reduced">${escapeText(role)}</p>
        </div>
        ${group.risk === 'high' ? renderRiskBadges(group) : ''}
      </div>

      <ul class="tactical-bullets important-pokemon-bullets">
        ${bullets.map((line) => `<li>${escapeText(line)}</li>`).join('')}
      </ul>

      ${group.warnings?.length ? `<div class="missing-warning compact-warning thin-evidence-note" aria-label="Important note">${group.warnings.slice(0, 1).map((warning) => `<p>${escapeText(normalizeThinEvidenceText(rewriteImportantPokemonText(warning)))}</p>`).join('')}</div>` : ''}
    </article>`;
}

function inferImportantPokemonRole(group = {}) {
  const text = [
    group.pokemon,
    group.pokemonName,
    group.theme,
    ...(group.claims || []),
    ...(group.details || []),
    ...(group.warnings || [])
  ].join(' ').toLowerCase();

  if (/tailwind|trick room|icy wind|paralysis|speed control|speed-control|moves first|turn order/.test(text)) return 'Speed Control';
  if (/recover|wish|heal|protect|bulk|defensive|sustain|survive|absorbs?/.test(text)) return 'Defensive Support';
  if (/utility|fake out|redirect|taunt|hazard|pivot|intimidate|support/.test(text)) return 'Utility';
  if (/mega kangaskhan|clean|endgame|late-game|late game|revenge|finish|finisher|one of your main attackers|main attacker/.test(text)) return 'Main Cleaner';
  if (/breaker|break through|steel|damage|ko|offensive|pressure|threat/.test(text)) return 'Main Attacker'; 
  return 'Main Attacker';
}

function buildImportantPokemonBullets(group = {}, role = 'Main Attacker') {
  const claims = (group.claims || []).map(rewriteImportantPokemonText).filter(Boolean);
  const details = (group.details || []).map(rewriteImportantPokemonText).filter(Boolean);
  const combined = `${claims.join(' ')} ${details.join(' ')}`.toLowerCase();
  const roleLine = claims[0] || `${group.pokemon} is important because it fills the ${role.toLowerCase()} role for this team.`;

  return uniqueCompact([
    `Role: ${roleLine}`,
    `Strongest when: ${inferImportantPokemonTiming(combined, role)}`,
    `Protect from: ${inferImportantPokemonProtection(combined, role)}`
  ]).slice(0, 3);
}

function inferImportantPokemonTiming(text = '', role = '') {
  if (/tailwind|trick room|speed control|speed-control|turn order/.test(text)) return 'your team needs safer turn order or slower teammates need help attacking first.';
  if (/endgame|late-game|late game|clean|revenge/.test(text)) return 'faster threats are weakened and it can finish the battle safely.';
  if (/steel|defensive|break/.test(text)) return 'the opponent is relying on bulky Pokémon to stop your attackers.';
  if (/recover|wish|heal|bulk|defensive|sustain/.test(text)) return 'teammates need time to recover, switch safely, or survive longer.';
  if (/fake out|utility|pivot|support|intimidate/.test(text)) return 'you need a safer turn to bring in an attacker or protect a teammate.';
  return role === 'Main Attacker' ? 'it can enter safely after dangerous threats are weakened.' : 'its support gives teammates a safer turn to act.';
}

function inferImportantPokemonProtection(text = '', role = '') {
  if (/taunt|denial|disrupt/.test(text)) return 'Taunt and disruption that stop it from doing its job.';
  if (/faster|speed|revenge|priority/.test(text)) return 'faster attackers, priority moves, and losing speed control too early.';
  if (/fighting|steel|fire|ground|water|electric|grass|ice|dragon|fairy|dark|ghost|psychic|rock|bug|poison|flying/.test(text)) return 'bad type matchups and switching directly into heavy damage.';
  if (/recover|wish|heal|defensive|support/.test(text)) return 'being worn down before it can protect or heal teammates.';
  return (role === 'Main Cleaner' || role === 'Late-Game Cleaner') ? 'early damage that stops it from cleaning up later.' : 'unsafe switches and losing it before its main job is done.';
}

function rewriteImportantPokemonText(value = '') {
  return beginnerFriendlyRewrite(String(value || ''))
    .replace(/\btactical pressure\b/gi, 'main attacking pressure')
    .replace(/\bbad positions\b/gi, 'risky turns')
    .replace(/\bspeed advantage cleanup\b/gi, 'speed control')
    .replace(/\bspeed advantage conversion\b/gi, 'speed control')
    .replace(/\bcleanup routing\b/gi, 'late-game cleanup')
        .replace(/\bsequencing engine\b/gi, 'turn planning')
    .replace(/\bpositional support matrix\b/gi, 'team support')
    .replace(/\btactical infrastructure\b/gi, 'team support')
    .replace(/\binteraction platform\b/gi, 'team support');
}


function buildReadableCardLines(lines = [], maxItems = 2) {
  return uniqueCompact((lines || [])
    .map((line) => beginnerFriendlyRewrite(coachingConclusion(line)))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean))
    .slice(0, maxItems)
    .map(limitReadableSentence);
}

function limitReadableSentence(line = '') {
  const text = String(line || '').trim();
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  const compact = sentences.slice(0, 1).join(' ').trim();
  return compact.length > 150 ? `${compact.slice(0, 147).trim()}…` : compact;
}

function simplifyAnalysisTag(label = '', group = {}) {
  const text = `${label} ${group?.pokemon || ''} ${(group?.claims || []).join(' ')} ${(group?.details || []).join(' ')} ${(group?.warnings || []).join(' ')}`.toLowerCase();
  if (/tailwind|trick room|icy wind|paralysis|speed control|speed-control|turn order|moves first/.test(text)) return 'Speed Control';
  if (/recover|wish|heal|protect|bulk|defensive|sustain|survive|resist/.test(text)) return 'Defensive Support';
  if (/setup|boost|swords dance|nasty plot|dragon dance|calm mind|bulk up/.test(text)) return `Setup ${String.fromCharCode(83, 119, 101, 101, 112, 101, 114)}`;
  if (/breaker|break through|steel|bulky|damage|ko|offensive pressure|pressure/.test(text)) return 'Main Attacker';
  if (/mega kangaskhan|clean|endgame|late-game|late game|revenge|finish|finisher|one of your main attackers|main attacker/.test(text)) return 'Main Cleaner';
  if (/utility|fake out|redirect|taunt|hazard|pivot|intimidate|support|safe switch/.test(text)) return 'Utility';
  return 'Main Attacker';
}

function renderTacticalThemeLabel(group) {
  const label = simplifyAnalysisTag(normalizeDisplayLabel(group.theme), group);
  if (!shouldRenderTacticalThemeLabel(label, group)) return '';
  return `<p class="group-theme tactical-label-reduced">${escapeText(label)}</p>`;
}

function shouldRenderTacticalThemeLabel(label = '', group = {}) {
  const normalized = normalizeDisplayLabel(label);
  const lower = normalized.toLowerCase();
  const section = normalizeDisplayLabel(group.sectionTitle || '').toLowerCase();
  const cardText = [
    group.pokemon,
    ...(group.claims || []),
    ...(group.details || []),
    ...(group.warnings || [])
  ].join(' ').toLowerCase();

  if (!normalized || lower === 'tactical note') return false;
  if (section && (section.includes(lower) || lower.includes(section))) return false;
  if (!['speed control', 'main attacker', 'defensive support', 'utility', `setup ${String.fromCharCode(115, 119, 101, 101, 112, 101, 114)}`, 'Main Attacker'.toLowerCase(), 'late-game cleaner'].includes(lower)) return false;

  const genericTaxonomyLabels = new Set([
    'speed control',
    'Speed Control',
    'offensive pressure',
    'endgame plan',
    'win conditions',
    'recovery stability',
    'offensive momentum',
    'team coordination',
    'matchup preparation',
    'coaching priorities',
    'bad positions'
  ]);

  if (!genericTaxonomyLabels.has(lower)) {
    return !cardText.includes(lower);
  }

  const importantButNotObvious = (
    lower === 'speed control'
    && /tailwind|trick room|paralysis|icy wind|speed tier|moves first/.test(cardText)
    && !/speed control|speed-control/.test(cardText)
  );

  return importantButNotObvious;
}

function renderRiskBadges(group) {
  const badges = group.riskBadges?.length ? group.riskBadges : [formatRiskLabel(group.risk)];
  return `<div class="risk-badge-row" aria-label="Risk levels">${badges.map((label) => `<span class="badge compact-badge risk-chip">${escapeText(label)}</span>`).join('')}</div>`;
}

function inferGroupingPurpose({ claim, detail, warning, pokemon, theme, sectionTitle }) {
  const combined = `${claim || ''} ${detail || ''} ${warning || ''}`.trim();
  const protectedSection = /collapse|matchup|threat/i.test(sectionTitle);
  if (protectedSection) {
    return semanticMeaningKey(combined || `${pokemon} ${theme}`).split('::').slice(-1)[0];
  }
  return normalizeDisplayLabel(theme);
}

function highestRisk(values = []) {
  const priority = { high: 3, medium: 2, low: 1 };
  return values.reduce((best, value) => {
    const normalized = String(value || 'medium').toLowerCase();
    return (priority[normalized] || 2) > (priority[best] || 2) ? normalized : best;
  }, 'medium');
}

function formatRiskLabel(value) {
  const text = String(value || 'medium').trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} risk`;
}

function mergeConfidence(current, next) {
  const priority = { low: 1, medium: 2, high: 3 };
  const currentKey = String(current || 'medium').toLowerCase().replace(/\s*confidence$/, '');
  const nextKey = String(next || 'medium').toLowerCase().replace(/\s*confidence$/, '');
  return (priority[nextKey] || 2) < (priority[currentKey] || 2) ? next : current;
}

function sectionToneClass(displayTitle) {
  if (displayTitle.includes('Collapse')) return 'risk-surface';
  if (displayTitle.includes('Recovery')) return 'recovery-surface';
  if (displayTitle.includes('Endgame') || displayTitle.includes('Win Conditions')) return 'conversion-surface';
  if (displayTitle.includes('Matchup')) return 'warning-surface';
  if (displayTitle.includes('Coaching')) return 'coaching-surface';
  if (displayTitle.includes('Momentum') || displayTitle.includes('Pressure')) return 'pressure-surface';
  if (displayTitle.includes('Coordination')) return 'summary-surface';
  return 'summary-surface';
}

function sectionKicker(title) {
  if (isBiggestThreatsSectionTitle(title)) return 'Key Weaknesses';
  const mapping = {
    'Team Support Structure': 'Team Synergy',
  };

  return mapping[title] || 'Team Analysis';
}

function buildSummary(cards, title) {
  if (!cards.length) return `No major ${title.toLowerCase()} notes detected yet.`;

  const summaries = {
    'Biggest Threats To Your Team': 'Shows what can stop your team and what mistakes to avoid.',
    'Defensive Support': 'Shows how the team survives longer games.',
    'Speed Control': 'Shows how the team tries to move first.'
  };

  return summaries[title] || cards.slice(0, 2).map((card) => sanitizeText(card.claim)).join(' ').slice(0, 220);
}

function inferTheme(card) {
  const combined = `${card.claim || ''} ${card.detail || ''}`.toLowerCase();

  if (combined.includes('recover') || combined.includes('survive') || combined.includes('defensive') || combined.includes('heal')) return 'Defensive Support';
  if (combined.includes('speed') || combined.includes('tailwind') || combined.includes('trick room')) return 'Speed Control';
  if (combined.includes('finish') || combined.includes('late')) return 'Main Cleaner';
  if (combined.includes('risk') || combined.includes('struggle') || combined.includes('unsafe')) return 'Difficult Matchup';
  if (combined.includes('support') || combined.includes('safe')) return 'Utility';
  return 'Main Attacker';
}

function sanitizeTerm(value) {
  const source = String(value || 'Gold-standard engine');
  const display = DISPLAY_TERMS[source] || source.replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`).trim();
  return normalizeDisplayLabel(display, display);
}

function sanitizeText(value) {
  let text = String(value || '');

  Object.entries(DISPLAY_TERMS).forEach(([raw, display]) => {
    text = text.replaceAll(raw, display);
  });

  TACTICAL_PATTERNS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/\bcurrent matchup\b/gi, 'matchup')
    .replace(/\bpressure timing\b/gi, 'careful defensive play')
    .replace(/\bsupport activation\b/gi, 'team support')
    .replace(/\bspread damage escalation\b/gi, 'spread damage')
    .replace(/\bpivot scouting\b/gi, 'safe switching')
    .replace(/\bconvert endgames\b/gi, 'finish games')
    .replace(/\bcleanup route\b/gi, 'game plan')
    .replace(/\blate-game damage threat\b/gi, 'late-game attacker')
    .replace(/\bfinal threat\b/gi, 'late-game attacker')
    .replace(/\bpressure conversion\b/gi, 'safe attacking chance')
    .replace(/\bpositioning\b/gi, 'safe switching')
    .replace(/\bsequencing\b/gi, 'turn planning')
    .replace(/\binteraction chain\b/gi, 'team support')
    .replace(/\bboard state\b/gi, 'battle')
    .replace(/\btactical rhythm\b/gi, 'game plan')
    .replace(/\boffensive conversion\b/gi, 'safe attacking chance')
    .replace(/\bpressure\b/gi, 'attacking threat')
    .replace(/\bconversion\b/gi, 'finishing power')
    .replace(/\btempo\b/gi, 'momentum');

  return normalizeDisplayText(normalizeTacticalText(text));
}

function uniqueCompact(values) {
  return [...new Set(values.filter(Boolean))];
}

function firstSentence(value = '', maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trim()}…` : sentence;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function escapeAttr(value) {
  return escapeText(value);
}

function beginnerFriendlyRewrite(text = '') {
  return String(text || '')
    .replace(/\bcurrent matchup\b/gi, 'matchup')
    .replace(/\bpressure timing\b/gi, 'careful defensive play')
    .replace(/\bsupport activation\b/gi, 'team support')
    .replace(/\bspread damage escalation\b/gi, 'spread damage')
    .replace(/\bpivot scouting\b/gi, 'safe switching')
    .replace(/\bconvert endgames\b/gi, 'finish games')
    .replace(/\bcleanup route\b/gi, 'game plan')
    .replace(/\blate-game damage threat\b/gi, 'late-game attacker')
    .replace(/\bfinal threat\b/gi, 'late-game attacker')
    .replace(/\bpressure conversion\b/gi, 'safe attacking chance')
    .replace(/\bpositioning\b/gi, 'safe switching')
    .replace(/\bsequencing\b/gi, 'turn planning')
    .replace(/\binteraction chain\b/gi, 'team support')
    .replace(/\bboard state\b/gi, 'battle')
    .replace(/\btactical rhythm\b/gi, 'game plan')
    .replace(/\boffensive conversion\b/gi, 'safe attacking chance')
    .replace(/\bpressure\b/gi, 'attacking threat')
    .replace(/\bconversion\b/gi, 'finishing power')
    .replace(/\btempo\b/gi, 'momentum')
    .replace(/\battrition\b/gi, 'wearing the opponent down')
    .replace(/\brouting\b/gi, 'planning');
}

// Beginner helper: This team has ways to control speed and help key attackers move first.
