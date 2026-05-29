import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { abilityReason, inferBeginnerRole } from './metadexRoleAnalysis.js';
import { dedupeLines, escapeText, itemCompatibility, legalAbilities, legalMoves, moveRelevanceScore, normalize, option, prioritizeLegalMoves } from './metadexText.js';
import { buildGuideBlock, buildGuideListBlock } from './renderMetadexGuidancePanels.js';

export function recommendedBuildOptionsPanel(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const roles = suggestedRoleLabels(pokemon, identity, state);
  const itemGroups = suggestedItemGroups(pokemon, role);
  const abilityLines = suggestedAbilityLines(pokemon, state, role);
  const moveGroups = suggestedMoveGroups(pokemon, state, role);
  const beginnerBuild = beginnerRecommendedBuild(pokemon, identity, state, role, itemGroups, moveGroups);

  return `<article class="mini-card metadex-info-card metadex-recommended-build-options">
    <h3>Recommended Build Options</h3>
    <p class="muted small-copy">These are suggestions from this Pokémon’s existing legal moves, abilities, items, and role data. They are not applied automatically.</p>
    <div class="metadex-build-guide-grid">
      ${buildGuideListBlock('Other possible roles', roles)}
      ${buildGroupedOptionsBlock('Suggested Items', itemGroups, 'No clear item suggestions are documented yet. Choose an item that matches the role you want.')}
      ${buildGuideListBlock('Suggested Abilities', abilityLines)}
      ${buildGroupedOptionsBlock('Suggested Move Categories', moveGroups, 'Start with Protect if legal, reliable attacks, and one support or coverage move that matches the role.')}
      ${beginnerBuild ? buildBeginnerBuildBlock(beginnerBuild) : buildGuideBlock('Beginner Recommended Build', '<p class="muted">Not enough legal move, item, and ability data exists to suggest a safe full build yet.</p>')}
    </div>
  </article>`;
}

// TODO: Replace with shared coaching profile

export function suggestedRoleLabels(pokemon, identity, state) {
  const role = inferBeginnerRole(pokemon, identity, state);
  const labels = [role.primaryRole || role.label];
  if (role.secondaryRole) labels.push(role.secondaryRole);
  (role.otherPossibleRoles || []).forEach((label) => {
    if (labels.length < 5 && !labels.includes(label)) labels.push(label);
  });
  if (labels.length < 2 && role.key === 'flex') labels.push('Flexible Pick');
  return labels.slice(0, 5);
}

export function suggestedItemGroups(pokemon, role) {
  const items = itemCompatibility(pokemon);
  const groups = [
    { label: 'Staying Power', terms: ['leftovers', 'sitrus', 'figy', 'wiki', 'mago', 'aguav', 'iapapa', 'black sludge', 'shell bell', 'assault vest'], values: [] },
    { label: 'Safety', terms: ['focus sash', 'covert cloak', 'safety goggles', 'clear amulet', 'mental herb', 'lum berry'], values: [] },
    { label: 'Damage', terms: ['life orb', 'choice specs', 'choice band', 'expert belt', 'muscle band', 'wise glasses', 'mystic water', 'charcoal', 'magnet', 'miracle seed', 'black glasses', 'dragon fang', 'spell tag', 'soft sand', 'hard stone', 'sharp beak', 'silk scarf'], values: [] },
    { label: 'Support', terms: ['light clay', 'mental herb', 'eviolite', 'terrain extender', 'icy rock', 'heat rock', 'damp rock', 'smooth rock'], values: [] },
    { label: 'Speed', terms: ['choice scarf', 'booster energy'], values: [] }
  ];

  for (const item of items) {
    const lower = normalize(item);
    const group = groups.find((entry) => entry.terms.some((term) => lower.includes(term)));
    if (group) group.values.push(item);
  }

  const active = groups.filter((group) => group.values.length).map((group) => ({ label: group.label, values: dedupeLines(group.values).slice(0, 5) }));
  if (!active.length && items.length) {
    active.push({ label: role.label, values: items.slice(0, 5) });
  }
  if (!active.length) {
    return fallbackItemGroupsForRole(role);
  }
  return active.slice(0, 5);
}

export function fallbackItemGroupsForRole(role) {
  const key = role?.key || 'flex';
  const groupsByRole = {
    attacker: [
      { label: 'Damage', values: ['Life Orb', 'Choice item', 'type-boosting item'] },
      { label: 'Safety', values: ['Focus Sash'] }
    ],
    setup: [
      { label: 'Setup Safety', values: ['Clear Amulet', 'Lum Berry', 'Leftovers'] }
    ],
    support: [
      { label: 'Support Safety', values: ['Sitrus Berry', 'Covert Cloak', 'Mental Herb'] },
      { label: 'Staying Power', values: ['Leftovers'] }
    ],
    'speed-control': [
      { label: 'Speed Control Safety', values: ['Covert Cloak', 'Mental Herb', 'Focus Sash'] }
    ],
    weather: [
      { label: 'Support Safety', values: ['Covert Cloak', 'Mental Herb', 'Focus Sash'] },
      { label: 'Weather Support', values: ['weather-extending item if your whole team depends on weather'] }
    ],
    bulky: [
      { label: 'Bulky Support', values: ['Sitrus Berry', 'Leftovers', 'Covert Cloak', 'Mental Herb'] }
    ],
    flex: [
      { label: 'Flexible build', values: ['choose the item and moves based on the role you need'] }
    ]
  };
  return groupsByRole[key] || groupsByRole.flex;
}

export function suggestedAbilityLines(pokemon, state, role) {
  const abilities = legalAbilities(pokemon, state).slice(0, 5);
  if (!abilities.length) return ['Choose the ability that best supports the role you want this Pokémon to fill.'];
  return abilities.map((ability) => `${ability}: ${abilityReason(ability, role)}`);
}

export function suggestedMoveGroups(pokemon, state, role) {
  const moves = prioritizeLegalMoves(legalMoves(pokemon, state), pokemon).map((entry) => entry.name);
  const groups = [
    { label: 'Protection', terms: ['protect', 'detect', 'wide guard', 'quick guard'], values: [] },
    { label: 'Speed Control', terms: ['tailwind', 'icy wind', 'trick room', 'thunder wave', 'electroweb', 'scary face'], values: [] },
    { label: 'Setup', terms: ['swords dance', 'nasty plot', 'dragon dance', 'calm mind', 'bulk up', 'coil', 'quiver dance'], values: [] },
    { label: 'Reliable Damage', terms: [], values: [] },
    { label: 'Utility', terms: ['fake out', 'follow me', 'rage powder', 'helping hand', 'taunt', 'encore', 'will-o-wisp', 'snarl', 'parting shot', 'roost', 'recover', 'wish', 'leech seed', 'spore', 'sleep powder', 'reflect', 'light screen', 'aurora veil'], values: [] }
  ];

  const protection = groups[0];
  const speed = groups[1];
  const setup = groups[2];
  const damage = groups[3];
  const utility = groups[4];
  const types = [pokemon.type1, pokemon.type2].map(normalize).filter(Boolean);

  for (const move of moves) {
    const lower = normalize(move);
    if (protection.terms.some((term) => lower.includes(term))) protection.values.push(move);
    else if (speed.terms.some((term) => lower.includes(term))) speed.values.push(move);
    else if (setup.terms.some((term) => lower.includes(term))) setup.values.push(move);
    else if (utility.terms.some((term) => lower.includes(term))) utility.values.push(move);
    else if (moveRelevanceScore(move, types) >= 6) damage.values.push(move);
  }

  const active = groups
    .map((group) => ({ label: group.label, values: dedupeLines(group.values).slice(0, group.label === 'Reliable Damage' ? 6 : 4) }))
    .filter((group) => group.values.length);

  if (!active.length && moves.length) active.push({ label: role.label, values: moves.slice(0, 6) });
  return active.slice(0, 5);
}

export function beginnerRecommendedBuild(pokemon, identity, state, role, itemGroups, moveGroups) {
  const items = itemGroups.flatMap((group) => group.values);
  const abilities = legalAbilities(pokemon, state);
  const selectedMoves = selectBeginnerMoves(pokemon, state, moveGroups, role);
  if (!abilities.length || selectedMoves.length < 4) return null;
  const safeItems = items.length ? items : fallbackItemGroupsForRole(role).flatMap((group) => group.values);
  return {
    role: role.label,
    item: safeItems[0] || 'Flexible build — choose the item and moves based on the role you need.',
    ability: chooseBeginnerAbility(abilities, role),
    nature: inferBeginnerNature(pokemon, state, role),
    moves: selectedMoves.slice(0, 4),
    explanation: beginnerBuildExplanation(pokemon, role)
  };
}

export function selectBeginnerMoves(pokemon, state, moveGroups, role) {
  const allLegal = legalMoves(pokemon, state);
  const picked = [];
  const add = (move) => { if (move && allLegal.includes(move) && !picked.includes(move)) picked.push(move); };
  const group = (label) => moveGroups.find((entry) => entry.label === label)?.values || [];
  const isOffensive = role?.key === 'attacker' || role?.key === 'setup';

  if (isOffensive) {
    group('Reliable Damage').slice(0, 3).forEach(add);
    add(group('Setup')[0]);
    add(group('Protection')[0]);
    group('Utility').filter((move) => /Fake Out|Sucker Punch|Extreme Speed|Bullet Punch|Aqua Jet|Ice Shard|Mach Punch|Shadow Sneak/i.test(move)).slice(0, 1).forEach(add);
    for (const entry of prioritizeLegalMoves(allLegal, pokemon)) add(entry.name);
    group('Utility').slice(0, 2).forEach(add);
    group('Speed Control').slice(0, 1).forEach(add);
    return picked.slice(0, 4);
  }

  add(group('Protection')[0]);
  add(group('Speed Control')[0]);
  add(group('Setup')[0]);
  group('Utility').slice(0, 2).forEach(add);
  group('Reliable Damage').slice(0, 3).forEach(add);
  for (const entry of prioritizeLegalMoves(allLegal, pokemon)) add(entry.name);
  return picked.slice(0, 4);
}

export function chooseBeginnerAbility(abilities, role) {
  const scored = abilities.map((ability) => {
    const lower = normalize(ability);
    let score = 0;
    if (role.key === 'weather' && /drizzle|drought|snow warning|sand stream/.test(lower)) score += 80;
    if ((role.key === 'attacker' || role.key === 'setup') && /adaptability|huge power|pure power|technician|sheer force|tough claws|guts|moxie|solar power|speed boost/.test(lower)) score += 60;
    if ((role.key === 'support' || role.key === 'bulky' || role.key === 'speed-control') && /intimidate|regenerator|natural cure|sturdy|multiscale|prankster|friend guard|overcoat/.test(lower)) score += 60;
    return { ability, score };
  }).sort((a, b) => b.score - a.score || String(a.ability).localeCompare(String(b.ability)));
  return scored[0]?.ability || abilities[0];
}

export function inferBeginnerNature(pokemon, state, role) {
  const stats = state.data.indexes.statsByPokemon[pokemon.pokemon_id] || {};
  const atk = Number(stats.atk) || 0;
  const spa = Number(stats.spa) || 0;
  const spe = Number(stats.spe) || 0;
  if (role.key === 'speed-control' || spe >= 100) return 'Timid / Jolly depending on attacking stat';
  if (role.key === 'attacker' || role.key === 'setup') return spa >= atk ? 'Modest or Timid' : 'Adamant or Jolly';
  if (role.key === 'bulky' || role.key === 'support') return 'Bold, Calm, or Careful depending on needed bulk';
  return 'Choose a nature that boosts its main job';
}

export function beginnerBuildExplanation(pokemon, role) {
  const name = getPokemonDisplayName(pokemon);
  if (role.key === 'attacker') return `${name} uses a simple damage-focused build with protection and reliable attacks.`;
  if (role.key === 'setup') return `${name} uses a setup-focused build that needs safe turns from its partner.`;
  if (role.key === 'support' || role.key === 'speed-control') return `${name} uses a simple support build that helps stronger teammates take better turns.`;
  if (role.key === 'bulky') return `${name} uses a steadier build focused on staying useful across multiple turns.`;
  if (role.key === 'weather') return `${name} uses a weather-focused build that works best with teammates that benefit from that weather.`;
  return `${name} uses a flexible starter build based on the safest legal options available.`;
}

export function buildGroupedOptionsBlock(title, groups, fallback) {
  const body = groups.length
    ? groups.map((group) => `<div class="metadex-build-option-group"><strong>${escapeText(group.label)}:</strong> ${group.values.map(escapeText).join(', ')}</div>`).join('')
    : `<p class="muted">${escapeText(fallback)}</p>`;
  return buildGuideBlock(title, body);
}

export function buildBeginnerBuildBlock(build) {
  return buildGuideBlock('Beginner Recommended Build', `<div class="metadex-beginner-build">
    <p><strong>Role:</strong> ${escapeText(build.role)}</p>
    <p><strong>Item:</strong> ${escapeText(build.item)}</p>
    <p><strong>Ability:</strong> ${escapeText(build.ability)}</p>
    <p><strong>Nature:</strong> ${escapeText(build.nature)}</p>
    <p><strong>Moves:</strong> ${build.moves.map(escapeText).join(', ')}</p>
    <p class="muted">${escapeText(build.explanation)}</p>
  </div>`);
}
