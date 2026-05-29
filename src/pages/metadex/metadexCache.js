import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { legalAbilities, legalMoves } from './metadexText.js';

const metadexRenderCaches = new WeakMap();

export function metadexCache(state = {}, options = {}) {
  const dataKey = state?.data?.collections?.pokemon || null;
  const teamKey = teamCacheKey(state);
  const existing = metadexRenderCaches.get(state);
  if (!existing || existing.dataKey !== dataKey || options.ensureFresh && existing.teamKey !== teamKey) {
    const nextCache = {
      dataKey,
      teamKey,
      filterMatches: existing?.filterMatches instanceof Map ? existing.filterMatches : new Map(),
      roles: existing?.roles instanceof Map ? existing.roles : new Map(),
      facts: existing?.facts instanceof Map ? existing.facts : new Map(),
      legalMoves: existing?.legalMoves instanceof Map ? existing.legalMoves : new Map(),
      legalAbilities: existing?.legalAbilities instanceof Map ? existing.legalAbilities : new Map(),
      detailPanels: existing?.detailPanels instanceof Map ? existing.detailPanels : new Map(),
      teamProfile: null
    };
    metadexRenderCaches.set(state, nextCache);
    return nextCache;
  }
  return existing;
}


// SHARED PROFILE DISPLAY: cached shared team interpretation for MetaDex panels and filters.
// Candidate-specific scoring can compare against this profile, but should not recreate team identity/risk coaching.

export function getMetadexTeamCoachingProfile(state = {}) {
  const cache = metadexCache(state);
  if (!cache.teamProfile) cache.teamProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  return cache.teamProfile;
}

export function pokemonCacheKey(pokemon) {
  return String(pokemon?.pokemon_id || pokemon?.id || pokemon?.name || 'unknown');
}

export function metadexViewCacheKey(view = {}, answerType = '') {
  return [
    view.search || '', view.field || 'all', view.legality || 'all', view.megaOnly ? 'mega' : 'all-forms',
    view.teamNeed || 'all', view.guideStep || 'any', view.teamFit || 'any', view.archetypeFit || 'any',
    view.roleConfidence || 'strong-secondary', view.sort || '', answerType || '', view.answerType || '', view.weaknessAnswerType || ''
  ].join('|');
}

export function teamCacheKey(state = {}) {
  return (Array.isArray(state.team) ? state.team : [])
    .map((slot) => {
      if (!slot) return '';
      const moves = Array.isArray(slot.moves || slot.move_ids)
        ? (slot.moves || slot.move_ids).filter(Boolean).join('/')
        : [slot.move1, slot.move2, slot.move3, slot.move4].filter(Boolean).join('/');
      return [
        slot.pokemon_id || slot.pokemon?.pokemon_id || '',
        slot.ability_id || slot.ability || '',
        slot.item_id || slot.item || '',
        moves
      ].join(':');
    })
    .join(',');
}
