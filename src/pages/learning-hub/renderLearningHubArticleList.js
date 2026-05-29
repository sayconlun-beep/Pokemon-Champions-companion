import { LEARNING_SECTIONS, LEARNING_CATEGORY_BY_ID, LEARNING_CATEGORY_LABELS } from './learningHubState.js';
import { slugify, getSectionPreview, escapeText, escapeAttr } from './learningHubHelpers.js';

export function getLearningHubArticleTiles(combined) {
  const tiles = LEARNING_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.id === 'speed-control' ? 'Learn why moving first matters and how Tailwind, Trick Room, speed drops, priority, and natural Speed shape battles.' : (section.helper || section.preview || getSectionPreview(section)),
    category: LEARNING_CATEGORY_BY_ID[section.id] || 'quick',
    categoryLabel: section.id === 'speed-control' ? 'Core Battle Concepts' : null
  }));
  tiles.push({ id: 'team-archetypes', title: 'Team Archetypes', description: 'Learn the common team styles, how they win, what they need, and when to build them.', category: 'archetypes' });
  tiles.push({ id: 'item-choices-page', title: 'Item Choices', description: 'Browse held items and learn how to choose items based on a Pokémon’s role.', category: 'details', route: 'items', href: '/items' });
  tiles.push({ id: 'learn-from-pro-teams', title: 'Learn From Pro Teams', description: 'Study real tournament teams and learn how strong teams are structured.', category: 'quick' });
  return tiles;
}

export function renderLearningArticleTile(article) {
  return `
    <a class="learning-index-tile" href="${escapeAttr(article.href || `/learning-hub?article=${article.id}`)}" data-route="${escapeAttr(article.route || 'learning-hub')}">
      <span class="learning-index-tile-tag">${escapeText(article.categoryLabel || LEARNING_CATEGORY_LABELS[article.category] || 'Learning')}</span>
      <strong>${escapeText(article.title)}</strong>
      <p>${escapeText(article.description)}</p>
      <span class="learning-index-open">Start reading →</span>
    </a>
  `;
}
