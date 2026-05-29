import { getReadablePokemonName, getReadableAbilityName } from '../../utils/displayNames.js';
import { escapeText, getAnalysisDeskPokemonTypes, normalizeAnalysisDeskType, normalizeName, splitAnalysisDeskTypes, firstSentence } from './analysisDeskHelpers.js';

export function renderActionableRiskSummary(presentation = {}, team = [], options = {}) {
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

export function getSuggestedSlotForTypeWeakness(typeName = '', entries = [], team = [], directEntry = null, data = {}, display = {}) {
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

export function renderSuggestedSlotLine(suggestion = null, options = {}) {
  if (!suggestion) return '';
  if (suggestion.multiple) return `<p class="suggested-slot-line"><b>Suggested slot to change:</b> ${escapeText(suggestion.reason || 'Multiple slots affected — review the team holistically.')}</p>`;
  return `<p class="suggested-slot-line"><b>Suggested slot to change:</b> ${escapeText(suggestion.slotLabel)} (${escapeText(suggestion.pokemonName)}) — ${escapeText(suggestion.reason || 'review this slot first.')} <a href="/team-builder" data-route="team-builder" data-scroll-slot="${Number(suggestion.slotIndex || 0)}">Open in Builder</a></p>`;
}

