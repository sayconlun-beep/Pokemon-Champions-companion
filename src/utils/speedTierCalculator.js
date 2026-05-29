import { getReadablePokemonName, getReadableAbilityName } from './displayNames.js';
import { getSlotStatAllocation } from '../core/statAllocationEngine.js';

const SPEED_UP_NATURES = new Set(['timid', 'jolly', 'hasty', 'naive']);
const SPEED_DOWN_NATURES = new Set(['brave', 'quiet', 'relaxed', 'sassy']);

const SPEED_CONTROL_MOVE_NAMES = new Set([
  'tailwind', 'trick room', 'icy wind', 'electroweb', 'thunder wave', 'glare', 'scary face',
  'bulldoze', 'sticky web', 'quash', 'after you', 'trick room', 'string shot', 'cotton spore',
  'rock tomb', 'low sweep', 'trailblaze', 'flame charge', 'agility', 'dragon dance', 'shift gear',
  'shell smash', 'quiver dance', 'speed swap'
]);

const PROTECTIVE_PRIORITY_MOVE_NAMES = new Set(['protect', 'detect', 'endure', 'wide guard', 'quick guard', "king's shield", 'spiky shield', 'baneful bunker']);

const BOOSTING_MOVE_NAMES = new Set([
  'agility', 'rock polish', 'autotomize', 'flame charge', 'trailblaze', 'dragon dance',
  'quiver dance', 'shift gear', 'shell smash'
]);

const SPEED_CONTROL_ABILITIES = new Set([
  'chlorophyll', 'swift swim', 'sand rush', 'slush rush', 'surge surfer', 'speed boost',
  'prankster', 'unburden', 'quick feet'
]);

export function calculateSpeedTierSnapshot(team = [], data = {}) {
  const members = (Array.isArray(team) ? team : [])
    .map((slot, slotIndex) => buildSpeedMember(slot, slotIndex, data))
    .filter(Boolean);

  const naturalOrder = sortBySpeed(members).map(toOrderEntry);
  const tailwindOrder = sortBySpeed(members.map((member) => ({ ...member, effectiveSpeed: member.effectiveSpeed * 2 }))).map(toOrderEntry);
  const trickRoomOrder = sortBySpeed(members, true).map(toOrderEntry);
  const paralysisAdjustedOrder = sortBySpeed(members.map((member) => ({ ...member, effectiveSpeed: Math.floor(member.effectiveSpeed / 2) }))).map(toOrderEntry);
  const speedBoostOrder = sortBySpeed(members.map(applyLikelySpeedBoost)).map(toOrderEntry);
  const priorityUsers = getPriorityUsers(members);
  const speedControlUsers = getSpeedControlUsers(members);
  const speedControlGaps = getSpeedControlGaps(members, priorityUsers, speedControlUsers);

  return {
    naturalOrder,
    tailwindOrder,
    trickRoomOrder,
    paralysisAdjustedOrder,
    speedBoostOrder,
    priorityUsers,
    speedControlUsers,
    speedControlGaps,
    summaryBullets: buildSummaryBullets({ members, naturalOrder, tailwindOrder, trickRoomOrder, priorityUsers, speedControlUsers, speedControlGaps })
  };
}

function buildSpeedMember(slot = {}, slotIndex = 0, data = {}) {
  if (!slot?.pokemon_id) return null;

  const pokemon = data?.indexes?.pokemonById?.[slot.pokemon_id] || {};
  const stats = data?.indexes?.statsByPokemon?.[slot.pokemon_id] || pokemon?.stats || pokemon?.baseStats || {};
  const baseSpeed = numberOrNull(stats?.spe ?? stats?.speed ?? stats?.baseSpeed ?? pokemon?.spe ?? pokemon?.speed ?? pokemon?.baseSpeed);
  if (baseSpeed === null) return null;

  const level = safePositiveNumber(slot.level, 50);
  const speedInvestment = getSpeedInvestment(slot);
  const natureModifier = getSpeedNatureModifier(slot.nature || slot.nature_id || slot.natureName);
  const effectiveSpeed = calculateEffectiveSpeed(baseSpeed, speedInvestment, level, natureModifier, slot);
  const moves = (Array.isArray(slot.moves) ? slot.moves : [])
    .filter(Boolean)
    .map((moveId) => data?.indexes?.movesById?.[moveId] || { move_id: moveId, name: moveId, priority: 0 });
  const ability = slot.ability_id ? data?.indexes?.abilitiesById?.[slot.ability_id] : null;
  const item = slot.item_id ? data?.indexes?.itemsById?.[slot.item_id] : null;

  return {
    slotIndex,
    pokemonId: slot.pokemon_id,
    name: getReadablePokemonName(pokemon, `Slot ${slotIndex + 1}`),
    baseSpeed,
    level,
    speedInvestment,
    natureModifier,
    effectiveSpeed,
    moves,
    ability,
    item,
    hasLikelySpeedBoost: hasLikelySpeedBoost(moves, ability, item)
  };
}

function calculateEffectiveSpeed(baseSpeed, speedInvestment, level, natureModifier, slot = {}) {
  const rawEvs = getRawEvSpeed(slot);
  if (rawEvs !== null) {
    const iv = 31;
    const stat = Math.floor(((2 * baseSpeed + iv + Math.floor(rawEvs / 4)) * level) / 100) + 5;
    return Math.max(1, Math.floor(stat * natureModifier));
  }

  return Math.max(1, Math.floor((baseSpeed + speedInvestment) * natureModifier));
}

function getSpeedInvestment(slot = {}) {
  const allocation = getSlotStatAllocation(slot);
  return safeNumber(allocation.speed, 0);
}

function getRawEvSpeed(slot = {}) {
  const evs = slot.importedShowdownEvs || slot.rawEvs || slot.showdownEvs;
  if (!evs || typeof evs !== 'object') return null;
  return safeNumber(evs.spe ?? evs.speed ?? evs.Speed, 0);
}

function getSpeedNatureModifier(nature) {
  const key = String(nature || '').trim().toLowerCase();
  if (SPEED_UP_NATURES.has(key)) return 1.1;
  if (SPEED_DOWN_NATURES.has(key)) return 0.9;
  return 1;
}

function getPriorityUsers(members = []) {
  return members
    .flatMap((member) => member.moves
      .map((move) => ({
        pokemon: member.name,
        move: move?.name || move?.move_id || 'Priority move',
        priority: safeNumber(move?.priority, 0),
        speed: member.effectiveSpeed
      }))
      .filter((entry) => entry.priority !== 0 && !PROTECTIVE_PRIORITY_MOVE_NAMES.has(normalizeKey(entry.move))))
    .sort((a, b) => b.priority - a.priority || b.speed - a.speed || a.pokemon.localeCompare(b.pokemon));
}

function getSpeedControlUsers(members = []) {
  return members
    .map((member) => {
      const moveTools = member.moves.filter((move) => isSpeedControlMove(move)).map((move) => move?.name || move?.move_id).filter(Boolean);
      const abilityName = getReadableAbilityName(member.ability, '');
      const abilityTool = SPEED_CONTROL_ABILITIES.has(normalizeKey(abilityName)) ? abilityName : '';
      const tools = [...new Set([...moveTools, abilityTool].filter(Boolean))];
      return tools.length ? { pokemon: member.name, tools, speed: member.effectiveSpeed } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.speed - a.speed || a.pokemon.localeCompare(b.pokemon));
}

function getSpeedControlGaps(members = [], priorityUsers = [], speedControlUsers = []) {
  const gaps = [];
  if (!members.length) return ['Add Pokémon to review speed-control coverage.'];

  const hasTailwind = speedControlUsers.some((user) => user.tools.some((tool) => normalizeKey(tool) === 'tailwind'));
  const hasTrickRoom = speedControlUsers.some((user) => user.tools.some((tool) => normalizeKey(tool) === 'trickroom'));
  const hasSlowControl = speedControlUsers.some((user) => user.tools.some((tool) => ['icywind', 'electroweb', 'thunderwave', 'glare', 'scaryface', 'bulldoze', 'rocktomb', 'lowsweep'].includes(normalizeKey(tool))));
  const fastest = sortBySpeed(members)[0];
  const slowCount = members.filter((member) => member.effectiveSpeed <= 70 || member.baseSpeed <= 60).length;
  const fastCount = members.filter((member) => member.effectiveSpeed >= 100 || member.baseSpeed >= 95).length;

  if (!hasTailwind && fastCount <= 1) gaps.push('Limited fast-mode support if the opponent controls turn order.');
  if (!hasTrickRoom && slowCount >= 3) gaps.push('Several slower Pokémon may struggle if Trick Room is not available or denied.');
  if (!hasSlowControl && !hasTailwind && !hasTrickRoom) gaps.push('No clear speed-control move is selected yet.');
  if (!priorityUsers.length) gaps.push('No selected priority moves to bypass normal speed order.');
  if (fastest && fastest.effectiveSpeed < 90 && !hasTailwind && !hasSlowControl) gaps.push('The fastest natural mover is still only mid-speed, so revenge turns may be difficult.');

  return [...new Set(gaps)].slice(0, 4);
}

function buildSummaryBullets({ members, naturalOrder, tailwindOrder, trickRoomOrder, priorityUsers, speedControlUsers, speedControlGaps }) {
  if (!members.length) return ['Add Pokémon to see a speed-control snapshot.'];

  const bullets = [];
  if (naturalOrder[0]) bullets.push(`${naturalOrder[0].pokemon} is currently your fastest natural mover.`);
  const tailwindBest = tailwindOrder.find((entry) => entry.speed >= 140) || tailwindOrder[0];
  if (tailwindBest) bullets.push(`${tailwindBest.pokemon} gains the most practical fast-mode value under Tailwind.`);
  if (trickRoomOrder[0]) bullets.push(`${trickRoomOrder[0].pokemon} is best positioned to act early under Trick Room.`);
  if (priorityUsers.length) bullets.push(`${priorityUsers[0].pokemon} can bypass speed order with ${priorityUsers[0].move}.`);
  if (speedControlUsers.length) bullets.push(`${speedControlUsers[0].pokemon} provides visible speed-control utility.`);
  if (!speedControlUsers.length && speedControlGaps.length) bullets.push(speedControlGaps[0]);

  return [...new Set(bullets)].slice(0, 5);
}

function applyLikelySpeedBoost(member) {
  const multiplier = member.hasLikelySpeedBoost ? 2 : 1;
  return { ...member, effectiveSpeed: member.effectiveSpeed * multiplier };
}

function hasLikelySpeedBoost(moves = [], ability = null, item = null) {
  const hasBoostMove = moves.some((move) => BOOSTING_MOVE_NAMES.has(normalizeKey(move?.name || move?.move_id)));
  const abilityName = normalizeKey(getReadableAbilityName(ability, ''));
  const itemName = normalizeKey(item?.name || item?.item_name || item?.item_id);
  return hasBoostMove || ['speedboost', 'chlorophyll', 'swiftswim', 'sandrush', 'slushrush', 'unburden', 'quickfeet'].includes(abilityName) || itemName.includes('choicescarf');
}

function isSpeedControlMove(move = {}) {
  const name = normalizeKey(move?.name || move?.move_id);
  if (SPEED_CONTROL_MOVE_NAMES.has(name)) return true;
  const text = `${move?.name || ''} ${move?.shortEffect || ''} ${move?.effect || ''} ${move?.description || ''}`.toLowerCase();
  return /tailwind|trick room|paraly|speed|priority|slower|lowers.*speed|raises.*speed/.test(text);
}

function sortBySpeed(members = [], ascending = false) {
  return [...members].sort((a, b) => {
    const speedDiff = ascending ? a.effectiveSpeed - b.effectiveSpeed : b.effectiveSpeed - a.effectiveSpeed;
    return speedDiff || a.name.localeCompare(b.name);
  });
}

function toOrderEntry(member) {
  return {
    pokemon: member.name,
    speed: member.effectiveSpeed,
    baseSpeed: member.baseSpeed,
    level: member.level,
    speedInvestment: member.speedInvestment
  };
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safePositiveNumber(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
