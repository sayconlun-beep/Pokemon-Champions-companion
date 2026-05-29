import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { getMetadexTeamCoachingProfile, metadexCache, metadexViewCacheKey, pokemonCacheKey, teamCacheKey } from './metadexCache.js';
import { METADEX_INITIAL_VISIBLE_LIMIT } from './metadexConstants.js';
import { inferBeginnerRole, pokemonFactProfile, roleHasPracticalRole } from './metadexRoleAnalysis.js';
import { flattenContent, normalize, tacticalIdentity, yesNo } from './metadexText.js';
import { evaluateWeaknessAnswerPokemon, getPokemonTypesForAnswer, hasTypeSpecificSupportIntoPressure, normaliseAnswerType, threatensTypeOffensively } from './renderMetadexAnswerPanels.js';
import { inferGuidedCoachFits } from './renderMetadexGuidancePanels.js';

export function filteredPokemon(state, view) {
  const term = normalize(view.search);
  const field = view.field || 'all';
  const legality = view.legality || 'all';
  const answerType = normaliseAnswerType(view.answerType || view.weaknessAnswerType || '');
  const rows = getGroupedPokemonOptions(state.data).filter((pokemon) => {
    if (term && !getPokemonSearchAliases(pokemon).some((alias) => normalize(alias).includes(term))) return false;
    if (legality === 'legal' && yesNo(pokemon.champions_legal) !== 'yes') return false;
    if (legality === 'review' && !pokemon.requiresOfficialReview && String(pokemon.confidenceStatus || '').toLowerCase() !== 'needs champions confirmation') return false;
    if (field !== 'all' && !hasMeaningfulValue(pokemon[field])) return false;
    if (view.megaOnly && !isMegaForm(pokemon)) return false;
    return true;
  });

  const scored = rows.map((pokemon) => ({ pokemon, match: getMetadexFilterMatch(pokemon, state, view, answerType) }));
  const hasActiveFilter = answerType || activeTeamNeed(view) !== 'all' || activeGuideStep(view) !== 'any' || activeTeamFit(view) !== 'any' || activeArchetypeFit(view) !== 'any';
  const confidenceMode = view.roleConfidence || 'strong-secondary';
  const filtered = scored.filter((entry) => {
    if (!hasActiveFilter) return true;
    if (confidenceMode === 'primary-only') return entry.match.primaryScore > 0 || entry.match.answerScore > 0;
    if (confidenceMode === 'hide-low') return entry.match.score >= 35 || entry.match.answerScore > 0;
    return entry.match.score > 0 || entry.match.answerScore > 0;
  });
  const sortMode = view.sort || defaultMetadexSort(view, state);
  return filtered
    .sort((a, b) => sortMetadexEntries(a, b, sortMode))
    .map((entry) => entry.pokemon);
}

export function activeTeamNeed(view = {}) { return view.teamNeed || 'all'; }

export function activeGuideStep(view = {}) { return view.guideStep || 'any'; }

export function activeTeamFit(view = {}) { return view.teamFit || 'any'; }

export function activeArchetypeFit(view = {}) { return view.archetypeFit || 'any'; }

export function defaultMetadexSort(view = {}, state = {}) {
  if (normaliseAnswerType(view.answerType || view.weaknessAnswerType || '')) return 'weakness-answer';
  if (activeGuideStep(view) !== 'any') return 'guide-step';
  return currentTeamPokemon(state).length ? 'team-fit' : 'alphabetical';
}

export function sortMetadexEntries(a, b, sortMode = 'alphabetical') {
  const left = a?.pokemon || {};
  const right = b?.pokemon || {};
  const leftMatch = a?.match || {};
  const rightMatch = b?.match || {};
  const leftFacts = leftMatch.facts || {};
  const rightFacts = rightMatch.facts || {};
  const byName = () => getPokemonDisplayName(left).localeCompare(getPokemonDisplayName(right));
  const byScore = (leftScore, rightScore) => {
    const diff = Number(rightScore || 0) - Number(leftScore || 0);
    return diff || byName();
  };

  switch (sortMode) {
    case 'team-fit':
    case 'guide-step':
      return byScore(leftMatch.totalScore || leftMatch.score, rightMatch.totalScore || rightMatch.score);
    case 'role-confidence':
      return byScore(leftMatch.primaryScore || leftMatch.score, rightMatch.primaryScore || rightMatch.score);
    case 'offense':
      return byScore(Math.max(Number(leftFacts.atk || 0), Number(leftFacts.spa || 0)), Math.max(Number(rightFacts.atk || 0), Number(rightFacts.spa || 0)));
    case 'defensive':
      return byScore((Number(leftFacts.hp || 0) + Number(leftFacts.def || 0) + Number(leftFacts.spd || 0)), (Number(rightFacts.hp || 0) + Number(rightFacts.def || 0) + Number(rightFacts.spd || 0)));
    case 'speed-control':
      return byScore((leftFacts.isFast ? 30 : 0) + (Array.isArray(leftFacts.speedMoves) ? leftFacts.speedMoves.length * 25 : 0) + Number(leftFacts.spe || 0) / 10, (rightFacts.isFast ? 30 : 0) + (Array.isArray(rightFacts.speedMoves) ? rightFacts.speedMoves.length * 25 : 0) + Number(rightFacts.spe || 0) / 10);
    case 'weakness-answer':
      return byScore(leftMatch.answerScore || leftMatch.score, rightMatch.answerScore || rightMatch.score);
    case 'alphabetical':
    default:
      return byName();
  }
}

export function metadexVisibleLimit(view = {}) {
  const rawLimit = Number(view.visibleLimit || METADEX_INITIAL_VISIBLE_LIMIT);
  return Number.isFinite(rawLimit) && rawLimit > 0 ? Math.max(METADEX_INITIAL_VISIBLE_LIMIT, rawLimit) : METADEX_INITIAL_VISIBLE_LIMIT;
}

export function hasActiveMetadexFilters(view = {}) {
  return Boolean(
    (view.search && String(view.search).trim()) ||
    (view.legality && view.legality !== 'all') ||
    (view.field && view.field !== 'all') ||
    view.megaOnly ||
    normaliseAnswerType(view.answerType || view.weaknessAnswerType || '') ||
    activeTeamNeed(view) !== 'all' ||
    activeGuideStep(view) !== 'any' ||
    activeTeamFit(view) !== 'any' ||
    activeArchetypeFit(view) !== 'any' ||
    (view.roleConfidence && view.roleConfidence !== 'strong-secondary')
  );
}

export function getMetadexFilterMatch(pokemon, state = {}, view = {}, answerType = '') {
  const cache = metadexCache(state).filterMatches;
  const key = `${pokemonCacheKey(pokemon)}|${metadexViewCacheKey(view, answerType)}|${teamCacheKey(state)}`;
  if (cache.has(key)) return cache.get(key);
  const match = evaluateMetadexFilterMatch(pokemon, state, view, answerType);
  cache.set(key, match);
  return match;
}

// RAW CALCULATION / CANDIDATE COMPARISON: evaluates filters against candidate facts and cached shared profile needs.

export function evaluateMetadexFilterMatch(pokemon, state = {}, view = {}, answerType = '') {
  const identity = tacticalIdentity(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const fits = inferGuidedCoachFits(pokemon, identity, state).map((fit) => fit.tag);
  const text = flattenContent([pokemon, identity.identity, identity.primaryPressure]).join(' ').toLowerCase();
  const need = activeTeamNeed(view);
  const guideStep = activeGuideStep(view);
  const teamFit = activeTeamFit(view);
  const archetype = activeArchetypeFit(view);
  const scores = [];
  const reasons = [];
  let primaryScore = 0;

  const add = (score, reason, primary = false) => {
    if (score > 0) { scores.push(score); reasons.push(reason); if (primary) primaryScore = Math.max(primaryScore, score); }
  };

  const needScore = scoreTeamNeedMatch(need, pokemon, role, facts, fits, text);
  if (need !== 'all') add(needScore.score, needScore.reason, needScore.primary);
  const stepScore = scoreGuideStepMatch(guideStep, pokemon, role, facts, fits, text);
  if (guideStep !== 'any') add(stepScore.score, stepScore.reason, stepScore.primary);
  const teamScore = scoreTeamFitMatch(teamFit, pokemon, state, role, facts, text);
  if (teamFit !== 'any') add(teamScore.score, teamScore.reason, teamScore.primary);
  const archScore = scoreArchetypeMatch(archetype, pokemon, role, facts, text);
  if (archetype !== 'any') add(archScore.score, archScore.reason, archScore.primary);

  let answerScore = 0;
  if (answerType) {
    const answer = evaluateWeaknessAnswerPokemon(pokemon, answerType, state);
    answerScore = answer.score;
    add(Math.max(0, answer.score), answer.reason, answer.score >= 55);
  }

  if (!reasons.length) {
    const fallback = role.primaryRole || role.label || 'Flexible team member';
    reasons.push(`${fallback}: useful when its role, typing, or legal options fit the plan.`);
  }
  return { score: Math.max(0, ...scores), totalScore: scores.reduce((a,b)=>a+b,0), primaryScore, answerScore, reason: reasons[0], facts };
}

export function currentTeamPokemon(state) {
  const team = Array.isArray(state?.team) ? state.team : [];
  return team.filter(Boolean).filter((slot) => slot?.pokemon || slot?.name || slot?.id);
}

export function isMegaForm(pokemon = {}) {
  const text = [pokemon.is_mega, pokemon.form_name, pokemon.name, pokemon.pokemon_id, pokemon.tags]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .join(' ')
    .toLowerCase();
  return yesNo(pokemon.is_mega) === 'yes' || /mega/.test(text);
}

// TODO: Replace with shared coaching profile

export function scoreTeamNeedMatch(need, pokemon, role, facts, fits, text) {
  const has = (...terms) => facts.hasMove(...terms) || terms.some((term) => text.includes(term));
  const offensive = role.key === 'attacker' || role.key === 'setup' || facts.atk >= 105 || facts.spa >= 105;
  const bulky = role.key === 'bulky' || facts.isBulky;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control');
  const map = {
    main: [offensive || role.key === 'setup', 80, 'Main Pokémon: has a clear pressure or win-condition profile.'],
    partner: [fits.includes('Partner') || support || bulky, 70, 'Core Partner: helps a main Pokémon through support, defensive value, or role compression.'],
    damage: [offensive, 78, 'Damage Pressure: strong attacking stats, setup value, or offensive role evidence.'],
    defensive: [bulky, 74, 'Defensive Switch-in: bulk, recovery, typing, or pivot traits can create safer switches.'],
    speed: [speed, 76, 'Speed Control: has practical speed tools rather than only abstract utility.'],
    disruption: [has('fake out','taunt','encore','will-o-wisp','snarl','parting shot','spore','thunder wave'), 70, 'Fake Out / Disruption: can interrupt opponents or create safer turns.'],
    redirection: [has('follow me','rage powder','protect','wide guard','quick guard','aurora veil','reflect','light screen'), 68, 'Redirection / Protection: offers tools that can protect partners or reduce incoming pressure.'],
    weather: [has('drizzle','drought','snow warning','sand stream','rain dance','sunny day','snowscape','sandstorm','aurora veil'), 75, 'Weather Support: can enable or benefit a weather-based structure.'],
    screens: [has('aurora veil','reflect','light screen'), 78, 'Screens / Aurora Veil: can improve team safety and setup windows.'],
    setup: [facts.setupMoves.length || text.includes('setup'), 70, 'Setup Support: can threaten setup or help create setup turns.'],
    pivot: [has('u-turn','volt switch','parting shot','pivot') || bulky || has('fake out'), 62, 'Pivot / Positioning: can help the team take better board positions.'],
    cleaner: [(facts.isFast && offensive) || /cleaner|late-game|endgame|priority/.test(text), 72, 'Late-game Cleaner: can pressure weakened teams or finish games.'],
    weakness: [fits.includes('Weakness Answer') || bulky || support, 58, 'Weakness Answer: can be checked against exposed matchups through typing, pressure, or support.'],
    secondary: [(role.secondaryRoles || []).length || role.key === 'weather' || role.key === 'setup', 58, 'Secondary Mode: has practical secondary role evidence without auto-building around it.'],
    glue: [support || bulky || speed || has('fake out','snarl','taunt','parting shot','protect'), 66, 'Utility Glue: compresses useful support, safety, or positioning tools.']
  };
  const [ok, score, reason] = map[need] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 72 };
}

// TODO: Replace with shared coaching profile

export function scoreGuideStepMatch(step, pokemon, role, facts, fits, text) {
  const offensive = role.key === 'attacker' || role.key === 'setup' || facts.atk >= 105 || facts.spa >= 105;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control');
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const cases = {
    step2: [(offensive || role.key === 'weather' || role.key === 'setup'), 65, 'Fits Step 2: gives the player a clear idea or direction to build around.'],
    step3: [(offensive || support || fits.includes('Partner')), 75, 'Fits Step 3: can form or support the first core.'],
    step4: [(support || speed || bulky || offensive), 70, 'Fits Step 4: adds complementary offense, defense, support, or speed control.'],
    step5: [(bulky || support || speed || fits.includes('Weakness Answer')), 76, 'Fits Step 5: helps patch matchups, add breadth, or answer weaknesses.'],
    step6: [(facts.supportMoves.length || facts.setupMoves.length || facts.weatherMoves.length || /item|ability|tech|coverage/.test(text)), 62, 'Fits Step 6: has meaningful item, move, ability, or tech decisions.'],
    step7: [true, 35, 'Fits Step 7: can be reviewed during playtesting for role overlap and matchup performance.']
  };
  const [ok, score, reason] = cases[step] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 70 };
}

// TODO: Replace with shared coaching profile

export function scoreTeamFitMatch(fit, pokemon, state, role, facts, text) {
  const team = currentTeamPokemon(state);
  if (!team.length) return { score: 0, reason: '', primary: false };
  const coachingProfile = getMetadexTeamCoachingProfile(state);
  const concerns = Array.isArray(coachingProfile?.risks) ? coachingProfile.risks : [];
  const covers = concerns.some((risk) => {
    const typeName = risk?.type || risk?.attackingType || '';
    return typeName && (
      calculateDefensiveMultiplier(typeName, getPokemonTypesForAnswer(pokemon)) < 1
      || threatensTypeOffensively(pokemon, typeName, state)
      || hasTypeSpecificSupportIntoPressure(pokemon, typeName, state)
    );
  });
  const worsens = concerns.some((risk) => {
    const typeName = risk?.type || risk?.attackingType || '';
    return typeName && calculateDefensiveMultiplier(typeName, getPokemonTypesForAnswer(pokemon)) > 1;
  });
  const missingSupportText = JSON.stringify(coachingProfile?.recommendations || []).toLowerCase();
  const teamNeedsSpeed = /speed control|tailwind|icy wind|trick room|thunder wave|turn order/.test(missingSupportText) || coachingProfile?.speedProfile?.mode === 'none';
  const teamNeedsBackbone = /defensive|switch-in|pivot|pressure/.test(missingSupportText) || !coachingProfile?.defensiveProfile?.switchIns?.length;
  const teamNeedsUtility = /fake out|taunt|encore|snarl|parting shot|disruption|protect/.test(missingSupportText);
  const hasSpeed = roleHasPracticalRole(role, 'speed-control');
  const hasSupport = roleHasPracticalRole(role, 'support');
  const hasDamage = roleHasPracticalRole(role, 'attacker') || roleHasPracticalRole(role, 'setup') || facts.atk >= 105 || facts.spa >= 105;
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const map = {
    good: [covers || hasSpeed || hasSupport || hasDamage || bulky, 62, 'Fits current team: adds a role, matchup patch, or pressure line requested by the shared team profile.'],
    weakness: [covers, 78, 'Covers current weakness: helps into a risk identified by the shared team profile.'],
    role: [(teamNeedsSpeed && hasSpeed) || (teamNeedsBackbone && bulky) || (teamNeedsUtility && hasSupport) || hasDamage, 64, 'Adds missing role: matches a support or pressure need from the shared team profile.'],
    speed: [hasSpeed && teamNeedsSpeed, 72, 'Adds speed control: helps the current team manage move order.'],
    backbone: [bulky && teamNeedsBackbone, 70, 'Adds defensive backbone: gives the current team a steadier switch or board presence.'],
    pressure: [hasDamage, 70, 'Adds offensive pressure: can improve knockout threat or force respect.'],
    utility: [hasSupport && (teamNeedsUtility || teamNeedsBackbone), 68, 'Adds support utility: brings disruption, protection, or safe-turn tools.'],
    worsen: [worsens, 60, 'May worsen a current shared-profile risk: review this carefully before choosing it.']
  };
  const [ok, score, reason] = map[fit] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 70 };
}


// RAW CALCULATION / CANDIDATE COMPARISON: scores a candidate against the selected archetype filter.
// Kept local to MetaDex so the page can sort/filter candidates without requiring page-level coaching state.

export function scoreArchetypeMatch(archetype, pokemon, role, facts, text) {
  const has = (...terms) => facts.hasMove(...terms) || terms.some((term) => text.includes(term));
  const offensive = roleHasPracticalRole(role, 'attacker') || roleHasPracticalRole(role, 'setup') || facts.atk >= 105 || facts.spa >= 105;
  const bulky = roleHasPracticalRole(role, 'bulky') || facts.isBulky;
  const support = roleHasPracticalRole(role, 'support');
  const speed = roleHasPracticalRole(role, 'speed-control') || has('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb');
  const weather = has('drizzle', 'drought', 'snow warning', 'sand stream', 'rain dance', 'sunny day', 'snowscape', 'sandstorm', 'aurora veil') || role.key === 'weather';
  const setup = facts.setupMoves.length || roleHasPracticalRole(role, 'setup') || has('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up');
  const pivot = has('u-turn', 'volt switch', 'parting shot', 'flip turn', 'baton pass') || support;

  const snow = has('snow warning', 'snowscape', 'aurora veil', 'blizzard') || /snow|hail|aurora veil/.test(text);
  const rain = has('drizzle', 'rain dance', 'swift swim', 'water spout', 'thunder') || /rain|swift swim/.test(text);
  const sun = has('drought', 'sunny day', 'chlorophyll', 'solar power', 'solar beam') || /sun|drought|chlorophyll|solar power/.test(text);
  const sand = has('sand stream', 'sandstorm', 'sand rush', 'sand force') || /sand|sand rush|sand force/.test(text);

  const cases = {
    balanced: [(offensive && (support || bulky || speed)) || (bulky && support), 70, 'Balanced Offense: contributes pressure while still adding support, speed, or defensive value.'],
    hyper: [offensive && (facts.isFast || setup || speed), 76, 'Hyper Offense: gives fast pressure, setup pressure, or speed support for aggressive teams.'],
    bulkyoffense: [offensive && bulky, 76, 'Bulky Offense: combines damage threat with enough bulk to trade hits.'],
    balance: [bulky || support || pivot || speed, 68, 'Balance: adds stable utility, positioning, speed control, or defensive value.'],
    trickroom: [has('trick room') || (!facts.isFast && (offensive || bulky || support)), 72, 'Trick Room: can set Trick Room or make better use of slower board states.'],
    tailwind: [has('tailwind') || (speed && offensive) || (facts.isFast && offensive), 72, 'Tailwind Offense: benefits from or enables faster offensive turns.'],
    weather: [weather, 74, 'Weather: can set, abuse, or support a weather-based plan.'],
    setup: [setup || (offensive && support), 72, 'Setup Offense: can threaten setup or help create safer setup turns.'],
    snow: [snow, 76, 'Snow: supports Snow, Aurora Veil, Blizzard pressure, or Ice-based weather plans.'],
    rain: [rain, 76, 'Rain: supports rain setting, rain abuse, or rain-enhanced pressure.'],
    sun: [sun, 76, 'Sun: supports sun setting, sun abuse, or sun-enhanced pressure.'],
    sand: [sand, 76, 'Sand: supports sand setting, sand abuse, or sand-based pressure.'],
    momentum: [pivot || speed || has('fake out', 'taunt', 'encore', 'snarl', 'parting shot'), 70, 'Momentum Balance: helps reposition, disrupt, or create safer turns.']
  };

  const [ok, score, reason] = cases[archetype] || [false, 0, ''];
  return { score: ok ? score : 0, reason, primary: ok && score >= 72 };
}
