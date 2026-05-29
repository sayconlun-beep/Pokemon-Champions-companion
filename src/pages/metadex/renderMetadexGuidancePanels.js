import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { getMetadexTeamCoachingProfile } from './metadexCache.js';
import { SHOW_METADEX_ROLE_DEBUG } from './metadexConstants.js';
import { buildPartnerGuideLines, inferBeginnerRole, pokemonFactProfile, roleConfidenceLabel, roleHasPracticalRole } from './metadexRoleAnalysis.js';
import { dedupeLines, escapeAttr, escapeText, flattenContent, legalAbilities, legalMoves, legalOptions, normalize, option } from './metadexText.js';
import { chooseBeginnerAbility, suggestedItemGroups, suggestedMoveGroups } from './renderMetadexBuildOptions.js';

export function metadexGuidedBuilderActions(pokemon, state) {
  const displayName = getPokemonDisplayName(pokemon);
  return `<article class="mini-card metadex-info-card metadex-builder-actions-panel">
    <h3>Add ${escapeText(displayName)} to your team</h3>
    <p class="muted small-copy">Adds this Pokémon to the next empty Team Builder slot, then returns you to Team Builder. It will not auto-fill items, abilities, moves, nature, or stats.</p>
    <button type="button" class="coach-nav-button compact metadex-builder-action-primary" data-action="metadex-add-to-team" data-pokemon-id="${escapeAttr(pokemon.pokemon_id)}">Add to team</button>
  </article>`;
}

export function quickBuildSummaryPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const fits = inferGuidedCoachFits(pokemon, identity, state);
  const itemGroups = suggestedItemGroups(pokemon, role);
  const ability = chooseBeginnerAbility(legalAbilities(pokemon, state), role);
  const moveGroups = suggestedMoveGroups(pokemon, state, role);
  const mainItem = itemGroups[0]?.values?.[0] || itemGroups[0]?.label || 'Choose by role';
  const moveFocus = moveGroups[0]?.label || (role.key === 'attacker' ? 'Reliable damage' : 'Role support');
  const coachStep = fits[0]?.tag || 'Flexible Pick';
  const chips = [
    ['Primary role', role.primaryRole || role.label],
    ['Secondary roles', (role.secondaryRoles || []).join(' / ') || 'None clear'],
    ['Flexible tech', (role.flexibleTech || []).slice(0, 3).join(', ') || 'None highlighted'],
    ['Best guide step', coachStep],
    ['Main item category', mainItem],
    ['Preferred ability', ability || 'Choose by matchup'],
    ['Main move focus', moveFocus],
    ['Role confidence', roleConfidenceLabel(role, pokemon, state)]
  ];

  return `<article class="mini-card metadex-info-card metadex-quick-build-summary">
    <h3>Quick Build Summary</h3>
    <div class="metadex-summary-chip-grid">
      ${chips.map(([label, value]) => `<div class="metadex-summary-chip"><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`).join('')}
    </div>
    ${role.notRecommendedRoles?.length ? `<p class="muted small-copy"><strong>Not recommended as:</strong> ${escapeText(role.notRecommendedRoles.join(', '))}</p>` : ''}
    ${role.roleReason ? `<p class="muted small-copy">Role reason: ${escapeText(role.roleReason)}</p>` : ''}
    ${SHOW_METADEX_ROLE_DEBUG && role.reason && role.reason !== role.roleReason ? `<p class="muted small-copy">Debug role reason: ${escapeText(role.reason)}</p>` : ''}
    ${speedControlEducationLink(pokemon, role, state)}
  </article>`;
}

export function speedControlEducationLink(pokemon = {}, role = {}, state = {}) {
  const moves = legalMoves(pokemon, state).map((move) => normalize(move?.name || move?.move_id || move || ''));
  const speedControlMoves = ['tailwind', 'icy wind', 'electroweb', 'trick room', 'fake out', 'thunder wave', 'nuzzle', 'scary face', 'quash', 'after you', 'aqua jet', 'sucker punch', 'extreme speed', 'quick attack', 'bullet punch', 'mach punch', 'shadow sneak', 'vacuum wave', 'grassy glide'];
  const hasSpeedTool = moves.some((move) => speedControlMoves.some((term) => move.includes(term))) || roleHasPracticalRole(role, 'speed-control') || (role.flexibleTech || []).some((tech) => /speed|tailwind|trick room|priority|fake out|paralysis/i.test(String(tech)));
  if (!hasSpeedTool) return '';
  return `<p class="muted small-copy metadex-education-link"><a class="team-guide-inline-link" href="/learning-hub?article=speed-control" data-route="learning-hub" data-learning-article="speed-control">New to Speed Control? Read the guide.</a></p>`;
}

export function teamValuePanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Damage pressure that can force opponents to respect attacks or setup turns.');
  if (role.key === 'bulky') lines.push('A steadier defensive switch-in or longer-field presence.');
  if (facts.speedMoves.length) lines.push(`Speed control through ${facts.speedMoves.slice(0, 2).join(' or ')}.`);
  if (facts.supportMoves.length) lines.push(`Disruption or support such as ${facts.supportMoves.slice(0, 3).join(', ')}.`);
  if (facts.protectionMoves.length) lines.push(`Safer positioning with ${facts.protectionMoves[0]}.`);
  if (facts.setupMoves.length) lines.push(`A setup threat with ${facts.setupMoves.slice(0, 2).join(' or ')}.`);
  if (facts.recoveryMoves.length) lines.push(`Recovery or staying power from ${facts.recoveryMoves.slice(0, 2).join(' or ')}.`);
  if (role.key === 'weather') lines.push('Weather structure that can enable specific teammates or matchup plans.');
  if (!lines.length) lines.push('A specific typing, role, or legal move pool that may fill a team gap.');
  return `<article class="mini-card metadex-info-card"><h3>What this Pokémon gives your team</h3>${buildGuideListBlock('Team value', dedupeLines(lines).slice(0, 6))}</article>`;
}

// SHARED PROFILE DISPLAY: candidate-specific needs panel may reference cached profile.risks/teamFunctions.

export function teamNeedsPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const coachingProfile = getMetadexTeamCoachingProfile(state);
  const weaknesses = pokemonTypeWeaknesses(pokemon).slice(0, 4);
  const lines = [];
  if (role.key === 'attacker' || role.key === 'setup') lines.push('Safe turns from Fake Out, redirection, screens, speed control, or strong positioning.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Damage partners that can convert its support turns into real pressure.');
  if (role.key === 'weather') lines.push('Teammates that benefit from the same weather rather than fighting against it.');
  if (facts.isSlow && role.key !== 'bulky') lines.push('Help moving safely before it takes bad trades.');
  if (weaknesses.length) lines.push(`Protection from ${weaknesses.join(', ')} pressure.`);
  const missingFunctions = Object.entries(coachingProfile.teamFunctions || {}).filter(([, entries]) => !entries?.length).map(([key]) => key);
  if (coachingProfile.risks?.[0]) lines.push(`Current team profile is most concerned about ${coachingProfile.risks[0].type} pressure.`);
  if (missingFunctions.includes('speedControl')) lines.push('Your current team profile has no selected speed control yet, so value Pokémon that can add it.');
  if (!facts.protectionMoves.length) lines.push('Careful positioning, because the legal data does not show an obvious Protect-style option.');
  if (!lines.length) lines.push('Partners that cover its typing weaknesses and avoid duplicating the same job too often.');
  return `<article class="mini-card metadex-info-card"><h3>What this Pokémon needs from teammates</h3>${buildGuideListBlock('Support needs', dedupeLines(lines).slice(0, 6))}</article>`;
}

export function guidedCoachFitPanel(pokemon, identity, state) {
  const fits = inferGuidedCoachFits(pokemon, identity, state);
  const safeFits = fits.length ? fits : [{
    tag: 'Flexible Pick',
    explanation: 'Can be considered when its typing, moves, or role fills a gap your current team still has.'
  }];

  return `<article class="mini-card metadex-info-card metadex-guided-coach-fit-panel">
    <h3>Team Building Guide Fit</h3>
    <p class="muted small-copy">Use these tags to decide whether this Pokémon fits your current team-building step and why.</p>
    <div class="metadex-coach-fit-list">
      ${safeFits.slice(0, 5).map((fit) => `<div class="metadex-coach-fit-row"><span class="score-pill metadex-coach-fit-tag">${escapeText(fit.tag)}</span><p>${escapeText(fit.explanation)}</p></div>`).join('')}
    </div>
  </article>`;
}

// TODO: Replace with shared coaching profile

export function inferGuidedCoachFits(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const moves = legalMoves(pokemon, state).map(normalize);
  const abilities = legalAbilities(pokemon, state).map(normalize);
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const strategicText = flattenContent([
    pokemon.role,
    pokemon.roles,
    pokemon.commonBuilds,
    pokemon.strategicStrengths,
    pokemon.interactionProfiles,
    pokemon.pressureFlow,
    pokemon.strategicTriggers,
    pokemon.damageProfile,
    identity.identity,
    identity.primaryPressure
  ]).join(' ').toLowerCase();

  const hasMove = (...terms) => moves.some((move) => terms.some((term) => move.includes(term)));
  const hasAbility = (...terms) => abilities.some((ability) => terms.some((term) => ability.includes(term)));
  const mentions = (...terms) => terms.some((term) => strategicText.includes(term));
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  const bulk = (Number(stats.hp) || 0) + (Number(stats.def) || 0) + (Number(stats.spd) || 0);

  const strongDamage = atk >= 105 || spa >= 105 || mentions('damage', 'attacker', 'setup attacker', 'cleaner', 'offensive pressure', 'burst');
  const supportMoves = hasMove('fake out', 'follow me', 'rage powder', 'helping hand', 'wide guard', 'quick guard', 'taunt', 'encore', 'reflect', 'light screen', 'aurora veil', 'will-o-wisp', 'snarl', 'parting shot');
  const speedControl = hasMove('tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face') || mentions('speed control', 'tailwind', 'trick room');
  const setup = hasMove('swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up') || mentions('setup', 'boost');
  const weather = hasAbility('drizzle', 'drought', 'snow warning', 'sand stream') || hasMove('rain dance', 'sunny day', 'snowscape', 'sandstorm') || mentions('weather', 'rain', 'sun', 'snow', 'sand');
  const defensiveFit = bulk >= 265 || hasMove('recover', 'roost', 'wish', 'moonlight', 'slack off') || mentions('bulky', 'defensive', 'pivot', 'survive', 'sustain');
  const fastPressure = spe >= 95 && strongDamage;

  const fits = [];
  const addFit = (tag, explanation) => {
    if (!fits.some((fit) => fit.tag === tag)) fits.push({ tag, explanation });
  };

  if (strongDamage || setup || fastPressure) {
    addFit('Main Pokémon', setup
      ? 'Can be built around as a win condition if the team can create safe setup turns.'
      : 'Can be chosen early when you want your team to focus on its damage or cleanup pressure.');
  }

  if (supportMoves || speedControl || weather || defensiveFit || mentions('partner', 'synergy', 'support requirements')) {
    addFit('Partner', 'Can support a main Pokémon by covering weaknesses, creating safer turns, or adding useful team tools.');
  }

  if (supportMoves || role.key === 'support' || role.key === 'bulky' || defensiveFit) {
    addFit('Support', supportMoves
      ? 'Can help the team with utility moves, disruption, screens, redirection, or safer positioning.'
      : 'Can help the team by staying on the field longer and giving frailer teammates safer turns.');
  }

  if (strongDamage || role.key === 'attacker' || role.key === 'setup') {
    addFit('Damage Pressure', 'Can threaten knockouts or force the opponent to respect its attacks.');
  }

  if (defensiveFit) {
    addFit('Defensive Switch-in', 'Can give the team a safer pivot or bulkier board presence when its typing fits the matchup.');
  }

  if (pokemonTypeWeaknesses(pokemon).length) {
    addFit('Weakness Answer', 'Can be checked as a possible answer when its typing, pressure, or support tools help patch a specific matchup.');
  }

  if (speedControl || supportMoves || weather) {
    addFit('Utility / Speed Control', speedControl
      ? 'Can help control move order with speed control such as Tailwind, Icy Wind, Trick Room, or paralysis.'
      : 'Can offer useful battle control through support, disruption, weather, or protection tools.');
  }

  if (!fits.length || role.key === 'flex' || (fits.length < 2 && defensiveFit)) {
    addFit('Flexible Pick', 'Can be used when you need a specific typing, safer switch, or missing utility piece rather than pure damage.');
  }

  return fits;
}

export function buildGuideBlock(title, content) {
  return `<div class="metadex-build-guide-block"><h4>${escapeText(title)}</h4>${content}</div>`;
}

export function buildGuideListBlock(title, lines) {
  const safeLines = dedupeLines(lines.filter(Boolean)).slice(0, 4);
  const fallback = 'Use this Pokémon when its role, typing, or moves help cover a gap on your team.';
  return buildGuideBlock(title, `<ul>${(safeLines.length ? safeLines : [fallback]).map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>`);
}

// TODO: Replace with shared coaching profile

export function teamFitPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const goodPartners = buildPartnerGuideLines(pokemon, role).slice(0, 3);
  const wantsSupport = [];
  const helpsBy = [];

  if (role.key === 'attacker' || role.key === 'setup') {
    wantsSupport.push('Fake Out, redirection, screens, or speed control to create safer attacking turns.');
  }
  if (role.key === 'support' || role.key === 'speed-control') {
    wantsSupport.push('A clear damage partner that can convert the support turns into knockouts.');
  }
  if (role.key === 'weather') wantsSupport.push('Teammates that benefit from the same weather plan.');
  if (facts.isSlow && role.key !== 'bulky') wantsSupport.push('Positioning help so it is not forced to take bad trades before acting.');
  if (!wantsSupport.length) wantsSupport.push('Partners that cover its typing weaknesses and avoid overlapping the same role.');

  if (facts.speedMoves.length) helpsBy.push(`Controlling speed with ${facts.speedMoves.slice(0, 2).join(' or ')}.`);
  if (facts.supportMoves.length) helpsBy.push(`Creating better turns with ${facts.supportMoves.slice(0, 3).join(', ')}.`);
  if (role.key === 'attacker') helpsBy.push('Adding direct damage pressure so support teammates have something to enable.');
  if (role.key === 'bulky') helpsBy.push('Giving the team a steadier switch-in and longer-field presence.');
  if (!helpsBy.length) helpsBy.push('Filling a specific typing, role, or move gap in the team plan.');

  return `<article class="mini-card metadex-info-card metadex-team-fit-panel">
    <h3>Team Fit</h3>
    <div class="metadex-build-guide-grid">
      ${buildGuideListBlock('Good partners', goodPartners)}
      ${buildGuideListBlock('Wants support from', dedupeLines(wantsSupport).slice(0, 3))}
      ${buildGuideListBlock('Helps teammates by', dedupeLines(helpsBy).slice(0, 3))}
    </div>
  </article>`;
}

export function referenceOptionsPanel(legalMoveRows, abilities) {
  const moveBlock = legalOptions('Legal moves', legalMoveRows, 10, '+{count} additional legal moves');
  const abilityBlock = legalOptions('Abilities', abilities, 8, '+{count} additional abilities');
  if (!moveBlock && !abilityBlock) return '';
  return `<article class="mini-card metadex-info-card metadex-reference-panel">
    <h3>Legal Moves and Abilities</h3>
    <p class="muted small-copy">Reference data for deeper manual building. Longer lists stay collapsed so the main guide remains readable.</p>
    <div class="metadex-reference-grid">${moveBlock}${abilityBlock}</div>
  </article>`;
}

export function choiceGuidancePanel(pokemon, identity, state) {
  return `<article class="mini-card metadex-info-card metadex-choice-guidance-panel">
    <h3>Choice Guidance</h3>
    <div class="metadex-build-guide-grid metadex-choice-guidance-grid">
      ${buildGuideListBlock('Choose this Pokémon when…', chooseThisPokemonLines(pokemon, identity, state))}
      ${buildGuideListBlock('Be careful choosing this Pokémon when…', cautionChoosingPokemonLines(pokemon, identity, state))}
    </div>
  </article>`;
}

// UI RENDERER: candidate-specific selection guidance.

export function chooseThisPokemonLines(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const lines = [];

  if (role.key === 'attacker') lines.push(`Your team needs more ${facts.damageSide === 'mixed' ? 'direct damage pressure' : `${facts.damageSide} damage pressure`}.`);
  if (role.key === 'setup') lines.push(`Your team can create safe turns for ${facts.setupMoves.slice(0, 2).join(' or ') || 'setup'}.`);
  if (role.key === 'support') lines.push(`Your team needs support or disruption such as ${facts.supportMoves.slice(0, 3).join(', ') || 'utility moves'}.`);
  if (role.key === 'speed-control') lines.push(`Your team needs speed control from ${facts.speedMoves.slice(0, 3).join(', ') || 'moves that change turn order'}.`);
  if (role.key === 'weather') lines.push('Your team already wants to use the same weather plan.');
  if (role.key === 'bulky') lines.push('Your team needs a steadier switch-in or a Pokémon that can stay useful across several turns.');
  if (role.key === 'flex') lines.push('Its typing, ability, or move options fill a specific gap your current team still has.');

  if (facts.isFast && (role.key === 'attacker' || role.key === 'speed-control')) lines.push('You want a Pokémon that can act before many slower threats.');
  if (facts.recoveryMoves.length) lines.push(`You want a Pokémon that can stay on the field longer with ${facts.recoveryMoves[0]}.`);
  if (facts.protectionMoves.length) lines.push(`You want safer turns from ${facts.protectionMoves[0]} while its partner attacks or sets up.`);
  if (facts.types.length) lines.push(`Its ${facts.types.join(' / ')} typing helps your team cover an important matchup.`);

  return dedupeLines(lines).slice(0, 4);
}

// UI RENDERER: candidate-specific caution guidance.

export function cautionChoosingPokemonLines(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const facts = pokemonFactProfile(pokemon, state);
  const weaknesses = pokemonTypeWeaknesses(pokemon).slice(0, 4);
  const lines = [];
  const lowAtk = facts.atk > 0 && facts.atk < 80;
  const lowSpa = facts.spa > 0 && facts.spa < 80;
  const lowBothAttack = lowAtk && lowSpa;

  if ((role.key === 'support' || role.key === 'speed-control' || role.key === 'bulky') && lowBothAttack && !facts.setupMoves.length) {
    lines.push('Your team already lacks damage pressure, because this Pokémon is not naturally built to carry knockouts.');
  }
  if (role.key !== 'attacker' && role.key !== 'setup' && !facts.setupMoves.length) {
    lines.push('You need immediate knockout power from this slot.');
  }
  if (facts.isSlow && role.key !== 'bulky' && role.key !== 'weather') {
    lines.push('Your team cannot protect slower Pokémon or help them move safely.');
  }
  if (weaknesses.length) {
    lines.push(`Your team is already weak to common ${weaknesses.join(', ')} pressure.`);
  }
  if (role.key === 'setup') lines.push('You cannot create safe setup turns with Fake Out, redirection, screens, or speed control.');
  if (role.key === 'weather') lines.push('The rest of your team does not benefit from its weather plan.');
  if (role.key === 'support' || role.key === 'speed-control') lines.push('Your team already has several support picks and still needs a clear attacker.');
  if (!facts.protectionMoves.length) lines.push('It lacks an obvious Protect-style option in the available move data, so positioning may be less forgiving.');

  return dedupeLines(lines).slice(0, 4);
}

export function pokemonTypeWeaknesses(pokemon) {
  const types = getPokemonTypes(pokemon).map((type) => type.toLowerCase());
  if (!types.length) return [];
  const chart = {
    normal: ['Fighting'],
    fire: ['Water', 'Ground', 'Rock'],
    water: ['Electric', 'Grass'],
    electric: ['Ground'],
    grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
    ice: ['Fire', 'Fighting', 'Rock', 'Steel'],
    fighting: ['Flying', 'Psychic', 'Fairy'],
    poison: ['Ground', 'Psychic'],
    ground: ['Water', 'Grass', 'Ice'],
    flying: ['Electric', 'Ice', 'Rock'],
    psychic: ['Bug', 'Ghost', 'Dark'],
    bug: ['Fire', 'Flying', 'Rock'],
    rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
    ghost: ['Ghost', 'Dark'],
    dragon: ['Ice', 'Dragon', 'Fairy'],
    dark: ['Fighting', 'Bug', 'Fairy'],
    steel: ['Fire', 'Fighting', 'Ground'],
    fairy: ['Poison', 'Steel']
  };
  return dedupeLines(types.flatMap((type) => chart[type] || []));
}

export function getPokemonTypes(pokemon) {
  const explicit = [pokemon.type1, pokemon.type2, pokemon.type_1, pokemon.type_2, pokemon.primaryType, pokemon.secondaryType]
    .map((type) => String(type || '').trim())
    .filter(Boolean);
  const fromTyping = String(pokemon.typing || '')
    .split(/[\/,&]+/)
    .map((type) => type.trim())
    .filter(Boolean);
  return [...explicit, ...fromTyping]
    .filter((type, index, list) => list.findIndex((entry) => entry.toLowerCase() === type.toLowerCase()) === index);
}

export function articleFor(label) {
  return /^[aeiou]/i.test(String(label || '').trim()) ? 'an' : 'a';
}
