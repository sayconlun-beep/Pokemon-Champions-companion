import { checkPokemonLegality } from './legalityEngine.js';
import { candidateConflictsWithTeamMega, getMegaOptions, getMegaRequirement } from './megaEvolutionEngine.js';
import { getReadablePokemonName } from '../utils/displayNames.js';
import { buildCompactExplanation, buildInstabilityFixed, buildNewWeakness, buildPressurePattern, buildReason, buildRepairClaim, humaniseKey } from './goldStandardTextEngine.js';

const AXES = [
  { id: 'openerInteraction', label: 'safe opening routes', weight: 8, paths: ['pressureFlow.entryPressure','pressureFlow.openingPressure','replayBehaviourEvidence.leadPatterns','strategicStrengths.opponentConstraints','interactionProfiles.forcesPositioningOn'] },
  { id: 'pressureConversion', label: 'turning pressure into damage', weight: 16, paths: ['strategicStrengths.conversionPatterns','pressureFlow.conversionPressure','pressureFlow.midgamePressure','interactionChains','pressureWindows','replayBehaviourEvidence.pressureSequences'] },
  { id: 'pivotReinforcement', label: 'pivot safety', weight: 15, paths: ['interactionProfiles.pivotTargets','replayBehaviourEvidence.pivotSequences','positioningBehavior','preferredBoardStates.positioningState','strategicTriggers.ifPivotLoopAvailable'] },
  { id: 'antiDisruptionUtility', label: 'disruption sequencing', weight: 15, paths: ['threatResponses','strategicTriggers.ifSpeedControlLost','strategicTriggers.ifPriorityThreatPresent','strategicTriggers.ifRecoveryDenied','interactionProfiles.isPressuredBy'] },
  { id: 'positioningStabilization', label: 'positioning stabilization', weight: 18, paths: ['preferredBoardStates','boardStateProfiles','strategicStrengths.preferredBoardStates','advancedResourceEconomy.convertsPositioningAdvantage','replayBehaviourEvidence.defensiveResponses'] },
  { id: 'recoveryRouteSupport', label: 'recovery route support', weight: 18, paths: ['advancedResourceEconomy','resourceEconomy','strategicStrengths.failureConditions','failureChains','strategicTriggers.ifRecoveryDenied'] },
  { id: 'endgameAmplification', label: 'endgame reliability', weight: 10, paths: ['strategicStrengths.endgamePatterns','pressureFlow.cleanupPressure','replayBehaviourEvidence.endgameConversions','strategicTriggers.ifSetupMoveRevealed','damageProfile','damageBenchmarks'] },
  { id: 'matchupPreparation', label: 'matchup stabilization', weight: 14, paths: ['strategicTriggers','interactionProfiles.winsTempoAgainst','interactionProfiles.losesTempoAgainst','threatResponses','conditionalSequencing'] },
  { id: 'collapseRiskReduction', label: 'collapse-risk reduction', weight: 18, paths: ['strategicStrengths.failureConditions','failureChains','threatResponses','strategicTriggers.ifSpeedControlLost','strategicTriggers.ifPriorityThreatPresent','preferredBoardStates.resourceState'] },
  { id: 'benchmarkSupport', label: 'damage benchmark coverage', weight: 5, paths: ['damageBenchmarks','speedBenchmarkData','damageProfile','showdownMechanicalLayer'] }
];

const GOLD_FIELDS = ['strategicStrengths','interactionProfiles','pressureFlow','strategicTriggers','replayBehaviourEvidence','failureChains','preferredBoardStates','advancedResourceEconomy','damageBenchmarks'];
const REQUIRED_DATA_FIELDS = GOLD_FIELDS.filter((field) => field !== 'damageBenchmarks');
const MIN_GOLD_FIELDS_REQUIRED = 3;
const HARD_STOP_WORDS = new Set(['pokemon','pressure','requires','active','against','turns','state','condition','opponent','opposing','supported','entry','available','expected','relevant','based','current','direct','specific','control']);

const TEAM_NEED_PRIORITY = [
  'speed-control',
  'offensive-pressure',
  'damage-balance',
  'defensive-resistance',
  'cleaner',
  'disruption',
  'spread-pressure',
  'safe-lead'
];

// TODO: Replace with shared coaching profile
export function recommendCandidates(team = [], data = {}, limit = 12, options = {}) {
  const selectedIds = new Set(team.filter(Boolean).map((slot) => slot.pokemon_id).filter(Boolean));
  const selectedPokemon = team.map((slot) => slot?.pokemon_id && data.indexes?.pokemonById?.[slot.pokemon_id]).filter(Boolean);
  const teamProfile = buildTeamProfile(selectedPokemon);
  const scored = (data.collections?.pokemon || [])
    .filter((pokemon) => pokemon?.pokemon_id && !selectedIds.has(pokemon.pokemon_id))
    .map((pokemon) => scoreCandidate(pokemon, selectedPokemon, data, teamProfile, { ...options, team }))
    .filter((result) => result.legality?.allowed)
    .filter((result) => recommendationSanityCheck(result, teamProfile))
    .sort((a, b) => b.score - a.score || (b.realism?.practicalViability || 0) - (a.realism?.practicalViability || 0) || confidenceSortValue(b.confidence) - confidenceSortValue(a.confidence) || a.name.localeCompare(b.name));
  return diversifyRecommendations(scored, limit);
}

// TODO: Replace with shared coaching profile
export function scoreCandidate(candidate, selectedPokemon = [], data = {}, suppliedTeamProfile = null, options = {}) {
  const teamProfile = suppliedTeamProfile || buildTeamProfile(selectedPokemon);
  const legality = checkPokemonLegality(candidate, data);
  const missingDataWarnings = missingGoldStandardWarnings(candidate);
  const populatedGoldFields = countPopulatedGoldFields(candidate);
  const insufficientData = populatedGoldFields < MIN_GOLD_FIELDS_REQUIRED;
  const candidateEvidence = collectCandidateEvidence(candidate);
  const axisResults = AXES.map((axis) => evaluateAxis(axis, candidate, candidateEvidence, teamProfile));
  const dependency = evaluateDependency(candidate);
  const megaConflict = candidateConflictsWithTeamMega(candidate, options.team || [], data);
  const megaOptions = getMegaOptions(candidate.pokemon_id, data);
  const megaRequirement = getMegaRequirement(candidate.pokemon_id, data);
  const chainRepair = evaluateChainRepair(candidateEvidence, teamProfile);
  const gapFit = evaluateLiveGapFit(candidate, candidateEvidence, teamProfile);
  const redundancy = evaluateRoleRedundancy(candidate, teamProfile);
  const filterBonus = evaluateFilterBonus(candidateEvidence, options);
  const tacticalWeightBonus = calculateTacticalWeightBonus(axisResults);
  const needsPriorityBonus = calculateNeedsPriorityBonus(gapFit, teamProfile);
  const realism = evaluateRecommendationRealism(candidate, axisResults, candidateEvidence, teamProfile, chainRepair, selectedPokemon, data);
  const positiveScore = axisResults.reduce((sum, axis) => sum + axis.score, 0) + tacticalWeightBonus + chainRepair.score + gapFit.score + needsPriorityBonus + filterBonus + realism.bonus;
  const missingPenalty = missingDataWarnings.length * 4 + (insufficientData ? 12 : 0);
  const dependencyPenalty = dependency.score + redundancy.penalty + realism.penalty + (megaConflict ? 35 : 0);
  const legalityScore = legality.allowed ? 10 : -1000;
  const score = Math.round(Math.max(0, positiveScore + legalityScore - missingPenalty - dependencyPenalty));
  const confidence = calculateConfidence(axisResults, missingDataWarnings, legality.allowed, chainRepair);
  const matchupVariance = calculateVariance(missingDataWarnings, dependency, chainRepair);
  const strongest = axisResults.filter((axis) => axis.raw > 0).sort((a, b) => b.score - a.score);

  const reasonChainContext = { ...chainRepair, gapFit };

  return {
    candidatePokemon: candidate,
    pokemon_id: candidate.pokemon_id,
    name: getReadablePokemonName(candidate),
    score,
    reasonItFits: buildReason(candidate, strongest, reasonChainContext, selectedPokemon),
    pressurePatternImproved: buildPressurePattern(strongest, chainRepair),
    instabilityFixed: buildInstabilityFixed(candidate, chainRepair),
    newWeaknessIntroduced: megaConflict ? 'Mega slot conflict: this candidate competes with the team’s existing Mega dependency.' : buildNewWeakness(candidate, dependency, missingDataWarnings),
    populatedGoldFields,
    insufficientData,
    confidence: insufficientData ? 'low' : confidence,
    confidenceScore: confidence,
    matchupVariance,
    missingDataWarnings,
    legality,
    axisResults,
    chainRepair,
    gapFit,
    needsPriorityBonus,
    redundancy,
    dependency,
    realism,
    mega: { conflict: megaConflict, options: megaOptions, requirement: megaRequirement, isMegaPressurePiece: Boolean(megaOptions.length || megaRequirement) },
    explanation: buildCompactExplanation(candidate, strongest, chainRepair, missingDataWarnings),
    risk: insufficientData || realism.level === 'low' ? 'high' : matchupVariance === 'high' || dependency.level === 'high' ? 'high' : matchupVariance === 'medium' || dependency.level === 'medium' || realism.level === 'medium' ? 'medium' : 'low'
  };
}

// TODO: Replace with shared coaching profile
export function buildTeamProfile(selectedPokemon = []) {
  const allText = selectedPokemon.flatMap((pokemon) => flattenText(pokemon)).join(' ');
  const failureText = selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.failureChains, pokemon?.strategicStrengths?.failureConditions, pokemon?.interactionProfiles?.isPressuredBy])).join(' ');
  const conversionText = selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.strategicStrengths?.conversionPatterns, pokemon?.pressureFlow, pokemon?.interactionChains])).join(' ');
  const boardText = selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.preferredBoardStates, pokemon?.boardStateProfiles, pokemon?.positioningBehavior])).join(' ');
  const roleProfile = buildLiveRoleProfile(selectedPokemon, allText);
  return {
    selectedCount: selectedPokemon.length,
    needTokens: weightedTokens([failureText, boardText, conversionText, roleProfile.gapText]),
    failureTokens: new Set(tokenize(failureText)),
    conversionTokens: new Set(tokenize(conversionText)),
    boardTokens: new Set(tokenize(boardText)),
    broadTokens: new Set(tokenize(allText)),
    roleMarks: roleProfile.roleMarks,
    roleCounts: roleProfile.roleCounts,
    gaps: roleProfile.gaps,
    gapText: roleProfile.gapText,
    failures: selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.failureChains, pokemon?.strategicStrengths?.failureConditions, pokemon?.interactionProfiles?.isPressuredBy])).slice(0, 10),
    conversions: selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.strategicStrengths?.conversionPatterns, pokemon?.pressureFlow?.conversionPressure, pokemon?.pressureFlow?.midgamePressure])).slice(0, 10),
    boards: selectedPokemon.flatMap((pokemon) => flattenText([pokemon?.preferredBoardStates, pokemon?.strategicStrengths?.preferredBoardStates])).slice(0, 10)
  };
}

function buildLiveRoleProfile(selectedPokemon = [], allText = '') {
  const roleCounts = new Map();
  const roleMarks = new Set();
  const add = (role) => { roleMarks.add(role); roleCounts.set(role, (roleCounts.get(role) || 0) + 1); };
  for (const pokemon of selectedPokemon) {
    for (const role of inferRecommendationMarks(pokemon)) add(role);
  }

  const lower = String(allText || '').toLowerCase();
  const teamTypes = selectedPokemon.flatMap(pokemonTypesForRoleRead).map((type) => type.toLowerCase());
  const typeSet = new Set(teamTypes);
  const physicalCount = roleCounts.get('physical-damage') || 0;
  const specialCount = roleCounts.get('special-damage') || 0;
  const offenseCount = roleCounts.get('offensive-pressure') || 0;
  const supportCount = (roleCounts.get('defensive-support') || 0) + (roleCounts.get('pivot') || 0) + (roleCounts.get('disruption') || 0);
  const identity = detectDraftIdentity(roleMarks, lower);

  const gaps = [];
  const addGap = (id, label, weight, terms, priority = TEAM_NEED_PRIORITY.indexOf(id)) => {
    gaps.push({ id, label, weight, terms, priority: priority < 0 ? 99 : priority });
  };

  if (!roleMarks.has('speed-control')) addGap('speed-control', 'No speed control', 42, ['tailwind','icy wind','trick room','thunder wave','nuzzle','speed control','priority','fast support']);
  if (selectedPokemon.length >= 2 && offenseCount < 2) addGap('offensive-pressure', 'Needs offensive pressure', 38, ['damage','heavy-hit','breaker','ko','attacker','offensive','breaker','conversion','win condition']);
  if (selectedPokemon.length >= 2 && (physicalCount === 0 || specialCount === 0)) {
    addGap('damage-balance', physicalCount === 0 ? 'No physical offense' : 'No special offense', 32, physicalCount === 0 ? ['physical','attack','close combat','earthquake','flare blitz','body slam','sucker punch'] : ['special','sp. atk','dazzling gleam','heat wave','shadow ball','moonblast','hydro pump']);
  }
  if (selectedPokemon.length >= 2 && !roleMarks.has('defensive-resistance')) addGap('defensive-resistance', 'Needs defensive resistances', 26, ['resist','immune','defensive','bulk','check','safe switch','absorbs','into']);
  if (!roleMarks.has('cleaner') && selectedPokemon.length >= 2) addGap('cleaner', 'No reliable cleaner', 30, ['cleanup','cleaner','endgame','priority','finisher','late-game','closer']);
  if (!roleMarks.has('disruption') && selectedPokemon.length >= 2) addGap('disruption', 'No disruption tools', 20, ['fake out','taunt','encore','snarl','will-o-wisp','intimidate','sleep','redirection','follow me','rage powder']);
  if (!roleMarks.has('spread-pressure')) addGap('spread-pressure', 'No spread damage', 18, ['spread','earthquake','rock slide','heat wave','dazzling gleam','surf','discharge','hyper voice']);
  if (!roleMarks.has('safe-lead') && selectedPokemon.length >= 2) addGap('safe-lead', 'Needs safe lead options', 16, ['lead','opening','fake out','protect','redirection','pivot','tailwind','pressure opening']);
  if (!roleMarks.has('pivot') && selectedPokemon.length >= 1) addGap('pivot', 'No defensive pivot', 14, ['pivot','switch','intimidate','fake out','parting shot','u-turn','volt switch']);
  if (/fighting/.test(lower) && !['fairy','flying','psychic','ghost','poison'].some((type) => typeSet.has(type))) addGap('fighting-check', 'Weak into Fighting', 22, ['fairy','flying','psychic','ghost','poison','fighting resist','fighting check']);

  const balanceWarnings = [];
  if (supportCount >= 2 && offenseCount < 2) balanceWarnings.push('support-heavy draft needs damage');
  if (offenseCount >= 4 && supportCount < 1) balanceWarnings.push('offense-heavy draft needs utility');
  if (identity === 'rain') addGap('rain-abuser', 'Needs rain payoff', 24, ['rain','swift swim','water pressure','thunder','hurricane']);
  if (identity === 'trick-room') addGap('trick-room-payoff', 'Needs slow Trick Room attacker', 28, ['slow attacker','trick room closer','low speed','room payoff']);
  if (identity === 'hyper-offense') addGap('tempo-pressure', 'Needs tempo pressure', 22, ['priority','fast','tailwind','fake out','spread','ko pressure']);

  gaps.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  return { roleMarks, roleCounts, gaps, gapText: [...gaps.map((gap) => `${gap.label}: ${gap.terms.join(' ')}`), ...balanceWarnings].join(' '), identity, balanceWarnings };
}

function inferRecommendationMarks(pokemon) {
  const text = flattenText(pokemon).join(' ').toLowerCase();
  const tags = new Set();
  const types = pokemonTypesForRoleRead(pokemon);
  const statsText = JSON.stringify(pokemon?.stats || pokemon?.baseStats || {}).toLowerCase();
  if (/tailwind|icy wind|trick room|thunder wave|nuzzle|speed control|priority|fast support/.test(text)) tags.add('speed-control');
  if (/cleanup|cleaner|endgame|finisher|late-game|closer|priority|sucker punch|extreme speed/.test(text)) tags.add('cleaner');
  if (/pivot|switch|u-turn|volt switch|parting shot|intimidate|fake out|redirection|follow me|rage powder/.test(text)) tags.add('pivot');
  if (/spread|earthquake|rock slide|heat wave|dazzling gleam|snarl|surf|discharge|hyper voice/.test(text)) tags.add('spread-pressure');
  if (/damage|heavy-hit|breaker|ko|offensive|attack|pressure|breaker|win condition|closer/.test(text)) tags.add('offensive-pressure');
  if (/special damage|sp\. atk|special offense|dazzling gleam|heat wave|shadow ball|moonblast|hydro pump|thunderbolt|hurricane/.test(text)) tags.add('special-damage');
  if (/physical damage|physical offense|attack stat|close combat|earthquake|flare blitz|body slam|sucker punch|knock off/.test(text)) tags.add('physical-damage');
  if (/taunt|encore|snarl|will-o-wisp|fake out|intimidate|sleep powder|spore|disable|redirection|follow me|rage powder|wide guard|quick guard/.test(text)) tags.add('disruption');
  if (/lead|opening|fake out|protect|redirection|pivot|tailwind|safe opening|pressure opening/.test(text)) tags.add('safe-lead');
  if (/recover|wish|roost|heal|defensive|bulk|regenerator|leftovers|protect|resist|immune|check|safe switch/.test(text)) tags.add('defensive-support');
  if (/resist|immune|defensive|bulk|check|safe switch|absorbs/.test(text) || types.length >= 2) tags.add('defensive-resistance');
  if (/rain|swift swim|drizzle|water pressure|thunder|hurricane/.test(text)) tags.add('rain-abuser');
  if (/trick room|slow attacker|low speed|room payoff/.test(text)) tags.add('trick-room-payoff');
  if (/tempo|hyper offense|priority|fast|ko pressure/.test(text)) tags.add('tempo-pressure');
  if (types.some((type) => ['Fairy','Flying','Psychic','Ghost','Poison'].includes(type))) tags.add('fighting-check');
  if (/atk|attack/.test(statsText) && !/sp/.test(statsText)) tags.add('physical-damage');
  return tags;
}

function detectDraftIdentity(roleMarks, lower) {
  if (/rain|drizzle|swift swim/.test(lower)) return 'rain';
  if (/trick room/.test(lower) || roleMarks.has('trick-room-payoff')) return 'trick-room';
  if (/hyper offense|tempo/.test(lower)) return 'hyper-offense';
  return 'balanced';
}

function pokemonTypesForRoleRead(pokemon) {
  return [pokemon?.type1, pokemon?.type2, pokemon?.typing].flatMap((value) => String(value || '').split(/[\/|, ]+/)).map((value) => value.trim()).filter(Boolean);
}

function evaluateAxis(axis, candidate, candidateEvidence, teamProfile) {
  const evidence = axis.paths.flatMap((path) => evidenceFromPath(candidate, path));
  const evidenceTokens = new Set(tokenize(evidence.join(' ')));
  const needHits = countSetOverlap(evidenceTokens, teamProfile.needTokens.keys);
  const failureHits = countSetOverlap(evidenceTokens, teamProfile.failureTokens);
  const conversionHits = countSetOverlap(evidenceTokens, teamProfile.conversionTokens);
  const boardHits = countSetOverlap(evidenceTokens, teamProfile.boardTokens);
  const selfSupport = Math.min(4, meaningfulEvidence(evidence).length);
  const chainHits = teamProfile.selectedCount ? Math.min(8, needHits + failureHits * 1.2 + conversionHits * 0.7 + boardHits * 0.7) : 0;
  const raw = selfSupport + chainHits;
  const score = axis.weight * Math.min(3.2, raw) / 3.2;
  return { id: axis.id, label: axis.label, raw, score, evidence: meaningfulEvidence(evidence).slice(0, 6), chainHits: Math.round(chainHits * 10) / 10 };
}

function evaluateChainRepair(candidateEvidence, teamProfile) {
  if (!teamProfile.selectedCount) return { score: 0, matchedNeeds: [], claim: 'No existing draft chain to repair yet.' };
  const tokens = new Set(tokenize(candidateEvidence.join(' ')));
  const matchedNeeds = Array.from(teamProfile.needTokens.keys).filter((token) => tokens.has(token)).slice(0, 10);
  const failureMatches = Array.from(teamProfile.failureTokens).filter((token) => tokens.has(token)).slice(0, 8);
  const boardMatches = Array.from(teamProfile.boardTokens).filter((token) => tokens.has(token)).slice(0, 8);
  const score = Math.min(28, matchedNeeds.length * 2.4 + failureMatches.length * 2.2 + boardMatches.length * 1.4);
  const claim = buildRepairClaim(matchedNeeds, failureMatches, boardMatches);
  return { score, matchedNeeds, failureMatches, boardMatches, claim };
}


// TODO: Replace with shared coaching profile
function evaluateLiveGapFit(candidate, candidateEvidence, teamProfile) {
  if (!teamProfile?.selectedCount || !teamProfile.gaps?.length) return { score: 0, matches: [], topNeed: null };
  const roles = inferRecommendationMarks(candidate);
  const text = `${candidateEvidence.join(' ')} ${flattenText(candidate).join(' ')}`.toLowerCase();
  const matches = [];
  let score = 0;
  for (const gap of teamProfile.gaps) {
    const roleHit = roles.has(gap.id);
    const textHit = gap.terms.some((term) => text.includes(term));
    if (roleHit || textHit) {
      const urgencyMultiplier = gap.priority <= 1 ? 1.35 : gap.priority <= 4 ? 1.15 : 1;
      matches.push(gap.label);
      score += gap.weight * urgencyMultiplier;
    }
  }
  const topNeed = teamProfile.gaps[0]?.label || null;
  const topNeedSolved = matches.includes(topNeed);
  if (topNeedSolved) score += 16;
  if (matches.length >= 2) score += Math.min(18, (matches.length - 1) * 7);
  return { score: Math.min(120, score), matches: matches.slice(0, 5), topNeed, topNeedSolved };
}

function evaluateRoleRedundancy(candidate, teamProfile) {
  if (!teamProfile?.selectedCount) return { penalty: 0, duplicateRoles: [] };
  const roles = inferRecommendationMarks(candidate);
  const duplicateRoles = Array.from(roles).filter((role) => (teamProfile.roleCounts?.get(role) || 0) >= 2 && !teamProfile.gaps?.some((gap) => gap.id === role));
  const passiveOverlap = roles.has('defensive-support') && roles.has('pivot') && (teamProfile.roleCounts?.get('defensive-support') || 0) >= 1 && !roles.has('offensive-pressure');
  const supportStack = ['defensive-support','pivot','disruption'].filter((role) => roles.has(role)).length >= 2 && (teamProfile.roleCounts?.get('offensive-pressure') || 0) < 2;
  const duplicatePenalty = duplicateRoles.reduce((sum, role) => {
    const count = teamProfile.roleCounts?.get(role) || 0;
    const importantDuplicate = ['speed-control','offensive-pressure'].includes(role) && count < 3;
    return sum + (importantDuplicate ? 5 : 11 + Math.max(0, count - 2) * 4);
  }, 0);
  const penalty = Math.min(62, duplicatePenalty + (passiveOverlap ? 24 : 0) + (supportStack ? 16 : 0));
  return { penalty, duplicateRoles };
}

function calculateNeedsPriorityBonus(gapFit, teamProfile) {
  if (!teamProfile?.selectedCount || !teamProfile.gaps?.length) return 0;
  if (gapFit?.topNeedSolved) return 18;
  if (gapFit?.matches?.length) return 6;
  return -12;
}

function calculateTacticalWeightBonus(axisResults) {
  const wanted = new Set(['recoveryRouteSupport','pivotReinforcement','pressureConversion','collapseRiskReduction','matchupPreparation','antiDisruptionUtility']);
  const weakAbstract = new Set(['openerInteraction']);
  return Math.min(26, axisResults.reduce((sum, axis) => {
    if (wanted.has(axis.id) && axis.raw > 0) return sum + Math.min(3, axis.raw) * 1.7;
    if (weakAbstract.has(axis.id) && axis.raw > 0) return sum - Math.min(2, axis.raw) * 1.2;
    return sum;
  }, 0));
}

function evaluateRecommendationRealism(candidate, axisResults, candidateEvidence, teamProfile, chainRepair, selectedPokemon = [], data = {}) {
  const text = candidateEvidence.join(' ').toLowerCase();
  const activeAxes = axisResults.filter((axis) => axis.raw > 0);
  const highValueAxes = new Set(['recoveryRouteSupport','pivotReinforcement','pressureConversion','collapseRiskReduction','matchupPreparation','antiDisruptionUtility','endgameAmplification']);
  const highValueCount = activeAxes.filter((axis) => highValueAxes.has(axis.id) && axis.raw >= 1.4).length;
  const practicalSignals = [
    /recover|roost|wish|protect|heal|regenerator|leftovers|drain/,
    /pivot|switch|u-turn|volt switch|parting shot|intimidate|fake out|redirection|follow me|rage powder/,
    /tailwind|trick room|icy wind|speed control|priority|thunder wave/,
    /spread|rock slide|earthquake|heat wave|snarl|will-o-wisp|taunt|encore|fake out/,
    /resist|immune|defensive|bulk|check|safe switch/,
    /ko|damage benchmark|cleanup|endgame|conversion|forced switch/
  ].filter((pattern) => pattern.test(text)).length;
  const selectedContext = selectedPokemon.length ? 1 : 0;
  const chainSpecificity = (chainRepair?.failureMatches?.length || 0) + (chainRepair?.boardMatches?.length || 0) + Math.min(2, chainRepair?.matchedNeeds?.length || 0);
  const practicalViability = evaluatePracticalViability(candidate, data, text);
  const abstractOnlyPenalty = highValueCount === 0 && chainSpecificity < 2 ? 22 : 0;
  const weakViabilityPenalty = practicalSignals < 2 ? 16 : practicalSignals < 3 ? 7 : 0;
  const lowPracticalPenalty = practicalViability.score < 3 ? 30 : practicalViability.score < 5 ? 10 : 0;
  const continuationBonus = highValueCount * 4 + practicalSignals * 2 + chainSpecificity * 2 + selectedContext + practicalViability.score * 2;
  const viabilityScore = highValueCount * 2 + practicalSignals + chainSpecificity + practicalViability.score;
  const level = viabilityScore >= 11 ? 'high' : viabilityScore >= 7 ? 'medium' : 'low';
  return { bonus: Math.min(60, continuationBonus), penalty: abstractOnlyPenalty + weakViabilityPenalty + lowPracticalPenalty, level, practicalSignals, highValueCount, chainSpecificity, practicalViability: practicalViability.score, practicalReasons: practicalViability.reasons, viabilityScore };
}

function evaluatePracticalViability(candidate, data = {}, evidenceText = '') {
  const stats = data.indexes?.statsByPokemon?.[candidate.pokemon_id] || {};
  const bst = Number(stats.bst || candidate.bst || 0);
  const speedTier = String(stats.speed_tier || candidate.speedBenchmarkData?.baseSpeedTier || '').toLowerCase();
  const reliability = JSON.stringify(candidate.reliabilityMetrics || {}).toLowerCase();
  const builds = Array.isArray(candidate.commonBuilds) ? candidate.commonBuilds.length : 0;
  const text = `${evidenceText} ${JSON.stringify(candidate.strategicStrengths || {})} ${JSON.stringify(candidate.threatResponses || {})}`.toLowerCase();
  const utilitySignals = [
    /fake out|intimidate|follow me|rage powder|redirection/,
    /tailwind|trick room|icy wind|thunder wave|speed control/,
    /wish|recover|roost|synthesis|regenerator|drain|protect/,
    /taunt|encore|snarl|will-o-wisp|wide guard|quick guard/,
    /spread|earthquake|rock slide|heat wave|dazzling gleam/
  ].filter((pattern) => pattern.test(text)).length;
  let score = 0;
  const reasons = [];
  if (bst >= 570) { score += 5; reasons.push('high stat profile'); }
  else if (bst >= 520) { score += 4; reasons.push('solid stat profile'); }
  else if (bst >= 490) { score += 2; reasons.push('usable stat profile'); }
  else if (bst >= 460) { score += 1; reasons.push('niche stat profile'); }
  if (speedTier.includes('fast')) { score += 1; reasons.push('fast tier'); }
  if (Number(stats.bulk_score || 0) >= 270) { score += 1; reasons.push('durable profile'); }
  if (builds > 0) { score += Math.min(3, builds); reasons.push('known build support'); }
  if (/high/.test(reliability)) { score += 2; reasons.push('high reliability metric'); }
  else if (/low_to_medium|low/.test(reliability)) { score -= 1; reasons.push('limited reliability metric'); }
  score += Math.min(4, utilitySignals);
  if (utilitySignals) reasons.push('practical doubles utility');
  if (candidate.is_mega === 'Yes' || /^Mega /i.test(candidate.name || '')) { score += 1; reasons.push('Mega-level profile'); }
  return { score: Math.max(0, score), reasons };
}

function recommendationSanityCheck(result, teamProfile) {
  if (!result?.legality?.allowed) return false;
  if (result.insufficientData && result.score < 50) return false;
  if (result.mega?.conflict) return false;
  const realism = result.realism || {};
  const hasTeamContext = (teamProfile?.selectedCount || 0) > 0;
  if (hasTeamContext && (realism.viabilityScore || 0) < 7) return false;
  if ((realism.practicalViability || 0) < 7) return false;
  if ((realism.highValueCount || 0) === 0 && (realism.chainSpecificity || 0) < 2) return false;
  if (result.score < 45) return false;
  return true;
}

function diversifyRecommendations(items, limit) {
  const selected = [];
  const seenGroups = new Set();
  const seenPhrases = new Set();
  const seenPrimaryRoles = new Map();
  let megaCount = 0;
  for (const item of items) {
    const isMega = item.mega?.isMegaPressurePiece || /^Mega /i.test(item.name || '');
    if (isMega && megaCount >= 2) continue;
    const group = tacticalGroup(item);
    const phraseKey = normalisePhrase(item.reasonItFits || item.pressurePatternImproved || '');
    const primaryRole = primaryRecommendationRole(item);
    const roleCount = seenPrimaryRoles.get(primaryRole) || 0;
    if (roleCount >= 2) continue;
    if ((seenGroups.has(group) || seenPhrases.has(phraseKey)) && selected.length >= Math.max(2, Math.ceil(limit * 0.45))) continue;
    selected.push(item);
    if (isMega) megaCount += 1;
    seenGroups.add(group);
    seenPrimaryRoles.set(primaryRole, roleCount + 1);
    if (phraseKey) seenPhrases.add(phraseKey);
    if (selected.length >= limit) return selected;
  }
  for (const item of items) {
    const isMega = item.mega?.isMegaPressurePiece || /^Mega /i.test(item.name || '');
    if (isMega && megaCount >= 2) continue;
    if (!selected.includes(item)) { selected.push(item); if (isMega) megaCount += 1; }
    if (selected.length >= limit) break;
  }
  return selected;
}

function primaryRecommendationRole(item) {
  const gap = item.gapFit?.matches?.[0];
  if (gap) return gap.toLowerCase();
  const role = Array.from(inferRecommendationMarks(item.candidatePokemon || {}))[0];
  return role || tacticalGroup(item);
}

function tacticalGroup(item) {
  const strongest = (item.axisResults || []).filter((axis) => axis.raw > 0).sort((a, b) => b.score - a.score)[0];
  const matched = item.chainRepair?.failureMatches?.[0] || item.chainRepair?.boardMatches?.[0] || item.chainRepair?.matchedNeeds?.[0] || '';
  return `${strongest?.id || 'general'}:${String(matched).toLowerCase()}`;
}

function normalisePhrase(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
}

function evaluateDependency(candidate) {
  const evidence = flattenText([candidate?.advancedResourceEconomy, candidate?.failureChains, candidate?.strategicStrengths?.failureConditions]);
  const text = evidence.join(' ').toLowerCase();
  const flags = [
    ['speed control', /requires speed|speedcontrol|speed control lost|tailwind|trick room/],
    ['protect cycling', /protect cycling|depends on protect/],
    ['pivot support', /requires pivot|pivot support/],
    ['redirection', /requires redirection|redirection/],
    ['weather', /weather dependent|weather removal|weather lost|weather overwritten/],
    ['terrain', /terrain dependent|terrain overwritten/],
    ['strict positioning', /strict|unsafe|forced defensive|positioning failure/]
  ].filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  const score = Math.min(26, flags.length * 4);
  const level = flags.length >= 4 ? 'high' : flags.length >= 2 ? 'medium' : 'low';
  return { score, level, flags, evidence: meaningfulEvidence(evidence).slice(0, 5) };
}

function evaluateFilterBonus(candidateEvidence, options) {
  const wanted = Array.isArray(options?.focus) ? options.focus : [];
  if (!wanted.length) return 0;
  const text = candidateEvidence.join(' ').toLowerCase();
  return wanted.reduce((sum, focus) => sum + (text.includes(String(focus).toLowerCase()) ? 5 : 0), 0);
}

function collectCandidateEvidence(candidate) {
  return AXES.flatMap((axis) => axis.paths.flatMap((path) => evidenceFromPath(candidate, path))).concat(flattenText(candidate?.strategicStrengths));
}

function evidenceFromPath(source, path) {
  const value = readPath(source, path);
  if (path.startsWith('strategicTriggers')) return flattenApplicableTriggers(value).filter(Boolean).slice(0, 10);
  return flattenText(value).filter(Boolean).slice(0, 10);
}

function flattenApplicableTriggers(value) {
  if (!value || typeof value !== 'object') return flattenText(value);
  return Object.entries(value).flatMap(([key, trigger]) => {
    if (trigger && typeof trigger === 'object' && trigger.applicable === false) return [];
    return [humaniseKey(key), ...flattenText(trigger)];
  });
}

function readPath(source, path) {
  return path.split('.').reduce((current, key) => current?.[key], source);
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

function tokenize(text) {
  return Array.from(new Set(String(text).toLowerCase().match(/[a-z][a-z-]{4,}/g) || [])).filter((token) => !HARD_STOP_WORDS.has(token)).slice(0, 120);
}

function weightedTokens(textBlocks) {
  const counts = new Map();
  for (const text of textBlocks) {
    for (const token of tokenize(text)) counts.set(token, (counts.get(token) || 0) + 1);
  }
  return { keys: new Set(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([token]) => token).slice(0, 60)), counts };
}

function countSetOverlap(left, right) {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function missingGoldStandardWarnings(candidate) {
  return REQUIRED_DATA_FIELDS.filter((field) => isEmpty(candidate?.[field])).map((field) => `Missing ${field} coverage.`);
}

export function countPopulatedGoldFields(pokemon) {
  return GOLD_FIELDS.filter((field) => !isEmpty(pokemon?.[field])).length;
}

function confidenceSortValue(value) {
  if (typeof value === 'number') return value;
  if (value === 'high') return 85;
  if (value === 'medium') return 55;
  if (value === 'low') return 25;
  return Number(value || 0);
}

function calculateConfidence(axisResults, missingDataWarnings, legal, chainRepair) {
  if (!legal) return 0;
  const activeAxes = axisResults.filter((axis) => axis.raw > 0).length;
  const repairBoost = chainRepair?.matchedNeeds?.length ? 8 : 0;
  return clamp(Math.round(28 + activeAxes * 6 + repairBoost - missingDataWarnings.length * 7), 12, 95);
}

function calculateVariance(missingDataWarnings, dependency, chainRepair) {
  if (dependency.level === 'high' || missingDataWarnings.length >= 4) return 'high';
  if (dependency.level === 'medium' || missingDataWarnings.length >= 2 || !chainRepair?.matchedNeeds?.length) return 'medium';
  return 'low';
}


function isEmpty(value) { if (!value) return true; if (Array.isArray(value)) return value.length === 0; if (typeof value === 'object') return Object.keys(value).length === 0; return false; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
