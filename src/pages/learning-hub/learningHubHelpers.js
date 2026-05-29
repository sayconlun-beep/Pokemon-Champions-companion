// Shared Learning Hub helper utilities.
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferRelated(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return ['Tailwind Sequencing', 'keeping momentum', 'late-game cleanup'];
  if (lower.includes('pivot')) return ['safe positioning', 'Recovery Stability', 'keeping momentum'];
  return ['safe positioning', 'setting up win conditions', 'safe recovery planning'];
}

export function inferExample(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return 'Whimsicott uses Tailwind to preserve Kangaskhan positioning before opponents can establish defensive pressure.';
  if (lower.includes('pivot')) return 'Incineroar creates safer pivot routes through Fake Out sequencing and Intimidate cycling.';
  return 'Teams that keep momentum and switch safely usually create better late-game win conditions.';
}

export function inferWhyItMatters(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return 'Moving first can let your team attack, protect, or support before the opponent can punish you.';
  if (lower.includes('recovery')) return 'Good recovery timing keeps important Pokémon useful instead of letting them get worn down too early.';
  if (lower.includes('pivot')) return 'Safe switching helps your attackers enter the field without taking unnecessary damage.';
  if (lower.includes('endgame')) return 'A cleaner endgame is easier when you save the Pokémon that can finish weakened opponents.';
  if (lower.includes('disruption')) return 'Well-timed disruption can stop setup, waste enemy turns, and create safer openings.';
  return 'Understanding this makes the analysis easier to act on during real battles.';
}

export function inferCommonMistake(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return 'Using speed control too late, after your main attacker has already been forced out or KO’d.';
  if (lower.includes('recovery')) return 'Recovering only when a Pokémon is already too low to safely stay on the field.';
  if (lower.includes('pivot')) return 'Switching without a plan and giving the opponent a free turn to attack or set up.';
  if (lower.includes('endgame')) return 'Trading away your best closer before the opponent’s team has been weakened.';
  if (lower.includes('disruption')) return 'Clicking disruption moves randomly instead of saving them for important enemy turns.';
  return 'Trying to force damage every turn instead of using positioning, support, or safer setup first.';
}

export function inferBeginnerTip(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return 'Before attacking, ask: “Do I move first this turn, and what happens if I do not?”';
  if (lower.includes('recovery')) return 'Recover before your Pokémon is desperate, especially if it is needed for your win condition.';
  if (lower.includes('pivot')) return 'Use pivots to bring in your strongest Pokémon on safer turns, not directly into danger.';
  if (lower.includes('endgame')) return 'Identify your likely finisher early and avoid risking it for small short-term trades.';
  if (lower.includes('disruption')) return 'Save disruption for turns where it blocks the opponent’s biggest threat or setup plan.';
  return 'Focus on one simple question: what does this help my team do more safely?';
}

export function generateTakeaway(title) {
  const lower = title.toLowerCase();
  if (lower.includes('speed')) return 'Teams that lose speed control early often fail to maintain offensive pressure into the midgame.';
  if (lower.includes('recovery')) return 'Reliable healing and safe switching help your team avoid falling behind in long games.';
  return 'Good support and safe switching help your team stay consistent.';
}

export function getReadablePokemonIdName(pokemonId) {
  return String(pokemonId || 'Pokémon')
    .replace(/^PKMN_/i, '')
    .replace(/_/g, ' ')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Pokémon';
}

export function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}



/* LEARNING_HUB_FINAL_QA_GUARDS
   Defensive layout notes:
   - Use min(280px, 100%) grid columns to prevent mobile overflow.
   - Allow text wrapping inside cards.
   - Avoid fixed card heights so expanded content is not clipped.
*/

export function escapeAttr(value) { return escapeText(value); }

export function getSectionPreview(section) {
  if (section.id === 'quick-competitive-tips') return 'Short reminders for cleaner battles.';
  return 'Open this section to view its cards.';
}

export function findSectionForConcept(targetConcept, combined) {
  return LEARNING_SECTIONS.find((section) => getSectionConceptSlugs(section, combined).has(targetConcept));
}

export function getSectionConceptSlugs(section, combined) {
  const slugs = new Set([slugify(section.id), slugify(section.title)]);
  if (section.kind === 'concepts') {
    combined.forEach((row) => {
      const text = JSON.stringify(row).toLowerCase();
      if (section.keywords.some((keyword) => text.includes(keyword))) {
        slugs.add(slugify(row.title || row.name || row.concept || 'Concept'));
      }
    });
    return slugs;
  }
  (section.items || []).forEach(([title]) => slugs.add(slugify(title)));
  return slugs;
}

export function getLearningTopicLink(label) {
  const links = {
    'Team Building Intent': '/learning-hub?article=team-building-intent',
    'What Is a Core?': '/learning-hub?article=pokemon-team-cores',
    'Adding to a Core': '/learning-hub?article=adding-to-a-core',
    'Speed Control': '/learning-hub?article=speed-control',
    'Safe Turns': '/learning-hub?article=safe-turns',
    'Offensive Pressure': '/learning-hub?article=offensive-pressure',
    'Positioning': '/learning-hub?article=positioning',
    'Matchups': '/learning-hub?article=learning-matchups',
    'Team Breadth': '/learning-hub?article=learning-team-breadth',
    'Team Depth': '/learning-hub?article=learning-team-depth',
    'Team Modes': '/learning-hub?article=learning-team-modes',
    'Win Conditions': '/learning-hub?article=learning-win-conditions',
    'Testing Teams': '/learning-hub?article=learning-testing-teams',
    'Team Cohesion': '/learning-hub?article=learning-team-cohesion',
    'Defensive Synergy': '/learning-hub?article=complementary-defense'
  };
  return links[label] ? { label, href: links[label] } : null;
}

export function getRelatedLearningTopics(archetype) {
  const base = [
    ['Team Building Intent', '/learning-hub?article=team-building-intent'],
    ['What Is a Core?', '/learning-hub?article=pokemon-team-cores'],
    ['Adding to a Core', '/learning-hub?article=adding-to-a-core'],
    ['Matchups', '/learning-hub?article=learning-matchups'],
    ['Win Conditions', '/learning-hub?article=learning-win-conditions'],
    ['Testing Teams', '/learning-hub?article=learning-testing-teams']
  ];
  if (archetype.tags.includes('Speed Control')) base.splice(3, 0, ['Speed Control', '/learning-hub?article=speed-control']);
  if (archetype.tags.includes('Setup')) base.splice(3, 0, ['Safe Turns', '/learning-hub?article=safe-turns']);
  if (archetype.tags.includes('Flexible')) base.splice(3, 0, ['Team Modes', '/learning-hub?article=learning-team-modes']);
  return base.map(([label, href]) => ({ label, href }));
}
