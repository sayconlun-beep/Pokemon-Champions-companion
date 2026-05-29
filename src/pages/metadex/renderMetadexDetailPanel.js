import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { renderDataConfidenceDisclosure } from '../../logic/dataConfidenceDisclosure.js';
import { metadexCache, metadexViewCacheKey, pokemonCacheKey, teamCacheKey } from './metadexCache.js';
import { availabilityText, escapeAttr, escapeText, legalAbilities, legalMoves, option, qualityTier, section, tacticalIdentity } from './metadexText.js';
import { weaknessAnswerFitPanel } from './renderMetadexAnswerPanels.js';
import { recommendedBuildOptionsPanel } from './renderMetadexBuildOptions.js';
import { choiceGuidancePanel, getPokemonTypes, guidedCoachFitPanel, metadexGuidedBuilderActions, quickBuildSummaryPanel, referenceOptionsPanel, teamFitPanel, teamNeedsPanel, teamValuePanel } from './renderMetadexGuidancePanels.js';

export function cachedDetailPanel(pokemon, state = {}) {
  const cache = metadexCache(state).detailPanels;
  const key = `${pokemonCacheKey(pokemon)}|${teamCacheKey(state)}|${metadexViewCacheKey(state.metadex || {})}`;
  if (cache.has(key)) return cache.get(key);
  const html = renderDetailPanel(pokemon, state);
  cache.set(key, html);
  return html;
}

export function renderMetadexDetailOverlay(pokemon, state = {}) {
  const displayName = getPokemonDisplayName(pokemon);
  return `<section class="direct-move-picker-overlay metadex-detail-overlay" aria-label="Selected Pokémon details" data-metadex-detail-overlay>
    <div class="direct-move-picker-panel metadex-detail-overlay-panel" role="dialog" aria-modal="true" aria-label="${escapeAttr(displayName)} details">
      <header class="direct-move-picker-head metadex-detail-overlay-head">
        <div>
          <p class="eyebrow">MetaDex detail view</p>
          <h2>${escapeText(displayName)}</h2>
        </div>
        <button type="button" class="direct-move-picker-close metadex-detail-close" data-action="close-metadex-detail" aria-label="Close Pokémon details">×</button>
      </header>
      <div class="metadex-detail-overlay-body">${cachedDetailPanel(pokemon, state)}</div>
    </div>
  </section>`;
}

export function renderMobileSelectedDetailPanel(pokemon, state = {}) {
  return renderMetadexDetailOverlay(pokemon, state);
}

export function renderDetailPanel(pokemon, state = {}) {
  const identity = tacticalIdentity(pokemon);
  const legalMoveRows = legalMoves(pokemon, state);
  const abilities = legalAbilities(pokemon, state);
  const sprite = getPokemonSprite(pokemon, state.data);
  const spriteSrc = typeof sprite === 'string' ? sprite : sprite?.src;
  const spriteAlt = typeof sprite === 'string' ? 'Pokémon sprite' : (sprite?.alt || 'Pokémon sprite');
  const displayName = getPokemonDisplayName(pokemon);
  const types = getPokemonTypes(pokemon);
  const coverage = scorePokemonGoldCoverage(pokemon, state.data?.requiredGoldFields || []);
  const quality = qualityTier(coverage.completeFields || 0);
  return `<div class="metadex-detail-stack">
    <header class="metadex-detail-header">
      <div class="dex-card-sprite metadex-detail-sprite"><img src="${escapeAttr(spriteSrc)}" alt="${escapeAttr(spriteAlt)}" loading="lazy" onerror="this.src='/assets/pokemon-silhouette.svg';" /></div>
      <div>
        <p class="eyebrow">${escapeText(availabilityText(pokemon))}</p>
        <h2>${escapeText(displayName)}</h2>
        <p class="muted">${escapeText(types.join(' / ') || pokemon.typing || 'Unknown type')}</p>
        <div class="team-guide-chip-row">
          <span class="score-pill">${escapeText(quality.label)}</span>
          <span class="score-pill">${escapeText((identity.identity || identity.primaryPressure || 'Flexible tactical option').toString().slice(0, 80))}</span>
        </div>
      </div>
    </header>
    ${renderDataConfidenceDisclosure(pokemon, { id: `metadex-${pokemon.pokemon_id || displayName}`, includeStrategicNote: true })}
    ${weaknessAnswerFitPanel(pokemon, state)}
    ${quickBuildSummaryPanel(pokemon, identity, state)}
    ${teamValuePanel(pokemon, identity, state)}
    ${teamNeedsPanel(pokemon, identity, state)}
    ${guidedCoachFitPanel(pokemon, identity, state)}
    ${teamFitPanel(pokemon, identity, state)}
    ${choiceGuidancePanel(pokemon, identity, state)}
    ${recommendedBuildOptionsPanel(pokemon, identity, state)}
    ${referenceOptionsPanel(legalMoveRows, abilities)}
    ${metadexGuidedBuilderActions(pokemon, state)}
  </div>`;
}
