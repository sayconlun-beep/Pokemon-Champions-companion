import { ARCHETYPE_FILTERS, TEAM_ARCHETYPES, ARCHETYPE_ARTICLES } from './learningHubState.js';
import { escapeText, escapeAttr, slugify, getRelatedLearningTopics, getLearningTopicLink } from './learningHubHelpers.js';

export function renderTeamArchetypesIndexPage() {
  return `
    <section class="page-stack learning-hub-page learning-hub-article-page learning-archetypes-page">
      ${renderLearningArticleBackBar('Team Archetypes')}
      <article class="learning-section-panel learning-article-shell">
        <header class="learning-article-title">
          <span class="section-kicker">Team Building</span>
          <h1>Team Archetypes</h1>
          <p>Understand the main styles of Pokémon Champions teams and how each one tries to win.</p>
        </header>
        <div class="learning-archetype-intro">
          <p>An archetype is the overall style or game plan of a team. It helps explain what your team is trying to do, what kind of Pokémon it needs, and what matchups it may struggle with.</p>
          <p>A team does not have to fit one archetype perfectly. Many good teams mix ideas, but knowing the main archetypes helps you build with clearer intent.</p>
        </div>
        <div class="learning-filter-row" aria-label="Team archetype filters">
          ${ARCHETYPE_FILTERS.map((filter, index) => `<button class="pill-button ${index === 0 ? 'active' : ''}" type="button" data-archetype-filter="${escapeAttr(filter)}">${escapeText(filter)}</button>`).join('')}
        </div>
        <div class="learning-index-grid learning-archetype-grid" data-archetype-grid>
          ${TEAM_ARCHETYPES.map(renderArchetypeTile).join('')}
        </div>
      </article>
    </section>
  `;
}

export function renderArchetypeTile(archetype) {
  const article = ARCHETYPE_ARTICLES[archetype.id] || null;
  return `
    <a class="learning-index-tile learning-archetype-tile" href="/learning-hub?article=learning-archetype-${escapeAttr(archetype.id)}" data-route="learning-hub" data-archetype-tags="${escapeAttr(archetype.tags.join('|'))}">
      <span class="learning-index-tile-tag">${escapeText(archetype.tags[0] || 'Team Building')}</span>
      <strong>${escapeText(archetype.title)}</strong>
      <p>${escapeText(article?.subtitle || archetype.description)}</p>
      <span class="archetype-tag-row">${archetype.tags.map((tag) => `<em>${escapeText(tag)}</em>`).join('')}</span>
      <span class="learning-index-open">Start reading →</span>
    </a>
  `;
}

export function renderTeamArchetypeArticlePage(archetype) {
  const article = ARCHETYPE_ARTICLES[archetype.id] || null;
  const related = article?.related ? article.related.map((id) => TEAM_ARCHETYPES.find((item) => item.id === id)).filter(Boolean) : getRelatedArchetypes(archetype).slice(0, 5);
  const learningLinks = article?.topics ? article.topics.map(getLearningTopicLink).filter(Boolean) : getRelatedLearningTopics(archetype).slice(0, 6);
  const roles = getArchetypeRoles(archetype);
  const strengths = getArchetypeStrengths(archetype);
  const weaknesses = getArchetypeWeaknesses(archetype);
  const mistakes = getArchetypeMistakes(archetype);
  const chooseWhen = getArchetypeChooseWhen(archetype);
  const carefulWhen = getArchetypeCarefulWhen(archetype);
  return `
    <section class="page-stack learning-hub-page learning-hub-article-page learning-archetypes-page">
      <nav class="learning-article-backbar" aria-label="Team archetype navigation">
        <a class="secondary-button" href="/learning-hub?article=team-archetypes" data-route="learning-hub">← Back to Team Archetypes</a>
        <a class="secondary-button" href="/learning-hub" data-route="learning-hub">Back to Learning Hub</a>
      </nav>
      <article class="learning-section-panel learning-article-shell">
        <header class="learning-article-title">
          <span class="section-kicker">Team Archetype</span>
          <h1>${escapeText(archetype.title)}</h1>
          <p>${escapeText(article?.subtitle || archetype.description)}</p>
          <div class="archetype-tag-row">${archetype.tags.map((tag) => `<em>${escapeText(tag)}</em>`).join('')}</div>
        </header>

        <div class="archetype-article-grid">
          ${renderArchetypeSection('What this archetype is', article?.what || [`${archetype.title} is ${archetype.description.charAt(0).toLowerCase()}${archetype.description.slice(1)}`, 'Use this label as a building shortcut: it tells you what your team is trying to do and what kinds of roles you should look for before filling all six slots.'])}
          ${renderArchetypeSection('How this archetype wins', article?.wins || [`This style usually wins when it ${archetype.wins}`, 'In Pokémon Champions, that means building turns where your important Pokémon can act safely, then converting those turns into knockouts, control, or a winning endgame.'])}
          ${renderArchetypeListSection('What this archetype needs', article?.needs || archetype.needs)}
          ${renderArchetypeListSection('Common Pokémon roles', article?.roles || roles)}
          ${renderArchetypeListSection('Strengths', article?.strengths || strengths)}
          ${renderArchetypeListSection('Weaknesses', article?.weaknesses || weaknesses)}
          ${renderArchetypeListSection('Common mistakes', article?.mistakes || mistakes)}
          ${renderArchetypeSection('How to build it in Pokémon Champions', article?.build || ['Use Metadex to find Pokémon that match the needed roles, then use Team Builder to assemble a first draft instead of trying to perfect every slot immediately.', 'Use Analysis to check structure and weaknesses, Matchups to review problem archetypes, and Damage to test important KOs and survival benchmarks.'])}
          ${renderArchetypeListSection('When to choose this archetype', article?.choose || chooseWhen)}
          ${renderArchetypeListSection('Be careful choosing this archetype when', article?.careful || carefulWhen)}
          ${renderArchetypeLinkSection('Related archetypes', related.map((item) => ({ label: item.title, href: `/learning-hub?article=learning-archetype-${item.id}` })))}
          ${renderArchetypeLinkSection('Related Learning Hub topics', learningLinks)}
        </div>

        <div class="learning-action-row archetype-action-row">
          <a class="secondary-button" href="/learning-hub?article=team-archetypes" data-route="learning-hub">Back to Team Archetypes</a>
          <a class="secondary-button" href="/learning-hub" data-route="learning-hub">Back to Learning Hub</a>
          <a class="secondary-button" href="/metadex" data-route="metadex">Open Metadex</a>
          <a class="secondary-button" href="/team-builder" data-route="team-builder">Open Team Builder</a>
          <a class="secondary-button" href="/analysis-desk" data-route="analysis-desk">Open Analysis</a>
          <a class="secondary-button" href="/matchups" data-route="matchups">Open Matchups</a>
          <a class="secondary-button" href="/damage" data-route="damage">Open Damage</a>
        </div>
      </article>
    </section>
  `;
}

export function renderArchetypeSection(title, paragraphs) {
  return `<section class="learning-info-block"><h4>${escapeText(title)}</h4>${paragraphs.map((paragraph) => `<p>${escapeText(paragraph)}</p>`).join('')}</section>`;
}

export function renderArchetypeListSection(title, items) {
  return `<section class="learning-info-block"><h4>${escapeText(title)}</h4><ul>${items.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></section>`;
}

export function renderArchetypeLinkSection(title, links) {
  return `<section class="learning-info-block"><h4>${escapeText(title)}</h4><div class="learning-action-row">${links.map((link) => `<a class="secondary-button" href="${escapeAttr(link.href)}" data-route="learning-hub">${escapeText(link.label)}</a>`).join('')}</div></section>`;
}

export function getArchetypeRoles(archetype) {
  const roles = ['main attacker', 'secondary attacker', 'support', 'defensive pivot'];
  if (archetype.tags.includes('Speed Control')) roles.push(archetype.id === 'trick-room' ? 'Trick Room setter' : 'speed control');
  if (archetype.tags.includes('Setup')) roles.push('setup attacker', 'setup support');
  if (archetype.tags.includes('Weather / Field')) roles.push(archetype.id === 'weather' ? 'weather setter' : 'terrain setter');
  if (archetype.id.includes('redirection')) roles.push('redirection support');
  if (archetype.id.includes('priority')) roles.push('cleaner');
  if (archetype.id.includes('stall')) roles.push('disruption support');
  return [...new Set(roles)].slice(0, 7);
}

export function getArchetypeStrengths(archetype) {
  return ['Gives the team a clear plan from preview.', 'Makes it easier to choose roles in Metadex.', 'Helps you decide which Pokémon should lead and which should stay in the back.', archetype.tags.includes('Flexible') ? 'Can adapt across several matchups.' : 'Can strongly pressure teams that are not prepared for its plan.'];
}

export function getArchetypeWeaknesses(archetype) {
  return [archetype.caution, 'Can struggle if key support is removed too early.', 'Can become awkward if the six Pokémon do not all support the same plan.', 'Needs testing because some problems only appear in real games.'];
}

export function getArchetypeMistakes(archetype) {
  return ['Adding strong Pokémon that do not help the archetype’s plan.', 'Forgetting enough Protect, switching, or positioning tools.', 'Building only for the best-case lead and not the difficult matchups.', 'Changing too many things after one bad game instead of looking for patterns.'];
}

export function getArchetypeChooseWhen(archetype) {
  return ['Your favourite Pokémon naturally fits one of the common roles.', 'You can explain how the team creates safe turns and converts them into progress.', 'The needed roles are available in Metadex and do not overload one slot.', 'You want a clear structure for your first draft.'];
}

export function getArchetypeCarefulWhen(archetype) {
  return [archetype.caution, 'Your team has no clear answer to opposing speed control.', 'You cannot identify which Pokémon actually closes games.', 'The archetype forces you to use roles you do not understand yet.'];
}

export function getRelatedArchetypes(archetype) {
  const preferred = {
    'balanced-offense': ['bulky-offense', 'balance', 'goodstuff', 'mode-based'],
    'hyper-offense': ['tailwind-offense', 'spread-damage', 'priority-offense', 'setup-offense'],
    'trick-room': ['mode-based', 'bulky-offense', 'redirection-setup', 'anti-meta'],
    'weather': ['terrain', 'mode-based', 'tailwind-offense', 'balance'],
    'terrain': ['weather', 'setup-offense', 'redirection-setup', 'balance'],
    'setup-offense': ['redirection-setup', 'hyper-offense', 'priority-offense', 'core-centric']
  }[archetype.id] || ['balanced-offense', 'balance', 'mode-based', 'goodstuff', 'core-centric'];
  return preferred.map((id) => TEAM_ARCHETYPES.find((item) => item.id === id)).filter(Boolean).filter((item) => item.id !== archetype.id);
}

export function findTeamArchetypeByArticleId(requestedId) {
  const normalized = slugify(String(requestedId || '').replace(/^learning-archetype-/, ''));
  return TEAM_ARCHETYPES.find((archetype) => archetype.id === normalized || slugify(archetype.title) === normalized) || null;
}

function renderLearningArticleBackBar(title) {
  return `<nav class="learning-article-backbar" aria-label="Learning article navigation"><a class="secondary-button" href="/learning-hub" data-route="learning-hub">← Back to Learning Hub</a><span>${escapeText(title)}</span></nav>`;
}
