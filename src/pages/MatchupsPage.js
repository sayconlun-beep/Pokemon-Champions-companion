import { SearchableSelector } from '../components/SearchableSelector.js';
import { getPokemonSpriteById } from '../utils/pokemonSprites.js';
import { getPokemonTypeChipStyle } from '../constants/pokemonTypeColors.js';
import { SpeedControlPanel } from '../components/analysis/SpeedControlPanel.js';
import { getPokemonDisplayName, getPokemonSearchAliases } from '../utils/formGrouping.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';
import { buildTacticalPresentation } from '../logic/tacticalPresenter.js';
import { renderDataConfidenceDisclosure, renderTeamDataConfidenceDisclosure } from '../logic/dataConfidenceDisclosure.js';


export function MatchupsPage(state) {
  const selectedMembers = getSelectedMembers(state);
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const planner = buildBattleScenarioPlanner(state, selectedMembers, coachingProfile);
  const tacticalPresentation = buildTacticalPresentation(coachingProfile, {
    page: 'matchups',
    selectedOpponentName: planner.selectedLabel,
    selectedOpponentTypes: planner.selectedOpponent ? pokemonTypes(planner.selectedOpponent) : [],
    scenarioRecommendations: planner.recommendations.map((item) => ({
      ...item,
      displayName: item?.pokemon ? getPokemonDisplayName(item.pokemon) : ''
    }))
  });
  const model = buildMatchupModel(null, selectedMembers, coachingProfile, planner.selectedOpponent, tacticalPresentation);

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

      ${renderTeamDataConfidenceDisclosure(state.team, state.data, { id: 'matchups-team', title: 'Team data confidence' })}
      ${planner.selectedOpponent ? renderDataConfidenceDisclosure(planner.selectedOpponent, { id: `matchups-opponent-${planner.selectedOpponent.pokemon_id}`, compact: true }) : ''}
      ${renderOpeningPlans(tacticalPresentation)}
      ${renderPrimaryMatchupRisks(model.primaryRisks)}
      ${renderBattleTips(model.battleCoaching)}
      ${SpeedControlPanel({ team: state.team, data: state.data, context: 'matchups', coachingProfile })}
      ${renderBattleScenarioPlanner(planner)}
      ${renderOpponentThreatHandling(model)}
    </section>`;
}



function renderOpeningPlans(tacticalPresentation = {}) {
  const leads = Array.isArray(tacticalPresentation?.leads) ? tacticalPresentation.leads.slice(0, 4) : [];
  if (!leads.length) return '';
  return `<section class="card tactical-secondary-panel opening-plans-section" aria-labelledby="opening-plans-title">
    <div class="workspace-section-head section-toolbar-header">
      <div class="section-toolbar-copy">
        <span class="section-kicker">Opening Plans</span>
        <h2 id="opening-plans-title">Opening Plans</h2>
        <p class="section-summary">Recommended opening pairs and early-game sequencing based on the current team structure.</p>
      </div>
    </div>
    <div class="lead-analysis-grid compact-lead-analysis">
      ${leads.map((lead) => `<article class="lead-analysis-card">
        <div class="lead-analysis-card-head">
          <h3>${escapeText(lead.title)}</h3>
          <span class="badge tertiary-chip">${escapeText(lead.members.join(' + '))}</span>
        </div>
        <ul class="lead-analysis-list">
          ${lead.turnOne ? `<li><strong>Turn 1</strong><span>${escapeText(lead.turnOne)}</span></li>` : ''}
          ${lead.watchOut ? `<li><strong>Watch out for</strong><span>${escapeText(lead.watchOut)}</span></li>` : ''}
          ${lead.backHalf ? `<li><strong>Your back half</strong><span>${escapeText(lead.backHalf)}</span></li>` : ''}
        </ul>
      </article>`).join('')}
    </div>
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


// SHARED PROFILE DISPLAY: combines opponent-specific evidence with buildTeamCoachingProfile for shared team tips/risks.
function buildMatchupModel(_analysis, members, coachingProfile = null, selectedOpponent = null, tacticalPresentation = null) {
  const primaryRisks = Array.isArray(tacticalPresentation?.matchup?.primaryRisks)
    ? tacticalPresentation.matchup.primaryRisks
    : [];
  const battleCoaching = tacticalPresentation?.matchup?.battleCoaching || {
    items: tacticalPresentation?.matchup?.battleTips || [],
    emptyMessage: tacticalPresentation?.matchup?.emptyBattlePrompt || 'Choose an opposing Pokémon in the Battle Scenario Planner to generate matchup-specific coaching cards.'
  };
  const battleTips = Array.isArray(battleCoaching.items) ? battleCoaching.items : [];
  const readinessScore = calculateSharedReadinessScore(coachingProfile, members.length);
  return {
    overview: {
      teamSummary: members.length ? `${members.length}/6 selected` : 'No active team selected',
      pressureIdentity: coachingProfile?.archetype?.primary || 'No clear archetype yet',
      primaryRisk: primaryRisks[0]?.title || 'No major opposing threat surfaced yet',
      conversionRoute: coachingProfile?.winConditions?.[0]?.label || 'Select a fuller team to expose conversion routing',
      readinessScore,
      missingCount: coachingProfile?.completeness?.missingSlots || 0,
      summary: tacticalPresentation?.matchup?.overview || 'Pick an opposing Pokémon below to turn this shared plan into matchup-specific preparation.'
    },
    tags: buildSharedMatchupTags(coachingProfile, readinessScore, members),
    pressureThreats: [],
    collapseRisks: [],
    primaryRisks,
    battleCoaching: { ...battleCoaching, items: battleTips },
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

// MATCHUPS UNIVERSAL RULES: Battle Coaching is opponent-reactive only.
function renderBattleTips(battleCoaching = {}) {
  const visible = Array.isArray(battleCoaching?.items) ? battleCoaching.items : [];
  const emptyMessage = battleCoaching?.emptyMessage || 'Choose an opposing Pokémon in the Battle Scenario Planner to generate matchup-specific coaching cards.';
  const kicker = battleCoaching?.kicker || 'Battle coaching';
  const title = battleCoaching?.title || 'Battle Coaching';
  const summary = battleCoaching?.summary || 'Opponent-reactive matchup advice only. General team strategy stays on the Analysis Desk.';

  return `
    <section class="card battle-tips-section tactical-secondary-panel" aria-labelledby="battle-tips-title">
      <div class="workspace-section-head section-toolbar-header matchup-cluster-head">
        <div class="section-toolbar-copy">
          <span class="section-kicker">${escapeText(kicker)}</span>
          <h2 id="battle-tips-title">${escapeText(title)}</h2>
          <p class="section-summary">${escapeText(summary)}</p>
        </div>
      </div>
      ${visible.length ? `<div class="battle-tip-grid">
        ${visible.map((item) => `<article class="battle-tip-card"><h3>${escapeText(item.title)}</h3><p>${escapeText(item.detail)}</p></article>`).join('')}
      </div>` : `<p class="muted battle-tip-empty">${escapeText(emptyMessage)}</p>`}
    </section>`;
}

// MATCHUPS UNIVERSAL RULES: risks add matchup context beyond Analysis Desk defensive callouts.
function renderPrimaryMatchupRisks(items = []) {
  const visibleItems = (items || []).filter((item) => item && item.answer);
  const isEmpty = !visibleItems.length || visibleItems.every((item) => item.empty);
  if (isEmpty) {
    const message = visibleItems[0]?.answer || 'No major opposing threats have been identified yet. Choose a specific opponent, lead Pokémon, or meta threat to get more detailed matchup advice.'
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
          <p class="section-summary">Matchup-context risks only; copied Analysis Desk warnings are omitted unless they add positioning or lead-selection context.</p>
        </div>
      </div>
      <ul class="primary-risk-list">
        ${visibleItems.map((item) => `<li><strong>${escapeText(item.question || item.title)}</strong><span>${escapeText(item.answer)}</span></li>`).join('')}
      </ul>
    </section>`;
}



// OPPONENT-SPECIFIC SCENARIO LOGIC: advanced threat handling was removed after presenter migration.
function renderOpponentThreatHandling() {
  return '';
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
