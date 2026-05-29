// URL/query helpers used by the Learning Hub route.
export function getLearningHubExpandedSections(state, combined) {
  if (state.learningHubExpanded && typeof state.learningHubExpanded === 'object') {
    return new Set(Object.entries(state.learningHubExpanded).filter(([, open]) => Boolean(open)).map(([id]) => id));
  }

  const targetConcept = getRequestedLearningConcept();
  if (targetConcept) {
    const matchingSection = findSectionForConcept(targetConcept, combined);
    if (matchingSection) return new Set([matchingSection.id]);
  }

  return new Set(['team-building-intent']);
}

export function getRequestedLearningArticle() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('article') || params.get('concept') || params.get('learning') || (window.location.hash || '').replace(/^#/, '');
    if (!raw) return '';
    return String(raw).replace(/^learning-card-/, '').trim();
  } catch {
    return '';
  }
}

export function getRequestedLearningConcept() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('concept') || params.get('learning') || (window.location.hash || '').replace(/^#/, '');
    if (!raw) return '';
    return slugify(raw.replace(/^learning-card-/, ''));
  } catch {
    return '';
  }
}
