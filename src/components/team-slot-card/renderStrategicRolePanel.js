import { analyseItemClause, suggestLegalItemAlternatives } from '../../core/itemClauseEngine.js';
import { normalizeTacticalText } from '../../core/tacticalNormalization.js';
import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { getReadableAbilityName, getReadableItemName, getReadableMoveName } from '../../utils/displayNames.js';
import { escapeText, formatTeamBuilderIssue, normalizeKey } from './teamSlotCardCommon.js';

export function strategicRolePanel(slot, index, pokemon, uiState = {}, team = [], data = {}) {
  const strengths = pokemon?.strategicStrengths || {};
  const contextualRole = buildContextualStrategicRole(slot, index, pokemon, team, data);
  const coreStrengths = contextualRole.coreStrengths.length ? contextualRole.coreStrengths : compactStrategicList(strengths.coreStrengths, 3);
  const pressureTypes = buildSpecificPressureTags(slot, pokemon, data, 4);
  const fallbackBoardStates = compactStrategicList(strengths.preferredBoardStates, 3);
  const preferredBoardStates = auditThrivesWhenText(contextualRole.thrivesWhen, fallbackBoardStates, slot, index, pokemon, team, data);
  const supportRequirements = contextualRole.supportRequirements.length ? contextualRole.supportRequirements : compactStrategicList(strengths.supportRequirements, 3);
  const endgame = contextualRole.footer || firstText(strengths.endgamePatterns || strengths.conversionPatterns);
  const hasAny = coreStrengths.length || pressureTypes.length || preferredBoardStates.length || supportRequirements.length || endgame;
  const open = uiState?.strategicRoleOpen === true;
  const fullAnalysisLabel = pokemon ? `View full ${getPokemonDisplayName(pokemon)} analysis` : 'View full analysis';

  if (!hasAny) {
    return `<details class="strategic-role-panel build-editor-section" data-strategic-role-slot="${index}" ${open ? 'open' : ''}>
      <summary class="strategic-role-summary"><span class="strategic-role-title"><i aria-hidden="true">◇</i><strong>Strategic Role</strong><em>How this Pokémon contributes to the team</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
      <p class="notice strategic-role-empty">Strategic role data is sparse for this entry.</p>
    </details>`;
  }

  return `<details class="strategic-role-panel build-editor-section" data-strategic-role-slot="${index}" ${open ? 'open' : ''}>
    <summary class="strategic-role-summary"><span class="strategic-role-title"><i aria-hidden="true">◇</i><strong>Strategic Role</strong><em>How this Pokémon contributes to the team</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
    <div class="strategic-role-grid">
      ${strategicRoleBlock('✦', 'Core strengths', coreStrengths, contextualRole.coreStrengths.length ? 'text' : 'tag')}
      ${strategicRoleBlock('▣', 'Pressures', pressureTypes, 'pressure')}
      ${strategicRoleBlock('□', 'Thrives when', preferredBoardStates, 'text')}
      ${strategicRoleBlock('♔', 'Needs from team', supportRequirements, 'text')}
    </div>
    <div class="strategic-role-footer">
      ${endgame ? `<span>${escapeText(shortStrategicPhrase(endgame))}</span>` : '<span>Pick this slot for role fit, not only raw stats.</span>'}
      <button type="button" class="strategic-analysis-link" data-nav="metadex" aria-label="${escapeText(fullAnalysisLabel)}">View full analysis →</button>
    </div>
  </details>`;
}




const PRESSURE_SHAPE_MOVES = {
  spread: new Set(['Earthquake','Rock Slide','Blizzard','Heat Wave','Dazzling Gleam','Hyper Voice','Surf','Muddy Water','Discharge','Electroweb','Icy Wind','Snarl','Eruption','Water Spout','Make It Rain','Lava Plume','Sludge Wave','Razor Leaf']),
  setup: new Set(['Swords Dance','Nasty Plot','Calm Mind','Dragon Dance','Quiver Dance','Bulk Up','Iron Defense','Coil','Shell Smash','Belly Drum','Growth','Tailwind','Trick Room','Aurora Veil','Reflect','Light Screen']),
  chip: new Set(['Will-O-Wisp','Toxic','Leech Seed','Salt Cure','Sand Tomb','Fire Spin','Whirlpool','Infestation','Stealth Rock','Spikes','Toxic Spikes','Sandstorm','Hail','G-Max Wildfire']),
  switchForcing: new Set(['Roar','Whirlwind','Dragon Tail','Circle Throw','Parting Shot','Yawn','Encore','Taunt'])
};
const STAB_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

export function buildSpecificPressureTags(slot, pokemon, data = {}, limit = 4) {
  if (!slot || !pokemon) return [];
  const tags = [];
  const seen = new Set();
  const add = (label, priority = 5) => {
    const clean = String(label || '').replace(/\s+/g, ' ').trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    tags.push({ label: clean, priority });
  };
  const moves = (slot.moves || [])
    .map((moveId) => data?.indexes?.movesById?.[moveId] || null)
    .filter(Boolean);

  moves.forEach((move) => {
    const type = STAB_TYPES.includes(move.type) ? move.type : '';
    const category = String(move.category || '').toLowerCase();
    const name = move.name || move.move_name || '';
    const power = Number(move.power || 0);
    const priority = Number(move.priority || 0);
    const lower = name.toLowerCase();
    if (/last respects|rage fist|stored power|power trip|supreme overlord/.test(lower)) {
      add(`${type || 'Endgame'} (scaling)`, 1);
      return;
    }
    if (priority > 0 && type) {
      add(`${type} (priority)`, 2);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.spread.has(name) && type) {
      add(`${type} (spread)`, 2);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.setup.has(name)) {
      add(type ? `${type} (setup)` : 'setup', 3);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.chip.has(name)) {
      add(type ? `${type} (chip)` : 'chip', 3);
      return;
    }
    if (PRESSURE_SHAPE_MOVES.switchForcing.has(name)) {
      add('switch-forcing', 3);
      return;
    }
    if (category === 'status') {
      add(type ? `${type} (status)` : 'status', 4);
      return;
    }
    if (type && power > 0) add(`${type} (single-target)`, 4);
  });

  const ability = normalizeKey(slot.ability || '');
  if (/chlorophyll|swiftswim|slushrush|sandrush|unburden|protosynthesis|quarkdrive/.test(ability)) add('setup/speed-scaling', 2);
  if (/intimidate/.test(ability)) add('Attack control (status)', 3);
  if (/lightningrod|stormdrain|flashfire|sapsipper|levitate/.test(ability)) add('defensive redirection', 3);
  if (/supremeoverlord|commander|costar/.test(ability)) add('endgame (scaling)', 1);

  const typeFallbacks = pokemonTypes(pokemon).filter(Boolean);
  typeFallbacks.forEach((type) => {
    if (tags.length < 2) add(`${type} (single-target)`, 8);
  });
  return tags.sort((a, b) => a.priority - b.priority).slice(0, limit).map((entry) => entry.label);
}

export function buildTeamPressureCoverageSummary(team = [], data = {}) {
  const members = (team || []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null;
    return pokemon ? { slot, pokemon, index, name: getPokemonDisplayName(pokemon), tags: buildSpecificPressureTags(slot, pokemon, data, 4) } : null;
  }).filter(Boolean);
  if (!members.length) return '';
  const typeMap = new Map();
  const shapeMap = new Map();
  members.forEach((member) => {
    member.tags.forEach((tag) => {
      const match = tag.match(/^([A-Za-z]+) \(([^)]+)\)$/);
      if (match && STAB_TYPES.includes(match[1])) {
        const [, type, shape] = match;
        if (!typeMap.has(type)) typeMap.set(type, new Set());
        typeMap.get(type).add(member.name);
        if (!shapeMap.has(shape)) shapeMap.set(shape, new Set());
        shapeMap.get(shape).add(member.name);
      } else if (/switch-forcing|setup|scaling|priority|chip|status/i.test(tag)) {
        const shape = tag.includes('(') ? tag.replace(/^.*\(([^)]+)\).*$/, '$1') : tag;
        if (!shapeMap.has(shape)) shapeMap.set(shape, new Set());
        shapeMap.get(shape).add(member.name);
      }
    });
  });
  const coveredTypes = [...typeMap.keys()];
  const coveredText = coveredTypes.length
    ? coveredTypes.map((type) => `${type} (${[...typeMap.get(type)].slice(0, 3).join(', ')})`).join(', ')
    : 'very little confirmed attacking coverage yet';
  const shapes = [...shapeMap.entries()].map(([shape, names]) => `${shape} pressure from ${[...names].slice(0, 3).join(', ')}`).slice(0, 4).join('; ');
  const missing = STAB_TYPES.filter((type) => !typeMap.has(type));
  const gapNotes = [];
  const has = (type) => typeMap.has(type);
  if (!has('Electric') && !has('Grass')) gapNotes.push('bulky Water-types can be awkward because the team lacks clear Electric or Grass damage into them');
  if (!has('Fire') && !has('Ground') && !has('Fighting')) gapNotes.push('bulky Steel-types can sit in front of you because Fire, Ground, and Fighting are the cleanest ways to punish them');
  if (!has('Ice') && !has('Fairy') && !has('Dragon')) gapNotes.push('Dragon-types may be harder to remove quickly because you are missing the usual anti-Dragon coverage');
  if (!has('Dark') && !has('Ghost')) gapNotes.push('Psychic- and Ghost-type opponents may get more freedom because you lack Dark or Ghost pressure');
  if (!has('Rock') && !has('Electric') && !has('Ice')) gapNotes.push('Flying-types can be annoying if they resist your main damage because Rock, Electric, and Ice are the common answers');
  const gapText = gapNotes.length
    ? gapNotes.slice(0, 2).join('. ') + '.'
    : missing.length ? `No obvious major attacking gap from the selected moves, but you currently lack ${missing.slice(0, 4).join(', ')} coverage.` : 'Your selected attacks cover every major type at least once.';
  return `<section class="team-pressure-coverage-summary"><strong>Pressure coverage</strong><p>Your team currently shows ${coveredText}. ${shapes ? `The main pressure shapes are ${shapes}. ` : ''}${gapText}</p></section>`;
}

function auditThrivesWhenText(contextualValues = [], fallbackValues = [], slot, index, pokemon, team = [], data = {}) {
  const currentValues = (contextualValues || []).filter(Boolean);
  const fallback = (fallbackValues || []).filter(Boolean);
  const candidate = currentValues.length ? currentValues : fallback;
  const hasGeneric = candidate.some(isGenericThrivesWhenText);
  const tooThin = !candidate.length || candidate.every((value) => String(value).length < 46 || /^[-\w\s]+$/.test(String(value)) && String(value).split(/\s+/).length <= 5);
  if (!hasGeneric && !tooThin && currentValues.length) return currentValues.slice(0, 3);
  const specific = buildSpecificThrivesWhen(slot, index, pokemon, team, data);
  if (specific.length) return specific.slice(0, 3);
  return candidate.filter((value) => !isGenericThrivesWhenText(value)).slice(0, 3);
}

function isGenericThrivesWhenText(value) {
  const text = String(value || '').toLowerCase();
  if (!text.trim()) return true;
  return /current battle situations|main pressure is protected|positions where partner support covers immediate weaknesses|offensive neutral states|hyper offense boards|fast tempo openings|neutral positioning|partner protection|intended board states|safe board states|generic pressure|stable positioning/.test(text);
}

function buildSpecificThrivesWhen(slot, index, pokemon, team = [], data = {}) {
  if (!slot || !pokemon) return [];
  const context = buildTeamSynergyContext(team, data, index);
  const current = context.current;
  if (!current) return [];
  const name = current.name || getPokemonDisplayName(pokemon);
  const abilityKey = normalizeKey(current.ability);
  const itemKey = normalizeKey(current.item);
  const moveText = current.moves.join(' | ').toLowerCase();
  const lines = [];
  const add = (value) => { if (value && !lines.includes(value)) lines.push(value); };

  const weatherPartner = findWeatherPartnerForAbility(abilityKey, context.weatherSetters.filter((entry) => entry.index !== index));
  if (weatherPartner) {
    const setterSupport = describeWeatherSupport(weatherPartner, current, context);
    add(`Early game — lead or switch ${name} next to ${weatherPartner.name}. ${weatherPartner.name} sets ${weatherPartner.weather} automatically with ${weatherPartner.ability}, so ${setterSupport}`);
  }

  const ownWeather = context.weatherSetters.find((entry) => entry.index === index);
  if (ownWeather) {
    const beneficiaries = context.allies.filter((ally) => abilityBenefitsFromWeather(normalizeKey(ally.ability), ownWeather.weather));
    const veilUsers = [current, ...context.allies].filter((entry) => entry.moves.some((move) => /aurora veil/i.test(move)));
    if (beneficiaries.length) add(`Early game — bring ${name} in before ${listNames(beneficiaries)}. ${name}'s ${ownWeather.ability} starts ${ownWeather.weather}, which immediately turns ${listNames(beneficiaries)} into faster or safer attackers.`);
    if (veilUsers.length && ownWeather.weather === 'snow') add(`Early game — use ${name}'s snow turns to help ${listNames(veilUsers)} set Aurora Veil, cutting incoming damage while the rest of the team gets into position.`);
  }

  const tailwindUser = context.speedControl.find((entry) => entry.index !== index && /tailwind/i.test(entry.move));
  const icyWindUser = context.speedControl.find((entry) => entry.index !== index && /icy wind/i.test(entry.move));
  const trickRoomUser = context.speedControl.find((entry) => entry.index !== index && /trick room/i.test(entry.move));
  const hasFakeOut = /fake out/i.test(moveText);
  if (hasFakeOut && tailwindUser) {
    add(`Turn 1 — pair ${name} with ${tailwindUser.name}. Use Fake Out to flinch the opponent's biggest threat, which gives ${tailwindUser.name} a safer turn to set Tailwind.`);
  }
  if (tailwindUser && !hasFakeOut && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — bring ${name} in after ${tailwindUser.name} sets Tailwind. Tailwind doubles your team's Speed for a few turns, giving ${name} a cleaner window to attack before the opponent.`);
  }
  if (icyWindUser && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — ${name} likes coming in after ${icyWindUser.name} uses Icy Wind, because the opponent is slowed down and easier to outspeed.`);
  }
  if (trickRoomUser && wantsSpeedSupport(current, pokemon)) {
    add(`Mid game — use ${name} after ${trickRoomUser.name} sets Trick Room only if moving under reversed turn order helps this slot attack before faster threats.`);
  }

  const fakeOutAlly = context.fakeOut.find((entry) => entry.index !== index);
  if (fakeOutAlly && likesProtectedTurns(current, pokemon)) {
    add(`Early game — put ${name} beside ${fakeOutAlly.name}. ${fakeOutAlly.name}'s Fake Out buys one safer turn for ${name} to attack, set up, or reposition without taking full pressure.`);
  }

  if (abilityKey === 'unburden') {
    const itemPhrase = itemKey ? `once its ${current.item} is used` : 'once its held item is used';
    add(`After setup — ${name}'s Unburden doubles its Speed ${itemPhrase}, so use that speed boost to start sweeping before the opponent can respond.`);
  }

  const defensiveAbsorb = TYPE_ABSORBING_ABILITIES[abilityKey];
  if (defensiveAbsorb) {
    const protectedAllies = context.allies.filter((ally) => isWeakToType(ally.pokemon, defensiveAbsorb.type));
    if (protectedAllies.length) add(`Mid game — switch ${name} in when ${listNames(protectedAllies)} is likely to be targeted by ${defensiveAbsorb.type} attacks. ${current.ability} redirects that damage and can turn the opponent's move into free value.`);
  }
  const allyAbsorbers = context.allies.filter((ally) => TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)] && isWeakToType(pokemon, TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)].type));
  if (allyAbsorbers.length) {
    const absorber = allyAbsorbers[0];
    const absorb = TYPE_ABSORBING_ABILITIES[normalizeKey(absorber.ability)];
    add(`Mid game — keep ${absorber.name} ready to switch in when opponents aim ${absorb.type} attacks at ${name}. ${absorber.ability} absorbs that pressure so ${name} can stay useful longer.`);
  }

  const redirector = context.redirection.find((entry) => entry.index !== index);
  if (redirector && likesProtectedTurns(current, pokemon)) {
    add(`Setup turn — place ${name} beside ${redirector.name}. ${redirector.name}'s ${redirector.move} pulls attacks away, giving ${name} the breathing room to convert its main job.`);
  }

  if (/last respects/i.test(moveText)) {
    const earlyUtility = context.allies.filter((ally) => ally.moves.some((move) => /fake out|tailwind|icy wind|aurora veil|parting shot|taunt/i.test(move)) || normalizeKey(ally.ability) === 'intimidate').slice(0, 3);
    const feederText = earlyUtility.length ? `${listNames(earlyUtility)} can spend the early turns using utility, taking trades, and chipping opponents` : 'your other five Pokémon can take early trades and chip opponents';
    add(`Endgame — save ${name} until 2–3 teammates have fainted. Last Respects gets stronger each time an ally goes down, so ${feederText} before ${name} cleans up.`);
  }

  if (/misty explosion/i.test(moveText)) {
    const cleaner = context.allies.find((ally) => ally.moves.some((move) => /last respects|close combat|blizzard|shadow ball|dire claw|liquidation/i.test(move)));
    add(`Mid to late game — use Misty Explosion only when ${cleaner ? `${cleaner.name} can switch in afterwards and finish the weakened board` : 'a teammate can enter afterwards and finish the weakened board'}. The sacrifice is valuable because it creates the next attack window.`);
  }

  if (hasFakeOut && !lines.some((line) => /Late game/.test(line))) {
    add(`Late game — ${name}'s Fake Out is strongest when you need one final safe turn, either to stop a threat from moving or to let a partner finish the match.`);
  }

  if (!lines.length && context.allies.length) {
    const support = context.speedControl.find((entry) => entry.index !== index) || context.fakeOut.find((entry) => entry.index !== index) || context.intimidate.find((entry) => entry.index !== index) || context.weatherSetters.find((entry) => entry.index !== index);
    if (support) add(`Mid game — use ${name} after ${support.name} has created support for the team. That gives beginners a clear rule: let ${support.name} create the safer board first, then bring ${name} in to do its main job.`);
  }
  return lines;
}

function describeWeatherSupport(weatherPartner, current, context = {}) {
  const name = current.name;
  const abilityKey = normalizeKey(current.ability);
  const moves = current.moves.join(' | ').toLowerCase();
  const partnerMoves = weatherPartner.moves.join(' | ').toLowerCase();
  if (abilityKey === 'chlorophyll') return `${name}'s Chlorophyll doubles its Speed and turns it into a fast sun win condition.`;
  if (abilityKey === 'swiftswim') return `${name}'s Swift Swim doubles its Speed and lets it attack before most opponents in rain.`;
  if (abilityKey === 'slushrush') return `${name}'s Slush Rush doubles its Speed and lets it clean while snow is active.`;
  if (abilityKey === 'sandrush') return `${name}'s Sand Rush doubles its Speed and gives the team a fast sand mode.`;
  if (/blizzard/i.test(moves) && weatherPartner.weather === 'snow') {
    const veilNote = /aurora veil/i.test(moves) || /aurora veil/i.test(partnerMoves) ? ' Aurora Veil also cuts incoming damage, giving the team a safer opening.' : '';
    return `${name}'s Blizzard becomes 100% accurate in snow.${veilNote}`;
  }
  if (weatherPartner.weather === 'snow' && abilityKey === 'snowcloak') return `${name}'s Snow Cloak is active and its Ice pressure is easier to support while snow is up.`;
  return `${name}'s weather-based ability is active immediately instead of being only conditional.`;
}

function buildContextualStrategicRole(slot, index, pokemon, team = [], data = {}) {
  if (!slot || !pokemon) return { coreStrengths: [], pressures: [], thrivesWhen: [], supportRequirements: [], footer: '' };
  const context = buildTeamSynergyContext(team, data, index);
  const current = context.current;
  const allies = context.allies;
  const name = current?.name || getPokemonDisplayName(pokemon);
  const ability = current?.ability || '';
  const moves = current?.moves || [];
  const moveText = moves.join(' | ').toLowerCase();
  const abilityKey = normalizeKey(ability);
  const coreStrengths = [];
  const pressures = [];
  const thrivesWhen = [];
  const supportRequirements = [];
  const footerNotes = [];
  const add = (target, value) => { if (value && !target.includes(value)) target.push(value); };
  const weatherPartner = findWeatherPartnerForAbility(abilityKey, context.weatherSetters);

  if (weatherPartner) {
    add(coreStrengths, `${name}'s ${ability} ability becomes active because ${weatherPartner.name} sets ${weatherPartner.weather} automatically with ${weatherPartner.ability}.`);
    if (abilityKey === 'chlorophyll') add(pressures, `${name}'s Speed doubles in sun, so ${weatherPartner.name} turns it from a conditional threat into an immediate fast attacker.`);
    else if (abilityKey === 'swiftswim') add(pressures, `${name}'s Speed doubles in rain, letting it pressure opponents before most neutral-speed attackers can move.`);
    else if (abilityKey === 'slushrush') add(pressures, `${name}'s Speed doubles in snow, making it a primary cleaner while ${weatherPartner.name}'s weather is active.`);
    else if (abilityKey === 'sandrush') add(pressures, `${name}'s Speed doubles in sand, giving the team a fast offensive mode instead of a purely defensive weather plan.`);
    else add(pressures, `${name} gains its weather-based value immediately when ${weatherPartner.name} is on the field.`);
    add(thrivesWhen, `Lead or pivot ${name} next to ${weatherPartner.name} when you want the weather mode online straight away.`);
  }

  const weatherSetter = context.weatherSetters.find((entry) => entry.index === index);
  if (weatherSetter) {
    const beneficiaries = allies.filter((ally) => abilityBenefitsFromWeather(normalizeKey(ally.ability), weatherSetter.weather));
    if (beneficiaries.length) {
      add(coreStrengths, `${name} sets ${weatherSetter.weather} automatically with ${weatherSetter.ability}, activating ${listNames(beneficiaries)} without spending a turn.`);
      add(pressures, `Your ${weatherSetter.weather} mode makes ${listNames(beneficiaries)} much harder to outspeed or trade with.`);
      add(thrivesWhen, `${name} gets the most value when it enters before ${listNames(beneficiaries)}, so the boosted partner can attack immediately.`);
    }
  }

  const defensiveAbsorb = TYPE_ABSORBING_ABILITIES[abilityKey];
  if (defensiveAbsorb) {
    const protectedAllies = allies.filter((ally) => isWeakToType(ally.pokemon, defensiveAbsorb.type));
    if (protectedAllies.length) {
      add(coreStrengths, `${name}'s ${ability} draws in ${defensiveAbsorb.type} attacks aimed at the team and turns a weakness into an advantage.`);
      add(pressures, `This is especially important for protecting ${listNames(protectedAllies)}, which dislike taking ${defensiveAbsorb.type} damage.`);
      const boostText = defensiveAbsorb.boost ? ` and can give ${name} ${defensiveAbsorb.boost}` : '';
      add(thrivesWhen, `Switch ${name} in when you expect ${defensiveAbsorb.type} coverage${boostText}.`);
    }
  }

  const allyAbsorbers = allies.filter((ally) => TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)] && isWeakToType(pokemon, TYPE_ABSORBING_ABILITIES[normalizeKey(ally.ability)].type));
  if (allyAbsorbers.length) {
    const absorber = allyAbsorbers[0];
    const absorb = TYPE_ABSORBING_ABILITIES[normalizeKey(absorber.ability)];
    add(coreStrengths, `${name} can play more aggressively because ${absorber.name}'s ${absorber.ability} protects it from ${absorb.type} attacks.`);
    add(thrivesWhen, `Keep ${absorber.name} available as a pivot when opponents are likely to target ${name}'s ${absorb.type} weakness.`);
  }

  if (context.speedControl.length) {
    const relevant = context.speedControl.filter((entry) => entry.index !== index);
    if (relevant.length && wantsSpeedSupport(current, pokemon)) {
      add(coreStrengths, `${name} benefits from team speed control from ${listNames(relevant)}, giving it safer attack windows.`);
      add(thrivesWhen, `Bring ${name} in after ${relevant[0].move} has slowed or reversed the board so it can move before key threats.`);
    }
  }

  if (context.fakeOut.length && !context.fakeOut.some((entry) => entry.index === index)) {
    const fakeOutUser = context.fakeOut[0];
    if (likesProtectedTurns(current, pokemon)) {
      add(coreStrengths, `${fakeOutUser.name}'s Fake Out can buy ${name} a safe first turn to attack, set up, or reposition.`);
      add(thrivesWhen, `${name} is strongest beside ${fakeOutUser.name} on turns where Fake Out stops the opponent's most dangerous action.`);
    }
  } else if (context.fakeOut.some((entry) => entry.index === index)) {
    const setupPartners = allies.filter((ally) => likesProtectedTurns(ally, ally.pokemon)).slice(0, 2);
    if (setupPartners.length) {
      add(coreStrengths, `${name}'s Fake Out creates a free turn for ${listNames(setupPartners)} to set up or take a safer attack.`);
      add(pressures, `Opponents have to respect Fake Out before they can freely target ${listNames(setupPartners)}.`);
    }
  }

  if (context.redirection.length && !context.redirection.some((entry) => entry.index === index) && likesProtectedTurns(current, pokemon)) {
    const redirector = context.redirection[0];
    add(coreStrengths, `${redirector.name}'s ${redirector.move} can pull attacks away from ${name}, giving it a cleaner turn to convert pressure.`);
    add(thrivesWhen, `Position ${name} beside ${redirector.name} when you need to protect a setup, weather, or cleanup turn.`);
  }

  if (context.intimidate.length) {
    if (context.intimidate.some((entry) => entry.index === index)) {
      const physicalPartners = allies.filter((ally) => isPhysicallyVulnerable(ally.pokemon)).slice(0, 2);
      add(coreStrengths, `${name}'s Intimidate lowers opposing Attack as soon as it enters, making trades safer for the whole team.`);
      if (physicalPartners.length) add(pressures, `That Attack drop helps ${listNames(physicalPartners)} survive physical pressure long enough to do their job.`);
    } else if (isPhysicallyVulnerable(pokemon)) {
      const intimidator = context.intimidate[0];
      add(thrivesWhen, `${name} appreciates ${intimidator.name}'s Intimidate support because it softens physical threats before they can force a KO.`);
    }
  }

  if (/last respects/i.test(moveText)) {
    add(coreStrengths, `${name}'s Last Respects gets stronger every time one of your teammates faints.`);
    add(pressures, `This makes ${name} a late-game finisher rather than an early damage dealer; every traded support Pokémon feeds its cleanup damage.`);
    add(thrivesWhen, `Bring ${name} in once 2–3 teammates are down so Last Respects can threaten a massive cleanup.`);
    add(supportRequirements, `Let utility partners chip, Fake Out, set weather, or control speed early instead of preserving them at all costs.`);
    footerNotes.push('Scaling win condition: teammate KOs increase cleanup power.');
  }

  if (/misty explosion/i.test(moveText)) {
    add(coreStrengths, `${name} can use Misty Explosion as a sacrificial momentum tool, trading itself to open a safer board for the next damage dealer.`);
    add(pressures, `Plan the follow-up slot before using Misty Explosion so the team converts the sacrifice instead of only taking chip damage.`);
    add(thrivesWhen, `${name} thrives when a teammate is ready to enter immediately after the sacrifice and take over the endgame.`);
    footerNotes.push('Sacrificial setup: value comes from the teammate that enters next.');
  }

  const scalingAlly = allies.find((ally) => ally.moves.some((move) => /last respects/i.test(move)) || /supremeoverlord|commander|costar/.test(normalizeKey(ally.ability)));
  if (scalingAlly && !/last respects/i.test(moveText)) {
    add(coreStrengths, `${name}'s early job can be to create chip, tempo, or trades that feed ${scalingAlly.name}'s scaling win condition.`);
    add(thrivesWhen, `Do not over-preserve ${name} if trading it helps ${scalingAlly.name} enter later with stronger cleanup pressure.`);
  }

  return {
    coreStrengths: coreStrengths.slice(0, 3),
    pressures: pressures.slice(0, 3),
    thrivesWhen: thrivesWhen.slice(0, 3),
    supportRequirements: supportRequirements.slice(0, 2),
    footer: footerNotes[0] || ''
  };
}

const WEATHER_SETTER_ABILITIES = {
  drought: 'sun',
  drizzle: 'rain',
  snowwarning: 'snow',
  sandstream: 'sand'
};

const TYPE_ABSORBING_ABILITIES = {
  lightningrod: { type: 'Electric', boost: 'a Special Attack boost' },
  stormdrain: { type: 'Water', boost: 'a Special Attack boost' },
  flashfire: { type: 'Fire', boost: 'stronger Fire attacks' },
  levitate: { type: 'Ground', boost: '' },
  sapsipper: { type: 'Grass', boost: 'an Attack boost' }
};

const TYPE_WEAKNESSES = {
  Normal: ['Fighting'], Fire: ['Water', 'Ground', 'Rock'], Water: ['Electric', 'Grass'], Electric: ['Ground'], Grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'], Ice: ['Fire', 'Fighting', 'Rock', 'Steel'], Fighting: ['Flying', 'Psychic', 'Fairy'], Poison: ['Ground', 'Psychic'], Ground: ['Water', 'Grass', 'Ice'], Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'], Bug: ['Fire', 'Flying', 'Rock'], Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'], Ghost: ['Ghost', 'Dark'], Dragon: ['Ice', 'Dragon', 'Fairy'], Dark: ['Fighting', 'Bug', 'Fairy'], Steel: ['Fire', 'Fighting', 'Ground'], Fairy: ['Poison', 'Steel']
};

function buildTeamSynergyContext(team = [], data = {}, currentIndex = 0) {
  const slots = (team || []).map((teamSlot, slotIndex) => buildSlotSynergyProfile(teamSlot, slotIndex, data)).filter(Boolean);
  const current = slots.find((entry) => entry.index === currentIndex) || null;
  const allies = slots.filter((entry) => entry.index !== currentIndex);
  return {
    slots,
    current,
    allies,
    weatherSetters: slots.filter((entry) => WEATHER_SETTER_ABILITIES[normalizeKey(entry.ability)]).map((entry) => ({ ...entry, weather: WEATHER_SETTER_ABILITIES[normalizeKey(entry.ability)] })),
    speedControl: slots.flatMap((entry) => entry.moves.filter((move) => /tailwind|trick room|icy wind/i.test(move)).map((move) => ({ ...entry, move }))),
    intimidate: slots.filter((entry) => normalizeKey(entry.ability) === 'intimidate'),
    redirection: slots.flatMap((entry) => entry.moves.filter((move) => /follow me|rage powder/i.test(move)).map((move) => ({ ...entry, move }))),
    fakeOut: slots.flatMap((entry) => entry.moves.filter((move) => /fake out/i.test(move)).map((move) => ({ ...entry, move })))
  };
}

function buildSlotSynergyProfile(teamSlot, index, data = {}) {
  if (!teamSlot?.pokemon_id) return null;
  const pokemon = data.indexes?.pokemonById?.[teamSlot.pokemon_id];
  if (!pokemon) return null;
  const ability = teamSlot.ability_id ? getReadableAbilityName(data.indexes?.abilitiesById?.[teamSlot.ability_id] || teamSlot.ability_id, '') : '';
  const moves = (teamSlot.moves || []).map((moveId) => getReadableMoveName(data.indexes?.movesById?.[moveId] || moveId, '')).filter(Boolean);
  const item = teamSlot.item_id ? getReadableItemName(data.indexes?.itemsById?.[teamSlot.item_id] || teamSlot.item_id, '') : '';
  return { index, slot: teamSlot, pokemon, name: getPokemonDisplayName(pokemon), ability, moves, item };
}


function findWeatherPartnerForAbility(abilityKey, weatherSetters = []) {
  const requiredWeather = { chlorophyll: 'sun', solarpower: 'sun', harvest: 'sun', swiftswim: 'rain', raindish: 'rain', dryskin: 'rain', slushrush: 'snow', snowcloak: 'snow', icebody: 'snow', sandrush: 'sand', sandforce: 'sand', sandveil: 'sand' }[abilityKey];
  return requiredWeather ? weatherSetters.find((setter) => setter.weather === requiredWeather) : null;
}

function abilityBenefitsFromWeather(abilityKey, weather) {
  const partner = findWeatherPartnerForAbility(abilityKey, [{ weather }]);
  return Boolean(partner);
}

function pokemonTypes(pokemon) {
  return [pokemon?.type_1, pokemon?.type_2, ...(pokemon?.types || []), ...String(pokemon?.typing || '').split(/[\/,]/)].map((type) => String(type || '').trim()).filter(Boolean).map((type) => type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
}

function isWeakToType(pokemon, attackType) {
  const target = String(attackType || '').toLowerCase();
  return pokemonTypes(pokemon).some((type) => (TYPE_WEAKNESSES[type] || []).some((weakness) => weakness.toLowerCase() === target));
}

function wantsSpeedSupport(profile, pokemon) {
  const text = `${profile?.moves?.join(' ') || ''} ${JSON.stringify(pokemon?.strategicStrengths || {})}`.toLowerCase();
  return /clean|pressure|setup|last respects|blizzard|eruption|water spout|speed|outspeed|tailwind|trick room/.test(text);
}

function likesProtectedTurns(profile, pokemon) {
  const text = `${profile?.moves?.join(' ') || ''} ${profile?.ability || ''} ${JSON.stringify(pokemon?.strategicStrengths || {})}`.toLowerCase();
  return /swords dance|nasty plot|dragon dance|calm mind|quiver dance|shell smash|belly drum|last respects|trick room|tailwind|weather|clean|setup|protect/.test(text);
}

function isPhysicallyVulnerable(pokemon) {
  const text = JSON.stringify(pokemon?.strategicStrengths || {}).toLowerCase();
  return /physical|contact|intimidate|bulk|survive|chip|priority/.test(text) || pokemonTypes(pokemon).some((type) => ['Ice', 'Rock', 'Dark', 'Normal'].includes(type));
}

function listNames(entries = []) {
  const names = entries.map((entry) => entry.name).filter(Boolean);
  if (names.length <= 1) return names[0] || 'that partner';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function strategicRoleBlock(icon, title, values, mode = 'text') {
  if (!values.length) return '';
  const body = mode === 'tag' || mode === 'pressure'
    ? `<div class="strategic-role-tags ${mode === 'pressure' ? 'pressure-tags' : ''}">${values.map((value) => `<span>${escapeText(value)}</span>`).join('')}</div>`
    : `<p>${values.map(escapeText).join(' · ')}</p>`;
  return `<section class="strategic-role-block ${mode}"><h5><span aria-hidden="true">${icon}</span>${escapeText(title)}</h5>${body}</section>`;
}

function compactStrategicList(value, limit = 3) {
  const source = Array.isArray(value) ? value : value ? Object.values(value) : [];
  return source.map(firstText).map(shortStrategicPhrase).filter(Boolean).slice(0, limit);
}

function shortStrategicPhrase(value) {
  return normalizeTeamSlotSidebarText(String(value || ''))
    .replace(/\bwith a weather-setting partner\b/gi, 'with weather support')
    .replace(/\bOpponent forced to respect\b/gi, 'respect')
    .replace(/\bPartners that\b/gi, 'partners to')
    .replace(/\.$/, '')
    .trim();
}

export function currentBuildSummary(slot, index, data, pokemon) {
  const item = slot?.item_id ? data.indexes.itemsById?.[slot.item_id] : null;
  const ability = slot?.ability_id ? data.indexes.abilitiesById?.[slot.ability_id] : null;
  const moves = [0, 1, 2, 3].map((moveIndex) => {
    const move = slot?.moves?.[moveIndex] ? data.indexes.movesById?.[slot.moves[moveIndex]] : null;
    return move?.name || '—';
  });
  return `<section class="current-build-summary build-editor-section compact-build-overview">
    <div class="build-section-head"><h4>Build Overview</h4><span>Selected set</span></div>
    <div class="compact-build-grid overview-only">
      <div class="compact-build-copy">
        <p class="current-build-title"><strong>${escapeText(getPokemonDisplayName(pokemon))}</strong> <span>@ ${escapeText(item ? getReadableItemName(item, 'No item') : 'No item')}</span></p>
        <div class="current-build-grid">
          <span><strong>Ability:</strong> ${escapeText(ability?.name || '—')}</span>
          <span><strong>Nature:</strong> ${escapeText(slot?.nature || '—')}</span>
          <span class="moves-line"><strong>Moves:</strong> ${moves.map(escapeText).join(' / ')}</span>
        </div>
      </div>
    </div>
  </section>`;
}

function buildIssueChips(legality) {
  const issues = [...(legality?.warnings || []), ...(legality?.missing || [])].map(formatTeamBuilderIssue).filter(Boolean).slice(0, 8);
  if (!issues.length) return '';
  return `<section class="build-issue-chips" aria-label="Build issues"><strong>Build Issues</strong><div>${issues.map((issue) => `<span class="badge warning-badge compact-warning">${escapeText(issue)}</span>`).join('')}</div></section>`;
}

export function itemConflictPanel(slot, index, data, team) {
  if (!slot?.item_id) return '';
  const clause = analyseItemClause(team, data);
  const conflict = clause.duplicates.find((entry) => entry.itemId === slot.item_id && entry.slots.includes(index));
  if (!conflict) return '';
  const alternatives = suggestLegalItemAlternatives(slot.item_id, team, data, index, 4);
  return `<div class="item-clause-panel"><strong>Duplicate item indicator</strong><p class="warning">${escapeText(conflict.itemName)} is already used by ${conflict.pokemonNames.filter((_, i) => conflict.slots[i] !== index).map(escapeText).join(', ')}.</p>${alternatives.length ? `<p class="muted small-copy">Legal alternatives: ${alternatives.map((item) => escapeText(item.name || item.item_id)).join(', ')}</p>` : '<p class="muted small-copy">No unused legal alternative found in the current item data.</p>'}</div>`;
}

function chainPreview(pokemon) {
  const lines = [];
  pushFrom(lines, pokemon?.strategicStrengths?.conversionPatterns, 'Gameplan');
  pushFrom(lines, pokemon?.pressureFlow?.openingPressure || pokemon?.pressureFlow?.earlyGamePressure, 'Opening');
  pushFrom(lines, pokemon?.preferredBoardStates?.preferredBoards || pokemon?.strategicStrengths?.preferredBoardStates, 'Board');
  pushFrom(lines, pokemon?.failureChains, 'Risk');
  if (!lines.length) return '<p class="notice">Strategic chain data is sparse for this entry.</p>';
  return `<h4>Tactical notes</h4><ul>${lines.slice(0, 4).map((line) => `<li>${escapeText(normalizeTeamSlotSidebarText(line))}</li>`).join('')}</ul>`;
}

function pushFrom(lines, value, label) {
  const text = firstText(value);
  if (text) lines.push(normalizeTeamSlotSidebarText(`${label}: ${text}`));
}

function normalizeTeamSlotSidebarText(value) {
  return normalizeTacticalText(value, { diversify: false })
    .replace(/\bCollapse cue\b/gi, 'Risk point')
    .replace(/\bdisruption trigger windows\b/gi, 'disruption timing')
    .replace(/\bdisruption trigger window\b/gi, 'disruption timing')
    .trim();
}

function firstText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(firstText).find(Boolean) || '';
  if (typeof value === 'object') return Object.values(value).map(firstText).find(Boolean) || '';
  return String(value);
}