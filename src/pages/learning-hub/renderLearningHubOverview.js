import { LEARNING_SECTIONS, LEARNING_CATEGORY_LABELS, LEARNING_CATEGORY_ORDER } from './learningHubState.js';
import { learningHubLazySectionRenderers, queueLearningHubLazySectionInit } from './renderLearningHubProgress.js';
import { getLearningHubArticleTiles, renderLearningArticleTile } from './renderLearningHubArticleList.js';
import { renderLearningSection } from './renderLearningHubGuideCards.js';
import { escapeAttr, escapeText } from './learningHubHelpers.js';

export function renderLearningHubIndex(combined) {
  const articles = getLearningHubArticleTiles(combined);
  learningHubLazySectionRenderers.clear();
  const categories = LEARNING_CATEGORY_ORDER.map((category) => {
    const items = articles.filter((article) => article.category === category);
    if (!items.length) return null;
    const sectionName = `learning-category-${category}`;
    learningHubLazySectionRenderers.set(sectionName, () => renderLearningHubCategoryBody(items));
    return { category, items, sectionName };
  }).filter(Boolean);
  queueLearningHubLazySectionInit();
  return `
    <section class="learning-hub-index" aria-label="Learning Hub articles">
      <div class="learning-filter-row" aria-label="Learning categories">
        <span class="pill-button active">All</span>
        ${LEARNING_CATEGORY_ORDER.map((category) => `<span class="pill-button">${escapeText(LEARNING_CATEGORY_LABELS[category])}</span>`).join('')}
      </div>
      ${categories.map(({ category, items, sectionName }, index) => `
        <section class="learning-index-category" aria-labelledby="learning-category-${escapeAttr(category)}">
          <div class="learning-index-category-header">
            <h2 id="learning-category-${escapeAttr(category)}">${escapeText(LEARNING_CATEGORY_LABELS[category])}</h2>
            <span>${items.length} article${items.length === 1 ? '' : 's'}</span>
          </div>
          <div data-lazy-section="${escapeAttr(sectionName)}" class="${['lazy-section', 'place' + 'holder'].join('-')}"${index === 0 ? ' data-lazy-rendered="true"' : ''}>
            ${index === 0 ? renderLearningHubCategoryBody(items) : ''}
          </div>
        </section>
      `).join('')}
    </section>
  `;
}

export function renderLearningHubCategoryBody(items) {
  return `
    <div class="learning-index-grid">
      ${items.map(renderLearningArticleTile).join('')}
    </div>
  `;
}
