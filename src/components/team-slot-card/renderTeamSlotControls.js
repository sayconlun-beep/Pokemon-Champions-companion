import { MoveSelectionList } from '../MoveSelect.js';
import { AbilitySelect } from '../AbilitySelect.js';
import { ItemSelect } from '../ItemSelect.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { statPanel } from './renderStatPanel.js';
import { spreadAnalysisPanel } from './spreadAnalysisPanel.js';
import { strategicRolePanel, currentBuildSummary, itemConflictPanel } from './renderStrategicRolePanel.js';
import { escapeText } from './teamSlotCardCommon.js';

export function megaPreview(megaState, data) {
  if (!megaState || megaState.status === 'none') return '';
  const rows = [];
  if (megaState.activeMega) {
    const mega = data.indexes.pokemonById[megaState.activeMega.megaPokemonId];
    const megaAbilities = (data.indexes.abilitiesByPokemon[megaState.activeMega.megaPokemonId] || []).map((row) => row.ability_name).filter(Boolean).slice(0, 2).join(', ');
    rows.push(`<div><strong>${escapeText(megaState.activeMega.megaName)}</strong><span>${TypeBadges(mega)}${megaAbilities ? ` · ${escapeText(megaAbilities)}` : ''}</span></div>`);
    rows.push(`<p class="muted small-copy">Required stone: ${escapeText(megaState.activeMega.requiredItemName || 'Mega data incomplete')}</p>`);
  } else if (megaState.options?.length) {
    rows.push(`<p class="muted small-copy"><strong>Mega Evolution:</strong> ${megaState.options.map((option) => `${option.megaName} via ${option.requiredItemName || 'unknown stone'}`).map(escapeText).join(' · ')}</p>`);
  }
  return `<section class="mega-preview ${megaState.activeMega ? 'active' : ''}">${rows.join('')}</section>`;
}

export function controls(slot, index, data, pokemon, legality, team, uiState = {}) {
  const buildContent = `<div class="slot-control-grid polished-slot-control-grid desktop-workbench-build-grid">
    <section class="build-editor-section ability-section polished-control-card"><div class="build-section-head"><h4>Ability</h4></div>${AbilitySelect(index, slot, data)}</section>
    <section class="build-editor-section item-section polished-control-card"><div class="build-section-head"><h4>Item</h4></div>${ItemSelect(index, slot, data, team, pokemon)}${itemConflictPanel(slot, index, data, team)}</section>
    <section class="build-editor-section nature-moves-section compact-moves-section polished-control-card"><div class="build-section-head"><h4>Moves</h4><span>Manual selection</span></div>${MoveSelectionList(index, slot, data)}</section>
  </div>`;
  const statsContent = statPanel(slot, index, data.indexes.statsByPokemon[pokemon.pokemon_id], pokemon);
  const buildSummary = currentBuildSummary(slot, index, data, pokemon);
  const spread = spreadAnalysisPanel(slot, index, data, pokemon, team);
  const role = strategicRolePanel(slot, index, pokemon, uiState, team, data);
  return `<div class="build-editor-shell polished-build-editor-shell team-slot-workbench-shell slot-ia-workspace">
    <div class="desktop-slot-workbench slot-ia-grid" aria-label="Expanded competitive build workbench">
      <section class="desktop-workbench-column desktop-workbench-left slot-zone slot-zone-build" aria-label="Build configuration">
        <div class="slot-zone-heading"><span>Build Configuration</span><em>How this Pokémon is built</em></div>
        ${buildSummary}
        ${buildContent}
      </section>
      <section class="desktop-workbench-column desktop-workbench-right slot-zone slot-zone-performance" aria-label="Performance and stats">
        <div class="slot-zone-heading"><span>Performance & Stats</span><em>What these stats accomplish</em></div>
        ${statsContent}
        ${spread}
      </section>
      <section class="desktop-workbench-column slot-zone slot-zone-context" aria-label="Team context">
        <div class="slot-zone-heading"><span>Team Context</span><em>What this Pokémon does for the team</em></div>
        ${role}
      </section>
    </div>
    <div class="mobile-slot-stack slot-ia-mobile-stack">
      <details class="mobile-slot-editor-section mobile-build-section" open><summary><span>Build</span><em>Ability, item, and moves</em></summary><div class="mobile-slot-section-body">${buildSummary}${buildContent}</div></details>
      <details class="mobile-slot-editor-section mobile-stats-section" open><summary><span>Stats + spread analysis</span><em>Numbers, nature, and tradeoffs</em></summary><div class="mobile-slot-section-body">${statsContent}${spread}</div></details>
      ${role}
    </div>
  </div>`;
}