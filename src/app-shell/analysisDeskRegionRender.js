import { renderAnalysisDeskDynamicRegion } from '../pages/analysis-desk/AnalysisDeskPage.js';

export function renderAnalysisDeskDynamicRegions(root, state) {
  if (!root || state?.route !== 'analysis-desk') return false;
  const page = root.querySelector('[data-analysis-desk-page], .analysis-desk-page');
  const region = page?.querySelector('[data-analysis-desk-dynamic-region]');
  if (!page || !region) return false;

  region.innerHTML = renderAnalysisDeskDynamicRegion(state);
  return true;
}

export function analysisDeskSignature(state) {
  const teamSignature = (Array.isArray(state?.team) ? state.team : [])
    .slice(0, 6)
    .map((slot) => slotSignature(slot))
    .join('||');
  const scenario = state?.matchupsScenario || {};
  return [
    teamSignature,
    scenario.selectedOpponentId || '',
    state?.activeSavedTeamId || '',
    state?.proStudySandbox?.active ? 'study' : ''
  ].join('::');
}

function slotSignature(slot = {}) {
  if (!slot || !slot.pokemon_id) return 'empty';
  const moves = Array.isArray(slot.moves)
    ? slot.moves
    : [slot.move1, slot.move2, slot.move3, slot.move4];
  const stats = slot.statAllocation || slot.stats || slot.spread || {};
  const statSignature = Object.keys(stats)
    .sort()
    .map((key) => `${key}:${stats[key] ?? ''}`)
    .join(',');
  return [
    slot.pokemon_id || '',
    slot.ability_id || '',
    slot.item_id || '',
    slot.nature || '',
    moves.filter(Boolean).join(','),
    statSignature,
    slot.isCoreAnchor ? 'core' : ''
  ].join('|');
}
