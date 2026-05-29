import { calculateWeaknessCoverageProfile } from '../core/weaknessCoverageProfile.js';
import { getPokemonDisplayName } from '../utils/formGrouping.js';
import { getReadablePokemonName, getReadableAbilityName, getReadableItemName, getReadableMoveName } from '../utils/displayNames.js';
import { getSlotMegaState } from '../core/megaEvolutionEngine.js';

const TEAM_SIZE = 6;
const SPEED_CONTROL_MOVES = set(['tailwind','icy wind','trick room','thunder wave','electroweb','glare','nuzzle','scary face','string shot']);
const FAKE_OUT_MOVES = set(['fake out']);
const REDIRECTION_MOVES = set(['follow me','rage powder']);
const SCREEN_MOVES = set(['aurora veil','reflect','light screen']);
const SETUP_MOVES = set(['swords dance','dragon dance','calm mind','nasty plot','bulk up','quiver dance','shell smash','coil','curse']);
const DISRUPTION_MOVES = set(['taunt','encore','will o wisp','snarl','parting shot','haze','spore','sleep powder']);
const PROTECT_MOVES = set(['protect','detect','spiky shield','kings shield','king’s shield','baneful bunker']);
const SPREAD_MOVES = set(['rock slide','heat wave','blizzard','earthquake','dazzling gleam','surf','muddy water','icy wind','snarl']);
const RECOVERY_MOVES = set(['recover','roost','wish','soft boiled','moonlight','morning sun','synthesis','slack off','rest','life dew']);
const PRIORITY_MOVES = set(['bullet punch','mach punch','sucker punch','aqua jet','ice shard','extreme speed','quick attack','shadow sneak']);
const FAINT_SCALING_WIN_MOVES = set(['last respects']);
const FAINT_SCALING_WIN_ABILITIES = set(['supreme overlord']);
const WEATHER_SETTERS = set(['drought','snow warning','drizzle','sand stream']);
const WEATHER_ABUSERS = set(['chlorophyll','swift swim','slush rush','sand rush','solar power','sand force','rain dish','ice body']);
const INTIMIDATE = set(['intimidate']);
const FIRE_MOVES = set(['heat wave','flamethrower','fire blast','flare blitz','fire punch','overheat']);
const WATER_MOVES = set(['surf','muddy water','hydro pump','scald','wave crash','waterfall','liquidation']);
const ROCK_GROUND_MOVES = set(['rock slide','stone edge','earthquake','earth power','stomping tantrum']);

function set(values) { return new Set(values.map(norm)); }
function norm(value) { return String(value || '').toLowerCase().replace(/['’]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function compact(value) { return safeArray(value).filter(Boolean); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function uniq(values) { return [...new Set(compact(values))]; }
function hasAny(values, lookup) { return values.some((value) => lookup.has(norm(value))); }
function memberNames(entries) { return uniq(entries.map((entry) => entry?.name || entry?.pokemon || entry?.member)); }
function displayName(pokemon, fallback = 'Unknown Pokémon') { try { return cleanDisplayName(getPokemonDisplayName(pokemon) || fallback); } catch { return cleanDisplayName(getReadablePokemonName(pokemon, fallback)); } }
function cleanDisplayName(value = '') { return String(value || '').replace(/^Mega (.+?) \(Mega\)$/i, 'Mega $1'); }

export function buildTeamCoachingProfile(team = [], options = {}) {
  const data = options.data || options.indexes || {};
  const members = normaliseMembers(team, data);
  const completeness = buildCompleteness(team, members);
  const teamFunctions = detectTeamFunctions(members);
  const risks = buildRisks(team, data, members);
  const archetype = detectArchetype(members, teamFunctions);
  const gameplans = buildGameplans(members, teamFunctions);
  const speedProfile = buildSpeedProfile(members, teamFunctions, gameplans);
  const weatherProfile = buildWeatherProfile(members, teamFunctions, gameplans);
  const terrainProfile = buildTerrainProfile(members, teamFunctions);
  const rawWeaknessCoverage = getRawWeaknessCoverage(team, data);
  const defensiveProfile = buildDefensiveProfile(members, risks, teamFunctions, rawWeaknessCoverage);
  const offensiveProfile = buildOffensiveProfile(members, teamFunctions, gameplans);
  const roleCompression = buildRoleCompression(members, teamFunctions);
  const winConditions = buildWinConditions(members, archetype, gameplans, teamFunctions);
  const recommendations = buildRecommendations(members, completeness, risks, gameplans, teamFunctions, speedProfile, defensiveProfile);
  const beginnerSummary = buildBeginnerSummary(members, archetype, gameplans, risks, completeness);
  const coaching = buildCoaching(members, completeness, archetype, gameplans, risks, teamFunctions, beginnerSummary, recommendations);

  return {
    completeness,
    archetype,
    gameplans,
    teamFunctions,
    speedProfile,
    weatherProfile,
    terrainProfile,
    defensiveProfile,
    offensiveProfile,
    roleCompression,
    winConditions,
    risks,
    recommendations,
    beginnerSummary,
    coaching
  };
}

export function getPrimaryGameplan(profile) {
  return profile?.gameplans?.[0] || null;
}

export function getSpeedControlSummary(profile) {
  return profile?.speedProfile?.summary || 'No clear speed control has been selected yet.';
}

export function getWeatherSummary(profile) {
  return profile?.weatherProfile?.summary || 'No clear weather plan has been selected yet.';
}

export function getMainRisks(profile, limit = 3) {
  return safeArray(profile?.risks).slice(0, limit);
}

export function getBeginnerCoachingSummary(profile) {
  return profile?.beginnerSummary || profile?.coaching?.beginnerSummary || 'Start by choosing a Pokémon or core.';
}

function buildCompleteness(team, members) {
  const filledSlots = members.length;
  const missingSlots = Math.max(0, TEAM_SIZE - filledSlots);
  const warnings = [];
  if (!filledSlots) warnings.push('Start by choosing a Pokémon or core.');
  if (missingSlots) warnings.push(`${missingSlots} team slot${missingSlots === 1 ? '' : 's'} still open.`);
  members.forEach((m) => {
    if (!m.moves.length) warnings.push(`${m.name} has no selected moves yet.`);
    if (!m.abilityName) warnings.push(`${m.name} has no selected ability yet.`);
  });
  return { filledSlots, missingSlots, isFullTeam: filledSlots >= TEAM_SIZE, warnings };
}

function normaliseMembers(team, data) {
  const indexes = data?.indexes || data || {};
  const pokemonById = indexes.pokemonById || {};
  const movesById = indexes.movesById || {};
  const abilitiesById = indexes.abilitiesById || {};
  const itemsById = indexes.itemsById || {};
  const statsByPokemon = indexes.statsByPokemon || {};
  return safeArray(team).filter((slot) => slot && (slot.pokemon_id || slot.pokemon)).map((slot, index) => {
    const basePokemon = pokemonById[slot.pokemon_id] || slot.pokemon || slot;
    const megaState = getSlotMegaState(slot, { indexes, collections: data?.collections || {} });
    const activePokemon = megaState?.activeMega?.megaPokemonId ? (pokemonById[megaState.activeMega.megaPokemonId] || basePokemon) : basePokemon;
    const pokemon = activePokemon;
    const moveIds = safeArray(slot.moves || slot.move_ids || [slot.move1, slot.move2, slot.move3, slot.move4]).filter(Boolean);
    const moves = moveIds.map((id) => movesById[id] || { move_id: id, id, name: id });
    const ability = abilitiesById[slot.ability_id] || abilitiesById[slot.ability] || (slot.ability ? { name: slot.ability } : null);
    const item = itemsById[slot.item_id] || itemsById[slot.item] || (slot.item ? { name: slot.item } : null);
    const stats = statsByPokemon[pokemon?.pokemon_id] || statsByPokemon[pokemon?.id] || pokemon?.stats || {};
    const types = uniq([slot.type_1, slot.type_2, slot.type1, slot.type2, pokemon?.type_1, pokemon?.type_2, pokemon?.type1, pokemon?.type2].flatMap(splitTypes));
    const moveNames = moves.map((move) => move?.name || move?.move_name || move?.move_id || move?.id).filter(Boolean);
    const abilityName = ability ? getReadableAbilityName(ability, '') : getReadableAbilityName(slot.ability_id || slot.ability || '', '');
    const itemName = item ? getReadableItemName(item, '') : getReadableItemName(slot.item_id || slot.item || '', '');
    return { slot, index, pokemon, name: displayName(pokemon, `Slot ${index + 1}`), moves, moveNames, moveKeys: moveNames.map(norm), ability, abilityName, abilityKey: norm(abilityName), item, itemName, types, speed: numberStat(stats, ['spe','speed']), atk: numberStat(stats, ['atk','attack']), spa: numberStat(stats, ['spa','sp_atk','special_attack']), hp: numberStat(stats, ['hp']), def: numberStat(stats, ['def','defense']), spd: numberStat(stats, ['spd','sp_def','special_def']) };
  }).filter((m) => m.pokemon);
}
function numberStat(stats, keys) { for (const key of keys) { const n = Number(stats?.[key]); if (Number.isFinite(n)) return n; } return 0; }
function splitTypes(value) { if (Array.isArray(value)) return value; if (!value) return []; return String(value).split(/[\/,&|]+/).map((x) => x.trim()).filter(Boolean); }

function detectTeamFunctions(members) {
  const out = Object.fromEntries(['speedControl','fakeOut','redirection','weatherSetters','weatherAbusers','screenSetters','intimidate','defensiveSwitchIns','setupThreats','disruption','priority','spreadDamage','recovery','protectUsers','scalingWinConditions'].map((k) => [k, []]));
  members.forEach((m) => {
    const add = (key, detail) => out[key].push({ pokemon: m.name, member: m.name, detail });
    if (hasAny(m.moveKeys, SPEED_CONTROL_MOVES)) add('speedControl', firstMatch(m.moveKeys, SPEED_CONTROL_MOVES));
    if (hasAny(m.moveKeys, FAKE_OUT_MOVES)) add('fakeOut', 'Fake Out');
    if (hasAny(m.moveKeys, REDIRECTION_MOVES)) add('redirection', firstMatch(m.moveKeys, REDIRECTION_MOVES));
    if (WEATHER_SETTERS.has(m.abilityKey)) add('weatherSetters', m.abilityName);
    if (WEATHER_ABUSERS.has(m.abilityKey)) add('weatherAbusers', m.abilityName);
    if (hasAny(m.moveKeys, SCREEN_MOVES)) add('screenSetters', firstMatch(m.moveKeys, SCREEN_MOVES));
    if (INTIMIDATE.has(m.abilityKey)) add('intimidate', 'Intimidate');
    if (isDefensiveSwitchIn(m)) add('defensiveSwitchIns', 'bulk, typing, recovery, or defensive item');
    if (hasAny(m.moveKeys, SETUP_MOVES)) add('setupThreats', firstMatch(m.moveKeys, SETUP_MOVES));
    if (hasAny(m.moveKeys, DISRUPTION_MOVES)) add('disruption', firstMatch(m.moveKeys, DISRUPTION_MOVES));
    if (hasAny(m.moveKeys, PRIORITY_MOVES)) add('priority', firstMatch(m.moveKeys, PRIORITY_MOVES));
    if (hasAny(m.moveKeys, SPREAD_MOVES)) add('spreadDamage', firstMatch(m.moveKeys, SPREAD_MOVES));
    if (hasAny(m.moveKeys, RECOVERY_MOVES)) add('recovery', firstMatch(m.moveKeys, RECOVERY_MOVES));
    if (hasAny(m.moveKeys, PROTECT_MOVES)) add('protectUsers', firstMatch(m.moveKeys, PROTECT_MOVES));
    if (hasAny(m.moveKeys, FAINT_SCALING_WIN_MOVES)) add('scalingWinConditions', displayMoveName(m, firstMatch(m.moveKeys, FAINT_SCALING_WIN_MOVES)) || 'Last Respects');
    if (FAINT_SCALING_WIN_ABILITIES.has(m.abilityKey)) add('scalingWinConditions', m.abilityName || 'Supreme Overlord');
  });
  return out;
}
function firstMatch(values, lookup) { return values.find((value) => lookup.has(norm(value))) || ''; }
function displayMoveName(member, normalizedMoveName) {
  const key = norm(normalizedMoveName);
  const move = safeArray(member?.moves).find((entry) => norm(entry?.name || entry?.move_name || entry?.move_id || entry?.id) === key);
  return move?.name || move?.move_name || normalizedMoveName;
}
function isDefensiveSwitchIn(m) { const bulk = (m.hp || 0) + (m.def || 0) + (m.spd || 0); return bulk >= 260 || hasAny(m.moveKeys, RECOVERY_MOVES) || /leftovers|sitrus|assault vest|rocky helmet|eviolite|safety goggles|berry/i.test(m.itemName || ''); }

function detectArchetype(members, f) {
  if (!members.length) return { primary: '', secondary: null, confidence: '', reasons: [] };
  const scores = new Map();
  const reasons = new Map();
  const evidence = new Map();
  const add = (name, points, reason, tags = []) => {
    scores.set(name, (scores.get(name) || 0) + points);
    if (reason) reasons.set(name, [...(reasons.get(name) || []), reason]);
    evidence.set(name, uniq([...(evidence.get(name) || []), ...compact(tags)]));
  };
  const hasTR = f.speedControl.some((x) => /trick room/i.test(x.detail));
  const hasTW = f.speedControl.some((x) => /tailwind/i.test(x.detail));
  const weather = weatherKinds(members, f);
  const offense = members.filter(isAttacker).length;
  const support = f.fakeOut.length + f.redirection.length + f.intimidate.length + f.disruption.length + f.screenSetters.length + f.recovery.length + f.protectUsers.length;
  const defensive = f.defensiveSwitchIns.length;
  const slowCount = slowAttackers(members);

  if (hasTR) add('Trick Room', 82 + slowCount * 10 + support * 2, buildTeamSpecificReason(members, f, 'Trick Room'), ['enabler', slowCount ? 'abuser' : '', support >= 2 ? 'support' : '']);
  if (hasTW) add('Tailwind Offense', 58 + offense * 5 + support * 2, buildTeamSpecificReason(members, f, 'Tailwind Offense'), ['enabler', offense ? 'abuser' : '', support >= 2 ? 'support' : '']);
  if (hasTW && weather.includes('Sun')) add('Sun + Tailwind offense', 96 + weatherSpecificEvidence('Sun', members) + offense * 4 + support * 2, describeSunTailwindArchetypeReason(members, f), ['enabler', 'abuser', support >= 2 ? 'support' : '']);
  if (weather.length) add('Weather Offense', 45 + weather.length * 8 + f.weatherAbusers.length * 15 + support * 2, buildTeamSpecificReason(members, f, 'Weather Offense'), ['enabler', (f.weatherAbusers.length || weather.some((kind) => weatherSpecificEvidence(kind, members) >= 12)) ? 'abuser' : '', support >= 2 ? 'support' : '']);
  weather.forEach((kind) => {
    const specificEvidence = weatherSpecificEvidence(kind, members);
    const veilBonus = kind === 'Snow' && f.screenSetters.some((x) => /aurora veil/i.test(x.detail)) ? 22 : 0;
    add(`${kind} Offense`, 62 + specificEvidence + veilBonus + support * 2, buildTeamSpecificWeatherReason(kind, members, f), ['enabler', specificEvidence >= 12 || veilBonus ? 'abuser' : '', support >= 2 ? 'support' : '']);
  });
  if (f.setupThreats.length >= 2) add('Setup Offense', 50 + f.setupThreats.length * 10 + support * 2, buildTeamSpecificReason(members, f, 'Setup Offense'), ['enabler', 'abuser', support >= 2 ? 'support' : '']);
  if (f.disruption.length + f.intimidate.length + f.fakeOut.length >= 3) add('Disruption Balance', 48 + support * 5 + defensive * 3, buildDisruptionBalanceReason(members, f), ['enabler', support >= 3 ? 'support' : '', defensive ? 'defense' : '']);
  if (offense >= 4 && support <= 2 && defensive <= 2) add('Hyper Offense', 48 + offense * 6, buildTeamSpecificReason(members, f, 'Hyper Offense'), ['abuser']);
  if (offense >= 3 && defensive >= 2) add('Bulky Offense', 44 + offense * 4 + defensive * 5 + support * 2, buildTeamSpecificReason(members, f, 'Bulky Offense'), ['abuser', 'defense', support ? 'support' : '']);
  if (offense >= 2 && support >= 2) add('Balanced Offense', 50 + offense * 4 + support * 3 + defensive * 2, buildTeamSpecificReason(members, f, 'Balanced Offense'), ['abuser', 'support', defensive ? 'defense' : '']);
  if (support >= 3 && defensive >= 2) add('Balance', 44 + support * 4 + defensive * 5 + offense * 2, buildTeamSpecificReason(members, f, 'Balance'), ['support', 'defense', offense ? 'abuser' : '']);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, score = 0] = ranked[0] || ['Unclear / Mixed Team', 0];
  const second = ranked[1];
  const primaryEvidence = evidence.get(primary) || [];
  const secondary = shouldKeepSecondaryArchetype(primary, second?.[0], second?.[1], score, evidence) ? second[0] : null;
  const confidence = confidenceFromEvidence(score, primaryEvidence, members.length);
  return { primary, secondary, confidence, reasons: (reasons.get(primary) || ['The current selected moves, abilities, and items do not point to one clear plan yet.']).slice(0, 4) };
}


function describeSunTailwindArchetypeReason(members, f) {
  const drought = members.find((m) => m.abilityKey === 'drought');
  const tailwind = f.speedControl.find((x) => /tailwind/i.test(x.detail || ''));
  const chlorophyll = members.filter((m) => m.abilityKey === 'chlorophyll').map((m) => m.name);
  const solarPower = members.filter((m) => m.abilityKey === 'solar power').map((m) => m.name);
  const firePressure = members.filter((m) => m.name !== drought?.name && hasAny(m.moveKeys || [], FIRE_MOVES)).map((m) => m.name);
  const solarBeam = members.filter((m) => hasAny(m.moveKeys || [], set(['solar beam']))).map((m) => m.name);
  const signals = compact([
    drought ? `Drought (${drought.name}) sets sun` : '',
    tailwind ? `Tailwind (${tailwind.pokemon}) provides speed control` : '',
    chlorophyll.length ? `Chlorophyll (${chlorophyll.join(', ')}) abuses the sun` : '',
    solarPower.length ? `Solar Power (${solarPower.join(', ')}) converts sun into extra damage` : '',
    firePressure.length ? `Fire pressure (${firePressure.join(', ')}) benefits from sun` : '',
    solarBeam.length ? `Solar Beam (${solarBeam.join(', ')}) is supported by sun` : ''
  ]);
  return signals.length
    ? `${signals.join(', ')}. These connected pieces define a Sun + Tailwind plan.`
    : 'Sun and Tailwind are both present, so the team is trying to stack weather pressure with speed control.';
}


function buildDisruptionBalanceReason(members, f) {
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const tailwind = f.speedControl.find((x) => /tailwind/i.test(x.detail));
  const speedDrop = f.speedControl.find((x) => /icy wind|electroweb|string shot/i.test(x.detail));
  const allDisruptions = [...f.disruption, ...f.fakeOut, ...f.intimidate];
  const disrupt1 = allDisruptions[0];
  const disrupt2 = allDisruptions.find((x) => x.pokemon !== disrupt1?.pokemon);
  const parts = [];
  if (tailwind) parts.push(`Tailwind (${tailwind.pokemon}) provides speed control`);
  if (disrupt1) parts.push(`${cap(disrupt1.detail)} (${disrupt1.pokemon}) provides tempo disruption`);
  if (disrupt2) parts.push(`${cap(disrupt2.detail)} (${disrupt2.pokemon}) adds a second disruption layer`);
  else if (speedDrop && speedDrop.pokemon !== tailwind?.pokemon) parts.push(`${cap(speedDrop.detail)} (${speedDrop.pokemon}) controls opposing speed`);
  return parts.length >= 2
    ? `${parts.join(', ')}. These connected pieces define a Disruption Balance plan.`
    : 'Multiple disruption and speed control tools are present. These connected pieces define a Disruption Balance plan.';
}

function buildTeamSpecificReason(members, f, archetype) {
  const speed = f.speedControl[0];
  const weather = f.weatherSetters[0];
  const disrupt = f.disruption[0] || f.fakeOut[0] || f.intimidate[0];
  const setup = f.setupThreats[0];
  const attacker = members.find(isAttacker);
  const parts = [];
  if (weather) parts.push(`${weather.detail} (${weather.pokemon}) enables field pressure`);
  if (speed) parts.push(`${speed.detail} (${speed.pokemon}) controls speed`);
  if (setup) parts.push(`${setup.detail} (${setup.pokemon}) creates a setup win condition`);
  if (disrupt) parts.push(`${disrupt.detail} (${disrupt.pokemon}) provides tempo disruption`);
  if (attacker) parts.push(`${attacker.name} supplies offensive pressure`);
  const text = parts.slice(0,3).join(', ');
  return text ? `${text}. These connected pieces define a ${archetype} plan.` : `Selected moves and abilities define a ${archetype} structure.`;
}
function buildTeamSpecificWeatherReason(kind, members, f) {
  const setter = f.weatherSetters.find((x) => weatherAbilityMatchesKind(x.detail, kind) || kind.toLowerCase().includes(x.detail?.toLowerCase()?.split(' ')[0] || ''));
  const abuser = f.weatherAbusers[0];
  const veil = kind === 'Snow' && f.screenSetters.find((x) => /aurora veil/i.test(x.detail));
  const parts = [];
  if (setter) parts.push(`${setter.detail} (${setter.pokemon}) sets ${kind.toLowerCase()}`);
  if (abuser) parts.push(`${abuser.detail} (${abuser.pokemon}) benefits from ${kind.toLowerCase()}`);
  if (veil) parts.push(`Aurora Veil (${veil.pokemon}) becomes available in snow`);
  return `${parts.join(', ')}. These connected pieces define a ${kind} offense plan.`;
}
function shouldKeepSecondaryArchetype(primary, secondary, secondaryScore, primaryScore, evidence) {
  if (!secondary || secondary === primary) return false;
  if (secondaryScore < 50 || secondaryScore < primaryScore * 0.78) return false;
  const p = String(primary || '').toLowerCase();
  const s = String(secondary || '').toLowerCase();
  if (p.includes(s) || s.includes(p) || p.split(' ')[0] === s.split(' ')[0]) return false;
  return ((evidence.get(secondary) || []).length >= 2);
}
function confidenceFromEvidence(score, evidenceTags, teamSize) {
  const tags = new Set(evidenceTags || []);
  if (teamSize < 3) return 'Low';
  if (tags.has('enabler') && tags.has('abuser') && (tags.has('support') || tags.has('defense')) && score >= 80) return 'High';
  if ((tags.has('enabler') && tags.has('abuser')) || tags.size >= 2 || score >= 58) return 'Medium';
  return 'Low';
}
function isAttacker(m) { return Math.max(m.atk || 0, m.spa || 0) >= 95 || hasAny(m.moveKeys, SPREAD_MOVES) || hasAny(m.moveKeys, SETUP_MOVES); }
function slowAttackers(members) { return members.filter((m) => isAttacker(m) && (m.speed || 0) <= 70).length; }
function weatherKinds(members, f) {
  const kinds = [];
  members.forEach((m) => {
    if (m.abilityKey === 'drought') kinds.push('Sun');
    if (m.abilityKey === 'drizzle') kinds.push('Rain');
    if (m.abilityKey === 'snow warning') kinds.push('Snow');
    if (m.abilityKey === 'sand stream') kinds.push('Sand');
  });
  return uniq(kinds).filter((kind) => {
    const relevantAbusers = f.weatherAbusers.filter((entry) => weatherAbilityMatchesKind(entry.detail, kind));
    const hasAuroraVeilSnow = kind === 'Snow' && f.screenSetters.some((x) => /aurora veil/i.test(x.detail));
    return relevantAbusers.length || weatherSpecificEvidence(kind, members) >= 8 || hasAuroraVeilSnow;
  });
}
function weatherAbilityMatchesKind(ability = '', kind = '') {
  const key = norm(ability);
  return kind === 'Sun' && ['chlorophyll','solar power'].includes(key)
    || kind === 'Rain' && ['swift swim','rain dish'].includes(key)
    || kind === 'Snow' && ['slush rush','ice body'].includes(key)
    || kind === 'Sand' && ['sand rush','sand force'].includes(key);
}
function isWeatherSetterForKind(m, kind) {
  return kind === 'Sun' && m.abilityKey === 'drought'
    || kind === 'Rain' && m.abilityKey === 'drizzle'
    || kind === 'Snow' && m.abilityKey === 'snow warning'
    || kind === 'Sand' && m.abilityKey === 'sand stream';
}
function weatherSpecificEvidence(kind, members) {
  return members.reduce((sum, m) => {
    if (isWeatherSetterForKind(m, kind)) return sum;
    if (kind === 'Sun' && (['chlorophyll','solar power'].includes(m.abilityKey) || hasAny(m.moveKeys, FIRE_MOVES) || hasAny(m.moveKeys, set(['solar beam'])))) return sum + 12;
    if (kind === 'Rain' && (m.abilityKey === 'swift swim' || hasAny(m.moveKeys, WATER_MOVES))) return sum + 12;
    if (kind === 'Snow' && (m.abilityKey === 'slush rush' || hasAny(m.moveKeys, set(['blizzard','aurora veil'])) || m.types.includes('Ice'))) return sum + 12;
    if (kind === 'Sand' && ['sand rush','sand force'].includes(m.abilityKey)) return sum + 12;
    return sum;
  }, 0);
}


function buildScalingWinPlans(members, f) {
  return safeArray(f.scalingWinConditions).map((entry) => {
    const abuser = entry.pokemon;
    const source = /supreme overlord/i.test(entry.detail || '') ? 'Supreme Overlord' : 'Last Respects';
    const label = source === 'Last Respects' ? 'Last Respects sweep' : `${source} cleanup`;
    const enablers = members.filter((m) => m.name !== abuser).map((m) => m.name);
    const sacrificialPieces = enablers.length ? enablers : memberNames(f.disruption.concat(f.fakeOut, f.screenSetters, f.intimidate, f.protectUsers));
    const advice = source === 'Last Respects'
      ? `${abuser}'s Last Respects gets stronger every time one of your teammates faints. Treat your utility Pokémon as expendable — their job is to chip the opponent and feed ${abuser}'s damage. Bring ${abuser} in late once 2–3 teammates are down for a massive cleanup attack.`
      : `${abuser}'s ${source} gets stronger as teammates faint. Trade your support pieces for chip, positioning, and tempo, then bring ${abuser} in as the late-game cleaner.`;
    return {
      label,
      type: 'scaling-win-condition',
      priority: 'Secondary',
      enablers: uniq(sacrificialPieces),
      abusers: [abuser],
      support: uniq(sacrificialPieces),
      advice,
      beginnerTip: `${label}: preserve ${abuser} until the board is weakened, then cash in the fainted-teammate scaling.`
    };
  }).filter((plan) => plan.abusers.length);
}

function buildGameplans(members, f) {
  const plans = [];
  const byFunction = (key) => memberNames(f[key]);
  const attackers = members.filter(isAttacker).map((m) => m.name);
  const supportNames = byFunction('fakeOut').concat(byFunction('redirection'), byFunction('protectUsers'), byFunction('disruption'));
  const add = (label, enablers, abusers, support, advice, beginnerTip, missingSupport = []) => {
    const realEnablers = uniq(enablers);
    if (!realEnablers.length) return;
    plans.push({ label, enablers: realEnablers, abusers: uniq(abusers), support: uniq(support), advice: appendMissingSupport(advice, missingSupport), beginnerTip });
  };
  const tailwindEnablers = f.speedControl.filter((x)=>/tailwind/i.test(x.detail)).map((x)=>x.pokemon);
  const sunEnablers = members.filter((m)=>m.abilityKey==='drought').map((m)=>m.name);
  const sunAbusers = members.filter((m)=>['chlorophyll','solar power'].includes(m.abilityKey)||(!isWeatherSetterForKind(m, 'Sun') && (hasAny(m.moveKeys,FIRE_MOVES)||hasAny(m.moveKeys,set(['solar beam']))))).map((m)=>m.name);
  const rainEnablers = members.filter((m)=>m.abilityKey==='drizzle').map((m)=>m.name);
  const rainAbusers = members.filter((m)=>m.abilityKey==='swift swim'||(!isWeatherSetterForKind(m, 'Rain') && hasAny(m.moveKeys,WATER_MOVES))).map((m)=>m.name);
  const snowEnablers = members.filter((m)=>m.abilityKey==='snow warning').map((m)=>m.name).concat(f.screenSetters.filter((x)=>/aurora veil/i.test(x.detail)).map((x)=>x.pokemon));
  const snowAbusers = members.filter((m)=>!isWeatherSetterForKind(m, 'Snow') && (m.types.includes('Ice') || hasAny(m.moveKeys, set(['blizzard'])))).map((m)=>m.name);
  if (rainEnablers.length && rainAbusers.length && tailwindEnablers.length) {
    add('Rain + Tailwind offense', uniq(rainEnablers.concat(tailwindEnablers)), uniq(rainAbusers.concat(attackers)), supportNames, 'Use Tailwind and rain as connected pressure pieces: set the speed advantage, then line up rain turns with Water or Swift Swim pressure.', 'Rain turns are strongest when they create immediate damage or safe trades.', missingSupportForPlan(f));
  }
  if (snowEnablers.length) {
    add('Snow / Aurora Veil mode', snowEnablers, snowAbusers, byFunction('protectUsers').concat(byFunction('disruption')), 'Set Snow, use Aurora Veil when safe, then use the protected turns to attack or reposition instead of playing passively.', 'Snow teams still need to attack; Veil buys turns but does not win by itself.', missingSupportForPlan(f));
  }
  if (sunEnablers.length && sunAbusers.length && tailwindEnablers.length) {
    add('Sun + Tailwind offense', uniq(sunEnablers.concat(tailwindEnablers)), uniq(sunAbusers.concat(attackers)), supportNames, 'Use Tailwind and sun as connected pressure pieces: set the speed advantage, then line up Drought turns with Fire, Chlorophyll, Solar Power, or Solar Beam pressure instead of treating them as separate plans.', 'Preserve the sun setter and avoid wasting both Tailwind and sun turns on passive moves.', missingSupportForPlan(f));
  } else {
    add('Tailwind mode', tailwindEnablers, attackers, byFunction('fakeOut').concat(byFunction('redirection'), byFunction('protectUsers')), 'Set Tailwind when the setter is reasonably safe, then use the fastest pressure turns to take KOs or force Protects.', 'Do not spend every Tailwind turn setting up; convert those turns into damage or board position.', missingSupportForPlan(f));
    if (sunAbusers.length) add('Sun mode', sunEnablers, sunAbusers, byFunction('protectUsers').concat(byFunction('disruption')), 'Lead or pivot your Drought user so sun turns line up with your abusers, then preserve weather if the opponent can overwrite it.', 'Sun turns are limited; use them to create pressure quickly.', missingSupportForPlan(f));
  }
  add('Trick Room mode', f.speedControl.filter((x)=>/trick room/i.test(x.detail)).map((x)=>x.pokemon), members.filter((m)=>isAttacker(m) && (m.speed||0)<=70).map((m)=>m.name), byFunction('fakeOut').concat(byFunction('redirection'), byFunction('disruption')), 'Protect the Trick Room setter, then attack with slower partners while Trick Room is active.', 'Avoid making Tailwind your main plan unless Tailwind is also actually selected.', missingSupportForPlan(f));
  if (rainAbusers.length) add('Rain mode', rainEnablers, rainAbusers, byFunction('protectUsers'), 'Set rain before committing rain attackers, then use the speed and boosted Water pressure to force trades.', 'Keep the rain setter healthy if the matchup depends on weather control.', missingSupportForPlan(f));
  const scalingPlans = buildScalingWinPlans(members, f);
  const hadPrimaryPlanBeforeScaling = plans.length > 0;
  scalingPlans.forEach((plan, index) => plans.push({ ...plan, priority: !hadPrimaryPlanBeforeScaling && index === 0 ? 'Primary' : 'Secondary' }));
  if (!plans.length && members.length >= 3 && attackers.length) plans.push({ label: 'Damage pressure', enablers: attackers.slice(0, 3), abusers: attackers.slice(0, 4), support: supportNames, advice: 'Use the team\'s strongest attackers to trade damage, force Protects, and open a cleaner endgame.', beginnerTip: 'Without a dedicated field mode, focus on safe attacks, positioning, and preserving your best damage dealer.' });
  const hasTrickRoom = f.speedControl.some((x) => /trick room/i.test(x.detail));
  if (hasTrickRoom) plans.sort((a, b) => Number(!/trick room/i.test(a.label)) - Number(!/trick room/i.test(b.label)));
  return plans;
}

function buildSpeedProfile(members, f, gameplans) {
  if (!members.length) return { mode: 'none', summary: 'No team members selected yet.', enablers: [], abusers: [], risks: [] };
  const tailwind = f.speedControl.filter((x) => /tailwind/i.test(x.detail));
  const trickRoom = f.speedControl.filter((x) => /trick room/i.test(x.detail));
  const speedDrops = f.speedControl.filter((x) => /icy wind|electroweb|scary face|string shot/i.test(x.detail));
  const paralysis = f.speedControl.filter((x) => /thunder wave|glare|nuzzle/i.test(x.detail));
  const fastAttackers = members.filter((m) => isAttacker(m) && (m.speed || 0) >= 95).map((m) => m.name);
  const slowAttackersList = members.filter((m) => isAttacker(m) && (m.speed || 0) <= 70).map((m) => m.name);
  const enablers = uniq(f.speedControl.map((x) => x.pokemon));
  const modes = compact([
    tailwind.length ? 'Tailwind' : '',
    trickRoom.length ? 'Trick Room' : '',
    speedDrops.length ? 'speed drops' : '',
    paralysis.length ? 'paralysis' : ''
  ]);
  const risks = compact([
    !enablers.length ? 'The team has no selected speed control yet.' : '',
    tailwind.length && !fastAttackers.length ? 'Tailwind is selected, but the team may need clearer attackers to convert those turns.' : '',
    trickRoom.length && !slowAttackersList.length ? 'Trick Room is selected, but few selected attackers clearly benefit from moving slowly.' : ''
  ]);
  const namedSources = compact([
    speedDrops.length ? `${speedDrops.map((x) => `${displaySpeedControlMove(x.detail)} from ${speedControlSourceName(x.pokemon)}`).join(' and ')}` : '',
    tailwind.length ? `Tailwind from ${tailwind.map((x) => x.pokemon).join(' and ')}` : '',
    trickRoom.length ? `Trick Room from ${trickRoom.map((x) => x.pokemon).join(' and ')}` : '',
    paralysis.length ? `paralysis from ${paralysis.map((x) => x.pokemon).join(' and ')}` : ''
  ]);
  const naturallyFast = members.filter((m) => (m.speed || 0) >= 110 || /mega froslass/i.test(m.name)).map((m) => m.name);
  let summary = 'No clear speed control has been selected yet.';
  if (namedSources.length) {
    const noTailwind = !tailwind.length ? ' No Tailwind on this team — you win speed wars through chip and Speed tiers rather than team-wide boosts.' : '';
    const naturalSpeedText = naturallyFast.length ? ` plus ${naturallyFast.slice(0, 2).join(' and ')}'s high natural Speed` : '';
    summary = `Speed plan: ${namedSources.join(', ')}${naturalSpeedText}.${noTailwind}`;
  }
  return { mode: modes[0] || 'none', modes, summary, enablers, abusers: uniq(fastAttackers.concat(slowAttackersList)), fastAttackers, slowAttackers: slowAttackersList, risks };
}

function speedControlSourceName(name = '') { return /mega froslass/i.test(name) ? 'Froslass' : name; }

function displaySpeedControlMove(value = '') {
  const key = norm(value);
  if (key === 'icy wind') return 'Icy Wind chip';
  if (key === 'electroweb') return 'Electroweb drops';
  if (key === 'thunder wave') return 'Thunder Wave paralysis';
  if (key === 'glare') return 'Glare paralysis';
  if (key === 'nuzzle') return 'Nuzzle paralysis';
  if (key === 'scary face') return 'Scary Face drops';
  if (key === 'tailwind') return 'Tailwind';
  if (key === 'trick room') return 'Trick Room';
  return value || 'speed control';
}

function buildWeatherProfile(members, f, gameplans) {
  if (!members.length) return { active: false, kinds: [], summary: 'No team members selected yet.', setters: [], abusers: [], support: [], risks: [] };
  const setters = f.weatherSetters.map((x) => ({ pokemon: x.pokemon, weather: weatherFromAbility(x.detail), source: x.detail })).filter((x) => x.weather);
  const kinds = weatherKinds(members, f);
  const abusers = f.weatherAbusers.map((x) => ({ pokemon: x.pokemon, detail: x.detail }));
  const snowVeil = f.screenSetters.filter((x) => /aurora veil/i.test(x.detail));
  const support = uniq(f.protectUsers.concat(f.disruption, f.fakeOut, f.redirection).map((x) => x.pokemon));
  const weatherPlans = gameplans.filter((p) => /sun|rain|snow|sand|weather/i.test(p.label));
  const risks = compact([
    setters.length && !kinds.length ? 'Weather setters are selected, but the shared profile does not see a clear weather payoff yet.' : '',
    kinds.includes('Snow') && !snowVeil.length ? 'Snow is present, but Aurora Veil is not selected.' : '',
    snowVeil.length && !kinds.includes('Snow') ? 'Aurora Veil is selected, but a reliable Snow setter is not selected.' : ''
  ]);
  const summary = kinds.length
    ? `Weather plan: ${kinds.join(', ')}. ${weatherPlans[0]?.beginnerTip || 'Line up weather turns with the Pokémon that benefit from them.'}`
    : 'No clear weather plan has been selected yet.';
  return { active: Boolean(kinds.length), kinds, summary, setters, abusers, support, screenSetters: snowVeil, risks };
}
function weatherFromAbility(value) { const key = norm(value); if (key === 'drought') return 'Sun'; if (key === 'drizzle') return 'Rain'; if (key === 'snow warning') return 'Snow'; if (key === 'sand stream') return 'Sand'; return ''; }

function buildTerrainProfile(members, f) {
  const terrainAbilities = ['electric surge', 'grassy surge', 'misty surge', 'psychic surge'];
  const setters = members.filter((m) => terrainAbilities.includes(m.abilityKey)).map((m) => ({ pokemon: m.name, terrain: m.abilityName.replace(/ Surge$/i, ''), source: m.abilityName }));
  const terrainMoves = ['electric terrain', 'grassy terrain', 'misty terrain', 'psychic terrain'];
  members.forEach((m) => {
    const move = m.moveKeys.find((key) => terrainMoves.includes(key));
    if (move) setters.push({ pokemon: m.name, terrain: move.replace(' terrain', ''), source: move });
  });
  return { active: Boolean(setters.length), setters, summary: setters.length ? `Terrain plan: ${uniq(setters.map((x) => x.terrain)).join(', ')} terrain support is selected.` : 'No clear terrain plan has been selected yet.' };
}

function buildDefensiveProfile(members, risks, f, rawWeaknessCoverage = []) {
  const answers = uniq(risks.flatMap((r) => r.softAnswers || []));
  return {
    switchIns: f.defensiveSwitchIns,
    screenSetters: f.screenSetters,
    intimidate: f.intimidate,
    recovery: f.recovery,
    protectUsers: f.protectUsers,
    topRisks: risks,
    rawWeaknessCoverage,
    softAnswers: answers,
    summary: risks.length ? `Main defensive concern: ${risks[0].type} pressure. ${risks[0].beginnerAdvice}` : members.length ? 'No major shared defensive concern stands out from the current selected team.' : 'No defensive profile yet.'
  };
}

function buildOffensiveProfile(members, f, gameplans) {
  const attackers = members.filter(isAttacker).map((m) => ({ pokemon: m.name, attackBias: (m.atk || 0) >= (m.spa || 0) ? 'physical' : 'special', speed: m.speed || 0 }));
  const spreadDamage = f.spreadDamage;
  const setupThreats = f.setupThreats;
  const priority = f.priority;
  const scalingWinConditions = safeArray(f.scalingWinConditions).map((entry) => ({ pokemon: entry.pokemon, source: entry.detail }));
  const scalingText = scalingWinConditions.length
    ? ` Scaling win condition detected: ${scalingWinConditions.map((entry) => `${entry.pokemon} with ${entry.source}`).join(', ')} gets stronger as teammates faint, giving the team a late-game cleanup route.`
    : '';
  return {
    attackers,
    spreadDamage,
    setupThreats,
    priority,
    scalingWinConditions,
    pressureModes: gameplans.map((p) => p.label),
    summary: attackers.length ? `${attackers.length} selected Pokémon look like damage converters. ${spreadDamage.length ? 'The team also has spread damage for double-slot pressure.' : 'Add spread or priority if the team needs easier damage conversion.'}${scalingText}` : (scalingText.trim() || 'No clear damage converters selected yet.')
  };
}

function buildRoleCompression(members, f) {
  const rolesByMember = new Map(members.map((m) => [m.name, []]));
  const roleKeys = ['speedControl','fakeOut','redirection','weatherSetters','weatherAbusers','screenSetters','intimidate','defensiveSwitchIns','setupThreats','disruption','priority','spreadDamage','recovery','protectUsers','scalingWinConditions'];
  roleKeys.forEach((key) => safeArray(f[key]).forEach((entry) => {
    if (!rolesByMember.has(entry.pokemon)) rolesByMember.set(entry.pokemon, []);
    rolesByMember.get(entry.pokemon).push(key);
  }));
  const compressed = [...rolesByMember.entries()].map(([pokemon, roles]) => ({ pokemon, roles: uniq(roles), roleCount: uniq(roles).length })).sort((a, b) => b.roleCount - a.roleCount);
  return { members: compressed, highCompression: compressed.filter((x) => x.roleCount >= 3), summary: compressed[0]?.roleCount ? `${compressed[0].pokemon} is currently carrying the most visible team jobs.` : 'No role compression detected yet.' };
}

function buildWinConditions(members, archetype, gameplans, f) {
  if (!members.length) return [];
  const primaryPlan = gameplans[0];
  const attackers = members.filter(isAttacker).map((m) => m.name);
  const conditions = [];
  if (primaryPlan) conditions.push({ label: primaryPlan.label, pieces: uniq(primaryPlan.enablers.concat(primaryPlan.abusers)), conversion: primaryPlan.advice });
  safeArray(f.scalingWinConditions).forEach((entry) => {
    conditions.push({ label: /last respects/i.test(entry.detail || '') ? 'Last Respects sweep' : `${entry.detail} cleanup`, pieces: [entry.pokemon], conversion: `${entry.pokemon} becomes a stronger endgame threat as teammates faint; preserve it until the late-game cleanup turn.` });
  });
  if (f.setupThreats.length) conditions.push({ label: 'Boosted attacker endgame', pieces: memberNames(f.setupThreats), conversion: 'Create one safe setup turn, then protect or redirect around the boosted attacker.' });
  if (attackers.length && !conditions.length) conditions.push({ label: archetype.primary || 'Damage pressure', pieces: attackers.slice(0, 3), conversion: 'Trade damage until one attacker can safely clean up.' });
  return conditions.slice(0, 4);
}

function buildRecommendations(members, completeness, risks, gameplans, f, speedProfile, defensiveProfile) {
  if (!members.length) return ['Choose a Pokémon or core first so the app can identify the team plan from real moves and abilities.'];
  const suggestions = buildNextSuggestions(f, risks, gameplans);
  if (!speedProfile.enablers.length) suggestions.unshift('Add speed control so the team has a reliable way to take safer turns.');
  if (!defensiveProfile.switchIns.length) suggestions.push('Add at least one safer defensive pivot or switch-in.');
  if (!completeness.isFullTeam) suggestions.push(`Fill the remaining ${completeness.missingSlots} slot${completeness.missingSlots === 1 ? '' : 's'} with Pokémon that support the main plan.`);
  return uniq(suggestions).slice(0, 6);
}

function buildBeginnerSummary(members, archetype, gameplans, risks, completeness) {
  if (!members.length) return 'Start by choosing a Pokémon or core. Once you add selected moves and abilities, the app will explain the team plan from the actual build.';
  if (members.length === 1) return `${members[0].name} is selected. Add teammates, moves, and abilities so the app can identify whether this is offense, balance, weather, Trick Room, or another plan.`;
  const mainPlan = archetype.primary || gameplans[0]?.label || 'a mixed plan';
  const riskText = risks[0] ? ` Watch out for ${risks[0].type} pressure.` : '';
  const completenessText = completeness.isFullTeam ? '' : ` The team still has ${completeness.missingSlots} open slot${completeness.missingSlots === 1 ? '' : 's'}, so treat this as a developing read.`;
  return `This team currently looks like ${mainPlan}. Use that plan when it creates safer turns, then convert those turns into damage, positioning, or protected setup.${riskText}${completenessText}`;
}

function missingSupportForPlan(f) {
  const missing = [];
  if (!f.fakeOut.length && !f.redirection.length) missing.push('Fake Out or redirection would make the setup turn safer');
  if (!f.protectUsers.length) missing.push('Protect-style moves would help preserve key pieces');
  if (!f.disruption.length) missing.push('disruption can stop opposing setup or speed control');
  return missing.slice(0, 2);
}
function appendMissingSupport(advice, missingSupport) {
  const missing = uniq(missingSupport);
  return missing.length ? `${advice} Missing support to consider: ${missing.join('; ')}.` : advice;
}

function getRawWeaknessCoverage(team, data) {
  try { return calculateWeaknessCoverageProfile(safeArray(team).filter((s)=>s && s.pokemon_id), data || {}); } catch { return []; }
}

function buildRisks(team, data, members) {
  if (!members.length) return [];
  const coverage = getRawWeaknessCoverage(team, data);
  const severityRank = { High: 0, Medium: 1, Low: 2 };
  const risks = safeArray(coverage).filter((e) => e && Number(e.weakCount || 0) > 0).map((entry) => {
    const affected = safeArray(entry.memberResults).filter((m)=>m.relation==='weak').map((m)=>m.pokemonName);
    const answers = safeArray(entry.memberResults).filter((m)=>m.relation==='resist'||m.relation==='immune').map((m)=>m.pokemonName);
    const severity = entry.weakCount >= 2 && (entry.resistCount + entry.immuneCount) <= 1 ? 'High' : entry.weakCount >= 1 && (entry.resistCount + entry.immuneCount) <= 1 ? 'Medium' : 'Low';
    const affectedText = affected.length > 2 ? `${affected.slice(0, 2).join(' and ')} plus ${affected.length - 2} more` : (affected.join(' or ') || 'a vulnerable Pokémon');
    const answerText = answers.length > 2 ? `${answers.slice(0, 2).join(' or ')} plus ${answers.length - 2} more` : answers.join(' or ');
    return { type: entry.attackingType, severity, reason: `${entry.weakCount} weak, ${entry.resistCount} resist, ${entry.immuneCount} immune.`, affectedPokemon: affected, softAnswers: answers, beginnerAdvice: answerText ? `Avoid switching ${affectedText} directly into ${entry.attackingType} attacks. Keep ${answerText} healthy as a safer answer when possible.` : `Avoid switching ${affectedText} directly into ${entry.attackingType} attacks. Look for safer positioning, Protect turns, or offensive pressure instead.` };
  }).sort((a,b)=>(severityRank[a.severity]-severityRank[b.severity]) || (b.affectedPokemon.length - a.affectedPokemon.length));
  return mergeSimilarRisks(risks).slice(0, 3);
}
function mergeSimilarRisks(risks) {
  const seen = new Map();
  risks.forEach((risk) => {
    const key = norm(risk.type);
    if (!seen.has(key)) seen.set(key, risk);
    else {
      const current = seen.get(key);
      current.affectedPokemon = uniq(current.affectedPokemon.concat(risk.affectedPokemon));
      current.softAnswers = uniq(current.softAnswers.concat(risk.softAnswers));
      current.reason = `${current.affectedPokemon.length} team member${current.affectedPokemon.length === 1 ? '' : 's'} need care into ${risk.type} pressure.`;
    }
  });
  return [...seen.values()];
}

function buildCoaching(members, completeness, archetype, gameplans, risks, f, beginnerSummary, recommendations = []) {
  if (!members.length) return { beginnerSummary, pilotTips: [], recommendedLeads: [], matchupNotes: [], nextTeammateSuggestions: [] };
  const protectNames = memberNames(f.protectUsers).slice(0, 2).join(' or ');
  const disruptionNames = memberNames(f.disruption).slice(0, 2).join(' and ');
  const spreadNames = memberNames(f.spreadDamage).slice(0, 2).join(' and ');
  const pilotTips = compact([
    gameplans[0]?.beginnerTip,
    gameplans[0]?.enablers?.[0] ? `Keep ${gameplans[0].enablers[0]} healthy enough to enable ${gameplans[0].label} at the right time.` : '',
    protectNames ? `Use Protect on ${protectNames} to stall dangerous turns or preserve key Pokémon.` : 'Consider adding Protect-style safety on important Pokémon if the format rewards positioning.',
    risks[0]?.beginnerAdvice,
    disruptionNames ? `${disruptionNames} can disrupt opposing setup or speed control.` : '',
    spreadNames ? `${spreadNames} can pressure both opposing slots with spread damage.` : ''
  ]).slice(0,6);
  const recommendedLeads = buildRecommendedLeads(members, gameplans, f, archetype);
  const matchupNotes = risks.slice(0,3).map((r)=>`${r.severity} ${r.type} concern: ${r.beginnerAdvice}`);
  const nextTeammateSuggestions = completeness.isFullTeam ? [] : (recommendations.length ? recommendations : buildNextSuggestions(f, risks, gameplans));
  return { beginnerSummary, pilotTips, recommendedLeads, matchupNotes, nextTeammateSuggestions };
}
function buildRecommendedLeads(members, gameplans, f, archetype = {}) {
  const leads = [];
  const seen = new Set();
  const byName = (name) => members.find((m) => m.name === name);
  const memberHas = (m, lookup) => m && hasAny(m.moveKeys || [], lookup);
  const strongestAttackers = members.filter(isAttacker).sort((a, b) => Math.max(b.atk || 0, b.spa || 0) - Math.max(a.atk || 0, a.spa || 0));
  const defensiveMembers = uniq(memberNames(f.defensiveSwitchIns).concat(memberNames(f.recovery), memberNames(f.intimidate)))
    .map(byName).filter(Boolean);
  const supportMembers = uniq(memberNames(f.speedControl).concat(memberNames(f.screenSetters), memberNames(f.fakeOut), memberNames(f.disruption), memberNames(f.redirection)))
    .map(byName).filter(Boolean);

  const addLead = (kind, membersPair, planLabel = '', purpose = '') => {
    const pair = compact(membersPair).map((entry) => typeof entry === 'string' ? byName(entry) : entry).filter(Boolean);
    if (pair.length < 2 || pair[0].name === pair[1].name) return;
    const key = pair.map((m) => m.name).sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    const title = leadTitle(kind, leads.length, archetype);
    leads.push({
      title,
      kind,
      members: pair.map((m) => m.name),
      reason: purpose || `${pair[0].name} starts the team's main plan while ${pair[1].name} gives immediate pressure or protection.`,
      turnOne: describeLeadTurnOne(pair, planLabel, f),
      watchOut: describeLeadProblem(pair, planLabel, f),
      backHalf: describeLeadBackHalf(pair, members, f, kind, planLabel)
    });
  };

  gameplans.slice(0, 3).forEach((plan, index) => {
    const enabler = plan.enablers.map(byName).find(Boolean);
    const partner = plan.abusers.map(byName).find((m) => m && m.name !== enabler?.name) || strongestAttackers.find((m) => m.name !== enabler?.name);
    if (enabler && partner) addLead(index === 0 ? 'best' : 'mode', [enabler, partner], plan.label, `${enabler.name} enables ${plan.label} while ${partner.name} converts the turn into pressure.`);
  });

  const fakeOutUsers = memberNames(f.fakeOut).map(byName).filter(Boolean);
  const speedOrScreen = uniq(memberNames(f.speedControl).concat(memberNames(f.screenSetters))).map(byName).filter(Boolean);
  if (fakeOutUsers.length && speedOrScreen.length) addLead('safe setup', [speedOrScreen[0], fakeOutUsers.find((m) => m.name !== speedOrScreen[0].name) || fakeOutUsers[0]], '', 'One slot sets speed control, weather, or screens while Fake Out protects the setup turn.');

  if (fakeOutUsers.length >= 2) addLead('aggressive', [fakeOutUsers[0], fakeOutUsers[1]], '', 'Double Fake Out can deny both opposing slots for a turn and punish setup teams.');
  else if (fakeOutUsers.length && strongestAttackers.length) addLead('aggressive', [fakeOutUsers[0], strongestAttackers.find((m) => m.name !== fakeOutUsers[0].name)], '', 'Fake Out buys one attacker a safer first turn to apply pressure.');

  if (defensiveMembers.length >= 2) addLead('defensive', [defensiveMembers[0], defensiveMembers.find((m) => m.name !== defensiveMembers[0].name)], '', 'Two sturdier Pokémon let you scout, absorb pressure, and pivot before committing your main attackers.');
  else if (defensiveMembers.length && supportMembers.length) addLead('defensive', [defensiveMembers[0], supportMembers.find((m) => m.name !== defensiveMembers[0].name)], '', 'A bulky slot plus support gives you a safer opening into unknown or aggressive teams.');

  if (!leads.length && members.length >= 2) addLead('best', [members[0], members[1]], '', 'Use your first two selected Pokémon as a starting point, then adjust once the team has clearer support and speed control.');

  const focused = /hyper offense|offense/i.test(archetype?.primary || '') && !/balance/i.test(archetype?.primary || '');
  const maxLeads = focused ? 2 : 4;
  return leads.slice(0, maxLeads);
}

function leadTitle(kind, index, archetype = {}) {
  if (kind === 'best' || index === 0) return 'Best opening';
  if (kind === 'aggressive') return 'Aggressive lead';
  if (kind === 'defensive') return 'Defensive lead';
  if (kind === 'safe setup') return 'Safe setup lead';
  return /balance/i.test(archetype?.primary || '') ? 'Flexible mode lead' : 'Secondary lead';
}

function describeLeadTurnOne(pair, planLabel, f) {
  const [a, b] = pair;
  const names = `${a.name} + ${b.name}`;
  const hasFakeOut = pair.find((m) => hasAny(m.moveKeys || [], FAKE_OUT_MOVES));
  const speedSetter = pair.find((m) => hasAny(m.moveKeys || [], SPEED_CONTROL_MOVES));
  const screenSetter = pair.find((m) => hasAny(m.moveKeys || [], SCREEN_MOVES));
  const weatherSetter = pair.find((m) => WEATHER_SETTERS.has(m.abilityKey));
  const lastRespectsUser = pair.find((m) => hasAny(m.moveKeys || [], FAINT_SCALING_WIN_MOVES));
  const attackers = pair.filter(isAttacker);
  const attackName = attackers.find((m) => m.name !== hasFakeOut?.name)?.name || attackers[0]?.name || b.name;
  if (weatherSetter && lastRespectsUser) return `${names} is the aggressive snow opening. ${weatherSetter.name} starts snow immediately while ${lastRespectsUser.name} threatens damage early and begins positioning around the Last Respects endgame rather than spending the whole lead on setup.`;
  if (screenSetter && speedSetter && weatherSetter) return `${names} is your controlled setup lead. ${weatherSetter.name} supplies the snow condition, ${screenSetter.name} can put up Aurora Veil, and ${speedSetter.name} can use ${displaySpeedControlMove(speedSetter.moveKeys?.find((move) => SPEED_CONTROL_MOVES.has(norm(move))) || 'speed control')} to slow the board.`;
  if (hasFakeOut && speedSetter) return `${names} gives you a protected first turn. ${hasFakeOut.name} can Fake Out the bigger threat while ${speedSetter.name} sets speed control, then ${attackName} starts turning that safer position into damage.`;
  if (hasFakeOut && screenSetter) return `${names} is built to make the first turn safer. ${hasFakeOut.name} can Fake Out the most dangerous opposing slot while ${screenSetter.name} puts up screens or Aurora Veil.`;
  if (screenSetter) return `${names} aims to reduce incoming damage early. ${screenSetter.name} sets screens or Aurora Veil, then the partner either attacks or protects so the team can play behind that buffer.`;
  if (weatherSetter) return `${names} starts the weather plan immediately. ${weatherSetter.name} brings the weather in on entry, while the partner uses that opening to attack, set up, or force defensive play.`;
  if (hasFakeOut) return `${names} uses Fake Out to deny one opposing Pokémon for a turn while the partner attacks, sets up, or takes a safer positioning turn.`;
  if (planLabel) return `${names} opens your ${planLabel} line. One slot establishes the plan while the other applies enough pressure that the opponent cannot ignore it.`;
  return `${names} is a practical opener: one Pokémon creates pressure while the other gives support, bulk, or a safer way to reach your midgame.`;
}

function describeLeadProblem(pair, planLabel, f) {
  const hasFakeOut = pair.some((m) => hasAny(m.moveKeys || [], FAKE_OUT_MOVES));
  const hasSpeed = pair.some((m) => hasAny(m.moveKeys || [], SPEED_CONTROL_MOVES));
  const hasScreen = pair.some((m) => hasAny(m.moveKeys || [], SCREEN_MOVES));
  const hasWeather = pair.some((m) => WEATHER_SETTERS.has(m.abilityKey));
  const hasLastRespects = pair.some((m) => hasAny(m.moveKeys || [], FAINT_SCALING_WIN_MOVES));
  if (hasWeather && hasLastRespects) return 'This lead is more exposed than the screens line: if the Last Respects user takes too much damage too early, your late-game cleaner can disappear before the move reaches full power. Trade support pieces first when possible.';
  if (hasSpeed && hasScreen) return 'The danger is losing your setup Pokémon before it chooses the right support move. Taunt, Encore, double-targeting, or faster disruption can force you to pick between Aurora Veil and speed drops instead of getting both.';
  if (hasSpeed) return 'Faster disruption, Clear Amulet-style attackers, or opponents that can ignore Speed drops may blunt this opening. Use the speed-control turn only when it creates a real attacking window.';
  if (hasScreen) return 'Taunt, Encore, Brick Break-style screen removal, or heavy double-target damage can stop the defensive buffer before it pays off. Protect or switch if the screen setter is clearly pinned.';
  if (hasFakeOut) return 'Ghost-types, Inner Focus-style effects, Protect, or opposing Fake Out can waste your denial turn. Do not rely on Fake Out as your only plan if the opponent has obvious counterplay.';
  if (hasWeather) return 'Opposing weather, fast spread damage, or pressure into the weather setter can shorten your strongest turns. Avoid spending every weather turn on passive moves.';
  if (/trick room/i.test(planLabel || '')) return 'Taunt, Fake Out, double-target pressure, or the opponent reversing Trick Room can ruin the setup. Make sure the setter is protected before committing.';
  return 'The main risk is overcommitting before you know the opponent’s plan. If both leads take too much damage early, your cleaner may not get a safe endgame.';
}

function describeLeadBackHalf(pair, members, f, kind = '', planLabel = '') {
  const leadNames = new Set(pair.map((m) => m.name));
  const bench = members.filter((m) => !leadNames.has(m.name));
  const leadHasLastRespects = pair.some((m) => hasAny(m.moveKeys || [], FAINT_SCALING_WIN_MOVES));
  const benchLastRespects = bench.find((m) => hasAny(m.moveKeys || [], FAINT_SCALING_WIN_MOVES));
  const attackers = bench.filter(isAttacker).slice(0, 2).map((m) => m.name);
  const pivots = bench.filter((m) => f.intimidate.some((x) => x.pokemon === m.name) || f.defensiveSwitchIns.some((x) => x.pokemon === m.name) || f.recovery.some((x) => x.pokemon === m.name)).slice(0, 2).map((m) => m.name);
  const support = bench.filter((m) => f.speedControl.some((x) => x.pokemon === m.name) || f.disruption.some((x) => x.pokemon === m.name) || f.fakeOut.some((x) => x.pokemon === m.name)).slice(0, 2).map((m) => m.name);
  const attackerText = attackers.join(' or ');
  const pivotText = pivots.join(' or ');
  const supportText = support.join(' or ');
  if (leadHasLastRespects && support.length) return `Keep ${supportText} ready to take the awkward middle turns after this aggressive opening. Their job is not just to survive — it is to create one more trade, pivot, or denial turn while the Last Respects user avoids being removed too early.`;
  if (benchLastRespects) return `Keep ${benchLastRespects.name} hidden until the opener has made the opponent spend resources. The first two Pokémon should create chip and force trades so ${benchLastRespects.name} enters late with a boosted cleanup button.`;
  if (/sun \+ tailwind/i.test(planLabel || '') && attackers.length) return `Because this lead spends early turns stacking sun and speed, the bench should be your payoff. Bring ${attackerText} in while those field turns are still active rather than saving all the damage for after Tailwind or sun expires.`;
  if (/tailwind/i.test(planLabel || '') && attackers.length) return `The bench is your Tailwind conversion package. Once speed control is up, rotate in ${attackerText} quickly so the remaining Tailwind turns become attacks, KOs, or forced Protects.`;
  if (/sun/i.test(planLabel || '') && attackers.length) return `Treat the bench as your sun timer payoff. Preserve ${attackerText} until Drought is active, then use the limited weather turns for immediate pressure instead of slow repositioning.`;
  if (kind === 'aggressive' && pivots.length) return `After the opening denial turn, ${pivotText} should be held as the reset button. Use that slot to soak the counterattack or pivot out once the opponent has protected around your first burst.`;
  if (kind === 'defensive' && attackers.length) return `This opener is meant to scout first, so the bench should stay sharper. Keep ${attackerText} healthy until you know which opposing slot is pinned, then bring it in to punish the safer target.`;
  if (kind === 'safe setup' && attackers.length) return `Once the setup turn is secured, the back half should immediately cash it in. ${attackerText} wants to enter behind the screen or speed advantage, not after the opponent has already stalled it out.`;
  if (attackers.length && pivots.length) return `${attackerText} gives the endgame damage, while ${pivotText} gives you a controlled way to reach it. Choose which one enters first based on whether the opener created a KO threat or needs a defensive reset.`;
  if (attackers.length && support.length) return `Bring ${attackerText} in after the first support exchange has created space. Keep ${supportText} available for a later disruption turn instead of spending every support tool immediately.`;
  if (attackers.length) return `Keep ${attackerText} as the closing threat. The opener should either chip its checks or force enough Protects that the cleaner can attack safely on entry.`;
  if (pivots.length) return `Use ${pivotText} to steady the midgame after the lead has revealed the opponent’s plan. Their value is in buying a safer switch, not racing for damage straight away.`;
  return 'Use the remaining two Pokémon as your safest matchup answers. Preserve whichever one gives you the best endgame into the opponent’s last attacker.';
}
function buildNextSuggestions(f, risks, gameplans) { const suggestions = []; if (!f.speedControl.length) suggestions.push('Add a real form of speed control such as Tailwind, Icy Wind, Thunder Wave, or Trick Room.'); if (!f.defensiveSwitchIns.length) suggestions.push('Add a defensive switch-in so the team has safer pivots into pressure.'); if (!f.disruption.length && !f.fakeOut.length) suggestions.push('Add disruption such as Fake Out, Taunt, Encore, Snarl, or Parting Shot.'); if (risks[0]) suggestions.push(`Add a teammate or support option that helps into ${risks[0].type} pressure.`); if (gameplans.length && !f.protectUsers.length) suggestions.push('Add Protect-style safety to important Pokémon so your main plan is easier to pilot.'); return uniq(suggestions).slice(0,5); }
