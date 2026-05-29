import { ensureSentence, normalizeCollapseRisk, normalizeTacticalText } from '../core/tacticalNormalization.js';
import { normalizeDisplayText, compressCoachingList, coachingConclusion } from '../utils/tacticalTextNormalizer.js';
import { SearchableSelector } from '../components/SearchableSelector.js';
import { getPokemonSpriteById } from '../utils/pokemonSprites.js';
import { getPokemonTypeChipStyle } from '../constants/pokemonTypeColors.js';
import { SpeedControlPanel } from '../components/analysis/SpeedControlPanel.js';
import { getPokemonDisplayName, getPokemonSearchAliases } from '../utils/formGrouping.js';
import { getReadablePokemonName } from '../utils/displayNames.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';
import { getPilotTipDisplayTitle, renderPilotTips, renderLeadAnalysis } from '../ui/teamCoachingRenderers.js';

const THREAT_PATTERNS = [
  ['Speed-control inversion', /speed|tailwind|trick room|tempo|priority/i],
  ['Taunt disruption', /taunt|disrupt|denial|shut down/i],
  ['Weather tempo strain', /weather|rain|sun|sand|hail|snow/i],
  ['Setup snowball risk', /setup|boost|sweep|snowball/i],
  ['Pivot denial', /pivot|switch|position|board-state/i],
  ['Priority pressure', /priority|fake out|quick attack|sucker|extreme speed/i]
];

export function MatchupsPage(state) {
  const selectedMembers = getSelectedMembers(state);
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const planner = buildBattleScenarioPlanner(state, selectedMembers, coachingProfile);
  const model = buildMatchupModel(null, selectedMembers, coachingProfile, planner.selectedOpponent);

  return `
    <section class="page-stack matchups-page">
      <header class="hero tactical-primary-panel matchup-overview-panel">
        <div class="matchup-overview-copy">
          <p class="eyebrow">Tactical preparation desk</p>
          <h1>Matchups</h1>
          <p>${escapeText(model.overview.summary)}</p>
        </div>
        <div class="matchup-metrics">
          <span class="badge tertiary-chip">Team ${escapeText(model.overview.teamSummary)}</span>
          <span class="badge tertiary-chip">Readiness ${escapeText(model.overview.readinessScore)}</span>
          <span class="badge tertiary-chip">Missing data ${model.overview.missingCount}</span>
        </div>
      </header>

      ${renderOpeningPlans(coachingProfile)}
      ${renderPrimaryMatchupRisks(model.primaryRisks, coachingProfile, planner.selectedOpponent)}
      ${renderBattleTips(model.battleTips, coachingProfile, planner.selectedOpponent, selectedMembers, planner.recommendations)}
      ${SpeedControlPanel({ team: state.team, data: state.data, context: 'matchups', coachingProfile })}
      ${renderBattleScenarioPlanner(planner)}
      ${renderOpponentThreatHandling(model)}
    </section>`;
}



function renderOpeningPlans(coachingProfile = {}) {
  const hasLeads = Array.isArray(coachingProfile?.coaching?.recommendedLeads) && coachingProfile.coaching.recommendedLeads.length > 0;
  if (!hasLeads) return '';
  return `<section class="card tactical-secondary-panel opening-plans-section" aria-labelledby="opening-plans-title">
    <div class="workspace-section-head section-toolbar-header">
      <div class="section-toolbar-copy">
        <span class="section-kicker">Opening Plans</span>
        <h2 id="opening-plans-title">Opening Plans</h2>
        <p class="section-summary">Recommended opening pairs and early-game sequencing based on the current team structure.</p>
      </div>
    </div>
    ${renderLeadAnalysis(coachingProfile, { showHeading: false, compact: true, labelMode: 'openingPlans', limit: 4 })}
  </section>`;
}

// OPPONENT-SPECIFIC SCENARIO LOGIC: uses selected opponent and existing team members only for the Battle Scenario Planner.
// TODO: Replace with shared coaching profile
function buildBattleScenarioPlanner(state, members, coachingProfile = null) {
  state.matchupsScenario ||= { selectedOpponentId: '' };
  const pokemonRows = getChampionsPokemonOptions(state.data);
  const selectedOpponent = state.data.indexes?.pokemonById?.[state.matchupsScenario.selectedOpponentId] || null;
  const options = pokemonRows.map((pokemon) => ({
    value: pokemon.pokemon_id,
    label: getPokemonDisplayName(pokemon),
    meta: compact([pokemon.typing || pokemonTypes(pokemon).join(' / '), pokemon.form_name && pokemon.form_name !== 'Base' ? pokemon.form_name : '']),
    selected: pokemon.pokemon_id === selectedOpponent?.pokemon_id,
    sprite: { src: getPokemonSpriteById(pokemon.pokemon_id, { name: getPokemonDisplayName(pokemon) }).src, pokemonId: pokemon.pokemon_id },
    badges: pokemonTypes(pokemon).map((type) => ({ label: type, style: getPokemonTypeChipStyle(type) })),
    searchTerms: getPokemonSearchAliases(pokemon)
  }));

  return {
    selectedOpponent,
    selectedLabel: selectedOpponent ? getPokemonDisplayName(selectedOpponent) : '',
    options,
    teamMembers: members,
    recommendations: selectedOpponent ? rankScenarioAnswers(members, selectedOpponent) : [],
    coachingProfile
  };
}

function getChampionsPokemonOptions(data) {
  const rows = data?.pokemon || data?.pokemonRows || Object.values(data?.indexes?.pokemonById || {});
  return (rows || [])
    .filter((pokemon) => String(pokemon?.champions_legal || '').toLowerCase() !== 'no')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function renderBattleScenarioPlanner(planner) {
  const hasTeam = planner.teamMembers.length > 0;
  const best = planner.recommendations.find((item) => item.tier !== 'avoid') || planner.recommendations[0];
  const backups = planner.recommendations.filter((item) => item !== best && ['backup', 'emergency', 'offensive'].includes(item.tier)).slice(0, 3);
  const risky = planner.recommendations.filter((item) => item.tier === 'avoid').slice(0, 3);
  const bestCardTitle = getScenarioBestCardTitle(best);
  return `<section class="card battle-scenario-planner tactical-secondary-panel" aria-labelledby="battle-scenario-title">
    <div class="workspace-section-head section-toolbar-header battle-scenario-head">
      <div class="section-toolbar-copy">
        <span class="section-kicker">Quick coaching tool</span>
        <h2 id="battle-scenario-title">Battle Scenario Planner</h2>
        <p class="section-summary">Choose an opposing Pokémon to see your safest switch-ins, risky matchups, and recommended gameplan.</p>
      </div>
    </div>
    <div class="battle-scenario-controls">
      ${SearchableSelector({
        kind: 'battle-scenario-opponent',
        slotIndex: 0,
        label: 'Opposing Pokémon',
        selectedLabel: planner.selectedLabel,
        hint: 'Search Pokémon…',
        options: planner.options,
        emptyMessage: 'No matching Pokémon found.',
        extraClass: 'battle-scenario-selector'
      })}
    </div>
    ${!hasTeam ? `<p class="notice battle-scenario-empty">Add Pokémon to your team first, then this planner can compare your current team into the chosen opponent.</p>` : ''}
    ${hasTeam && !planner.selectedOpponent ? `<p class="muted battle-scenario-empty">Pick an opposing Pokémon to generate a simple switch-in plan.</p>` : ''}
    ${planner.selectedOpponent && hasTeam ? `<div class="battle-scenario-results">
      ${renderGameplanCard(planner.selectedOpponent, best, backups, risky)}
      ${renderPlannerCard(bestCardTitle, best ? [best] : [], best?.tier || 'best')}
      ${renderPlannerCard('Backup Options', backups, 'backup')}
      ${renderPlannerCard('Avoid If Possible', risky, 'avoid')}
    </div>` : ''}
  </section>`;
}

function renderGameplanCard(opponent, best, backups, risky) {
  const backupNames = backups.map((item) => getPokemonDisplayName(item.pokemon)).slice(0, 2).join(' or ');
  const riskyNames = risky.map((item) => getPokemonDisplayName(item.pokemon)).slice(0, 2).join(' or ');
  const bestName = best ? getPokemonDisplayName(best.pokemon) : '';
  const lines = best ? compact([
    getScenarioGameplanLead(best, opponent),
    backupNames ? `If ${bestName} is weakened or unsafe, look to ${backupNames} as your next reset option.` : 'If your best answer is weakened, avoid forcing risky switches and use Protect or careful pivoting first.',
    riskyNames ? `Avoid switching ${riskyNames} directly into attacks from ${getPokemonDisplayName(opponent)} unless you have no safer option.` : '',
    `Keep your best answer healthy so you still have a way to handle ${getPokemonDisplayName(opponent)} later.`
  ]) : [`No clear answer is available yet. Use Protect, scouting, or a sacrifice only if you must.`];
  return `<article class="battle-scenario-card gameplan-card">
    <div class="battle-scenario-card-head"><h3>Recommended Gameplan</h3><span class="badge utility-badge">Coach view</span></div>
    <ul class="battle-scenario-list">${lines.map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>
  </article>`;
}

function renderPlannerCard(title, items, tone) {
  const cardTone = ['safe', 'offensive', 'emergency'].includes(tone) ? 'best' : tone === 'avoid' ? 'risky' : tone;
  return `<article class="battle-scenario-card ${escapeText(cardTone)}-scenario-card">
    <div class="battle-scenario-card-head"><h3>${escapeText(title)}</h3>${scenarioBadge(tone)}</div>
    ${items.length ? `<div class="scenario-option-stack">${items.map(renderScenarioOption).join('')}</div>` : `<p class="muted small-copy">No ${escapeText(title.toLowerCase())} found from the current team.</p>`}
  </article>`;
}

function renderScenarioOption(item) {
  return `<details class="scenario-option" ${item.tier === 'safe' ? 'open' : ''}>
    <summary>
      <span class="scenario-option-title">${escapeText(getPokemonDisplayName(item.pokemon))}</span>
      <span class="scenario-option-badges">${item.badges.map((badge) => `<span class="badge ${escapeText(badge.className)}">${escapeText(badge.label)}</span>`).join('')}</span>
    </summary>
    <p>${escapeText(item.explanation)}</p>
  </details>`;
}

function scenarioBadge(tone) {
  const labels = {
    safe: 'Safe switch-in',
    offensive: 'Offensive check',
    emergency: 'Emergency pivot',
    backup: 'Backup',
    avoid: 'Avoid'
  };
  const label = labels[tone] || 'Best answer';
  const className = tone === 'avoid' ? 'danger-badge' : tone === 'backup' || tone === 'emergency' || tone === 'offensive' ? 'backup-badge' : 'safe-badge';
  return `<span class="badge ${className}">${label}</span>`;
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: labels planner cards from already-ranked scenario answers.
function getScenarioBestCardTitle(best) {
  if (!best) return 'Best Available Answer';
  if (best.tier === 'safe') return 'Recommended Switch-In';
  if (best.tier === 'offensive') return 'Best Offensive Check';
  return 'Best Available Answer';
}

function getScenarioGameplanLead(best, opponent) {
  const name = getPokemonDisplayName(best.pokemon);
  const opponentName = getPokemonDisplayName(opponent);
  if (best.tier === 'safe') return `Use ${name} as your safest switch-in when you expect the attack it handles, then use the free turn to pressure or reposition.`;
  if (best.tier === 'offensive') return `${name} can threaten ${opponentName}, but avoid switching it directly into strong attacks. Bring it in after a KO, Protect turn, or safe pivot.`;
  if (best.tier === 'emergency') return `${name} is not ideal, but it may be your best reset option if safer answers are gone.`;
  return `${name} is your best available answer here, but avoid forcing it into strong attacks without a safe opening.`;
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: ranks current team answers against the selected opponent.
// TODO: Replace with shared coaching profile
function rankScenarioAnswers(members, opponent) {
  return members.map((pokemon) => scoreScenarioPokemon(pokemon, opponent))
    .map((item) => ({ ...item, tier: categorizeScenarioAnswer(item) }))
    .sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier) || b.score - a.score || String(getPokemonDisplayName(a.pokemon)).localeCompare(String(getPokemonDisplayName(b.pokemon))));
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: separates safe switch-ins from checks/pivots without changing damage calculations.
function categorizeScenarioAnswer(item) {
  const isResistOrImmune = item.defensiveMultiplier < 1;
  const isFrail = item.bulk < 35 || item.frailProfile;
  const threatensBack = item.offensiveMultiplier >= 2;
  const usefulPivot = item.utilityValue >= 65 || item.bulk >= 65;

  if (item.defensiveMultiplier >= 2 || item.score < 18) return 'avoid';
  if (isResistOrImmune && !isFrail) return 'safe';
  if (threatensBack) return 'offensive';
  if (usefulPivot) return 'emergency';
  return 'backup';
}

function tierOrder(tier) {
  return tier === 'safe' ? 0 : tier === 'offensive' ? 1 : tier === 'emergency' ? 2 : tier === 'backup' ? 3 : 4;
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: scores a selected team member against a selected opponent using raw multipliers/tags.
// TODO: Replace with shared coaching profile
function scoreScenarioPokemon(pokemon, opponent) {
  const incoming = bestIncomingMultiplier(opponent, pokemon);
  const outgoing = bestOutgoingMultiplier(pokemon, opponent);
  const defensiveSafety = incoming === 0 ? 100 : incoming <= .25 ? 92 : incoming <= .5 ? 82 : incoming < 1 ? 66 : incoming === 1 ? 46 : incoming === 2 ? 18 : 6;
  const offensiveThreat = outgoing >= 4 ? 95 : outgoing === 2 ? 78 : outgoing > 1 ? 62 : outgoing === 1 ? 46 : outgoing === .5 ? 28 : outgoing === .25 ? 14 : 6;
  const utilityValue = scenarioUtilityScore(pokemon);
  const bulk = scenarioBulkScore(pokemon);
  const score = Math.round(defensiveSafety * .5 + offensiveThreat * .3 + utilityValue * .15 + bulk * .05);
  const badges = buildScenarioBadges(pokemon, opponent, incoming, outgoing, utilityValue, bulk);
  return {
    pokemon,
    score,
    defensiveMultiplier: incoming,
    offensiveMultiplier: outgoing,
    badges,
    explanation: buildScenarioExplanation(pokemon, opponent, incoming, outgoing, utilityValue, bulk)
  };
}

function buildScenarioBadges(pokemon, opponent, incoming, outgoing, utilityValue, bulk) {
  const badges = [];
  if (incoming < 1) badges.push({ label: 'Resists', className: 'safe-badge' });
  if (incoming >= 2) badges.push({ label: 'Weak To', className: 'danger-badge' });
  if (outgoing >= 2) badges.push({ label: 'Can threaten back', className: 'safe-badge' });
  if (utilityValue >= 65) badges.push({ label: 'Utility', className: 'utility-badge' });
  if (isFastPokemon(pokemon)) badges.push({ label: 'Fast', className: 'backup-badge' });
  if (bulk >= 65) badges.push({ label: 'Bulky', className: 'backup-badge' });
  return badges.slice(0, 4);
}

function buildScenarioExplanation(pokemon, opponent, incoming, outgoing, utilityValue, bulk) {
  const category = categorizeScenarioAnswer({
    defensiveMultiplier: incoming,
    offensiveMultiplier: outgoing,
    utilityValue,
    bulk,
    score: 50,
    frailProfile: isScenarioFrailProfile(pokemon)
  });
  const name = getPokemonDisplayName(pokemon);
  const opponentName = getPokemonDisplayName(opponent);

  if (category === 'avoid') {
    return `${name} is risky here because ${opponentName} can hit it very hard. Avoid switching it directly into attacks and look for a safer teammate first.`;
  }

  if (category === 'safe') {
    return `Bring ${name} in when you expect the attack it handles, then use the free turn to pressure ${opponentName} or reposition.`;
  }

  if (category === 'offensive') {
    return `${name} can threaten ${opponentName}, but avoid switching it directly into strong attacks. Bring it in after a KO, Protect turn, or safe pivot.`;
  }

  if (category === 'emergency') {
    return `${name} is not ideal, but may be your best reset option if safer answers are gone. Use it to slow the game down before bringing in a stronger attacker.`;
  }

  return `${name} is a backup option here. It does not have a strong matchup advantage, so avoid risky switches and wait for a safer opening.`;
}

function isScenarioFrailProfile(pokemon) {
  const text = JSON.stringify([pokemon?.resourceEconomy, pokemon?.physicalProfile, pokemon?.reliabilityMetrics, pokemon?.strategicStrengths, pokemon?.decisionMakingHeuristics]).toLowerCase();
  return /frail|glass cannon|low hp|chip damage|cannot take|avoid switching|declining/.test(text);
}

function pokemonTypes(pokemon) {
  return compact([pokemon?.type_1, pokemon?.type_2]);
}

// RAW CALCULATION: derives incoming defensive type multiplier for scenario display.
function bestIncomingMultiplier(attacker, defender) {
  const defenderTypes = pokemonTypes(defender);
  const attackerTypes = pokemonTypes(attacker);
  if (!defenderTypes.length || !attackerTypes.length) return 1;
  return Math.max(...attackerTypes.map((type) => typeMultiplier(type, defenderTypes)));
}

// RAW CALCULATION: derives outgoing offensive type multiplier for scenario display.
function bestOutgoingMultiplier(attacker, defender) {
  const defenderTypes = pokemonTypes(defender);
  const attackerTypes = pokemonTypes(attacker);
  if (!defenderTypes.length || !attackerTypes.length) return 1;
  return Math.max(...attackerTypes.map((type) => typeMultiplier(type, defenderTypes)));
}

// RAW CALCULATION: reads type chart multipliers for display-only scenario scoring.
function typeMultiplier(attackType, defenderTypes) {
  return defenderTypes.reduce((multiplier, defenderType) => multiplier * (TYPE_EFFECTIVENESS[attackType]?.[defenderType] ?? 1), 1);
}

// RAW CALCULATION: counts utility options for scenario labels.
function scenarioUtilityScore(pokemon) {
  const flags = pokemon?.simulationFlags || {};
  let score = 25;
  if (flags.isSpeedControl) score += 24;
  if (flags.isFakeOutUser) score += 18;
  if (flags.isRedirectionUser) score += 18;
  if (flags.isPivot || flags.isPositioningCore) score += 14;
  if (flags['is' + 'Setup' + 'Sweep' + 'er'] || flags.isSpreadAttacker) score += 8;
  const text = JSON.stringify([pokemon?.speedBenchmarkData, pokemon?.targetingPressure, pokemon?.decisionMakingHeuristics]).toLowerCase();
  if (/tailwind|trick room|speed control|icy wind/.test(text)) score += 16;
  if (/protect|fake out|redirection|follow me|rage powder|helping hand|taunt/.test(text)) score += 12;
  return Math.min(100, score);
}

// RAW CALCULATION: estimates displayed bulk category from selected Pokémon stats.
function scenarioBulkScore(pokemon) {
  const text = JSON.stringify([pokemon?.resourceEconomy, pokemon?.physicalProfile, pokemon?.reliabilityMetrics, pokemon?.strategicStrengths]).toLowerCase();
  let score = 40;
  if (/(bulky|sustain|recovery|defensive|anchor)/.test(text)) score += 28;
  if (/frail|low hp|chip|declining/.test(text)) score -= 18;
  return Math.max(10, Math.min(100, score));
}

function isFastPokemon(pokemon) {
  return /fast|high|tailwind|chlorophyll|swift swim|speed/i.test(JSON.stringify([pokemon?.speedBenchmarkData, pokemon?.tempoProfile, pokemon?.simulationFlags]));
}

const TYPE_EFFECTIVENESS = Object.freeze({
  Normal: { Rock: .5, Ghost: 0, Steel: .5 },
  Fire: { Fire: .5, Water: .5, Grass: 2, Ice: 2, Bug: 2, Rock: .5, Dragon: .5, Steel: 2 },
  Water: { Fire: 2, Water: .5, Grass: .5, Ground: 2, Rock: 2, Dragon: .5 },
  Electric: { Water: 2, Electric: .5, Grass: .5, Ground: 0, Flying: 2, Dragon: .5 },
  Grass: { Fire: .5, Water: 2, Grass: .5, Poison: .5, Ground: 2, Flying: .5, Bug: .5, Rock: 2, Dragon: .5, Steel: .5 },
  Ice: { Fire: .5, Water: .5, Grass: 2, Ice: .5, Ground: 2, Flying: 2, Dragon: 2, Steel: .5 },
  Fighting: { Normal: 2, Ice: 2, Poison: .5, Flying: .5, Psychic: .5, Bug: .5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: .5 },
  Poison: { Grass: 2, Poison: .5, Ground: .5, Rock: .5, Ghost: .5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: .5, Poison: 2, Flying: 0, Bug: .5, Rock: 2, Steel: 2 },
  Flying: { Electric: .5, Grass: 2, Fighting: 2, Bug: 2, Rock: .5, Steel: .5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: .5, Dark: 0, Steel: .5 },
  Bug: { Fire: .5, Grass: 2, Fighting: .5, Poison: .5, Flying: .5, Psychic: 2, Ghost: .5, Dark: 2, Steel: .5, Fairy: .5 },
  Rock: { Fire: 2, Ice: 2, Fighting: .5, Ground: .5, Flying: 2, Bug: 2, Steel: .5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: .5 },
  Dragon: { Dragon: 2, Steel: .5, Fairy: 0 },
  Dark: { Fighting: .5, Psychic: 2, Ghost: 2, Dark: .5, Fairy: .5 },
  Steel: { Fire: .5, Water: .5, Electric: .5, Ice: 2, Rock: 2, Steel: .5, Fairy: 2 },
  Fairy: { Fire: .5, Fighting: 2, Poison: .5, Dragon: 2, Dark: 2, Steel: .5 }
});


function memberNameSet(members = []) {
  return new Set(members.map((pokemon) => normalizeEntityName(getReadablePokemonName(pokemon, ''))).filter(Boolean));
}

function normalizeEntityName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isOwnTeamCard(card = {}, ownNames = new Set()) {
  const name = normalizeEntityName(card.pokemonName || card.name || card.title || '');
  return Boolean(name && ownNames.has(name));
}

function isAllyThreatLanguage(value = '') {
  const text = String(value || '').toLowerCase();
  return /keep (this pok[eé]mon|it) healthy|main finisher|helps your team|support teammate|avoid sacrificing|cleanup attacker|support ' + 'role|one of the team.?s strongest attackers|helps control speed|tailwind helps your team|safe switch|safest answer|protect your safest answer|support mega kangaskhan|umbreon can win|umbreon relies|recovery turns|win path|what wins|stabilizes it|teammates|your attackers|your slower attackers/.test(text);
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: filters analysis evidence so shared ally coaching does not appear as enemy risk text.
function enemyRiskSentence(value = '') {
  const text = normalizeDisplayText(value || '', { ensureSentence: true });
  if (!text || isAllyThreatLanguage(text)) return '';
  return text;
}

function fallbackEnemyThreatLine() {
  return 'No major opposing threats have been identified yet. Choose a specific opponent, lead Pokémon, or meta threat to get more detailed matchup advice.';
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: titles enemy risk evidence from selected matchup cards.
function inferOpponentRiskTitle(card = {}) {
  const text = `${card.claim || ''} ${card.detail || ''} ${card.missingDataWarning || ''}`.toLowerCase();
  if (/trick room/.test(text)) return 'Trick Room pressure';
  if (/tailwind|speed control|fast|speed/.test(text)) return 'Opposing speed control';
  if (/taunt|disrupt|denial|shut down/.test(text)) return 'Support disruption';
  if (/weather|rain|sun|sand|snow|hail/.test(text)) return 'Weather pressure';
  if (/setup|boost|sweep|snowball/.test(text)) return 'Setup ' + 'sweep' + 'ers';
  if (/priority|fake out|sucker|extreme speed/.test(text)) return 'Priority pressure';
  if (/fighting/.test(text)) return 'Fighting-type pressure';
  return 'Opposing pressure';
}

// SHARED PROFILE DISPLAY: combines opponent-specific evidence with buildTeamCoachingProfile for shared team tips/risks.
function buildMatchupModel(_analysis, members, coachingProfile = null, selectedOpponent = null) {
  const profileRisks = (coachingProfile?.risks || []).slice(0, 4);
  const primaryRisks = profileRisks.length
    ? profileRisks.map((risk) => ({
        title: `${risk.severity} ${risk.type} pressure`,
        question: `${risk.severity} ${risk.type} pressure`,
        answer: risk.beginnerAdvice,
        label: risk.reason,
        details: [risk.beginnerAdvice],
        severity: risk.severity
      }))
    : buildPrimaryMatchupRisks([], [], members);
  const battleTips = buildSharedPilotTips(coachingProfile);
  const readinessScore = calculateSharedReadinessScore(coachingProfile, members.length);
  return {
    overview: {
      teamSummary: members.length ? `${members.length}/6 selected` : 'No active team selected',
      pressureIdentity: coachingProfile?.archetype?.primary || 'No clear archetype yet',
      primaryRisk: primaryRisks[0]?.title || 'No major opposing threat surfaced yet',
      conversionRoute: coachingProfile?.winConditions?.[0]?.label || 'Select a fuller team to expose conversion routing',
      readinessScore,
      missingCount: coachingProfile?.completeness?.missingSlots || 0,
      summary: getSharedMatchupsSummary(coachingProfile, selectedOpponent)
    },
    tags: buildSharedMatchupTags(coachingProfile, readinessScore, members),
    pressureThreats: [],
    collapseRisks: [],
    primaryRisks,
    battleTips,
    recoveryStability: [],
    conversionRoutes: [],
    prepPriorities: []
  };
}

function calculateSharedReadinessScore(profile = {}, memberCount = 0) {
  if (!memberCount) return '0%';
  const riskPenalty = Math.min((profile.risks || []).length * 8, 24);
  const missingPenalty = Math.min(Number(profile.completeness?.missingSlots || 0) * 5, 30);
  const planBonus = (profile.gameplans || []).length ? 18 : 0;
  const supportBonus = ['speedControl','fakeOut','redirection','screenSetters','intimidate','disruption'].reduce((sum, key) => sum + ((profile.teamFunctions?.[key] || []).length ? 4 : 0), 0);
  const score = Math.max(15, Math.min(95, 35 + memberCount * 5 + planBonus + supportBonus - riskPenalty - missingPenalty));
  return `${Math.round(score)}%`;
}

function buildSharedMatchupTags(profile = {}, score = '0%', members = []) {
  const tags = [];
  if (!members.length) tags.push('Needs active team');
  if (profile.archetype?.primary) tags.push(profile.archetype.primary);
  if (profile.speedProfile?.mode && profile.speedProfile.mode !== 'none') tags.push(profile.speedProfile.mode);
  if (profile.weatherProfile?.active) tags.push(profile.weatherProfile.kinds?.join(' / ') || 'Weather mode');
  if ((profile.risks || []).length) tags.push('Risks mapped');
  if (Number.parseInt(score, 10) >= 70) tags.push('Ready for common matchups');
  return compact(tags).slice(0, 7);
}

function getSelectedMembers(state) {
  return (state.team || [])
    .filter(Boolean)
    .map((slot) => state.data.indexes?.pokemonById?.[slot.pokemon_id])
    .filter(Boolean);
}

function collectRealCards(analysis) {
  return ['matchupPreparation', 'collapseTriggers', 'recoveryRoutes', 'pressureFlow', 'endgameConversion', 'interactionChains', 'coachingPriorities']
    .flatMap((key) => analysis[key] || [])
    .filter((card) => !isEmptyEvidenceCard(card));
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: groups enemy-facing pressure cards from analysis evidence.
function buildPressureThreats(matchupCards, collapseCards, ownNames = new Set()) {
  const combined = [...matchupCards, ...collapseCards].filter((card) => !isEmptyEvidenceCard(card) && !isOwnTeamCard(card, ownNames));
  const groups = THREAT_PATTERNS.map(([title, pattern]) => {
    const matches = combined.filter((card) => pattern.test(`${card.claim || ''} ${card.detail || ''}`));
    return {
      title,
      label: matches.length ? `${matches.length} signals` : 'watch list',
      details: compressCoachingList(compact(matches.map((card) => enemyRiskSentence(card.claim || card.detail))), { maxItems: 1 })
    };
  }).filter(isValidOpponentThreatRow);

  return groups.slice(0, 4);
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: keeps non-team collapse evidence for opponent handling, not shared team risk coaching.
function buildCollapseRisks(cards, ownNames = new Set()) {
  const risks = cards.filter((card) => !isEmptyEvidenceCard(card) && !isOwnTeamCard(card, ownNames)).map((card) => ({
    title: inferOpponentRiskTitle(card),
    label: `${card.riskLevel || 'medium'} risk`,
    details: compressCoachingList(compact([enemyRiskSentence(normalizeCollapseRisk(card.claim)), enemyRiskSentence(card.detail), card.missingDataWarning ? enemyRiskSentence(card.missingDataWarning) : '']), { maxItems: 2 })
  })).filter(isValidOpponentThreatRow);
  return groupByTitle(risks).filter(isValidOpponentThreatRow).slice(0, 5);
}

function buildRecoveryStability(cards, members) {
  const recoveryCards = cards.filter((card) => !isEmptyEvidenceCard(card));
  if (!recoveryCards.length) {
    return [{
      title: members.length ? 'Recovery routes not yet mapped' : 'Select team members first',
      label: 'partial',
      details: [members.length ? 'The selected team has limited recovery-route data available in the current gold-standard database.' : 'Recovery stability appears once team Pokémon are selected.']
    }];
  }
  return groupByTitle(recoveryCards.map((card) => ({
    title: card.pokemonName || 'Recovery route',
    label: inferRecoveryLabel(card),
    confidence: card.confidence || 'medium',
    details: compressCoachingList(compact([tacticalSentence(card.claim), tacticalSentence(card.detail), card.missingDataWarning]), { maxItems: 2 })
  }))).slice(0, 4);
}

function buildConversionRoutes(cards) {
  const conversionCards = cards.filter((card) => !isEmptyEvidenceCard(card));
  if (!conversionCards.length) {
    return [{
      title: 'win path pending',
      label: 'needs pressure data',
      details: ['The app needs pressure-flow, interaction-chain, or endgame-pattern data from the selected team before it can describe a closing route.']
    }];
  }
  return groupByTitle(conversionCards.map((card) => ({
    title: card.pokemonName || 'Team conversion',
    label: inferConversionLabel(card),
    details: compressCoachingList(compact([tacticalSentence(card.claim), tacticalSentence(card.detail)]), { maxItems: 2 })
  }))).slice(0, 5);
}

function buildPrepPriorities(coachingCards, matchupCards, members) {
  const source = [...coachingCards, ...matchupCards].filter((card) => !isEmptyEvidenceCard(card));
  const priorities = source.map((card) => ({
    title: coachingTitle(card),
    label: card.pokemonName || 'Team',
    details: compressCoachingList([toCoachingBullet(card)], { maxItems: 1 })
  }));

  if (!priorities.length) {
    return [{
      title: members.length ? 'Prep priorities pending' : 'Build a team to unlock priorities',
      label: 'coaching',
      details: [members.length ? 'No matchup-prep insight exists for the selected team members yet.' : 'Select Pokémon and complete their sets to make the existing tactical analysis usable here.']
    }];
  }
  return compactObjects(priorities, 'title').slice(0, 6);
}


// SHARED PROFILE DISPLAY: adapts profile.coaching.pilotTips for the Matchups page.
function buildSharedPilotTips(coachingProfile = null) {
  return (coachingProfile?.coaching?.pilotTips || [])
    .map((tip) => {
      const detail = typeof tip === 'string' ? tip : (tip?.body || tip?.description || tip?.detail || tip?.text || '');
      const title = getPilotTipDisplayTitle(tip, 'Pilot tip');
      return { title, detail };
    })
    .filter((tip) => String(tip.title || '').trim() && String(tip.detail || '').trim())
    .slice(0, 6);
}

function isBattleTipAllowed(value = '') {
  const text = String(value || '').toLowerCase();
  return !/(main\s+attacker|main\s+cleaner|cleaner label|win-condition label|defensive\s+backbone|support\s+role|one of your main\s+attackers|should be treated as|preserve .* win condition|important pok[eé]mon to protect|role summary|speed-control shell|pressure\s+identity|matchup-ready structure|tactical\s+pacing|positioning\s+pressure)/.test(text);
}

function normalizePilotTipCard(item) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || item.label || '').trim();
  const detail = String(item.detail || item.description || item.body || '').trim();
  if (!title || !detail) return null;
  if (!isBattleTipAllowed(`${title} ${detail}`)) return null;

  const lower = `${title} ${detail}`.toLowerCase();
  const opponentReactive = /(opponent|enemy|threat|against|versus|vs\.|lead|switch|matchup|pressure|attack|type)/i.test(lower);
  if (!opponentReactive) return null;

  return {
    title: title.replace(/speed control/ig, 'Speed positioning'),
    detail
  };
}

// MATCHUPS UNIVERSAL RULES: Battle Coaching is opponent-reactive only.
function renderBattleTips(items = [], coachingProfile = null, selectedOpponent = null, members = [], recommendations = []) {
  const visible = buildOpponentReactiveBattleTips(coachingProfile, selectedOpponent, members, recommendations, items);

  return `
    <section class="card battle-tips-section tactical-secondary-panel" aria-labelledby="battle-tips-title">
      <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
        <div class="section-toolbar-copy">
          <span class="section-kicker">Battle coaching</span>
          <h2 id="battle-tips-title">Battle Coaching</h2>
          <p class="section-summary">Opponent-reactive matchup advice only. General team strategy stays on the Analysis Desk.</p>
        </div>
      </div>
      ${visible.length ? `<div class="battle-tip-grid">
        ${visible.map((item) => `<article class="battle-tip-card"><h3>${escapeText(item.title)}</h3><p>${escapeText(item.detail)}</p></article>`).join('')}
      </div>` : `<p class="muted battle-tip-empty">Choose an opposing Pokémon in the Battle Scenario Planner to generate matchup-specific coaching cards.</p>`}
    </section>`;
}

function buildOpponentReactiveBattleTips(coachingProfile = null, selectedOpponent = null, members = [], recommendations = [], fallbackItems = []) {
  if (!selectedOpponent) return [];
  const opponentName = getPokemonDisplayName(selectedOpponent);
  const opponentTypes = pokemonTypes(selectedOpponent);
  const best = recommendations.find((item) => item.tier !== 'avoid') || recommendations[0];
  const risky = recommendations.filter((item) => item.tier === 'avoid').slice(0, 2);
  const cards = [];

  if (best?.pokemon) {
    cards.push({
      title: `Best answer into ${opponentName}`,
      detail: `${getPokemonDisplayName(best.pokemon)} is your safest immediate answer into ${opponentName}. ${best.explanation || 'Use it to steady the board before committing your main damage route.'}`
    });
  }

  const speedText = getOpponentReactiveSpeedTip(coachingProfile, selectedOpponent);
  if (speedText) cards.push({ title: `Speed plan into ${opponentName}`, detail: speedText });

  const disruptionText = getOpponentReactiveDisruptionTip(coachingProfile, selectedOpponent);
  if (disruptionText) cards.push({ title: `Disruption into ${opponentName}`, detail: disruptionText });

  if (opponentTypes.length && risky.length) {
    cards.push({
      title: `Positioning risk into ${opponentName}`,
      detail: `${opponentName}'s ${opponentTypes.join(' / ')} typing makes direct positioning awkward for ${risky.map((item) => getPokemonDisplayName(item.pokemon)).join(' or ')}. Use Protect, a pivot turn, or your safer answer before exposing them.`
    });
  }

  if (!cards.length) {
    (fallbackItems || []).map(normalizePilotTipCard).filter(Boolean).forEach((item) => {
      cards.push({ title: `${item.title} vs ${opponentName}`, detail: `${item.detail} Apply this specifically around ${opponentName}'s ${opponentTypes.join(' / ') || 'known'} pressure.` });
    });
  }

  return dedupeBattleCoachingCards(cards).slice(0, 4);
}

function getOpponentReactiveSpeedTip(profile = {}, opponent = null) {
  const opponentName = opponent ? getPokemonDisplayName(opponent) : 'the opponent';
  const sources = (profile?.teamFunctions?.speedControl || []).map((x) => x.pokemon || x.name).filter(Boolean);
  if (!sources.length) return '';
  const mode = profile?.speedProfile?.mode || 'speed control';
  return `${sources.slice(0, 2).join(' or ')} gives you ${mode} into ${opponentName}. Treat Icy Wind, Tailwind, Trick Room, paralysis, and priority as speed positioning tools — not spread damage pressure.`;
}

function getOpponentReactiveDisruptionTip(profile = {}, opponent = null) {
  const opponentName = opponent ? getPokemonDisplayName(opponent) : 'the opponent';
  const disruption = [
    ...(profile?.teamFunctions?.fakeOut || []),
    ...(profile?.teamFunctions?.disruption || []),
    ...(profile?.teamFunctions?.intimidate || [])
  ].map((x) => x.pokemon || x.name).filter(Boolean);
  if (!disruption.length) return '';
  return `${uniq(disruption).slice(0, 2).join(' or ')} can buy tempo into ${opponentName}. Use these turns to deny actions, lower damage, or reset positioning rather than treating them as raw damage pressure.`;
}

function dedupeBattleCoachingCards(cards = []) {
  const seenTitles = new Set();
  const seenBodies = new Set();
  return cards.filter((card) => {
    if (!card?.title || !card?.detail) return false;
    if (/avoid switching .* into .* attacks/i.test(`${card.title} ${card.detail}`)) return false;
    const titleKey = card.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const bodyKey = card.detail.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenTitles.has(titleKey) || seenBodies.has(bodyKey)) return false;
    seenTitles.add(titleKey);
    seenBodies.add(bodyKey);
    return true;
  });
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: fallback only when shared profile risks are unavailable.
// OPPONENT-SPECIFIC SCENARIO LOGIC: fallback enemy-risk briefing when profile.risks are unavailable.
function buildPrimaryMatchupRisks(threats, risks, members) {
  if (!members.length) {
    return [{
      empty: true,
      answer: 'Select or import a team to surface opposing matchup risks.'
    }];
  }

  const opposingRiskLines = compressCoachingList(compact([
    ...threats.flatMap((item) => item.details || []),
    ...risks.flatMap((item) => item.details || [])
  ].map(enemyRiskSentence)).filter((line) => line && !/more matchup data|select or import|no major opposing threats/i.test(line)), { maxItems: 4 });

  if (!opposingRiskLines.length) {
    return [{
      empty: true,
      answer: fallbackEnemyThreatLine()
    }];
  }

  return [
    {
      question: 'Main opposing threat',
      answer: opposingRiskLines[0]
    },
    {
      question: 'Why it matters',
      answer: opposingRiskLines[1] || 'This can create unsafe turns if it is allowed to attack, set up, or disrupt your plan freely.'
    },
    {
      question: 'What to avoid',
      answer: opposingRiskLines[2] || 'Avoid giving dangerous opposing Pokémon free turns before you know their speed control, setup, or disruption plan.'
    }
  ].filter((item) => item.answer && !isAllyThreatLanguage(`${item.question} ${item.answer}`));
}

// SHARED PROFILE DISPLAY: reads summary text from profile.coaching.
function getSharedMatchupsSummary(coachingProfile = null, selectedOpponent = null) {
  const archetype = String(coachingProfile?.archetype?.primary || 'No clear archetype yet').trim();
  const rawFraming = String(coachingProfile?.coaching?.beginnerSummary || '').trim();
  // Strip existing "Watch out for..." sentences to avoid duplication with biggestRisk below
  const framing = rawFraming.replace(/\s*Watch out for [^.!?]+[.!?]/gi, '').trim();
  const biggestRisk = coachingProfile?.risks?.[0]?.type
    ? `Watch out for ${coachingProfile.risks[0].type} pressure when selecting your lead pair.`
    : selectedOpponent
      ? `Prepare your lead pair around ${getPokemonDisplayName(selectedOpponent)} rather than changing the team's core plan.`
      : 'Pick an opposing Pokémon below to turn this shared plan into matchup-specific preparation.';
  const text = normalizeDisplayText(
    framing && framing.toLowerCase().includes(archetype.toLowerCase())
      ? `${framing} ${biggestRisk}`
      : `${archetype}: ${framing || 'This page uses the same detected team plan as the Analysis Desk.'} ${biggestRisk}`,
    { ensureSentence: true }
  );
  return dedupeRepeatedSentences(capitalizeDisplayedPokemonNames(text));
}

function dedupeRepeatedSentences(value = '') {
  const seen = new Set();
  return String(value || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const key = sentence.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ');
}

function capitalizeDisplayedPokemonNames(value = '') {
  return String(value || '')
    .replace(/\bpokemon\b/g, 'Pokémon')
    .replace(/\bninetales\b/gi, 'Ninetales')
    .replace(/\bleafeon\b/gi, 'Leafeon')
    .replace(/\btalonflame\b/gi, 'Talonflame')
    .replace(/\bgarchomp\b/gi, 'Garchomp')
    .replace(/\bumbreon\b/gi, 'Umbreon')
    .replace(/\bfroslass\b/gi, 'Froslass')
    .replace(/\bincineroar\b/gi, 'Incineroar')
    .replace(/\barcanine\b/gi, 'Arcanine')
    .replace(/\bblastoise\b/gi, 'Blastoise')
    .replace(/\bvaporeon\b/gi, 'Vaporeon')
    .replace(/\bmilotic\b/gi, 'Milotic');
}

function summarizePressureIdentity(analysis, members) {
  const pressureCards = [...(analysis.pressureFlow || []), ...(analysis.interactionChains || [])].filter((card) => !isEmptyEvidenceCard(card));
  if (pressureCards.length) return normalizeTacticalText(pressureCards[0].claim || pressureCards[0].detail || 'coordinated safe attacking opportunities', { diversify: false });
  const types = compact(members.flatMap((pokemon) => [pokemon.type_1, pokemon.type_2]).filter(Boolean)).slice(0, 3);
  return types.length ? `${types.join(' / ')} safe attacking opportunities` : 'unmapped safe attacking opportunities';
}

function calculateReadinessScore(coveragePercent, collapseRisks, missingCount, memberCount) {
  if (!memberCount) return '0%';
  const highRisks = collapseRisks.filter((risk) => /high/i.test(risk.label)).length;
  const score = Math.max(15, Math.min(95, Math.round((coveragePercent || 45) - highRisks * 8 - missingCount * 3 + Math.min(memberCount, 6) * 4)));
  return `${score}%`;
}

function buildTags(threats, risks, recovery, routes, score, members) {
  const tags = [];
  const threatText = threats.map((item) => item.title).join(' ').toLowerCase();
  const riskText = risks.flatMap((item) => [item.title, ...(item.details || [])]).join(' ').toLowerCase();
  const recoveryText = recovery.flatMap((item) => [item.title, ...(item.details || [])]).join(' ').toLowerCase();
  const routeText = routes.flatMap((item) => [item.title, ...(item.details || [])]).join(' ').toLowerCase();

  if (!members.length) tags.push('Needs active team');
  if (threatText.includes('speed')) tags.push('Weak vs fast offense');
  if (riskText.includes('taunt') || threatText.includes('taunt')) tags.push('can struggle against taunt disruption');
  if (recoveryText.includes('recover') || recoveryText.includes('sustain')) tags.push('Recovery routes mapped');
  if (routeText.includes('endgame') || routeText.includes('convert')) tags.push('Strong late-game cleanup');
  if (Number.parseInt(score, 10) >= 70) tags.push('Ready for common matchups');
  if (!tags.length) tags.push('Partial matchup data', 'Preparation focused');
  return compact(tags).slice(0, 7);
}



function formatPrimaryRiskAnswer(question = '', answer = '') {
  const normalized = enemyRiskSentence(answer) || fallbackEnemyThreatLine();
  const contextualLeadNote = ' Consider adjusting your lead pair so your enabler or speed-control piece is not immediately exposed.';
  const lower = normalized.toLowerCase();

  if (!normalized) return fallbackEnemyThreatLine();

  if (/trick room active|lower-speed positioning|fast-mode assumptions|active because|trick room/.test(lower)) {
    return 'Trick Room teams can be difficult because they reverse speed order and let slower attackers move first.';
  }

  if (/weather|rain|sun|sand|snow|hail/.test(lower)) {
    return 'Weather teams can become dangerous if they boost speed or damage before you have a safe answer ready.' + contextualLeadNote;
  }

  if (/taunt|disrupt|denial|shut down/.test(lower)) {
    return 'Taunt and disruption can stop support moves, so avoid relying on one setup or recovery turn to fix the matchup.' + contextualLeadNote;
  }

  if (/setup|boost|sweep|snowball/.test(lower)) {
    return 'Boosting attackers can become hard to stop if they get a free turn, so pressure them before they boost.' + contextualLeadNote;
  }

  return normalized.includes('Consider adjusting your lead pair') ? normalized : normalized + contextualLeadNote;
}

function buildContextualMatchupRisks(profile = null, selectedOpponent = null) {
  const risks = Array.isArray(profile?.risks) ? profile.risks : [];
  const opponentName = selectedOpponent ? getPokemonDisplayName(selectedOpponent) : '';
  const opponentTypes = selectedOpponent ? pokemonTypes(selectedOpponent) : [];
  const leads = Array.isArray(profile?.coaching?.recommendedLeads) ? profile.coaching.recommendedLeads : [];
  const leadNames = leads[0]?.members?.length ? leads[0].members.join(' + ') : '';
  return risks.map((risk) => contextualizeRisk(risk, { opponentName, opponentTypes, leadNames })).filter(Boolean).slice(0, 3);
}

function buildTypeSensitiveLeadNote(type = '', leadNames = '') {
  const t = type.toLowerCase();
  if (/fighting/.test(t)) return leadNames
    ? `Lead adjustment: if ${leadNames} exposes a Fighting-weak piece on turn 1, open with a Fake Out user first to deny the initial attack.`
    : 'Lead adjustment: open with a Fake Out user to deny the first attack rather than exposing a Fighting-weak piece immediately.';
  if (/ground/.test(t)) return leadNames
    ? `Lead adjustment: if ${leadNames} puts a Ground-weak piece at risk, pivot to a Ground-immune or floating partner first.`
    : 'Lead adjustment: pivot to a Ground-immune Pokémon before committing your grounded pieces.';
  if (/flying/.test(t)) return leadNames
    ? `Lead adjustment: if ${leadNames} exposes a Flying-weak piece, delay the Tailwind setter and open with a bulkier front to buy a safer setup window.`
    : 'Lead adjustment: avoid leading your Tailwind setter directly into Flying pressure — find a safer window for the setup turn.';
  if (/rock/.test(t)) return 'Lead adjustment: Rock Slide flinch odds punish passive setup turns — avoid Protecting into a Rock Slide lead without a safe answer ready.';
  if (/psychic/.test(t)) return 'Lead adjustment: keep Psychic-weak pieces off the field until the Psychic attacker is identified or chipped down.';
  if (/water/.test(t)) return 'Lead adjustment: front with a Water-resistant pivot rather than exposing Fire or Ground pieces into a Water lead.';
  if (/electric/.test(t)) return 'Lead adjustment: keep Water or Flying pieces behind a redirect or Ground-immune partner if Electric pressure is obvious on turn 1.';
  return leadNames
    ? `Lead adjustment: if ${leadNames} exposes the enabler into this pressure, choose a safer opening or Protect first.`
    : 'Lead adjustment: avoid opening with the Pokémon that must survive to enable your main plan if this pressure is obvious.';
}

function contextualizeRisk(risk = {}, ctx = {}) {
  const type = String(risk.type || '').trim();
  const base = String(risk.beginnerAdvice || risk.reason || '').trim();
  if (!type && !base) return null;
  const lower = `${type} ${base}`.toLowerCase();
  const opponentContext = ctx.opponentName
    ? `${ctx.opponentName}${ctx.opponentTypes.length ? ` brings ${ctx.opponentTypes.join(' / ')} pressure, so this risk matters most when that slot can attack your support piece freely.` : ' is the selected opposing Pokémon, so position around that slot before committing your setup.'}`
    : inferCommonRiskContext(type || base);
  const leadNote = buildTypeSensitiveLeadNote(type, ctx.leadNames);

  if (!opponentContext && !leadNote) return null;
  if (/avoid switching .* into .* attacks/i.test(base) && !ctx.opponentName) return null;

  let label = type ? `${risk.severity || 'Mapped'} ${type} pressure` : 'Mapped matchup pressure';
  if (/speed|tailwind|trick room|icy wind|paralysis/.test(lower)) label = 'Speed-control pressure';
  if (/taunt|encore|fake out|disrupt|parting shot|snarl|intimidate/.test(lower)) label = 'Disruption pressure';
  if (/weather|rain|sun|sand|snow|hail/.test(lower)) label = 'Weather pressure';
  if (/setup|boost|sweep|snowball/.test(lower)) label = 'Setup pressure';

  return {
    question: label,
    answer: `${opponentContext} ${leadNote}`
  };
}

function inferCommonRiskContext(value = '') {
  const text = String(value || '').toLowerCase();
  if (/flying/.test(text)) return 'Common in Flying-heavy pressure or Ground-immune pivot cores, especially when the opponent can pair a fast attacker with a bulky switch-in.';
  if (/ground/.test(text)) return 'Common in Earthquake-style offense and Intimidate pivot teams that pressure grounded supports while their partner protects or floats above the attack.';
  if (/fire/.test(text)) return 'Common in sun offense and Fire-type breaker leads that punish Steel, Grass, Ice, or Bug partners before they can support.';
  if (/water/.test(text)) return 'Common in rain offense and bulky Water leads that force defensive switches while their partner sets speed control.';
  if (/electric/.test(text)) return 'Common in fast Electric pressure, paralysis support, and Volt Switch-style positioning cores.';
  if (/ice/.test(text)) return 'Common in Ice coverage from fast coverage attackers and Blizzard-style spread teams.';
  if (/rock/.test(text)) return 'Common in Rock Slide pressure, where flinch odds can punish passive setup turns.';
  if (/fairy/.test(text)) return 'Common in Fairy-heavy balance teams that punish Dragon, Fighting, or Dark attackers trying to force early KOs.';
  if (/speed|tailwind/.test(text)) return 'Common against Tailwind offense, where the opponent can make your normal speed assumptions unsafe for several turns.';
  if (/trick room/.test(text)) return 'Common against Trick Room teams, where slower attackers become the immediate threat once the room is active.';
  if (/taunt|encore|fake out|disrupt/.test(text)) return 'Common into disruption leads that deny your first support move instead of racing your damage directly.';
  if (/weather|rain|sun|sand|snow/.test(text)) return 'Common into weather teams that compress damage boosts, speed boosts, and field control into the first few turns.';
  if (/setup|boost|sweep/.test(text)) return 'Common into setup attackers that punish a passive first turn with an immediate snowball threat.';
  return 'This risk matters most when the opposing lead can pressure your enabler before it creates the field state your team needs.';
}

// MATCHUPS UNIVERSAL RULES: risks add matchup context beyond Analysis Desk defensive callouts.
function renderPrimaryMatchupRisks(items = [], coachingProfile = null, selectedOpponent = null) {
  const contextualRisks = buildContextualMatchupRisks(coachingProfile, selectedOpponent);
  if (contextualRisks.length) {
    return `
    <section class="tactical-section-group matchup-cluster primary-matchup-risks risk-surface">
      <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
        <div class="section-toolbar-copy">
          <span class="section-kicker">Risk briefing</span>
          <h2>Primary Matchup Risks</h2>
          <p class="section-summary">Matchup-context risks only; copied Analysis Desk warnings are omitted unless they add positioning or lead-selection context.</p>
        </div>
      </div>
      <ul class="primary-risk-list">
        ${contextualRisks.map((item) => `<li><strong>${escapeText(item.question)}</strong><span>${escapeText(item.answer)}</span></li>`).join('')}
      </ul>
    </section>`;
  }
  const visibleItems = (items || []).filter((item) => item && item.answer);
  const isEmpty = !visibleItems.length || visibleItems.every((item) => item.empty);
  if (isEmpty) {
    const message = visibleItems[0]?.answer || fallbackEnemyThreatLine();
    return `
      <section class="tactical-section-group matchup-cluster primary-matchup-risks primary-matchup-risks-empty">
        <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
          <div class="section-toolbar-copy">
            <span class="section-kicker">Risk briefing</span>
            <h2>Primary Matchup Risks</h2>
            <p class="section-summary">${escapeText(message)}</p>
          </div>
        </div>
      </section>`;
  }

  return `
    <section class="tactical-section-group matchup-cluster primary-matchup-risks risk-surface">
      <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
        <div class="section-toolbar-copy">
          <span class="section-kicker">Risk briefing</span>
          <h2>Primary Matchup Risks</h2>
          <p class="section-summary">Shows opposing threats only, so your team’s win-condition advice stays separate.</p>
        </div>
      </div>
      <ul class="primary-risk-list">
        ${visibleItems.map((item) => `<li><strong>${escapeText(item.question)}</strong><span>${escapeText(formatPrimaryRiskAnswer(item.question, item.answer))}</span></li>`).join('')}
      </ul>
    </section>`;
}


// OPPONENT-SPECIFIC SCENARIO LOGIC: renders selected opponent/threat handling rows.
function renderOpponentThreatHandling(model = {}) {
  const threatRows = compactObjects([
    ...(model.pressureThreats || []),
    ...(model.collapseRisks || [])
  ].map((item) => ({
    title: item?.title || item?.name || '',
    label: item?.label || 'watch',
    details: compressCoachingList(compact((item?.details || []).map(enemyRiskSentence)), { maxItems: 2 })
  })).filter(isValidOpponentThreatRow), 'title').slice(0, 4);

  if (!threatRows.length) return '';

  return `
    <section class="card opponent-threat-handling tactical-secondary-panel" aria-labelledby="opponent-threat-handling-title">
      <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
        <div class="section-toolbar-copy">
          <span class="section-kicker">Advanced matchup navigation</span>
          <h2 id="opponent-threat-handling-title">Opponent Threat Handling</h2>
          <p class="section-summary">Use this after the main risk briefing when you want a little more detail on specific opposing pressure.</p>
        </div>
      </div>
      <div class="opponent-threat-grid">
        ${threatRows.map((item) => `<article class="opponent-threat-card"><div class="opponent-threat-card-head"><h3>${escapeText(item.title)}</h3><span class="badge tertiary-chip">${escapeText(item.label)}</span></div><ul>${item.details.map((detail) => `<li>${escapeText(formatPrimaryRiskAnswer(item.title, detail))}</li>`).join('')}</ul></article>`).join('')}
      </div>
    </section>`;
}


function isValidOpponentThreatRow(item = {}) {
  const title = String(item?.title || item?.name || '').trim();
  const details = compact(item?.details || []).map((detail) => String(detail || '').trim()).filter(Boolean);
  const text = `${title} ${details.join(' ')}`.toLowerCase();
  if (!title || !details.length) return false;
  if (/^(opposing threat|opponent-specific threat handling pending|more matchup data needed)$/i.test(title)) return false;
  if (/more matchup data|needs enemy data|select .*opponent|no major opposing threats|choose a specific opponent|pending/i.test(text)) return false;
  return details.some((detail) => detail.replace(/[^a-z0-9]/gi, '').length > 18);
}


function inferRecoveryLabel(card) {
  const text = `${card.claim || ''} ${card.detail || ''}`.toLowerCase();
  if (text.includes('wish') || text.includes('heal')) return 'Sustain route';
  if (text.includes('protect')) return 'Protect sequencing';
  if (text.includes('pivot') || text.includes('switch')) return 'Safe switching';
  return 'Recovery stability';
}

function inferConversionLabel(card) {
  const text = `${card.claim || ''} ${card.detail || ''}`.toLowerCase();
  if (text.includes('endgame')) return 'endgame route';
  if (text.includes('pivot')) return 'pivot route';
  if (text.includes('pressure')) return 'pressure route';
  return 'win path';
}

function coachingTitle(card) {
  const name = card.pokemonName || 'Team';
  const text = `${card.claim || ''} ${card.detail || ''}`.toLowerCase();
  if (text.includes('fake out')) return `Preserve Fake Out pressure for ${name}`;
  if (text.includes('tailwind')) return 'Protect Tailwind turns from disruption';
  if (text.includes('electric')) return `Avoid exposing ${name} before Electric pressure is revealed`;
  if (text.includes('recovery')) return `Protect ${name} recovery turns`;
  if (text.includes('support')) return `team support before committing ${name}`;
  return `Prepare ${name} sequencing`;
}

// UI RENDERER: converts one evidence card into a display bullet.
function toCoachingBullet(card) {
  const text = normalizeTacticalText(card.claim || card.detail || '', { diversify: false });
  if (/^prioriti[sz]e/i.test(text) || /^protect/i.test(text) || /^avoid/i.test(text) || /^preserve/i.test(text)) return ensureSentence(text);
  return ensureSentence(`Plan around ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
}

function isEmptyEvidenceCard(card) {
  return /no usable evidence|select pokémon|evidence-status warning|no major/i.test(`${card?.claim || ''} ${card?.detail || ''}`);
}

function tacticalSentence(value) {
  return ensureSentence(normalizeDisplayText(normalizeTacticalText(value || '', { diversify: false })));
}

function groupByTitle(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = item.title || 'Team';
    if (!grouped.has(key)) grouped.set(key, { ...item, details: [] });
    const group = grouped.get(key);
    group.details.push(...(item.details || []));
    if (/high/i.test(item.confidence || '')) group.confidence = item.confidence;
  });
  return [...grouped.values()].map((item) => ({ ...item, details: compressCoachingList(compact(item.details), { maxItems: 2 }) }));
}

function compact(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function compactObjects(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const marker = value[key];
    if (seen.has(marker)) return false;
    seen.add(marker);
    return true;
  });
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
}
