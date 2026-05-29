import { getReadablePokemonName, getReadableAbilityName, getReadableItemName, getReadableMoveName } from '../utils/displayNames.js';
import { getSlotMegaState, analyseTeamMegaState, isMegaStoneItem, isMegaPokemon } from './megaEvolutionEngine.js';
import { analyseItemClause } from './itemClauseEngine.js';
import { getSlotStatAllocation, validateStatAllocation } from './statAllocationEngine.js';

export function checkPokemonLegality(pokemon, data) {
  if (!pokemon) return { allowed: false, reason: 'No Pokémon selected.' };
  const unavailable = pokemon.unavailable || pokemon.is_unavailable || pokemon.legal === false || String(pokemon.champions_legal || 'Yes').toLowerCase() === 'no';
  if (unavailable) return { allowed: false, reason: 'Unavailable in the active rules data.' };
  const ruleRows = data.collections.rulesets || [];
  const matchingRule = ruleRows.find((row) => row.pokemon_id === pokemon.pokemon_id || row.species_id === pokemon.pokemon_id);
  if (matchingRule && (matchingRule.banned || matchingRule.allowed === false || String(matchingRule.is_legal || 'Yes').toLowerCase() === 'no')) {
    return { allowed: false, reason: matchingRule.reason || 'Blocked by active rules data.' };
  }
  return { allowed: true, reason: 'Allowed by current data.' };
}

export function checkSlotLegality(slot, data, team = null, slotIndex = -1) {
  const warnings = [];
  const missing = [];
  if (!slot?.pokemon_id) return { allowed: true, warnings, missing };
  const pokemon = data.indexes.pokemonById[slot.pokemon_id];
  const base = checkPokemonLegality(pokemon, data);
  if (!base.allowed) warnings.push(base.reason);

  // User database is the source of truth for build legality.
  // If a move exists in the move catalogue, treat it as legal.
  // Missing per-Pokémon learnset rows or `Needs Review` flags should not make a team illegal.
  for (const moveId of slot.moves || []) {
    if (!moveId) continue;
    if (data.indexes.movesById?.[moveId]) continue;
    warnings.push(`Unknown move selected: ${slotMoveLabel(moveId, data)}`);
  }

  // Same rule for abilities: anything present in the ability catalogue is selectable/legal.
  // This prevents valid form abilities such as Snow Warning being blocked by incomplete
  // per-form ability mapping or review metadata.
  if (slot.ability_id && !data.indexes.abilitiesById?.[slot.ability_id]) {
    warnings.push(`Unknown ability selected: ${slotAbilityLabel(slot.ability_id, data)}`);
  }

  const item = slot.item_id ? data.indexes.itemsById[slot.item_id] : null;
  if (slot.item_id && !item) warnings.push(`Unknown item selected: ${getReadableItemName(slot.item_id, slot.item_id)}`);

  const megaState = getSlotMegaState(slot, data);
  for (const warning of megaState.warnings || []) warnings.push(warning);

  if (team && slot?.item_id) {
    const itemClause = analyseItemClause(team, data);
    const duplicate = itemClause.duplicates.find((entry) => entry.itemId === slot.item_id && entry.slots.includes(slotIndex));
    if (duplicate) warnings.push(`Item Clause conflict: ${duplicate.itemName} is also held by ${duplicate.pokemonNames.filter((_, i) => duplicate.slots[i] !== slotIndex).join(' and ')}.`);
  }

  const required = ['strategicStrengths', 'interactionProfiles', 'pressureFlow', 'strategicTriggers', 'replayBehaviourEvidence', 'failureChains', 'preferredBoardStates', 'advancedResourceEconomy', 'damageBenchmarks'];
  for (const field of required) {
    if (isEmpty(pokemon?.[field])) missing.push(`Missing ${field} coverage.`);
  }

  const statValidation = validateStatAllocation(slot.statAllocation || slot.skillPoints || {});
  warnings.push(...statValidation.errors);

  return { allowed: warnings.length === 0, warnings, missing };
}

export function checkTeamLegality(team, data) {
  const itemClause = analyseItemClause(team, data);
  const slotChecks = (Array.isArray(team) ? team : []).map((slot, index) => checkSlotLegality(slot, data, team, index));
  const teamValidation = analyseTeamValidation(team, data);
  const warnings = [
    ...slotChecks.flatMap((check, index) => check.warnings.map((warning) => `Slot ${index + 1}: ${warning}`)),
    ...teamValidation.errors.map((issue) => issue.message),
    ...teamValidation.redundancies.map((issue) => issue.message)
  ];
  return {
    allowed: slotChecks.every((check) => check.allowed) && itemClause.legal && teamValidation.errors.length === 0,
    slotChecks,
    itemClause,
    teamValidation,
    warnings
  };
}

export function analyseTeamValidation(team = [], data = {}) {
  const slots = (Array.isArray(team) ? team : [])
    .map((slot, index) => buildValidationSlot(slot, index, data))
    .filter((slot) => slot.pokemon);
  const errors = [];
  const strengths = [];
  const redundancies = [];
  const clarifications = [];
  const addIssue = (bucket, code, message, slotIndexes = []) => {
    if (bucket.some((issue) => issue.code === code && issue.message === message)) return;
    bucket.push({ code, message, slotIndexes });
  };

  const megaStoneSlots = slots.filter((slot) => slot.item && isMegaStoneItem(slot.item));
  if (megaStoneSlots.length > 1) {
    addIssue(errors, 'multiple-mega-stones', 'Only one Pokémon can Mega Evolve per battle. Having two Mega Stones means one will be inactive — pick which Pokémon you actually want to Mega Evolve and give the other a regular item.', megaStoneSlots.map((slot) => slot.index));
  } else {
    const mega = analyseTeamMegaState(team, data);
    if (mega.conflict) {
      addIssue(errors, 'multiple-mega-stones', 'Only one Pokémon can Mega Evolve per battle. Having two Mega Stones means one will be inactive — pick which Pokémon you actually want to Mega Evolve and give the other a regular item.', mega.active.map((slot) => slot.index));
    }
  }

  for (const slot of slots) {
    if (hasAbility(slot, 'Unburden') && hasItem(slot, 'Leftovers')) {
      addIssue(errors, `unburden-leftovers-${slot.index}`, 'Unburden + Leftovers will never trigger Unburden because Leftovers is never consumed. Use a Berry or White Herb instead.', [slot.index]);
    }
  }

  const trickRoomSlots = slots.filter((slot) => hasMove(slot, 'Trick Room'));
  const tailwindSlots = slots.filter((slot) => hasMove(slot, 'Tailwind'));
  if (trickRoomSlots.length && tailwindSlots.length) {
    addIssue(errors, 'trick-room-tailwind-compete', 'Trick Room and Tailwind both eat your first turn and counter each other. Only one can go up safely — decide which is your priority.', [...trickRoomSlots, ...tailwindSlots].map((slot) => slot.index));
  }

  const fakeOutSlots = slots.filter((slot) => hasMove(slot, 'Fake Out'));
  if (fakeOutSlots.length >= 2) {
    addIssue(strengths, 'stacked-fake-out', 'Two Fake Out users let you deny the opponent two turns in a row by pairing both leads. This is very strong against setup teams.', fakeOutSlots.map((slot) => slot.index));
  }

  for (const setter of slots) {
    const weather = weatherSetBySlot(setter);
    if (!weather) continue;
    for (const abuser of slots) {
      if (abuser.index === setter.index) continue;
      const abilityWeather = weatherUsedByAbility(abuser.abilityName);
      if (abilityWeather && abilityWeather === weather) {
        addIssue(strengths, `weather-synergy-${setter.index}-${abuser.index}`, `${setter.abilityName} enables ${abuser.abilityName} on ${abuser.name} — intentional synergy, not a redundancy.`, [setter.index, abuser.index]);
      }
    }
  }


  for (const setter of slots) {
    const weather = weatherSetBySlot(setter);
    if (weather === 'Snow') {
      for (const veilUser of slots.filter((slot) => hasMove(slot, 'Aurora Veil'))) {
        addIssue(strengths, `snow-aurora-veil-${setter.index}-${veilUser.index}`, `${setter.abilityName || setter.name} (${setter.name}) enables Aurora Veil — Veil is only usable in snow.`, [setter.index, veilUser.index]);
      }
    }
  }

  for (const slot of slots) {
    if (hasAbility(slot, 'Adaptability') && hasMove(slot, 'Last Respects')) {
      addIssue(strengths, `adaptability-last-respects-${slot.index}`, `Adaptability + Last Respects (${slot.name}) — Adaptability doubles STAB, compounding the scaling finisher.`, [slot.index]);
    }
    if (hasAbility(slot, 'Intimidate') && hasMove(slot, 'Parting Shot')) {
      addIssue(strengths, `intimidate-parting-shot-${slot.index}`, `Intimidate + Parting Shot (${slot.name}) — stacks two attack-lowering effects into a defensive pivot.`, [slot.index]);
    }
    if (hasItem(slot, 'White Herb') && hasMove(slot, 'Close Combat')) {
      addIssue(strengths, `white-herb-close-combat-${slot.index}`, `White Herb + Close Combat (${slot.name}) — White Herb restores the defensive drops from Close Combat, enabling safer aggression.`, [slot.index]);
    }
    if (hasItem(slot, "King's Rock") && hasMove(slot, 'Bullet Punch')) {
      addIssue(strengths, `kings-rock-bullet-punch-${slot.index}`, `King's Rock + Bullet Punch (${slot.name}) — flinch chance per priority hit, intentional flinch-fishing.`, [slot.index]);
    }
  }

  for (const protector of slots) {
    const absorbedTypes = absorbedTypesByAbility(protector.abilityName);
    if (!absorbedTypes.length) continue;
    for (const teammate of slots) {
      if (teammate.index === protector.index) continue;
      const protectedType = absorbedTypes.find((type) => isWeakToType(teammate.pokemon, type));
      if (protectedType) {
        addIssue(strengths, `type-absorb-${protector.index}-${teammate.index}-${protectedType}`, `${protector.name} protects ${teammate.name} from ${protectedType} attacks via ${protector.abilityName}.`, [protector.index, teammate.index]);
      }
    }
  }

  const kingsRockSlots = slots.filter((slot) => hasItem(slot, "King's Rock") && !hasMove(slot, 'Bullet Punch') && slot.moves.some((move) => isPriorityMove(move) || isMultiHitMove(move)));
  for (const slot of kingsRockSlots) {
    const move = slot.moves.find((candidate) => isPriorityMove(candidate) || isMultiHitMove(candidate));
    const moveName = move?.name || 'that move';
    addIssue(strengths, `kings-rock-priority-${slot.index}-${normaliseName(moveName)}`, `King's Rock adds a flinch chance to each hit of ${moveName} — intentional flinch-fishing setup.`, [slot.index]);
  }



  for (const slot of slots) {
    const inactiveAbility = inactiveWeatherAbilityClarification(slot, slots);
    if (inactiveAbility) {
      addIssue(clarifications, `inactive-weather-ability-${slot.index}-${normaliseName(slot.abilityName)}`, inactiveAbility, [slot.index]);
    }
  }

  const weatherSetters = slots.filter((slot) => Boolean(weatherSetBySlot(slot)));
  const uniqueWeatherPlans = new Set(weatherSetters.map(weatherSetBySlot));
  if (weatherSetters.length >= 2 && uniqueWeatherPlans.size >= 2) {
    addIssue(redundancies, 'multiple-weather-setters', "They'll override each other's weather. Pick one as your main weather plan.", weatherSetters.map((slot) => slot.index));
  }

  const slowTrickRoomSetters = trickRoomSlots.filter((slot) => isSlowSlot(slot));
  if (slowTrickRoomSetters.length >= 2) {
    addIssue(redundancies, 'two-slow-trick-room-setters', 'Only one will set Trick Room safely. Consider whether you need both.', slowTrickRoomSetters.map((slot) => slot.index));
  }

  return { errors, strengths, redundancies, clarifications };
}

export function legalPokemon(data) {
  return data.collections.pokemon.filter((pokemon) => checkPokemonLegality(pokemon, data).allowed);
}



function inactiveWeatherAbilityClarification(slot, slots = []) {
  const ability = normaliseName(slot.activeConditionalAbilityName || slot.abilityName);
  const requirements = {
    sandforce: {
      weather: 'Sand',
      text: `${slot.name}'s Sand Force ability boosts Ground, Rock, and Steel moves by 30% in sand. This team has no sand setter, so Sand Force will be inactive in battle.${slot.isActiveMega ? ` The Mega slot is justified by ${slot.name}'s stat boost rather than the ability.` : ''}`
    },
    sandrush: {
      weather: 'Sand',
      text: `${slot.name}'s Sand Rush ability doubles Speed in sand. This team has no sand setter, so Sand Rush will be inactive in battle.`
    },
    sandveil: {
      weather: 'Sand',
      text: `${slot.name}'s Sand Veil ability raises evasion in sand. This team has no sand setter, so Sand Veil will be inactive in battle.`
    },
    swiftswim: {
      weather: 'Rain',
      text: `${slot.name}'s Swift Swim ability doubles its Speed in rain. This team has no rain setter, so Swift Swim will be inactive in battle.`
    },
    raindish: {
      weather: 'Rain',
      text: `${slot.name}'s Rain Dish ability heals in rain. This team has no rain setter, so Rain Dish will be inactive in battle.`
    },
    hydration: {
      weather: 'Rain',
      text: `${slot.name}'s Hydration ability clears status in rain. This team has no rain setter, so Hydration will be inactive in battle.`
    },
    chlorophyll: {
      weather: 'Sun',
      text: `${slot.name}'s Chlorophyll ability doubles its Speed in sun. This team has no sun setter, so Chlorophyll will be inactive in battle.`
    },
    solarpower: {
      weather: 'Sun',
      text: `${slot.name}'s Solar Power ability boosts Special Attack in sun but only works while sun is active. This team has no sun setter, so Solar Power will be inactive in battle.`
    },
    harvest: {
      weather: 'Sun',
      text: `${slot.name}'s Harvest ability is most reliable in sun. This team has no sun setter, so Harvest support is not being supplied.`
    },
    leafguard: {
      weather: 'Sun',
      text: `${slot.name}'s Leaf Guard ability only blocks status in sun. This team has no sun setter, so Leaf Guard will be inactive in battle.`
    },
    snowcloak: {
      weather: 'Snow',
      text: `${slot.name}'s Snow Cloak ability raises evasion in snow. This team has no snow setter, so Snow Cloak will be inactive in battle.`
    },
    slushrush: {
      weather: 'Snow',
      text: `${slot.name}'s Slush Rush ability doubles Speed in snow. This team has no snow setter, so Slush Rush will be inactive in battle.`
    },
    icebody: {
      weather: 'Snow',
      text: `${slot.name}'s Ice Body ability heals in snow. This team has no snow setter, so Ice Body will be inactive in battle.`
    }
  };
  const requirement = requirements[ability];
  if (!requirement) return '';
  const hasMatchingSetter = slots.some((candidate) => weatherSetBySlot(candidate) === requirement.weather);
  return hasMatchingSetter ? '' : requirement.text;
}

function buildValidationSlot(slot, index, data) {
  const pokemon = slot?.pokemon_id ? data.indexes?.pokemonById?.[slot.pokemon_id] : null;
  const item = slot?.item_id ? data.indexes?.itemsById?.[slot.item_id] : null;
  const ability = slot?.ability_id ? data.indexes?.abilitiesById?.[slot.ability_id] : null;
  const moves = (slot?.moves || []).map((moveId) => data.indexes?.movesById?.[moveId]).filter(Boolean);
  const megaState = getSlotMegaState(slot, data);
  const activeMegaId = megaState?.activeMega?.megaPokemonId || '';
  const activeMegaAbilities = activeMegaId ? (data.indexes?.abilitiesByPokemon?.[activeMegaId] || []) : [];
  const selectedAbilityName = ability ? getReadableAbilityName(ability, '') : getReadableAbilityName(slot?.ability_id || slot?.ability || '', '');
  const megaAbilityName = activeMegaAbilities[0]?.ability_name || activeMegaAbilities[0]?.name || '';
  const activeConditionalAbilityName = weatherUsedByAbility(megaAbilityName) ? megaAbilityName : selectedAbilityName;
  const activePokemon = pokemon;
  return {
    index,
    slot,
    pokemon: activePokemon || pokemon,
    basePokemon: pokemon,
    name: activePokemon ? getReadablePokemonName(activePokemon, `Slot ${index + 1}`) : `Slot ${index + 1}`,
    item,
    itemName: item ? getReadableItemName(item, '') : '',
    ability,
    abilityName: selectedAbilityName,
    activeConditionalAbilityName,
    moves,
    isActiveMega: Boolean(activeMegaId && weatherUsedByAbility(megaAbilityName))
  };
}

function hasAbility(slot, abilityName) { return normaliseName(slot.abilityName) === normaliseName(abilityName); }
function hasItem(slot, itemName) { return normaliseName(slot.itemName) === normaliseName(itemName); }
function hasMove(slot, moveName) { return slot.moves.some((move) => normaliseName(move?.name) === normaliseName(moveName)); }
function isPriorityMove(move) { return Number(move?.priority || 0) > 0; }
function isMultiHitMove(move) { return /2-5|multi-hit|multi hit|hits two|hits 2|hits twice|each hit/i.test(`${move?.effect || ''} ${move?.description || ''} ${move?.name || ''}`); }

function weatherSetBySlot(slot) {
  const ability = normaliseName(slot.abilityName);
  if (ability === 'snowwarning') return 'Snow';
  if (ability === 'drought') return 'Sun';
  if (ability === 'drizzle') return 'Rain';
  if (ability === 'sandstream') return 'Sand';
  const moves = slot.moves.map((move) => normaliseName(move?.name));
  if (moves.includes('snowscape') || moves.includes('hail')) return 'Snow';
  if (moves.includes('sunnyday')) return 'Sun';
  if (moves.includes('raindance')) return 'Rain';
  if (moves.includes('sandstorm')) return 'Sand';
  return '';
}

function weatherUsedByAbility(abilityName = '') {
  const ability = normaliseName(abilityName);
  if (['snowcloak', 'slushrush', 'icebody'].includes(ability)) return 'Snow';
  if (['chlorophyll', 'solarpower', 'harvest', 'leafguard'].includes(ability)) return 'Sun';
  if (['swiftswim', 'raindish', 'dryskin', 'hydration'].includes(ability)) return 'Rain';
  if (['sandrush', 'sandforce', 'sandveil'].includes(ability)) return 'Sand';
  return '';
}

function absorbedTypesByAbility(abilityName = '') {
  const ability = normaliseName(abilityName);
  if (['lightningrod', 'voltabsorb', 'motordrive'].includes(ability)) return ['Electric'];
  if (['stormdrain', 'waterabsorb', 'dryskin'].includes(ability)) return ['Water'];
  if (ability === 'flashfire') return ['Fire'];
  if (ability === 'sapsipper') return ['Grass'];
  if (ability === 'eartheater') return ['Ground'];
  if (ability === 'levitate') return ['Ground'];
  return [];
}

const TYPE_WEAKNESSES = {
  Normal: ['Fighting'], Fire: ['Water', 'Ground', 'Rock'], Water: ['Electric', 'Grass'], Electric: ['Ground'], Grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
  Ice: ['Fire', 'Fighting', 'Rock', 'Steel'], Fighting: ['Flying', 'Psychic', 'Fairy'], Poison: ['Ground', 'Psychic'], Ground: ['Water', 'Grass', 'Ice'],
  Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'], Bug: ['Fire', 'Flying', 'Rock'], Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
  Ghost: ['Ghost', 'Dark'], Dragon: ['Ice', 'Dragon', 'Fairy'], Dark: ['Fighting', 'Bug', 'Fairy'], Steel: ['Fire', 'Fighting', 'Ground'], Fairy: ['Poison', 'Steel']
};

function pokemonTypes(pokemon = {}) {
  return [pokemon.type1 || pokemon.type_1 || pokemon.primary_type || pokemon.type, pokemon.type2 || pokemon.type_2 || pokemon.secondary_type]
    .flatMap((value) => Array.isArray(value) ? value : String(value || '').split(/[\/,&]+/))
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isWeakToType(pokemon, attackingType) {
  const type = String(attackingType || '').trim();
  if (!type) return false;
  return pokemonTypes(pokemon).some((defendingType) => (TYPE_WEAKNESSES[defendingType] || []).includes(type));
}

function isSlowSlot(slot) {
  const allocation = getSlotStatAllocation(slot.slot || {});
  const speedPoints = Number(allocation?.Spe || allocation?.speed || allocation?.spe || 0);
  const rawSpeed = Number(slot.pokemon?.speed || slot.pokemon?.spe || slot.pokemon?.base_speed || slot.pokemon?.stats?.Spe || slot.pokemon?.stats?.speed || 0);
  return rawSpeed <= 70 || speedPoints <= 4;
}

function normaliseName(value = '') { return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''); }

function slotMoveLabel(moveId, data) {
  return getReadableMoveName(data.indexes.movesById?.[moveId] || moveId, moveId);
}

function slotAbilityLabel(abilityId, data) {
  return getReadableAbilityName(data.indexes.abilitiesById?.[abilityId] || abilityId, abilityId);
}

function isEmpty(value) {
  if (!value) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
