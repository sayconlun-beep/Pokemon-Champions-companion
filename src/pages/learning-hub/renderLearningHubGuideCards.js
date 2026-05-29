import { escapeText, escapeAttr, slugify, inferRelated, inferExample, inferWhyItMatters, inferCommonMistake, inferBeginnerTip, generateTakeaway, getSectionPreview } from './learningHubHelpers.js';
import { renderCustomLearningArticle, renderTeamBuildingIntentArticle } from './renderLearningHubCustomArticles.js';
import { renderTypingArticle } from './renderLearningHubTypingArticle.js';

export function renderLearningSection(section, combined, expandedSections, targetConcept) {
  const content = renderSectionContent(section, combined, targetConcept);
  const isOpen = expandedSections.has(section.id);

  return `
    <details class="learning-section-panel learning-section-accordion" data-learning-section="${escapeText(section.id)}" ${isOpen ? 'open' : ''}>
      <summary class="learning-section-header">
        <div>
          <h2>${escapeText(section.title)}</h2>
          <p>${escapeText(section.helper)}</p>
          <span class="learning-section-preview">${escapeText(section.preview || getSectionPreview(section))}</span>
        </div>
        <span class="learning-section-toggle" aria-hidden="true"></span>
      </summary>
      <div class="learning-grid">
        ${content || '<article class="mini-card"><p class="muted">No linked concepts available.</p></article>'}
      </div>
    </details>
  `;
}

export function renderSectionContent(section, combined, targetConcept) {
  if (section.kind === 'concepts') {
    const items = combined.filter((c) => {
      const text = JSON.stringify(c).toLowerCase();
      return section.keywords.some((k) => text.includes(k));
    }).slice(0, 12);

    return items.map((item) => renderConceptCard(item, targetConcept)).join('');
  }

  if (section.id === 'team-building-intent') return renderTeamBuildingIntentArticle(targetConcept);
  if (section.id === 'learning-typing') return renderTypingArticle(section, targetConcept);
  if (section.kind === 'custom') return renderCustomLearningArticle(section, targetConcept);

  return section.items.map(([title, text]) => renderLearningCard({
    title,
    summary: text,
    whyItMatters: inferWhyItMatters(title),
    example: inferExample(title),
    mistake: inferCommonMistake(title),
    tip: inferBeginnerTip(title),
    targetConcept
  })).join('');
}

export function renderConceptCard(row, targetConcept) {
  const title = row.title || row.name || row.concept || 'Concept';
  const summary = row.summary || row.description || row.text || 'A useful competitive idea that helps explain team decisions.';
  const whyItMatters = row.matters || inferWhyItMatters(title);
  const example = inferExample(title);
  const mistake = inferCommonMistake(title);
  const tip = inferBeginnerTip(title);

  return renderLearningCard({ title, summary, whyItMatters, example, mistake, tip, targetConcept });
}

export function renderLearningCard({ title, summary, whyItMatters, example, mistake, tip, targetConcept }) {
  const slug = slugify(title);
  const highlighted = targetConcept && slug === targetConcept;
  return `
    <details class="learning-concept-card learning-friendly-card ${highlighted ? 'learning-target-card' : ''}" id="learning-card-${escapeText(slug)}" ${highlighted ? 'open' : ''}>
      <summary>
        <div class="learning-card-summary">
          <h3>${escapeText(title)}</h3>
          <p>${escapeText(summary)}</p>
          <div class="learning-why-block">
            <span>Why it matters</span>
            <p>${escapeText(whyItMatters)}</p>
          </div>
        </div>
        <span class="learn-more-button">Learn More</span>
      </summary>

      <div class="learning-card-content">
        <div class="learning-info-block tactical-example">
          <h4>Simple example</h4>
          <p>${escapeText(example)}</p>
        </div>

        <div class="learning-info-block">
          <h4>Common mistake</h4>
          <p>${escapeText(mistake)}</p>
        </div>

        <div class="learning-info-block tactical-takeaway">
          <h4>Beginner tip</h4>
          <p>${escapeText(tip)}</p>
        </div>
      </div>
    </details>
  `;
}
