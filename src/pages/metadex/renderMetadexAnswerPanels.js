import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { escapeText, flattenContent, legalMoves } from './metadexText.js';

export function renderAnswerCategoryBadges(answer = {}) {
  const labels = (answer.categories || []).slice(0, 3);
  if (!labels.length) return '';
  return `<span class="metadex-answer-tags">${labels.map((label) => `<span class="score-pill">${escapeText(label)}</span>`).join('')}</span>`;
}

// TODO: Replace with shared coaching profile

export function weaknessAnswerFitPanel(pokemon, state = {}) {
  const answerType = normaliseAnswerType(state?.metadex?.answerType || state?.metadex?.weaknessAnswerType || '');
  if (!answerType) return '';
  const answer = evaluateWeaknessAnswerPokemon(pokemon, answerType, state);
  const categoryLines = answer.categories.length ? answer.categories : ['Soft answer'];
  return `<article class="mini-card metadex-info-card metadex-answer-fit-panel">
    <h3>Answer fit: ${escapeText(answerType)} pressure</h3>
    <p>${escapeText(answer.reason)}</p>
    <div class="team-guide-chip-row">${categoryLines.map((line) => `<span class="score-pill">${escapeText(line)}</span>`).join('')}</div>
    ${answer.warning ? `<p class="notice">${escapeText(answer.warning)}</p>` : ''}
    <p class="muted small-copy">This is a priority sort, not a hard filter. You can still choose Pokémon that fit your main plan better.</p>
  </article>`;
}

// RAW CALCULATION / CANDIDATE COMPARISON: scores a candidate against a requested profile risk/answer type.
// TODO: Replace with shared coaching profile

export function evaluateWeaknessAnswerPokemon(pokemon = {}, attackingType = '', state = {}) {
  const typeName = normaliseAnswerType(attackingType);
  const types = getPokemonTypesForAnswer(pokemon);
  const multiplier = calculateDefensiveMultiplier(typeName, types);
  const immune = multiplier === 0;
  const resists = multiplier > 0 && multiplier < 1;
  const weak = multiplier > 1;
  const offensive = threatensTypeOffensively(pokemon, typeName, state);
  const support = hasTypeSpecificSupportIntoPressure(pokemon, typeName, state);
  const bulky = looksBulkyEnough(pokemon, state);
  const categories = [];
  let score = 0;

  if ((immune || resists) && bulky) { categories.push('Safe switch-in'); score += immune ? 90 : 75; }
  else if (immune || resists) { categories.push(immune ? 'Immune pivot' : 'Resist'); score += immune ? 65 : 55; }
  if (offensive) { categories.push('Offensive answer'); score += 35; }
  if (support && !weak) { categories.push('Support answer'); score += 24; }
  if (!categories.length && !weak && (offensive || support || (bulky && multiplier === 1))) { categories.push('Soft answer'); score += 8; }
  if (!categories.length) score = 0;
  if (weak) score -= 45;
  if (multiplier === 1 && !offensive && !support) score = 0;
  const warning = teamContextWarning(pokemon, typeName, state);
  if (warning && score > 0) score -= 12;

  return {
    score,
    categories,
    warning,
    reason: buildAnswerReason(pokemon, typeName, { immune, resists, weak, offensive, support, bulky, categories })
  };
}

export function buildAnswerReason(pokemon, typeName, flags) {
  const name = getPokemonDisplayName(pokemon);
  if (flags.immune) return `${name} gives a ${typeName} immunity, making it a strong defensive answer if it still fits your game plan.`;
  if (flags.resists && flags.offensive) return `${name} resists ${typeName} and can also threaten ${typeName}-type Pokémon or common users of that pressure.`;
  if (flags.resists) return `${name} resists ${typeName}, so it can help create safer switching and positioning.`;
  if (flags.offensive && flags.support) return `${name} has relevant pressure and matchup-specific support into ${typeName}, but check whether it is a safe switch-in.`;
  if (flags.offensive) return `${name} is mainly an offensive answer into ${typeName}-type Pokémon rather than a safe switch-in.`;
  if (flags.support) return `${name} has support that specifically helps into ${typeName} pressure, but it may not be a safe switch-in.`;
  if (flags.weak) return `${name} may worsen ${typeName} pressure, so only choose it if it strongly supports the rest of the team plan.`;
  return `${name} is not a direct ${typeName} answer. It should only be considered if it fits your wider team plan.`;
}

export function getPokemonTypesForAnswer(pokemon = {}) {
  return [pokemon.type_1, pokemon.type_2, pokemon.type1, pokemon.type2]
    .flatMap((value) => Array.isArray(value) ? value : String(value || '').split(/[\/,&|]+/))
    .map((value) => normaliseAnswerType(value))
    .filter(Boolean);
}

export function normaliseAnswerType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  return ATTACKING_TYPES.find((type) => type.toLowerCase() === clean) || '';
}

export function threatensTypeOffensively(pokemon = {}, targetType = '', state = {}) {
  const attackingTypes = offensiveAnswerTypesInto(targetType);
  if (getPokemonTypesForAnswer(pokemon).some((type) => attackingTypes.includes(type))) return true;
  const moves = legalMoves(pokemon, state).map((move) => String(move?.name || move?.move_id || move || '').toLowerCase());
  return moves.some((move) => attackingTypes.some((type) => moveSuggestsType(move, type)));
}

export function offensiveAnswerTypesInto(defendingType = '') {
  return ATTACKING_TYPES.filter((attackType) => (TYPE_EFFECTIVENESS[attackType]?.[defendingType] || 1) > 1);
}

export function moveSuggestsType(moveName = '', type = '') {
  const text = String(moveName || '').toLowerCase();
  const hints = {
    Steel: ['steel', 'iron', 'metal', 'bullet punch', 'flash cannon', 'heavy slam'],
    Poison: ['poison', 'sludge', 'gunk', 'toxic'],
    Fire: ['fire', 'flame', 'heat', 'burn', 'eruption', 'overheat'],
    Water: ['water', 'aqua', 'hydro', 'surf', 'scald'],
    Electric: ['thunder', 'volt', 'electric', 'zap'],
    Grass: ['grass', 'leaf', 'seed', 'giga drain', 'energy ball'],
    Ice: ['ice', 'blizzard', 'freeze', 'frost'],
    Ground: ['earth', 'ground', 'mud', 'stomping'],
    Fighting: ['fighting', 'punch', 'kick', 'close combat', 'aura sphere'],
    Flying: ['flying', 'air', 'aerial', 'hurricane', 'brave bird'],
    Psychic: ['psychic', 'psy', 'zen'],
    Bug: ['bug', 'x-scissor', 'lunge', 'u-turn'],
    Rock: ['rock', 'stone', 'power gem'],
    Ghost: ['ghost', 'shadow', 'phantom'],
    Dragon: ['dragon', 'draco'],
    Dark: ['dark', 'knock off', 'sucker punch', 'crunch'],
    Fairy: ['fairy', 'moon', 'dazzling', 'play rough'],
    Normal: ['normal', 'body slam', 'hyper voice', 'return']
  };
  return (hints[type] || [String(type).toLowerCase()]).some((hint) => text.includes(hint));
}

export function hasSupportIntoPressure(pokemon = {}, state = {}) {
  return hasTypeSpecificSupportIntoPressure(pokemon, '', state);
}

export function hasTypeSpecificSupportIntoPressure(pokemon = {}, targetType = '', state = {}) {
  const typeName = normaliseAnswerType(targetType);
  const movesText = legalMoves(pokemon, state).map((move) => move?.name || move?.move_id || move).join(' ').toLowerCase();
  const profileText = [
    pokemon.abilities,
    pokemon.ability,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.preferredBoardStates,
    pokemon.supportRequirements
  ].flatMap(flattenContent).join(' ').toLowerCase();
  const text = `${profileText} ${movesText}`;
  const has = (...terms) => terms.some((term) => text.includes(String(term).toLowerCase()));

  // Generic utility is not automatically an answer to a specific attacking type.
  // It only counts here when it is paired with support that actually changes that matchup.
  if (!typeName) {
    return /fake out|follow me|rage powder|redirection|tailwind|trick room|icy wind|thunder wave|snarl|intimidate|parting shot|taunt|encore|aurora veil|reflect|light screen|wide guard|quick guard/.test(text);
  }

  const directTypeSupport = {
    Water: ['water absorb', 'storm drain', 'dry skin', 'drought', 'sunny day', 'desolate land', 'wide guard'],
    Fire: ['flash fire', 'drizzle', 'rain dance', 'primordial sea', 'thick fat', 'wide guard'],
    Electric: ['lightning rod', 'motor drive', 'volt absorb', 'ground', 'wide guard'],
    Grass: ['sap sipper', 'overcoat', 'safety goggles', 'weather support', 'wide guard'],
    Ice: ['thick fat', 'snow warning', 'aurora veil', 'wide guard'],
    Ground: ['levitate', 'flying', 'air balloon', 'grassy terrain', 'wide guard'],
    Dragon: ['fairy', 'misty terrain', 'aurora veil', 'reflect', 'light screen'],
    Fairy: ['steel', 'poison', 'flash fire', 'aurora veil', 'light screen'],
    Rock: ['wide guard', 'reflect', 'intimidate'],
    Fighting: ['ghost', 'fairy', 'psychic terrain', 'intimidate', 'will-o-wisp', 'reflect'],
    Psychic: ['dark', 'taunt', 'encore', 'light screen'],
    Ghost: ['normal', 'dark', 'scrappy', 'light screen'],
    Dark: ['fairy', 'fighting', 'intimidate', 'reflect'],
    Steel: ['fire', 'ground', 'fighting', 'will-o-wisp', 'reflect'],
    Poison: ['steel', 'ground', 'psychic terrain'],
    Flying: ['electric', 'rock', 'ice', 'tailwind', 'wide guard'],
    Bug: ['fire', 'flying', 'rock', 'intimidate', 'reflect'],
    Normal: ['ghost', 'intimidate', 'will-o-wisp', 'reflect']
  };
  if (has(...(directTypeSupport[typeName] || []))) return true;

  const enablesRealAnswer = /fake out|follow me|rage powder|redirection|aurora veil|reflect|light screen|wide guard|quick guard/.test(text);
  const hasRealPartnerLanguage = new RegExp(`${typeName.toLowerCase()}|weakness answer|safe switch|protect teammates|enable.*answer|matchup`).test(profileText);
  return enablesRealAnswer && hasRealPartnerLanguage;
}

export function looksBulkyEnough(pokemon = {}, state = {}) {
  const stats = state?.data?.indexes?.statsByPokemon?.[pokemon.pokemon_id] || {};
  const hp = Number(stats.hp || 0), def = Number(stats.def || 0), spd = Number(stats.spd || 0);
  return (hp + Math.max(def, spd)) >= 170 || Math.min(def, spd) >= 85;
}

export function teamContextWarning(pokemon = {}, answerType = '', state = {}) {
  const team = Array.isArray(state.team) ? state.team.filter((slot) => slot && slot.pokemon_id) : [];
  if (team.length < 2) return '';
  const profile = calculateWeaknessCoverageProfile(team, state.data || {});
  const concerns = profile.filter((entry) => entry.attackingType !== answerType && ['Exposed', 'Needs Attention'].includes(entry.classification));
  const types = getPokemonTypesForAnswer(pokemon);
  const worsened = concerns.find((entry) => calculateDefensiveMultiplier(entry.attackingType, types) > 1);
  if (!worsened) return '';
  return `This helps against ${answerType} but may worsen your ${worsened.attackingType} matchup.`;
}
