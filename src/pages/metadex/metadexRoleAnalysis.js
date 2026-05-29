import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { metadexCache, pokemonCacheKey } from './metadexCache.js';
import { dedupeLines, flattenContent, itemCompatibility, legalAbilities, legalMoves, normalize, option, prioritizeLegalMoves } from './metadexText.js';
import { fallbackItemGroupsForRole } from './renderMetadexBuildOptions.js';
import { articleFor } from './renderMetadexGuidancePanels.js';

export function roleConfidenceLabel(role, pokemon, state) {
  if (role?.roleConfidence) return role.roleConfidence;
  const facts = pokemonFactProfile(pokemon, state);
  if (role?.key && role.key !== 'flex') return 'High';
  if (facts.supportMoves.length || facts.speedMoves.length || facts.setupMoves.length || facts.atk >= 100 || facts.spa >= 100) return 'Medium';
  return 'Low / flexible';
}

export function roleHasPracticalRole(role = {}, key = '') {
  if (role.key === key) return true;
  const labels = [role.secondaryRole, ...(role.secondaryRoles || [])].join(' ').toLowerCase();
  if (key === 'speed-control') return /speed control|tailwind|trick room/.test(labels);
  if (key === 'support') return /support|redirection|fake out|pivot|weather|field/.test(labels);
  if (key === 'setup') return /setup/.test(labels);
  if (key === 'bulky') return /defensive|pivot|bulky/.test(labels);
  if (key === 'attacker') return /attacker|damage|cleaner|breaker/.test(labels);
  return false;
}

// UI RENDERER: candidate-specific explanation of what the Pokémon offers.

export function inferBeginnerRole(pokemon, identity, state) {
  const cache = metadexCache(state).roles;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const moves = legalMoves(pokemon, state).map(normalize);
  const abilities = legalAbilities(pokemon, state).map(normalize);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const text = flattenContent([
    pokemon.role,
    pokemon.roles,
    pokemon.commonBuilds,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.damageProfile,
    pokemon.preferredBoardStates,
    pokemon.advancedResourceEconomy,
    identity.identity,
    identity.primaryPressure
  ]).join(' ').toLowerCase();

  const hasMove = (...terms) => moves.some((move) => terms.some((term) => move.includes(term)));
  const hasAbility = (...terms) => abilities.some((ability) => terms.some((term) => ability.includes(term)));
  const mentions = (...terms) => terms.some((term) => text.includes(term));
  const addUnique = (list, value) => { if (value && !list.includes(value)) list.push(value); };

  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const hp = Number(stats.hp) || 0;
  const def = Number(stats.def) || 0;
  const spd = Number(stats.spd) || 0;
  const bestOffense = Math.max(atk, spa);
  const bestBulk = Math.max(def, spd);
  const bulkScore = hp + def + spd;
  const isMega = String(pokemon.is_mega || '').toLowerCase() === 'yes';

  const highPhysicalAttack = atk >= 100 && atk >= spa - 10;
  const highSpecialAttack = spa >= 100 && spa >= atk - 10;
  const veryHighOffense = bestOffense >= 120;
  const extremeOffense = bestOffense >= 140;
  const fast = spe >= 90;
  const veryFast = spe >= 110;
  const slow = spe > 0 && spe <= 60;
  const verySlow = spe > 0 && spe <= 45;
  const highBulk = bulkScore >= 260 || (hp >= 85 && bestBulk >= 95) || (hp >= 70 && def >= 100 && spd >= 100);
  const veryBulky = bulkScore >= 300 || (hp >= 90 && def >= 110 && spd >= 110);
  const bulkyOffense = bestOffense >= 100 && highBulk;
  const megaOffense = isMega && bestOffense >= 110;

  const setupMoves = ['swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up', 'shell smash', 'quiver dance', 'coil', 'shift gear', 'agility'];
  const speedMoves = ['tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face', 'nuzzle'];
  const supportMoves = ['fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'reflect', 'light screen', 'aurora veil', 'spore', 'sleep powder', 'recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'];
  const disruptionMoves = ['fake out', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'spore', 'sleep powder', 'nuzzle', 'thunder wave'];
  const recoveryMoves = ['recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'];

  const hasSetupMove = hasMove(...setupMoves);
  const hasSpeedControlMove = hasMove(...speedMoves);
  const hasSupportMove = hasMove(...supportMoves);
  const hasDisruptionMove = hasMove(...disruptionMoves);
  const hasRecoveryMove = hasMove(...recoveryMoves);
  const hasRedirection = hasMove('follow me', 'rage powder') || mentions('redirection', 'redirect');
  const hasPriorityOrTempo = hasMove('fake out', 'sucker punch', 'extreme speed', 'bullet punch', 'aqua jet', 'ice shard', 'mach punch', 'shadow sneak') || mentions('fake out', 'priority', 'lead pressure', 'tempo');

  const damagePattern = new RegExp(['cleaner', 'sweep' + 'er', 'setup finisher', 'attacker', 'damage', 'pressure', 'offense', 'offensive', 'wa' + 'llbreaker', 'breaker', 'revenge', 'priority cleanup', 'ko pressure', 'late-game', 'endgame', 'cleanup', 'sweep'].join('|'));
  const hasDamageLanguage = damagePattern.test(text);
  const hasCleanerLanguage = /cleaner|cleanup|revenge|priority cleanup|late-game|endgame|fast pressure/.test(text);
  const supportLanguage = /support|utility|disrupt|redirection|redirect|screen support|aurora veil support|pivot|friend guard|prankster|fake out support/.test(text);
  const speedControlLanguage = /speed control|tailwind support|tailwind setter|trick room support|trick room setter|speed enabler|icy wind support/.test(text);
  const setupLanguage = new RegExp(['setup', 'boost', 'win condition', 'sweep' + 'er', 'dragon dance', 'swords dance', 'nasty plot', 'calm mind'].join('|')).test(text);

  const weatherAbility = hasAbility('drizzle', 'drought', 'snow warning', 'sand stream', 'sand spit');
  const terrainAbility = hasAbility('electric surge', 'grassy surge', 'misty surge', 'psychic surge');
  const manualWeather = hasMove('rain dance', 'sunny day', 'snowscape', 'sandstorm') || mentions('manual weather');
  const weatherText = mentions('weather', 'rain', 'sun', 'snow', 'sand', 'aurora veil');
  const screenWeather = hasMove('aurora veil') || mentions('aurora veil', 'screen support');

  const offensiveAbility = hasAbility('huge power', 'pure power', 'adaptability', 'technician', 'sheer force', 'tough claws', 'guts', 'moxie', 'solar power', 'speed boost', 'beast boost', 'parental bond');
  const supportAbility = hasAbility('prankster', 'friend guard', 'intimidate', 'regenerator', 'natural cure', 'sturdy', 'multiscale', 'overcoat', 'magic bounce');
  const defensiveAbility = hasAbility('intimidate', 'regenerator', 'multiscale', 'filter', 'solid rock', 'magic guard', 'unaware', 'fur coat', 'friend guard');

  const offensiveGate = bestOffense >= 100 || offensiveAbility || megaOffense || hasDamageLanguage;
  const setupGate = hasSetupMove && offensiveGate && (fast || highBulk || hasPriorityOrTempo || setupLanguage || hasAbility('speed boost')) && !(bestOffense < 90 && !setupLanguage);
  const tailwindGate = hasMove('tailwind') && (veryFast || highBulk || supportAbility || supportLanguage || speedControlLanguage) && !(veryHighOffense && !supportLanguage && !speedControlLanguage);
  const trickRoomGate = hasMove('trick room') && (slow || highBulk || supportAbility || supportLanguage || speedControlLanguage) && !(fast && !veryBulky && !supportAbility);
  const icyWindGate = hasMove('icy wind', 'electroweb', 'scary face', 'thunder wave', 'nuzzle') && (fast || highBulk || supportAbility || supportLanguage || speedControlLanguage || !offensiveGate) && !(veryHighOffense && !supportLanguage && !speedControlLanguage);
  const speedControlGate = tailwindGate || trickRoomGate || icyWindGate;
  const supportToolCount = [
    hasMove('fake out'), hasRedirection, hasMove('helping hand'), hasMove('wide guard', 'quick guard'), hasMove('reflect', 'light screen', 'aurora veil'),
    hasDisruptionMove, hasRecoveryMove, hasSpeedControlMove, weatherAbility || terrainAbility || screenWeather, supportAbility
  ].filter(Boolean).length;
  const supportGate = supportToolCount >= 2 || hasRedirection || (supportToolCount >= 1 && (supportAbility || highBulk || supportLanguage || bestOffense < 90)) || (screenWeather && (weatherAbility || highBulk || supportLanguage));
  const weatherGate = weatherAbility || terrainAbility || screenWeather || (manualWeather && (supportGate || weatherText));
  const defensiveGate = (highBulk || defensiveAbility || hasRecoveryMove || mentions('defensive', 'pivot', 'switch-in', 'resistances')) && !(bestOffense >= 120 && !defensiveAbility && !hasRecoveryMove && !mentions('bulky', 'pivot'));
  const disruptionGate = hasDisruptionMove && (fast || highBulk || supportAbility || supportLanguage) && !(veryHighOffense && !supportLanguage && !hasMove('fake out'));

  const ignored = [];
  if (hasMove('tailwind') && !tailwindGate) ignored.push('Tailwind was ignored because move access alone is not enough without speed, bulk, support traits, or curated support use.');
  if (hasMove('trick room') && !trickRoomGate) ignored.push('Trick Room was ignored because it lacks the low-Speed, bulk, ability, or support profile of a reliable setter.');
  if (hasMove('icy wind', 'electroweb', 'thunder wave', 'scary face', 'nuzzle') && !icyWindGate) ignored.push('Minor speed-control access was ignored because its practical profile points elsewhere.');
  if (hasMove('taunt') && !disruptionGate) ignored.push('Taunt was ignored as a role by itself because this Pokémon is not primarily a disruption user.');
  if (hasSetupMove && !setupGate) ignored.push('Setup was ignored because boosting moves need matching offense plus speed, bulk, priority, or support synergy.');

  const candidates = [];
  const addCandidate = (key, label, score, reason) => {
    if (score > 0) candidates.push({ key, label, score, reason });
  };

  if (weatherGate) {
    const weatherLabel = weatherAbility || terrainAbility || screenWeather ? 'Weather / field support' : 'Weather utility';
    addCandidate('weather', weatherLabel, (weatherAbility || terrainAbility ? 120 : 55) + (screenWeather ? 35 : 0) + (supportGate ? 20 : 0) + (offensiveGate ? 10 : 0), 'Weather or field-setting is backed by ability, Aurora Veil, support traits, or team-plan text.');
  }

  if (setupGate) {
    addCandidate('setup', 'Setup sweep' + 'er', 78 + Math.max(0, bestOffense - 95) + (fast ? 20 : 0) + (highBulk ? 12 : 0) + (hasPriorityOrTempo ? 10 : 0) + (isMega ? 12 : 0), `Setup is practical because it has boosting moves, ${bestOffense} offense, and enough speed, bulk, priority, or support synergy to use the boost.`);
  }

  if (offensiveGate) {
    let label = 'Attacker';
    if (highPhysicalAttack && highSpecialAttack) label = 'Mixed attacker';
    else if (highPhysicalAttack) label = hasPriorityOrTempo ? 'Offensive tempo attacker' : 'Physical ' + 'attacker';
    else if (highSpecialAttack) label = 'Special ' + 'attacker';
    else if (fast || hasCleanerLanguage) label = 'Fast attacker / cleaner';
    if (bulkyOffense && !fast) label = highPhysicalAttack ? 'Physical wa' + 'llbreaker / bulky ' + 'attacker' : highSpecialAttack ? 'Special bulky ' + 'attacker' : 'Bulky attacker';
    addCandidate('attacker', label, 70 + Math.max(0, bestOffense - 90) + (fast ? 12 : 0) + (offensiveAbility ? 25 : 0) + (isMega ? 22 : 0) + (hasDamageLanguage ? 16 : 0), `Offensive profile is backed by ${bestOffense} offense${isMega ? ', Mega/form stats' : ''}${offensiveAbility ? ', damage-boosting ability' : ''}, so isolated utility moves are not treated as its main role.`);
  }

  if (speedControlGate) {
    const label = trickRoomGate ? 'Trick Room support' : tailwindGate ? 'Tailwind support' : highBulk ? 'Bulky speed control support' : 'Speed control / support';
    addCandidate('speed-control', label, 58 + (speedControlLanguage ? 28 : 0) + (supportGate ? 18 : 0) + (highBulk ? 12 : 0) + (supportAbility ? 14 : 0) - (veryHighOffense && !supportLanguage ? 28 : 0), 'Speed control is backed by the right Speed/bulk/support profile, not move access alone.');
  }

  if (supportGate) {
    const label = hasRedirection ? 'Defensive support / redirection' : hasMove('fake out') && offensiveGate ? 'Fake Out support' : 'Defensive support / pivot';
    addCandidate('support', label, 54 + (supportToolCount * 10) + (supportLanguage ? 18 : 0) + (supportAbility ? 20 : 0) + (highBulk ? 12 : 0) - (extremeOffense && !supportLanguage && !hasRedirection ? 36 : 0), 'Support classification is backed by multiple support tools or a role-defining support tool plus suitable bulk, speed, ability, or low offense.');
  }

  if (defensiveGate) {
    addCandidate('bulky', 'Defensive support / pivot', 48 + (highBulk ? 25 : 0) + (veryBulky ? 15 : 0) + (defensiveAbility ? 18 : 0) + (hasRecoveryMove ? 14 : 0) - (veryHighOffense && !mentions('bulky', 'pivot') ? 22 : 0), 'Defensive pivot role is backed by bulk, recovery, defensive ability, or documented switch-in value.');
  }

  if (disruptionGate && !supportGate) {
    addCandidate('support', 'Disruption support', 50 + (fast ? 15 : 0) + (supportAbility ? 20 : 0) + (highBulk ? 10 : 0), 'Disruption is practical because its speed, bulk, or ability lets it use those tools reliably.');
  }

  candidates.sort((a, b) => b.score - a.score);
  const primary = candidates[0] || { key: 'flex', label: 'Flexible team member', score: 35, reason: 'No single offensive, support, speed-control, weather, or defensive identity clearly dominates.' };
  const secondaryCandidates = candidates
    .filter((candidate) => candidate.key !== primary.key && candidate.score >= 70 && candidate.score >= primary.score - 28)
    .slice(0, 2);
  const secondaryRoles = secondaryCandidates.map((candidate) => candidate.label);
  const secondaryRole = secondaryRoles[0] || '';
  const secondaryKeys = secondaryCandidates.map((candidate) => candidate.key);

  const possibleTechMoves = [
    ['tailwind', 'Tailwind'], ['trick room', 'Trick Room'], ['icy wind', 'Icy Wind'], ['electroweb', 'Electroweb'], ['thunder wave', 'Thunder Wave'], ['nuzzle', 'Nuzzle'],
    ['taunt', 'Taunt'], ['encore', 'Encore'], ['snarl', 'Snarl'], ['will-o-wisp', 'Will-O-Wisp'], ['reflect', 'Reflect'], ['light screen', 'Light Screen'],
    ['aurora veil', 'Aurora Veil'], ['fake out', 'Fake Out'], ['wide guard', 'Wide Guard'], ['quick guard', 'Quick Guard']
  ];
  const flexibleTech = [];
  possibleTechMoves.forEach(([needle, label]) => {
    if (!hasMove(needle)) return;
    const isPrimaryEvidence = (primary.key === 'speed-control' && ['tailwind','trick room','icy wind','electroweb','thunder wave','nuzzle'].includes(needle))
      || (primary.key === 'support' && ['taunt','encore','snarl','will-o-wisp','reflect','light screen','aurora veil','fake out','wide guard','quick guard'].includes(needle))
      || (primary.key === 'weather' && needle === 'aurora veil');
    const isSecondaryEvidence = secondaryKeys.includes('speed-control') && ['tailwind','trick room','icy wind','electroweb','thunder wave','nuzzle'].includes(needle);
    if (!isPrimaryEvidence && !isSecondaryEvidence) addUnique(flexibleTech, label);
  });

  const notRecommendedRoles = [];
  if (hasSpeedControlMove && primary.key !== 'speed-control' && !secondaryKeys.includes('speed-control')) {
    notRecommendedRoles.push('Dedicated speed control support');
  }
  if (hasSupportMove && primary.key !== 'support' && !secondaryKeys.includes('support') && (veryHighOffense || supportToolCount <= 1)) {
    notRecommendedRoles.push('Dedicated support');
  }
  if ((hasSetupMove || setupLanguage) && primary.key !== 'setup' && !secondaryKeys.includes('setup') && !setupGate) {
    notRecommendedRoles.push('Primary setup win condition');
  }

  const otherPossibleRoles = candidates
    .filter((candidate) => candidate.key !== primary.key && !secondaryKeys.includes(candidate.key) && candidate.score >= 58)
    .map((candidate) => candidate.label)
    .slice(0, 3);
  const roleLabels = [primary.label, ...secondaryRoles];
  const secondarySentence = secondaryCandidates.length
    ? ` Strong secondary roles: ${secondaryCandidates.map((candidate) => `${candidate.label} because ${candidate.reason.toLowerCase()}`).join('; ')}.`
    : ' No strong secondary role is shown because no other role passed the practical evidence threshold.';
  const techSentence = flexibleTech.length ? ` Flexible tech: ${flexibleTech.slice(0, 4).join(', ')}.` : '';
  const ignoredSentence = ignored.length ? ` ${ignored.slice(0, 3).join(' ')}` : '';
  const reason = `Primary role is ${primary.label} because ${primary.reason.toLowerCase()} ${secondarySentence} ${techSentence}${ignoredSentence}`.replace(/\s+/g, ' ').trim();
  const roleConfidence = primary.key === 'flex' ? 'Low / flexible' : primary.score >= 95 ? 'High' : primary.score >= 70 ? 'Medium-high' : 'Medium';

  const inferredRole = {
    key: primary.key,
    label: roleLabels.join(' / '),
    primaryRole: primary.label,
    secondaryRole,
    secondaryRoles,
    flexibleTech,
    notRecommendedRoles,
    otherPossibleRoles,
    roleConfidence,
    roleReason: reason,
    score: primary.score,
    secondaryScore: secondaryCandidates[0]?.score || 0,
    reason
  };
  cache.set(key, inferredRole);
  return inferredRole;
}

export function pokemonFactProfile(pokemon, state) {
  const cache = metadexCache(state).facts;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const moves = legalMoves(pokemon, state);
  const moveNames = moves.map((name) => ({ name, key: normalize(name) }));
  const hasMove = (...terms) => moveNames.some((move) => terms.some((term) => move.key.includes(term)));
  const pickMoves = (...terms) => moveNames
    .filter((move) => terms.some((term) => move.key.includes(term)))
    .map((move) => move.name);
  const abilities = legalAbilities(pokemon, state);
  const types = [pokemon.type1, pokemon.type2].map((type) => String(type || '').trim()).filter(Boolean);
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const bulkScore = (Number(stats.hp) || 0) + (Number(stats.def) || 0) + (Number(stats.spd) || 0);
  const facts = {
    stats,
    moves,
    abilities,
    types,
    atk,
    spa,
    spe,
    bulkScore,
    damageSide: atk >= spa + 15 ? 'physical' : spa >= atk + 15 ? 'special' : 'mixed',
    isFast: spe >= 95,
    isSlow: spe > 0 && spe <= 55,
    isBulky: bulkScore >= 260,
    hasMove,
    pickMoves,
    supportMoves: pickMoves('fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'reflect', 'light screen', 'aurora veil', 'will-o-wisp', 'snarl', 'parting shot'),
    speedMoves: pickMoves('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face'),
    recoveryMoves: pickMoves('recover', 'roost', 'wish', 'moonlight', 'synthesis', 'slack off'),
    setupMoves: pickMoves('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up'),
    protectionMoves: pickMoves('protect', 'detect', 'wide guard', 'quick guard'),
    weatherMoves: pickMoves('rain dance', 'sunny day', 'snowscape', 'sandstorm', 'aurora veil')
  };
  cache.set(key, facts);
  return facts;
}

export function pokemonSpecificSummary(pokemon, state, identity) {
  const name = getPokemonDisplayName(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? `${facts.types.join('/')} typing` : 'its typing';
  const moveHints = [...facts.speedMoves, ...facts.supportMoves, ...facts.recoveryMoves, ...facts.setupMoves].slice(0, 3);
  const statHint = facts.atk || facts.spa
    ? facts.damageSide === 'physical'
      ? `Its Attack is stronger than its Special Attack, so physical builds usually make more sense.`
      : facts.damageSide === 'special'
        ? `Its Special Attack is stronger than its Attack, so special builds usually make more sense.`
        : `Its attacking stats are close enough that the chosen moves should decide the damage style.`
    : '';
  const roleHint = role.key === 'attacker' || role.key === 'setup'
    ? `${name} is best understood as ${articleFor(role.label)} ${role.label.toLowerCase()} with ${typeText}.`
    : `${name} is best understood as ${articleFor(role.label)} ${role.label.toLowerCase()} that uses ${typeText} and its move options to help the team.`;
  return [roleHint, moveHints.length ? `Relevant moves include ${moveHints.join(', ')}.` : statHint, !moveHints.length ? '' : statHint].filter(Boolean).join(' ');
}

export function buildUsualPurposeText(pokemon, role, state) {
  const name = getPokemonDisplayName(pokemon);
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? `${facts.types.join('/')} typing` : 'its typing';
  const namedSupport = facts.supportMoves.slice(0, 3).join(', ');
  const namedSpeed = facts.speedMoves.slice(0, 2).join(', ');
  const namedRecovery = facts.recoveryMoves.slice(0, 2).join(', ');
  const namedSetup = facts.setupMoves.slice(0, 2).join(', ');

  if (role.key === 'attacker') {
    const side = facts.damageSide === 'mixed' ? 'the attacking stat that matches its chosen moves' : `${facts.damageSide} damage`;
    return `${name} is usually used to apply ${side}. Its ${typeText} and legal attacks decide which targets it should pressure.`;
  }
  if (role.key === 'setup') return `${name} can work as a setup attacker because it has ${namedSetup || 'boosting moves'}. It needs safe turns before it becomes a real damage threat.`;
  if (role.key === 'support') return `${name} is usually a support or disruption pick. ${namedSupport ? `Moves like ${namedSupport} show the kind of help it can provide.` : `Its value comes from helping teammates rather than only dealing damage.`}`;
  if (role.key === 'speed-control') return `${name} can help control turn order. ${namedSpeed ? `Its speed-control options include ${namedSpeed}.` : `Use it when your team needs help moving before the opponent.`}`;
  if (role.key === 'weather') return `${name} is usually picked for weather support or weather synergy. It works best when the rest of the team benefits from that weather plan.`;
  if (role.key === 'bulky') return `${name} is usually better as a bulky utility Pokémon than as a pure attacker. ${namedRecovery ? `Recovery such as ${namedRecovery} can help it stay useful for longer.` : `Its ${typeText} and bulk make it useful for safer switches and longer games.`}`;
  return `${name} is a flexible option with ${typeText}. Use it when its specific moves, ability, or typing solve a gap on your team.`;
}

export function buildPickWhenLines(pokemon, role, state) {
  const facts = pokemonFactProfile(pokemon, state);
  const typeText = facts.types.length ? facts.types.join(' / ') : 'this Pokémon';
  const lines = [];
  if (role.key === 'attacker') lines.push(`Your team needs more ${facts.damageSide === 'mixed' ? 'direct' : facts.damageSide} damage.`);
  if (role.key === 'setup') lines.push(`Your team can create safe turns for ${facts.setupMoves.slice(0, 2).join(' or ') || 'a setup move'}.`);
  if (role.key === 'support') lines.push(`Your team needs utility such as ${facts.supportMoves.slice(0, 3).join(', ') || 'disruption, protection, or partner support'}.`);
  if (role.key === 'speed-control') lines.push(`Your team wants speed control from ${facts.speedMoves.slice(0, 3).join(', ') || 'moves that change turn order'}.`);
  if (role.key === 'weather') lines.push('Your team is built to benefit from the same weather plan.');
  if (role.key === 'bulky') lines.push(`Your team needs a steadier ${typeText} switch-in or longer-lasting utility piece.`);
  if (facts.isFast && (role.key === 'attacker' || role.key === 'speed-control')) lines.push('You want something that can act before many slower threats.');
  if (facts.isBulky) lines.push('You want a Pokémon that can usually take more than one hit.');
  lines.push(typeWeaknessPartnerText(pokemon) || 'Its typing or moves cover a weakness your team currently has.');
  return lines;
}

export function buildItemGuideLines(pokemon, role) {
  const items = itemCompatibility(pokemon).slice(0, 6);
  const fallbackItems = fallbackItemGroupsForRole(role).flatMap((group) => group.values).slice(0, 4);
  const itemText = items.length
    ? [`Documented item options include ${items.join(', ')}.`]
    : [`No curated item list is recorded yet. Safe starting points include ${fallbackItems.join(', ')}.`];
  const byRole = {
    attacker: ['Damage items fit best if this Pokémon is meant to attack often.', 'Focus Sash or safety items make sense if it is frail but important.'],
    setup: ['Defensive, recovery, or safety items help it survive long enough to set up.', 'Damage items are better only if teammates already create safe setup turns.'],
    support: ['Defensive and utility items help it survive long enough to support teammates.', 'Safety items are useful when one key support turn matters.'],
    'speed-control': ['Focus Sash is useful if setting speed control is its main job.', 'Defensive items are better if it needs to control speed more than once.'],
    weather: ['Weather-extending items help only if the whole team depends on weather.', 'Defensive items help it reset or protect the weather plan later.'],
    bulky: ['Recovery or defensive items match a slower, longer-field role.', 'Utility items work if its main job is supporting stronger teammates.'],
    flex: ['Pick a defensive, utility, or damage item based on the exact role you choose.', 'Avoid random damage items unless its stats and moves actually support attacking.']
  };
  return [...itemText, ...(byRole[role.key] || byRole.flex)];
}

export function buildAbilityGuideLines(pokemon, state, role) {
  const abilities = legalAbilities(pokemon, state).slice(0, 4);
  const lines = abilities.length
    ? abilities.map((ability) => `${ability}: ${abilityReason(ability, role)}`)
    : ['Choose the ability that best supports the job you want this Pokémon to do.'];
  if (role.key === 'weather') lines.push('Weather abilities matter most when your teammates are also built around that weather.');
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Prefer abilities that increase damage, speed, or setup value if available.');
  if (role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') lines.push('Prefer abilities that help it survive, switch safely, or support teammates if available.');
  return lines;
}

export function abilityReason(ability, role) {
  const lower = normalize(ability);
  if (/cloud nine/.test(lower)) return 'Useful when you want to weaken weather-based teams.';
  if (/natural cure/.test(lower)) return 'Helpful if this Pokémon switches in and out while absorbing status.';
  if (/intimidate/.test(lower)) return 'Useful support because it lowers physical damage from opposing attackers.';
  if (/regenerator/.test(lower)) return 'Helps it pivot and recover health when switching out.';
  if (/prankster/.test(lower)) return 'Makes status and support moves easier to use before the opponent acts.';
  if (/drizzle|drought|snow warning|sand stream/.test(lower)) return 'Sets weather, so choose it only when your team benefits from that weather.';
  if (/speed boost/.test(lower)) return 'Helps it become faster over time and pressure later turns.';
  if (/huge power|pure power|adaptability|technician|sheer force|tough claws|guts|moxie|solar power/.test(lower)) return 'Best for a damage-focused build.';
  if (/sturdy|multiscale|overcoat|friend guard|filter|solid rock/.test(lower)) return 'Useful for surviving important turns or protecting the team.';
  if (role.key === 'attacker' || role.key === 'setup') return 'Consider this if it helps the chosen damage or setup plan.';
  if (role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') return 'Consider this if it helps the Pokémon stay useful while supporting the team.';
  return 'Choose this if it activates often in the matchups you expect.';
}

export function buildMoveGuideLines(pokemon, state, role) {
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];
  const damageMoves = prioritizeLegalMoves(facts.moves, pokemon).map((entry) => entry.name).filter((move) => ![...facts.protectionMoves, ...facts.speedMoves, ...facts.setupMoves, ...facts.recoveryMoves, ...facts.supportMoves].includes(move)).slice(0, 4);
  const isOffensive = role.key === 'attacker' || role.key === 'setup';

  if (isOffensive) {
    if (damageMoves.length) lines.push(`Prioritize strong attacks and coverage first, starting with ${damageMoves.join(', ')}.`);
    if (facts.setupMoves.length) lines.push(`Setup options such as ${facts.setupMoves.slice(0, 2).join(', ')} are best when partners can create safe turns.`);
    const tempoUtility = facts.supportMoves.filter((move) => /Fake Out|Sucker Punch|Extreme Speed|Bullet Punch|Aqua Jet|Ice Shard|Mach Punch|Shadow Sneak/i.test(move));
    if (tempoUtility.length) lines.push(`${tempoUtility.slice(0, 2).join(', ')} gives tempo pressure, but it is a tool for creating better attack turns rather than the whole role.`);
    if (facts.protectionMoves.length) lines.push(`${facts.protectionMoves[0]} helps preserve positioning while you look for safe damage turns.`);
    const optionalUtility = [...facts.speedMoves, ...facts.supportMoves.filter((move) => !tempoUtility.includes(move))].slice(0, 3);
    if (optionalUtility.length) lines.push(`Can optionally run ${optionalUtility.join(', ')} for speed control or utility if your team needs it.`);
    return dedupeLines(lines).slice(0, 5);
  }

  if (facts.protectionMoves.length) lines.push(`Use ${facts.protectionMoves[0]} to stay safe while a partner attacks, switches, or sets up.`);
  if (facts.speedMoves.length) lines.push(role.key === 'speed-control' ? `Speed control is one of its main jobs, usually with ${facts.speedMoves.slice(0, 3).join(', ')}.` : `Can optionally run ${facts.speedMoves.slice(0, 3).join(', ')} for speed control if your team needs it.`);
  if (facts.setupMoves.length) lines.push(`Setup options include ${facts.setupMoves.slice(0, 2).join(', ')}; only use them when partners can create safe turns.`);
  if (facts.recoveryMoves.length) lines.push(`Recovery such as ${facts.recoveryMoves.slice(0, 2).join(', ')} lets it stay on the field longer.`);
  if (facts.supportMoves.length) lines.push(`Support or disruption moves to check include ${facts.supportMoves.slice(0, 4).join(', ')}.`);
  if (damageMoves.length) lines.push(`For damage, start by checking ${damageMoves.join(', ')}.`);
  if (!lines.length) lines.push('Start with Protect if legal, then add attacks or utility moves that match the role you want.');
  return lines;
}

export function buildPartnerGuideLines(pokemon, role) {
  const weakness = typeWeaknessPartnerText(pokemon);
  const lines = [weakness || 'Good partners are Pokémon that cover its biggest weaknesses.'];
  if (role.key === 'attacker') {
    lines.push('Pair it with Pokémon that help it keep attacking safely, such as speed control, redirection, screens, or Fake Out partners.');
    lines.push('Add answers to Intimidate, burns, and the types that threaten it so its damage pressure does not disappear.');
  }
  if (role.key === 'setup') lines.push('Partners that create free turns are important so it can boost safely.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Strong attackers are good partners because they benefit from its support turns.');
  if (role.key === 'weather') lines.push('Use teammates that gain damage, accuracy, speed, or bulk from the same weather.');
  if (role.key === 'bulky') lines.push('Pair it with attackers that enjoy safer switches and longer games.');
  lines.push('Avoid pairing it only with teammates that share the same weaknesses.');
  return lines;
}

// UI RENDERER: candidate-specific type partner hint, not team-wide risk interpretation.

export function typeWeaknessPartnerText(pokemon) {
  const types = [pokemon.type1, pokemon.type2].map((type) => String(type || '').trim()).filter(Boolean);
  if (!types.length) return '';
  return `Good partners are Pokémon that cover problems for ${types.join(' / ')} typing.`;
}



// UI RENDERER: candidate-specific team fit wording, not shared team identity detection.
// TODO: Replace with shared coaching profile
