import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';

export const FIELD_LABELS = {
  strategicStrengths: 'Strategic strengths',
  interactionProfiles: 'Team Coordination',
  pressureFlow: 'offensive pressure',
  strategicTriggers: 'Strategic triggers',
  replayBehaviourEvidence: 'Replay evidence',
  failureChains: 'bad positions',
  preferredBoardStates: 'Preferred boards',
  advancedResourceEconomy: 'Resource economy',
  damageBenchmarks: 'Damage benchmarks'
};

export const QUALITY_LABELS = {
  gold: 'Gold Star',
  strong: 'Strong',
  needs: 'Needs Work',
  incomplete: 'Incomplete'
};

export const EMPTY_MESSAGES = {
  'Damage benchmark notes': 'No benchmark analysis recorded yet.',
  'Item compatibility': 'No advanced item interactions documented.',
  'Replay evidence': 'No tactical replay evidence available.',
  'Legal moves': 'No legal move data recorded yet.',
  Abilities: 'No legal ability data recorded yet.',
  default: 'No tactical note recorded yet.'
};

export const SHOW_METADEX_ROLE_DEBUG = false;

export const METADEX_INITIAL_VISIBLE_LIMIT = 90;

export const METADEX_LOAD_MORE_INCREMENT = 60;

export const MOVE_PRIORITY_TERMS = [
  'protect', 'fake out', 'tailwind', 'trick room', 'taunt', 'follow me', 'rage powder', 'wide guard', 'quick guard',
  'spore', 'will-o-wisp', 'thunder wave', 'icy wind', 'snarl', 'parting shot', 'u-turn', 'volt switch', 'knock off',
  'swords dance', 'dragon dance', 'nasty plot', 'calm mind', 'bulk up', 'recover', 'roost', 'wish', 'moonlight',
  'extreme speed', 'sucker punch', 'bullet punch', 'aqua jet', 'ice shard', 'mach punch', 'shadow sneak',
  'earthquake', 'rock slide', 'heat wave', 'dazzling gleam', 'blizzard', 'eruption', 'water spout', 'spread'
];

export const TACTICAL_IDENTITY_CACHE = new WeakMap();

export const METADEX_EMPTY_DETAIL = '<h2>Select a Pokémon</h2><p class="muted">Choose a tile or search result to inspect tactical identity, legal options, and evidence notes.</p>';
