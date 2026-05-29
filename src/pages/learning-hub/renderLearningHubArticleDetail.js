import { LEARNING_SECTIONS, LEARNING_CATEGORY_LABELS, LEARNING_CATEGORY_BY_ID } from './learningHubState.js';
import { renderLearningSection, renderSectionContent } from './renderLearningHubGuideCards.js';
import { getLearningHubExpandedSections } from './learningHubEvents.js';
import { escapeText, slugify, getSectionPreview, getSectionConceptSlugs } from './learningHubHelpers.js';
import { renderTeamArchetypesIndexPage, renderTeamArchetypeArticlePage, findTeamArchetypeByArticleId } from './renderLearningHubArchetypeArticles.js';
import { mergeProTeamStateCollections, renderProTeamLearningHub } from './renderLearningHubProTeamStudy.js';
import { renderCustomLearningArticle, renderTeamBuildingIntentArticle } from './renderLearningHubCustomArticles.js';
import { renderTypingArticle } from './renderLearningHubTypingArticle.js';
import { renderSpeedControlArticlePage } from './renderLearningHubSpeedControlArticle.js';

export function renderLearningArticlePage(state, combined, requestedId) {
  const section = findLearningSectionByArticleId(requestedId, combined);
  if (requestedId === 'team-archetypes') {
    return renderTeamArchetypesIndexPage();
  }
  if (requestedId === 'speed-control') {
    return renderSpeedControlArticlePage();
  }
  const archetype = findTeamArchetypeByArticleId(requestedId);
  if (archetype) {
    return renderTeamArchetypeArticlePage(archetype);
  }
  if (requestedId === 'learn-from-pro-teams') {
    return `
      <section class="page-stack learning-hub-page learning-hub-article-page">
        ${renderLearningArticleBackBar('Learn From Pro Teams')}
        ${renderProTeamLearningHub(state)}
      </section>
    `;
  }
  if (!section) {
    return `
      <section class="page-stack learning-hub-page learning-hub-article-page">
        ${renderLearningArticleBackBar('Learning Hub')}
        <article class="learning-section-panel learning-article-shell">
          <h1>Article not found</h1>
          <p class="muted">This Learning Hub article could not be found. Return to the index and choose another topic.</p>
        </article>
      </section>
    `;
  }
  const content = renderSectionContent(section, combined, slugify(requestedId));
  return `
    <section class="page-stack learning-hub-page learning-hub-article-page">
      ${renderLearningArticleBackBar(section.title)}
      <article class="learning-section-panel learning-article-shell">
        <header class="learning-article-title">
          <span class="section-kicker">${escapeText(LEARNING_CATEGORY_LABELS[LEARNING_CATEGORY_BY_ID[section.id] || 'quick'] || 'Learning Hub')}</span>
          <h1>${escapeText(section.title)}</h1>
          <p>${escapeText(section.helper || section.preview || getSectionPreview(section))}</p>
        </header>
        <div class="learning-article-content">
          ${content || '<p class="muted">No linked concepts available.</p>'}
        </div>
      </article>
    </section>
  `;
}

export function renderLearningArticleBackBar(title) {
  return `
    <nav class="learning-article-backbar" aria-label="Learning article navigation">
      <a class="secondary-button" href="/learning-hub" data-route="learning-hub">← Back to Learning Hub</a>
      <span>${escapeText(title)}</span>
    </nav>
  `;
}

export function findLearningSectionByArticleId(requestedId, combined) {
  const normalized = slugify(String(requestedId || '').replace(/^learning-card-/, ''));
  return LEARNING_SECTIONS.find((section) => section.id === requestedId || slugify(section.id) === normalized || slugify(section.title) === normalized || getSectionConceptSlugs(section, combined).has(normalized));
}
