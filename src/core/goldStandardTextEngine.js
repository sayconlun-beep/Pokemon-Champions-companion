import { getReadablePokemonName } from '../utils/displayNames.js';
import { normalizeTacticalText, normalizeCollapseRisk, ensureSentence } from './tacticalNormalization.js';

export function buildRepairClaim(matchedNeeds = [], failureMatches = [], boardMatches = []) {
  if (failureMatches.length) return `Reduces matchup risk around ${failureMatches.slice(0, 3).join(', ')}.`;
  if (boardMatches.length) return `Stabilizes current matchups involving ${boardMatches.slice(0, 3).join(', ')}.`;
  if (matchedNeeds.length) return `Improves sequencing reliability around ${matchedNeeds.slice(0, 3).join(', ')}.`;
  return 'Adds a distinct stabilization path where current repair evidence is limited.';
}

function normalisePhrase(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
}

function flattenText(value) {
  if (value === null || value === undefined || value === false) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenText);
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, row]) => [humaniseKey(key), ...flattenText(row)]);
  return [];
}

function meaningfulEvidence(lines) {
  return Array.from(new Set(lines.map((line) => String(line || '').trim()).filter((line) => line.length > 2 && !/^true|false$/i.test(line))));
}

export function buildReason(candidate, strongest, chainRepair, selectedPokemon) {
  const leading = strongest[0];
  const name = getReadablePokemonName(candidate);
  const gapMatches = chainRepair?.gapFit?.matches || [];
  const context = gapMatches.length ? `Fills the current team gap: ${gapMatches[0].toLowerCase()}.` : selectedPokemon.length ? tacticalSentenceForAxis(leading?.id, chainRepair) : 'Creates the first reliable board-state route for the draft.';
  const evidence = cleanEvidence(leading?.evidence?.[0]);
  const evidenceLine = evidence ? ` Data cue: ${evidence}.` : '';
  const megaLine = candidate?.is_mega === 'Yes' || /^Mega /i.test(candidate?.name || '') ? ' Uses the single Mega slot, so keep the rest of the core Mega-free.' : '';
  return dedupeSentence(`${name}: ${context}${evidenceLine}${megaLine}`);
}

export function tacticalSentenceForAxis(axisId, chainRepair) {
  const cue = chainRepair?.failureMatches?.[0] || chainRepair?.boardMatches?.[0] || chainRepair?.matchedNeeds?.[0] || '';
  const tail = cue ? ` around ${cue}` : '';
  const map = {
    recoveryRouteSupport: `Protects recovery flow${tail} so passive turns do not become forced sacrifices.`,
    positioningStabilization: `Creates safer pivot turns${tail} after defensive pacing starts to slip.`,
    antiDisruptionUtility: `Controls disruption timing${tail} before recovery turns become unsafe.`,
    pressureConversion: `Turns forced switches${tail} into cleaner openings.`,
    collapseRiskReduction: `Keeps switch safety available${tail} during difficult sequences.`,
    pivotReinforcement: `Improves pivoting${tail} so recovery flow stays intact.`,
    matchupPreparation: `Improves difficult matchup routing${tail} before denial pressure snowballs.`,
    openerInteraction: `Improves early-turn sequencing${tail} without risky commitments.`,
    endgameAmplification: `Keeps late-game cleanup active${tail} once defensive resources are weakened.`
  };
  return map[axisId] || buildRepairClaim(chainRepair?.matchedNeeds, chainRepair?.failureMatches, chainRepair?.boardMatches);
}

export function buildPressurePattern(strongest, chainRepair) {
  const pressureAxis = strongest.find((axis) => ['pressureConversion','positioningStabilization','pivotReinforcement','antiDisruptionUtility','collapseRiskReduction'].includes(axis.id)) || strongest[0];
  const evidence = cleanEvidence(pressureAxis?.evidence?.[0]);
  if (evidence) return evidence;
  return buildRepairClaim(chainRepair?.matchedNeeds, chainRepair?.failureMatches, chainRepair?.boardMatches);
}

export function buildInstabilityFixed(candidate, chainRepair) {
  if (chainRepair?.failureMatches?.length) return normalizeCollapseRisk(`Disruption risk tied to ${chainRepair.failureMatches.slice(0, 2).join(', ')}`);
  if (chainRepair?.boardMatches?.length) return ensureSentence(normalizeTacticalText(`Improves board flow around ${chainRepair.boardMatches.slice(0, 2).join(', ')}`));
  return normalizeCollapseRisk(firstText(candidate?.strategicStrengths?.failureConditions || candidate?.failureChains)) || 'Coverage is limited by available tactical data.';
}


export function normalizeTacticalLanguage(value) {
  return normalizeTacticalText(value);
}

export function cleanEvidence(value) {
  return normalizeTacticalLanguage(String(value || '').replace(/(template support|flat attack boost|low context support|chain filler|generic fit)/ig, '').replace(/\s+/g, ' ').trim());
}

export function dedupeSentence(value) {
  const seen = new Set();
  return String(value || '').split(/(?<=[.!?])\s+/).filter((part) => {
    const key = normalisePhrase(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' ');
}

export function buildNewWeakness(candidate, dependency, missingDataWarnings) {
  if (dependency.flags.length) return ensureSentence(normalizeTacticalText(`Dependency risk: ${dependency.flags.slice(0, 4).join(', ')}`));
  if (missingDataWarnings.length) return missingDataWarnings[0];
  return normalizeCollapseRisk(firstText(candidate?.strategicStrengths?.failureConditions || candidate?.failureChains)) || 'No new weakness is supported by current data.';
}

export function buildCompactExplanation(candidate, strongest, chainRepair, missingDataWarnings) {
  const main = buildReason(candidate, strongest, chainRepair, []);
  return `${main}${missingDataWarnings.length ? ` ${missingDataWarnings[0]}` : ''}`;
}

function firstText(value) { return meaningfulEvidence(flattenText(value))[0] || ''; }
export function humaniseKey(key) { return normalizeTacticalLanguage(String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')); }
