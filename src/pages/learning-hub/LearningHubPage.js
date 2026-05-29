import { renderLearningHubHeader } from './renderLearningHubHeader.js';
import { renderLearningHubIndex } from './renderLearningHubOverview.js';
import { renderLearningArticlePage } from './renderLearningHubArticleDetail.js';
import { getRequestedLearningArticle, getRequestedLearningConcept } from './learningHubEvents.js';

export function LearningHubPage(state) {
  const concepts = state.data.collections.concepts || [];
  const principles = state.data.collections.principles || [];
  const combined = [...concepts, ...principles].slice(0, 60);
  const targetConcept = getRequestedLearningConcept();
  const activeArticleId = getRequestedLearningArticle() || targetConcept;

  if (activeArticleId) {
    return renderLearningArticlePage(state, combined, activeArticleId);
  }

  return `
    <section class="page-stack learning-hub-page learning-hub-index-page">
      ${renderLearningHubHeader()}
      ${renderLearningHubIndex(combined)}
    </section>
  `;
}
