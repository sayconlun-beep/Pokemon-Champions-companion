import { escapeText, escapeAttr } from './learningHubHelpers.js';

export function renderSpeedControlArticlePage() {
  const relatedLinks = [
    ['Team Roles', '/learning-hub?article=learning-pokemon-roles'],
    ['Movesets', '/learning-hub?article=learning-movesets'],
    ['Typing', '/learning-hub?article=learning-typing'],
    ['Defensive Switching', '/learning-hub?article=complementary-defense'],
    ['Safe Turns', '/learning-hub?article=safe-turns'],
    ['Trick Room', '/learning-hub?article=trick-room'],
    ['Tailwind Offense', '/learning-hub?article=tailwind-offense'],
    ['Weather', '/learning-hub?article=weather'],
    ['Setup Offense', '/learning-hub?article=setup-offense'],
    ['Team Archetypes', '/learning-hub?article=team-archetypes']
  ];

  return `
    <section class="page-stack learning-hub-page learning-hub-article-page">
      ${renderLearningArticleBackBar('Speed Control')}
      <article class="learning-section-panel learning-article-shell speed-control-article">
        <header class="learning-article-title">
          <span class="section-kicker">Core Battle Concepts · 10 min read</span>
          <h1>Speed Control</h1>
          <p>Learn why moving before your opponent matters and what tools help your team control turn order.</p>
        </header>
        <div class="learning-article-content">
          <div class="learning-info-block">
            <p>In Pokémon battles, both players choose their moves at the same time, but Pokémon act in an order determined by Speed, priority, and field effects.</p>
            <p>Speed control means using moves, abilities, items, or team structure to influence which Pokémon move first.</p>
            <ul>
              <li>knock out a threat before it attacks</li>
              <li>set up support before damage lands</li>
              <li>move before disruption</li>
              <li>reduce the impact of secondary effects</li>
              <li>force the opponent to spend turns answering your plan</li>
              <li>make your own game plan more reliable</li>
            </ul>
            <p><strong>Beginner note:</strong> Speed control is not only about having fast Pokémon. Slow teams can control Speed too, especially with Trick Room.</p>
          </div>

          ${renderSpeedArticleSection('Why moving first matters', [
            'Moving first is powerful because if you knock out a Pokémon before it acts, that Pokémon loses its move for the turn.',
            'Fast pressure can protect your team by removing threats before they attack. Support moves are also stronger when used before the opponent lands damage, status, flinches, or disruption.',
            'The player who controls turn order often controls the pace of the game.'
          ], [], 'Your attacker can knock out an opposing threat, but only if it moves first. If your Pokémon moves second, it may faint before attacking. A Tailwind, Icy Wind, Choice Scarf, or priority move can change that turn completely.')}

          ${renderSpeedCallout('Beginner rule', 'Most teams want at least one reliable way to influence turn order. Many strong teams have two.')}

          ${renderSpeedArticleSection('Speed control is about turn order', [
            'Speed control is any tool that changes, reverses, bypasses, or pressures the normal Speed order.',
            'Speed control tools can stack or conflict. A fast team can still use Trick Room answers. A slow team can still use priority or speed drops.'
          ], [
            'Tailwind doubles your side’s Speed for a few turns.',
            'Trick Room reverses normal Speed order.',
            'Speed drops reduce opposing Speed.',
            'Speed boosts increase your own Speed.',
            'Priority moves can act before normal moves.',
            'Abilities and items can change Speed.',
            'Natural Speed still matters even without active effects.'
          ])}

          ${renderSpeedArticleSection('Tailwind', [
            'Tailwind is one of the most straightforward forms of speed control. It increases the Speed of Pokémon on your side for a limited number of turns.',
            'Tailwind teams can use fast support Pokémon, Prankster users, bulky support Pokémon, or offensive Pokémon that can set Tailwind while still threatening damage.',
            'Tailwind teams can struggle if they waste Tailwind turns, fail to take knockouts, or run into Trick Room.'
          ], [
            'your team has strong attackers that become threatening when faster',
            'your Pokémon are already medium-to-fast',
            'you want immediate offensive pressure',
            'your team can use the limited turns efficiently',
            'your setter can survive or use priority'
          ], 'A medium-speed attacker may lose to faster threats normally, but under Tailwind it can move first and take knockouts before being hit.')}

          ${renderSpeedCallout('Tailwind vs Trick Room', 'Tailwind helps faster and medium-speed Pokémon move first. Trick Room lets slower Pokémon move first. Mixed teams can use both, but they need a clear plan.')}

          ${renderSpeedArticleSection('Trick Room', [
            'Trick Room reverses the usual Speed order for several turns, causing slower Pokémon to move before faster Pokémon.',
            'Trick Room usually needs support such as Fake Out, redirection, defensive switching, Protect, bulky setters, and strong slow attackers.',
            'Trick Room can be stopped by Taunt, Fake Out pressure, double-targeting, opposing Trick Room, or stalling out its turns.',
            'Trick Room does not mean every Pokémon must be slow. Some teams use Trick Room as a mode rather than the whole team plan.'
          ], [
            'your team has slow, powerful attackers',
            'your Pokémon are bulky enough to survive setup turns',
            'you want to punish very fast teams',
            'your team can protect the setter',
            'you can pressure the opponent once Trick Room is active'
          ])}

          ${renderSpeedArticleSection('Speed drops', [
            'Speed drops reduce the opponent’s Speed instead of increasing your own.',
            'They are flexible, can support multiple teammates, can be attached to Pokémon that already provide utility, punish opponents that stay in, and can create immediate turn-order swings.',
            'Speed drops can be reset when the opponent switches out, may fail into immunities, and may not help if the opponent already has Tailwind or Trick Room active.'
          ], [
            'Icy Wind',
            'Electroweb',
            'Bulldoze',
            'Rock Tomb',
            'other moves that lower Speed'
          ], 'Icy Wind may deal low damage, but if it lets your partner move before both opposing Pokémon next turn, it can be more valuable than a stronger attack.')}

          ${renderSpeedArticleSection('Speed boosts', [
            'Speed boosts increase your own Pokémon’s Speed.',
            'They can stay with the Pokémon while it remains active, turn one attacker into a major threat, help clean up late-game, and force the opponent to answer quickly.',
            'Speed boosts often require setup turns, specific weather, or item commitment. If the boosted Pokémon is knocked out or forced out, the value may be lost.'
          ], [
            'Dragon Dance',
            'Quiver Dance',
            'Speed-boosting abilities',
            'weather-based Speed abilities',
            'Choice Scarf',
            'other setup or item-based boosts'
          ])}

          ${renderSpeedArticleSection('Priority moves', [
            'Priority moves act before normal moves within their priority bracket, letting slower Pokémon bypass normal Speed order.',
            'Priority can finish weakened targets, disrupt setup, help slow Pokémon act first, support faster attackers, and bypass Tailwind-style speed races.',
            'Priority moves often have lower power, can be blocked or resisted, and do not always solve the full speed-control problem.',
            'Fake Out is especially valuable because it can deny an opponent’s action for a turn, helping your team set Tailwind, Trick Room, screens, or safe attacks.'
          ], [
            'Fake Out',
            'Extreme Speed',
            'Sucker Punch',
            'Aqua Jet',
            'Grassy Glide',
            'Prankster support moves'
          ])}

          ${renderSpeedArticleSection('Natural Speed', [
            'Natural Speed is still important even when a team has Tailwind, Trick Room, or other tools.',
            'Naturally fast Pokémon do not need setup to move first, are strong before and after Tailwind turns, force immediate respect, and can clean up games once speed control expires.',
            'Naturally slow Pokémon can thrive under Trick Room, often have better bulk or power, and punish teams built only around being fast.',
            'A team with only fast frail Pokémon may struggle defensively. A team with only slow Pokémon may struggle before Trick Room is active or after it expires.'
          ])}

          ${renderSpeedArticleSection('Items and abilities that affect Speed', [
            'Some items and abilities change Speed directly or indirectly.',
            'These tools can be powerful, but they often require conditions: weather must be active, the item may lock move choice, the ability may need setup, the Pokémon may become predictable, or the opponent may remove or reverse the condition.'
          ], [
            'Choice Scarf',
            'Iron Ball',
            'Lagging Tail',
            'Room Service',
            'Swift Swim',
            'Chlorophyll',
            'Sand Rush',
            'Slush Rush',
            'Speed Boost',
            'Unburden',
            'Prankster'
          ])}

          ${renderSpeedArticleSection('Other ways to control turn order', [
            'Some speed control tools are more situational, but they can be excellent when they fit the team’s plan.',
            'Protect can stall opposing Tailwind or Trick Room turns. Switching can reset speed drops. Taunt and Fake Out can delay opposing setup before it starts.'
          ], [
            'Thunder Wave or paralysis',
            'Quash',
            'After You',
            'Trick with Lagging Tail or Iron Ball',
            'speed swapping effects if available',
            'Protect to stall opposing speed-control turns',
            'switching to reset speed drops',
            'Taunt to stop Trick Room or Tailwind setters',
            'Fake Out to delay setup'
          ])}

          ${renderSpeedArticleSection('Choosing speed control for your team', [
            'The right speed control depends on what your team is trying to do, not just which move sounds strongest.',
            'Fast offense often likes Tailwind, speed drops, or priority. Slow bulky offense often likes Trick Room. Balanced teams often like mixed speed control. Weather teams may use weather-based Speed abilities. Setup teams may use Fake Out, redirection, or Tailwind to create safe turns.'
          ], [
            'Is my team naturally fast, slow, or mixed?',
            'Do my main attackers need help moving first?',
            'Do I want short explosive turns or a slower setup mode?',
            'Can my team protect a Trick Room setter?',
            'Can my team use Tailwind turns efficiently?',
            'Do I already have priority or speed drops?',
            'Am I too dependent on one speed-control method?',
            'What happens when my speed control expires?'
          ])}

          ${renderSpeedCallout('Do not only chase Speed', 'Moving first is powerful, but it does not replace damage, bulk, positioning, or good move choices.')}

          ${renderSpeedArticleSection('Common speed control mistakes', [], [
            'Having no speed control at all.',
            'Using Tailwind but not having enough damage to use the turns.',
            'Building Trick Room without protecting the setter.',
            'Making every Pokémon slow and losing outside Trick Room.',
            'Making every Pokémon fast and becoming too frail.',
            'Forgetting priority moves.',
            'Ignoring opposing Trick Room.',
            'Ignoring opposing Tailwind.',
            'Using speed drops when the opponent can easily switch out.',
            'Relying on one Pokémon for all speed control.',
            'Forgetting that Protect can stall speed-control turns.'
          ])}

          ${renderSpeedArticleSection('Speed control checklist', [], [
            'Who are my fastest Pokémon?',
            'Who are my slowest Pokémon?',
            'What happens if the opponent sets Tailwind?',
            'What happens if the opponent sets Trick Room?',
            'Can I stop opposing speed control?',
            'Can I function without my own speed control?',
            'Do my attackers need speed support to take knockouts?',
            'Do I have priority to finish weakened targets?',
            'Do I have speed drops or boosts?',
            'Do I have more than one way to control turn order?'
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
          </div>
        </div>
      </article>
    </section>
  `;
}

export function renderSpeedArticleSection(title, paragraphs = [], bullets = [], example = '') {
  return `<div class="learning-info-block">
    <h4>${escapeText(title)}</h4>
    ${paragraphs.map((paragraph) => `<p>${escapeText(paragraph)}</p>`).join('')}
    ${bullets.length ? `<ul>${bullets.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>` : ''}
    ${example ? `<div class="tactical-example"><h4>Example</h4><p>${escapeText(example)}</p></div>` : ''}
  </div>`;
}

export function renderSpeedCallout(title, text) {
  return `<div class="learning-info-block tactical-example speed-control-callout">
    <h4>${escapeText(title)}</h4>
    <p>${escapeText(text)}</p>
  </div>`;
}

function renderLearningArticleBackBar(title) {
  return `<nav class="learning-article-backbar" aria-label="Learning article navigation"><a class="secondary-button" href="/learning-hub" data-route="learning-hub">← Back to Learning Hub</a><span>${escapeText(title)}</span></nav>`;
}
