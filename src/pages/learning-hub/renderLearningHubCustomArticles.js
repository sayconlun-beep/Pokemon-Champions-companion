import { CUSTOM_LEARNING_ARTICLES } from './learningHubState.js';
import { escapeText, escapeAttr } from './learningHubHelpers.js';

export function renderCustomLearningArticle(section, targetConcept) {
  const article = CUSTOM_LEARNING_ARTICLES[section.id];
  if (!article) return '';
  const highlighted = targetConcept === section.id;
  const labels = { 'learning-hub':'Back to Learning Hub', 'team-building-guide':'Back to Team Building Guide', metadex:'Open MetaDex', 'team-builder':'Open Team Builder', 'analysis-desk':'Open Analysis', damage:'Open Damage', matchups:'Open Matchups' };
  return `<article class="learning-concept-card learning-friendly-card ${highlighted ? 'learning-target-card' : ''}" id="learning-card-${escapeText(section.id)}">
    <div class="learning-card-summary"><h3>${escapeText(article.title)}</h3><p>${escapeText(article.subtitle)}</p></div>
    <div class="learning-card-content">
      ${article.body.map((paragraph) => `<p>${escapeText(paragraph)}</p>`).join('')}
      ${Array.isArray(article.sections) ? article.sections.map(([heading, items]) => `<div class="learning-info-block"><h4>${escapeText(heading)}</h4><ul>${items.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></div>`).join('') : ''}
      ${section.id === 'learning-movesets' ? `<div class="learning-info-block tactical-example"><h4>Speed control planning</h4><p>Speed control moves deserve their own planning. <a class="team-guide-inline-link" href="/learning-hub?article=speed-control" data-route="learning-hub" data-learning-article="speed-control">Read the Speed Control guide.</a></p></div>` : ''}
      <div class="learning-info-block tactical-example"><h4>Beginner examples</h4><ul>${article.examples.map((example) => `<li>${escapeText(example)}</li>`).join('')}</ul></div>
      <div class="learning-action-row">${article.buttons.map((route) => `<a class="secondary-button" href="/${escapeAttr(route)}" data-route="${escapeAttr(route)}">${escapeText(labels[route])}</a>`).join('')}</div>
    </div>
  </article>`;
}

export function renderTeamBuildingIntentArticle(targetConcept) {
  const highlighted = targetConcept === 'team-building-intent';
  return `
    <article class="learning-concept-card learning-friendly-card ${highlighted ? 'learning-target-card' : ''}" id="learning-card-team-building-intent">
      <div class="learning-card-summary">
        <h3>Team Building Intent</h3>
        <p>Why every Pokémon, move, item, and ability should have a reason.</p>
      </div>
      <div class="learning-card-content">
        <div class="learning-info-block">
          <h4>What is intent?</h4>
          <p>Intent is the reason behind a team-building choice. It answers: “Why is this here?”</p>
        </div>

        <div class="learning-info-block">
          <h4>Starting a team</h4>
          <p>A team can start from many different places. The starting point does not need to be perfect — it just needs to give you direction.</p>
          <ul>
            <li>a Pokémon you want to use</li>
            <li>a core you want to try</li>
            <li>a tactic such as Fake Out, Tailwind, Trick Room, weather, redirection, or spread damage</li>
            <li>a matchup answer to something you keep losing to</li>
            <li>a favourite Pokémon you want to support properly</li>
            <li>a strong meta option you want to understand</li>
          </ul>
        </div>

        <div class="learning-info-block">
          <h4>Adding Pokémon with purpose</h4>
          <p>When you add a Pokémon, ask what job it is meant to do for the team.</p>
          <ul>
            <li>deal damage</li>
            <li>create safe turns</li>
            <li>provide speed control</li>
            <li>cover a weakness</li>
            <li>enable another Pokémon</li>
            <li>improve a bad matchup</li>
          </ul>
        </div>

        <div class="learning-info-block">
          <h4>Evaluating your choices</h4>
          <p>After battles, compare what the Pokémon was meant to do with what actually happened.</p>
          <ul>
            <li>Did this Pokémon do its job?</li>
            <li>Did I bring it often?</li>
            <li>Did the item help?</li>
            <li>Did the moves get clicked?</li>
            <li>Did the ability matter?</li>
            <li>Did this fix the matchup I added it for?</li>
          </ul>
        </div>

        <div class="learning-info-block">
          <h4>When you do not know your intent</h4>
          <p>It is okay to start with a rough idea. If the reason is unclear, write one simple sentence: “I added this because…”</p>
          <p>You do not need a perfect reason for every choice at first, but every choice should eventually have a purpose.</p>
        </div>

        <div class="learning-info-block tactical-example">
          <h4>Pokémon Champions examples</h4>
          <ul>
            <li>“I added Kangaskhan (Mega) because Fake Out creates safe turns and it can clean weakened teams.”</li>
            <li>“I added Ninetales (Alolan Form) because Snow Warning and Aurora Veil help my team survive setup or offensive pressure.”</li>
            <li>“I added speed control because my attackers were strong but too slow.”</li>
            <li>“I changed an item because the previous item was not helping in real games.”</li>
          </ul>
        </div>

        <div class="learning-action-row">
          <a class="secondary-button" href="/team-building-guide" data-route="team-building-guide">Back to Team Building Guide</a>
          <a class="secondary-button" href="/metadex" data-route="metadex">Open Metadex</a>
          <a class="secondary-button" href="/team-builder" data-route="team-builder">Open Team Builder</a>
        </div>
      </div>
    </article>
  `;
}
