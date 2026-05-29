import { TypeChartReference } from '../../components/TypeChartReference.js';
import { escapeText, escapeAttr } from './learningHubHelpers.js';

export function renderTypingArticle(section, targetConcept) {
  const highlighted = targetConcept === section.id;
  const relatedLinks = [
    ['Team Roles', '/learning-hub?article=learning-pokemon-roles'],
    ['Movesets', '/learning-hub?article=learning-movesets'],
    ['Speed Control', '/learning-hub?article=speed-control'],
    ['Defensive Switching', '/learning-hub?article=complementary-defense'],
    ['Safe Turns', '/learning-hub?article=safe-turns'],
    ['Testing Teams', '/learning-hub?article=learning-testing-teams'],
    ['Team Archetypes', '/learning-hub?article=team-archetypes']
  ];

  return `<article class="learning-concept-card learning-friendly-card ${highlighted ? 'learning-target-card' : ''}" id="learning-card-${escapeText(section.id)}">
    <div class="learning-card-summary">
      <span class="section-kicker">Concrete Building Blocks · 8 min read</span>
      <h3>Typing</h3>
      <p>Understanding weaknesses, resistances, STAB, coverage, and defensive synergy.</p>
    </div>
    <div class="learning-card-content typing-article-content">
      <p>Typing is one of the first things players learn about Pokémon, but in team building it is more than memorising the type chart.</p>
      <div class="learning-info-block">
        <h4>A Pokémon’s typing affects</h4>
        <ul>
          <li>what it can switch into</li>
          <li>what it is weak to</li>
          <li>what it resists</li>
          <li>what attacks it powers up with STAB</li>
          <li>what coverage it threatens</li>
          <li>which teammates it fits beside</li>
          <li>which matchups it makes easier or harder</li>
        </ul>
        <p>The goal is not to cover every type perfectly. The goal is to understand which attacks your team is likely to face and whether you have safe answers.</p>
      </div>

      ${renderTypingSection('Defensive typing', [
        'Defensive typing is about how well a Pokémon takes attacks.',
        'A Pokémon with useful defensive typing can switch into attacks aimed at a teammate, resist common attacking types, avoid important weaknesses, give the team safer positioning, and help cover a weakness in the current team.',
        'Typing only matters defensively if the Pokémon has enough bulk, speed, utility, or pressure to actually use it.'
      ], ['A Steel-type may resist many attacks, but if it is too frail or does not threaten anything back, it may still be difficult to use as a defensive answer.'])}

      ${renderTypingSection('What makes typing good?', [
        'A Pokémon’s typing is good when it helps that Pokémon do a useful job in the current format or on the current team.',
        'Good typing can mean few important weaknesses, useful resistances, an immunity to a common attack type, strong STAB attacks, useful offensive coverage, synergy with teammates, or resisting attacks that threaten the rest of the team.',
        'Good typing is contextual. A type combination can be strong on one team and awkward on another.'
      ])}

      ${renderTypingSection('What makes typing bad?', [
        'Bad typing usually means the Pokémon is difficult to position safely.',
        'Bad typing can mean many common weaknesses, a 4× weakness to a common attacking type, few useful resistances, weaknesses that overlap with teammates, being weak to common spread moves, being unable to switch in safely, or needing too much support to function.',
        'Bad defensive typing does not always make a Pokémon unusable. Strong offensive pressure, speed, utility, or a Focus Sash-style item can still make it valuable.'
      ])}

      ${renderTypingSection('Offensive typing, STAB, and coverage', [
        'Offensive typing is about what your Pokémon threatens.',
        'STAB means a Pokémon gets extra damage from attacks that match its own type.',
        'Coverage means attacks that hit types your STAB moves do not handle well.',
        'Do not add coverage just to hit every type. Add coverage when it helps beat Pokémon your team actually struggles with.'
      ], [
        'A Water-type using a Water move has STAB.',
        'A Fire-type using Grass coverage may threaten Water, Rock, or Ground targets.',
        'A Dragon-type may need Steel or Fire coverage to threaten Fairy or Steel answers.'
      ])}

      ${renderTypingSection('Resistances, weaknesses, and immunities', [
        'When checking a team, look for types you are weak to, types you resist, types you are immune to, types where several Pokémon share the same weakness, and types where no Pokémon can switch in safely.',
        'One weakness is usually fine. Multiple shared weaknesses become a problem when the team has no safe switch-in, no speed control, and no way to pressure the attacker.'
      ])}

      <div class="learning-info-block type-chart-reference">
        <h4>Type chart reference</h4>
        <p>This read-only reference shows attacking types down the left and defending types across the top. It does not change the app’s real damage or type-effectiveness calculations.</p>
        ${TypeChartReference()}
      </div>

      ${renderTypingSection('Using the Weakness Coverage chart', [
        'The Weakness Coverage chart helps you see which attacking types your team handles well and which ones may need safer answers.',
        'Covered means the team has reasonable answers. Needs Attention means the team may be pressured by that attacking type. Exposed means the team has a serious gap or no safe switch-in.',
        'When a type is exposed, look for Pokémon that resist or are immune to that attacking type, threaten common users of that type, do not worsen your existing weaknesses, fit your team’s role needs, and still contribute to your main game plan.'
      ], ['If Fairy is exposed, useful answers may include Steel, Poison, or Fire defensive options, but the best choice still depends on the rest of the team.'])}

      ${renderTypingSection('Type synergy between teammates', [
        'Good teams often pair Pokémon that cover each other’s weaknesses.',
        'A Pokémon weak to Fire appreciates a teammate that resists Fire. A Pokémon weak to Fighting appreciates Ghost, Flying, Psychic, Poison, Fairy, or bulky resist options depending on the format.',
        'A frail attacker may not need perfect defensive typing if its teammates create safe turns.',
        'Do not choose a Pokémon only because it fixes a type chart problem. It also needs to do something useful in battle.'
      ])}

      ${renderTypingSection('Common typing mistakes', [], [
        'Trying to resist every type perfectly.',
        'Adding a Pokémon only because it has a useful resistance.',
        'Ignoring whether the Pokémon can actually switch in.',
        'Forgetting offensive pressure.',
        'Overvaluing rare weaknesses.',
        'Ignoring common spread moves.',
        'Stacking weaknesses without a plan.',
        'Fixing typing while making speed control, damage, or support worse.'
      ])}

      ${renderTypingSection('Typing checklist', [], [
        'What attacking types threaten my current team?',
        'Which types do I have safe switch-ins for?',
        'Which weaknesses are shared by multiple Pokémon?',
        'Do I have any useful immunities?',
        'Do my attackers have reliable STAB moves?',
        'Do I have coverage for the Pokémon I actually struggle with?',
        'Does this Pokémon fix a real problem or only look good on the type chart?',
        'Does adding this Pokémon create a new weakness elsewhere?',
        'Can this Pokémon still perform a useful role?'
      ])}

      <div class="learning-info-block">
        <h4>Related Learning Hub topics</h4>
        <div class="learning-action-row">
          ${relatedLinks.map(([label, href]) => `<a class="secondary-button" href="${escapeAttr(href)}" data-route="learning-hub">${escapeText(label)}</a>`).join('')}
        </div>
      </div>

      <div class="learning-action-row">
        <a class="secondary-button" href="/learning-hub" data-route="learning-hub">Back to Learning Hub</a>
        <a class="secondary-button" href="/team-building-guide" data-route="team-building-guide">Back to Team Building Guide</a>
        <a class="secondary-button" href="/team-builder" data-route="team-builder">Open Team Builder</a>
        <a class="secondary-button" href="/metadex" data-route="metadex">Open MetaDex</a>
        <a class="secondary-button" href="/analysis-desk" data-route="analysis-desk">View Weakness Coverage</a>
      </div>
    </div>
  </article>`;
}

export function renderTypingSection(title, paragraphs = [], bullets = []) {
  return `<div class="learning-info-block">
    <h4>${escapeText(title)}</h4>
    ${paragraphs.map((paragraph) => `<p>${escapeText(paragraph)}</p>`).join('')}
    ${bullets.length ? `<ul>${bullets.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>` : ''}
  </div>`;
}
