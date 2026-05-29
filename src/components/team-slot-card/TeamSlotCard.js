import { checkSlotLegality } from '../../core/legalityEngine.js';
import { analyseItemClause } from '../../core/itemClauseEngine.js';
import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { getSlotMegaState } from '../../core/megaEvolutionEngine.js';
import { isPokemonSlotComplete } from '../../core/teamSlotCompletionEngine.js';
import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { generatedBuildCoachNote, formBadge, completionBadge, megaBadge, spriteImage, escapeText } from './teamSlotCardCommon.js';
import { reviewCard } from './renderReviewCard.js';
import { controls, megaPreview } from './renderTeamSlotControls.js';
export { buildSpecificPressureTags, buildTeamPressureCoverageSummary } from './renderStrategicRolePanel.js';

export function TeamSlotCard(slot, index, data, team = [], uiState = {}) {
  const pokemon = slot?.pokemon_id ? data.indexes.pokemonById[slot.pokemon_id] : null;
  const legality = checkSlotLegality(slot, data, team, index);
  const itemClause = analyseItemClause(team, data);
  const itemConflict = itemClause.conflictSlotIndexes.has(index);
  const sprite = pokemon ? getPokemonSprite(pokemon) : null;
  const megaState = pokemon ? getSlotMegaState(slot, data) : null;
  const completion = isPokemonSlotComplete(slot, { data, team, index });
  const collapsed = Boolean(uiState?.collapsed && slot);
  if (collapsed) return reviewCard(slot, index, data, team, itemConflict);
  return `<article class="card team-slot ${itemConflict ? 'item-clause-conflict' : ''}" data-slot-card="${index}">
    <header class="slot-identity-card mobile-compact-slot-head redesigned-slot-header">
      <button type="button" class="slot-pokemon-picker-card redesigned-pokemon-picker" data-selector-focus="pokemon" data-slot="${index}" aria-label="${pokemon ? `Change ${escapeText(getPokemonDisplayName(pokemon))}` : 'Choose Pokémon'}">
        <span class="slot-sprite-stage">${sprite ? spriteImage(sprite, pokemon, 'team-slot-sprite') : '<span class="pokemon-sprite-frame empty team-slot-sprite" aria-hidden="true"></span>'}</span>
        <span class="slot-title-copy centered redesigned-title-copy">
          <span class="eyebrow compact-line mobile-slot-number slot-number-label">Slot ${index + 1}</span>
          <span class="slot-pokemon-name">${escapeText(pokemon ? getPokemonDisplayName(pokemon) : 'Choose Pokémon')}</span>
          ${pokemon ? `<span class="compact-line type-badge-row identity-badges redesigned-identity-badges">${TypeBadges(pokemon)}${formBadge(pokemon)}${megaBadge(megaState)}</span>` : '<span class="muted small-copy">Tap to search and select.</span>'}
        </span>
      </button>
      <div class="slot-action-row slot-header-actions redesigned-slot-actions" aria-label="Slot actions">
        ${slot ? `<div class="slot-status-toggle-row">${pokemon ? completionBadge(completion, index) : ''}<button type="button" class="slot-chevron-button" data-collapse-slot="${index}" aria-label="Minimise slot ${index + 1}"><span aria-hidden="true">⌄</span></button></div><button type="button" class="clear-slot-link" data-clear-slot="${index}" aria-label="Clear slot ${index + 1}"><span class="trash-icon" aria-hidden="true">🗑</span><span>Clear</span></button>` : ''}
      </div>
    </header>
    ${generatedBuildCoachNote(slot)}
    ${pokemon ? megaPreview(megaState, data) : ''}
    ${pokemon ? controls(slot, index, data, pokemon, legality, team, uiState) : '<p class="muted">Choose a Pokémon to unlock legal set controls.</p>'}
  </article>`;
}

