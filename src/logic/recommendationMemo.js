const recommendationMemo = new Map();
let pendingRecommendationKey = '';

export function teamRecommendationKey(state = {}) {
  return JSON.stringify({
    focus: state.builderFocus || [],
    team: (state.team || []).map((slot) => slot ? {
      p: slot.pokemon_id || '',
      i: slot.item_id || '',
      a: slot.ability_id || '',
      n: slot.nature || '',
      m: slot.moves || []
    } : null)
  });
}

export function getTeamBuilderRecommendation(key) {
  return recommendationMemo.get(key) || null;
}

export function setTeamBuilderRecommendation(key, items) {
  if (!key) return null;
  const entry = { key, items: Array.isArray(items) ? items : [] };
  recommendationMemo.set(key, entry);
  return entry;
}

export function isTeamBuilderRecommendationPending(key) {
  return Boolean(key) && pendingRecommendationKey === key;
}

export function markTeamBuilderRecommendationPending(key) {
  pendingRecommendationKey = key || '';
}

export function clearTeamBuilderRecommendationPending(key = '') {
  if (!key || pendingRecommendationKey === key) pendingRecommendationKey = '';
}

export function resetTeamBuilderRecommendationMemo() {
  recommendationMemo.clear();
  pendingRecommendationKey = '';
}
