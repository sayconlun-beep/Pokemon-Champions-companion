import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { inferBeginnerRole } from './metadexRoleAnalysis.js';
import { availabilityText, escapeAttr, escapeText, qualityTier, tacticalIdentity } from './metadexText.js';
import { getPokemonTypes } from './renderMetadexGuidancePanels.js';

export function dexTile(pokemon, state = {}, selectedId = '') {
  const displayName = getPokemonDisplayName(pokemon);
  const types = getPokemonTypes(pokemon);
  const identity = tacticalIdentity(pokemon);
  const role = inferBeginnerRole(pokemon, identity, state);
  const coverage = scorePokemonGoldCoverage(pokemon, state.data?.requiredGoldFields || []);
  const quality = qualityTier(coverage.completeFields || 0);
  const selected = selectedId === pokemon.pokemon_id;
  const sprite = getPokemonSprite(pokemon, state.data);
  const spriteSrc = typeof sprite === 'string' ? sprite : sprite?.src;
  const spriteAlt = typeof sprite === 'string' ? `${displayName} sprite` : (sprite?.alt || `${displayName} sprite`);
  const form = getPokemonFormLabel(pokemon);
  const primaryRole = role.primaryRole || role.label || identity.identity || identity.primaryPressure || 'Flexible';
  const typeBadges = TypeBadges(pokemon);
  return `<article class="dex-card metadex-tile${selected ? ' selected active' : ''}" data-metadex-card data-metadex-select="${escapeAttr(pokemon.pokemon_id)}" data-action="select-metadex-pokemon" data-pokemon-id="${escapeAttr(pokemon.pokemon_id)}" tabindex="0" role="button" aria-pressed="${selected ? 'true' : 'false'}">
    <div class="metadex-card-head">
      <h3 class="metadex-card-name">${escapeText(displayName)}</h3>
      <div class="type-badge-row metadex-card-types">${typeBadges}</div>
    </div>
    <div class="metadex-card-art" aria-hidden="true">
      <img src="${escapeAttr(spriteSrc)}" alt="${escapeAttr(spriteAlt)}" loading="lazy" onerror="this.src='/assets/pokemon-silhouette.svg'; this.classList.add('sprite-fallback');" />
      <span class="metadex-card-orbit"></span>
    </div>
    <p class="metadex-card-role">${escapeText(primaryRole)}</p>
    <div class="metadex-card-meta">
      ${form ? `<span class="score-pill form-pill">${escapeText(form)}</span>` : ''}
      <span class="score-pill">${escapeText(availabilityText(pokemon))}</span>
      <span class="score-pill quality-${escapeAttr(quality.key || 'strong')}">${escapeText(quality.label)}</span>
    </div>
  </article>`;
}
