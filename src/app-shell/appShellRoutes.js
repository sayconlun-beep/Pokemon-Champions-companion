import { escapeText } from './appShellText.js';

export const METADEX_INITIAL_VISIBLE_LIMIT = 90;
export const METADEX_LOAD_MORE_INCREMENT = 60;

export function ensureMetadexView(state) {
  state.metadex ||= { search: '', legality: 'all', field: 'all', selectedId: '', megaOnly: false, visibleLimit: METADEX_INITIAL_VISIBLE_LIMIT };
  if (!state.metadex.visibleLimit) state.metadex.visibleLimit = METADEX_INITIAL_VISIBLE_LIMIT;
  return state.metadex;
}

export function resetMetadexVisibleLimit(state) {
  const view = ensureMetadexView(state);
  view.visibleLimit = METADEX_INITIAL_VISIBLE_LIMIT;
  return view;
}


export function buildMetadexContextFromLink(routeLink, state = {}) {
  if (!routeLink) return null;
  const source = routeLink.dataset.metadexContextSource || '';
  const rawStep = Number(routeLink.dataset.metadexGuideStep || 0);
  const guideStep = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 0;
  const targetType = routeLink.dataset.metadexAnswerType || routeLink.dataset.metadexTargetType || '';
  const targetRole = routeLink.dataset.metadexTargetRole || '';
  const targetArchetype = routeLink.dataset.metadexTargetArchetype || '';
  const intent = routeLink.dataset.metadexIntent || (targetType ? 'weakness-answer' : guideStep ? 'guide-step' : 'browse');
  if (!source && !guideStep && !targetType && !targetRole && !targetArchetype) return null;
  return {
    source: source || (targetType ? 'weakness-coverage' : 'team-building-guide'),
    guideStep,
    intent,
    targetType,
    targetRole,
    targetArchetype,
    currentTeamSnapshot: Array.isArray(state.team) ? state.team.filter(Boolean).map((slot) => slot?.pokemon_id || slot?.pokemonId || slot?.name || '').filter(Boolean) : []
  };
}

export function applyMetadexContextToView(state, context = {}) {
  const view = resetMetadexVisibleLimit(state);
  view.context = context;
  view.search = '';
  view.field = 'all';
  view.selectedId = '';
  view.roleConfidence = context.guideStep === 6 ? 'flexible' : 'strong-secondary';
  if (context.source === 'weakness-coverage' || context.targetType) {
    view.answerType = context.targetType || context.intent || '';
    view.teamNeed = 'weakness';
    view.teamFit = 'weakness';
    view.sort = 'weakness-answer';
    return;
  }
  view.answerType = '';
  if (context.targetArchetype) view.archetypeFit = context.targetArchetype;
  switch (Number(context.guideStep)) {
    case 3:
      view.guideStep = 'step3';
      view.teamNeed = context.targetRole || 'main';
      view.teamFit = 'any';
      view.sort = 'guide-step';
      break;
    case 4:
      view.guideStep = 'step4';
      view.teamNeed = context.targetRole || 'partner';
      view.teamFit = Array.isArray(state.team) && state.team.filter(Boolean).length ? 'role' : 'any';
      view.sort = 'guide-step';
      break;
    case 5:
      view.guideStep = 'step5';
      view.teamNeed = context.targetRole || 'weakness';
      view.teamFit = Array.isArray(state.team) && state.team.filter(Boolean).length ? 'weakness' : 'any';
      view.sort = 'guide-step';
      break;
    case 6:
      view.guideStep = 'step6';
      view.teamNeed = context.targetRole || 'glue';
      view.teamFit = 'any';
      view.sort = 'guide-step';
      break;
    default:
      view.guideStep = context.guideStep ? `step${context.guideStep}` : 'any';
      if (context.targetRole) view.teamNeed = context.targetRole;
      view.sort = context.guideStep ? 'guide-step' : (view.sort || 'team-fit');
      break;
  }
}
