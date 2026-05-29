import { buildTeamCoachingProfile, getPrimaryGameplan } from './teamCoachingProfile.js';
import { getPokemonDisplayName } from '../utils/formGrouping.js';
import { getReadablePokemonName, getReadableAbilityName, getReadableMoveName } from '../utils/displayNames.js';
import { getSlotMegaState } from '../core/megaEvolutionEngine.js';

const WEATHER_REQUIREMENTS = [
  { abilities: ['chlorophyll', 'solar power'], weather: 'Sun', label: 'sun' },
  { abilities: ['swift swim', 'rain dish'], weather: 'Rain', label: 'rain' },
  { abilities: ['sand force', 'sand rush'], weather: 'Sand', label: 'sand' },
  { abilities: ['snow cloak', 'slush rush', 'ice body'], weather: 'Snow', label: 'snow' }
];

function safeArray(value) { return Array.isArray(value) ? value : []; }
function compact(values) { return safeArray(values).filter(Boolean); }
function uniq(values) { return [...new Set(compact(values))]; }
function norm(value) { return String(value || '').toLowerCase().replace(/['’]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function sentence(value = '') { return String(value || '').trim().replace(/\s+/g, ' '); }

export function buildTeamGuideContext(team = [], options = {}) {
  const data = options.data || options.indexes || {};
  const profile = options.profile || buildTeamCoachingProfile(team, { data });
  const selectedPokemon = buildSelectedPokemon(team, data);
  const primaryPlan = getPrimaryGameplan(profile);
  const teamFunctions = profile.teamFunctions || {};
  const weatherKinds = safeArray(profile.weatherProfile?.kinds);

  return {
    profile,
    selectedPokemon,
    archetype: profile.archetype?.primary || '',
    confidence: profile.archetype?.confidence || '',
    mainPlanSummary: buildMainPlanSummary(profile, primaryPlan),
    coreSynergySignals: buildCoreSynergySignals(profile, teamFunctions),
    speedControlSources: buildSpeedControlSources(profile, teamFunctions),
    pressureSources: buildPressureSources(profile, teamFunctions),
    topDefensiveRisks: buildTopDefensiveRisks(profile),
    inactiveAbilityWarnings: buildInactiveAbilityWarnings(team, data, weatherKinds),
    teamCompleteness: buildTeamCompleteness(profile),
    corePieces: buildCorePieces(selectedPokemon, profile, teamFunctions),
    coreCohesion: buildCoreCohesion(selectedPokemon, profile, teamFunctions)
  };
}

function buildSelectedPokemon(team = [], data = {}) {
  const indexes = data?.indexes || data || {};
  const pokemonById = indexes.pokemonById || {};
  const abilitiesById = indexes.abilitiesById || {};
  const movesById = indexes.movesById || {};
  const collections = data?.collections || {};

  return safeArray(team).map((slot, index) => {
    if (!slot || (!slot.pokemon_id && !slot.pokemon)) return null;
    const basePokemon = pokemonById[slot.pokemon_id] || slot.pokemon || slot;
    const megaState = getSlotMegaState(slot, { indexes, collections });
    const activePokemon = megaState?.activeMega?.megaPokemonId ? (pokemonById[megaState.activeMega.megaPokemonId] || basePokemon) : basePokemon;
    const ability = abilitiesById[slot.ability_id] || abilitiesById[slot.ability] || slot.ability || slot.ability_id || '';
    const moveIds = safeArray(slot.moves || slot.move_ids || [slot.move1, slot.move2, slot.move3, slot.move4]).filter(Boolean);
    const moveNames = moveIds.map((id) => getReadableMoveName(movesById[id] || id, String(id))).filter(Boolean);
    const name = getPokemonDisplayName(activePokemon) || getReadablePokemonName(activePokemon, `Slot ${index + 1}`);
    return {
      index,
      name,
      ability: getReadableAbilityName(ability, ''),
      moves: moveNames
    };
  }).filter(Boolean);
}

function buildMainPlanSummary(profile = {}, primaryPlan = null) {
  if (primaryPlan?.label) {
    const advice = sentence(primaryPlan.beginnerTip || primaryPlan.advice || '');
    return advice ? `${primaryPlan.label}: ${advice}` : primaryPlan.label;
  }
  const beginner = sentence(profile.beginnerSummary || profile.coaching?.beginnerSummary || '');
  return beginner || 'Add selected moves and abilities to reveal the team plan.';
}

function buildCoreSynergySignals(profile = {}, f = {}) {
  const signals = [];
  safeArray(f.weatherSetters).forEach((entry) => signals.push(`${entry.pokemon}: ${entry.detail} sets weather`));
  safeArray(f.weatherAbusers).forEach((entry) => signals.push(`${entry.pokemon}: ${entry.detail} benefits from weather`));
  safeArray(f.screenSetters).forEach((entry) => signals.push(`${entry.pokemon}: ${entry.detail} support`));
  safeArray(f.fakeOut).forEach((entry) => signals.push(`${entry.pokemon}: Fake Out tempo support`));
  safeArray(f.redirection).forEach((entry) => signals.push(`${entry.pokemon}: ${entry.detail} redirection`));
  safeArray(f.intimidate).forEach((entry) => signals.push(`${entry.pokemon}: Intimidate pivot support`));
  safeArray(f.scalingWinConditions).forEach((entry) => signals.push(`${entry.pokemon}: ${entry.detail} scaling win condition`));
  return uniq(signals).slice(0, 8);
}

function buildSpeedControlSources(profile = {}, f = {}) {
  const sources = safeArray(f.speedControl).map((entry) => `${entry.pokemon}: ${entry.detail}`);
  if (!sources.length && profile.speedProfile?.summary) return [profile.speedProfile.summary];
  return uniq(sources).slice(0, 6);
}

function buildPressureSources(profile = {}, f = {}) {
  const pressure = [];
  safeArray(profile.offensiveProfile?.attackers).forEach((entry) => pressure.push(`${entry.pokemon}: ${entry.attackBias || 'damage'} attacker`));
  safeArray(f.spreadDamage).forEach((entry) => pressure.push(`${entry.pokemon}: ${entry.detail} spread pressure`));
  safeArray(f.priority).forEach((entry) => pressure.push(`${entry.pokemon}: ${entry.detail} priority`));
  safeArray(f.setupThreats).forEach((entry) => pressure.push(`${entry.pokemon}: ${entry.detail} setup threat`));
  safeArray(profile.offensiveProfile?.scalingWinConditions).forEach((entry) => pressure.push(`${entry.pokemon}: ${entry.source} cleaner`));
  return uniq(pressure).slice(0, 8);
}

function buildTopDefensiveRisks(profile = {}) {
  return safeArray(profile.defensiveProfile?.topRisks || profile.risks).slice(0, 3).map((risk) => {
    const label = risk.type ? `${risk.type}-type pressure` : (risk.label || risk.title || 'Defensive risk');
    const advice = sentence(risk.beginnerAdvice || risk.summary || risk.description || '');
    return advice ? `${label}: ${advice}` : label;
  });
}

function buildInactiveAbilityWarnings(team = [], data = {}, weatherKinds = []) {
  const selected = buildSelectedPokemon(team, data);
  const activeWeather = new Set(weatherKinds.map(norm));
  return selected.flatMap((member) => {
    const abilityKey = norm(member.ability);
    const requirement = WEATHER_REQUIREMENTS.find((entry) => entry.abilities.includes(abilityKey));
    if (!requirement || activeWeather.has(norm(requirement.weather))) return [];
    return [`${member.name}'s ${member.ability} needs ${requirement.label}, but this team does not currently show a ${requirement.label} setter.`];
  }).slice(0, 4);
}


function buildCorePieces(selectedPokemon = [], profile = {}, f = {}) {
  const functionEntries = [
    ['Weather setter', 'weatherSetters'],
    ['Weather abuser', 'weatherAbusers'],
    ['Speed control', 'speedControl'],
    ['Pivot / stability', 'intimidate'],
    ['Pivot / stability', 'defensiveSwitchIns'],
    ['Disruption / support', 'fakeOut'],
    ['Disruption / support', 'redirection'],
    ['Disruption / support', 'screenSetters'],
    ['Disruption / support', 'disruption'],
    ['Disruption / support', 'recovery'],
    ['Main attacker', 'spreadDamage'],
    ['Main attacker', 'setupThreats'],
    ['Secondary attacker', 'priority'],
    ['Main attacker', 'scalingWinConditions']
  ];
  const attackerNames = safeArray(profile.offensiveProfile?.attackers).map((entry) => entry.pokemon).filter(Boolean);
  const primaryAbusers = safeArray(profile.gameplans?.[0]?.abusers);
  const primaryEnablers = safeArray(profile.gameplans?.[0]?.enablers);

  return safeArray(selectedPokemon).map((member) => {
    const roles = [];
    const details = [];
    functionEntries.forEach(([label, key]) => {
      safeArray(f[key]).filter((entry) => entry.pokemon === member.name).forEach((entry) => {
        roles.push(label);
        if (entry.detail) details.push(`${label}: ${entry.detail}`);
      });
    });

    if (attackerNames.includes(member.name)) {
      roles.push(primaryAbusers.includes(member.name) ? 'Main attacker' : 'Secondary attacker');
    }

    const cleanRoles = uniq(roles);
    const cleanDetails = uniq(details).slice(0, 4);
    const isEnabler = primaryEnablers.includes(member.name) || cleanRoles.some((role) => /weather setter|speed control|support|pivot|stability/i.test(role));
    const isAbuser = primaryAbusers.includes(member.name) || cleanRoles.some((role) => /attacker|weather abuser/i.test(role));
    const coreCategory = isEnabler && isAbuser ? 'Enabler + abuser' : isEnabler ? 'Enabler' : isAbuser ? 'Abuser' : 'Needs clearer job';
    const summary = summarizeCorePiece(member.name, cleanRoles, coreCategory);

    return { name: member.name, roles: cleanRoles, details: cleanDetails, coreCategory, summary };
  });
}

function summarizeCorePiece(name = '', roles = [], category = '') {
  if (!roles.length) return `${name} is selected, but its core contribution is not clear from the current moves, ability, item, or team context.`;
  const roleText = roles.slice(0, 3).join(', ').toLowerCase();
  if (/enabler \+ abuser/i.test(category)) return `${name} both enables the plan and converts it into pressure through ${roleText}.`;
  if (/enabler/i.test(category)) return `${name} helps the main plan function through ${roleText}.`;
  if (/abuser/i.test(category)) return `${name} is one of the pieces meant to convert support into pressure through ${roleText}.`;
  return `${name} currently contributes ${roleText}.`;
}

function buildCoreCohesion(selectedPokemon = [], profile = {}, f = {}) {
  const pieces = buildCorePieces(selectedPokemon, profile, f);
  const supports = buildCoreSynergySignals(profile, f).slice(0, 4);
  const disconnected = pieces
    .filter((piece) => !piece.roles.length || /needs clearer job/i.test(piece.coreCategory || ''))
    .map((piece) => `${piece.name}: needs a clearer connection to the main plan`)
    .slice(0, 4);
  const enablers = pieces.filter((piece) => /enabler/i.test(piece.coreCategory || '')).map((piece) => piece.name);
  const abusers = pieces.filter((piece) => /abuser/i.test(piece.coreCategory || '')).map((piece) => piece.name);
  const enablerAbuserSummary = compact([
    enablers.length ? `Enablers: ${enablers.join(', ')}` : '',
    abusers.length ? `Abusers: ${abusers.join(', ')}` : ''
  ]).join('. ');
  return {
    supportsMainPlan: supports,
    disconnectedPieces: disconnected,
    enablerAbuserSummary: enablerAbuserSummary || 'No clear enabler/abuser split is visible yet.'
  };
}

function buildTeamCompleteness(profile = {}) {
  const completeness = profile.completeness || {};
  const filledSlots = Number(completeness.filledSlots || 0);
  const missingSlots = Number(completeness.missingSlots || Math.max(0, 6 - filledSlots));
  return {
    filledSlots,
    missingSlots,
    isFullTeam: Boolean(completeness.isFullTeam || filledSlots >= 6),
    warnings: safeArray(completeness.warnings)
  };
}
