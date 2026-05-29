export const GUIDE_STEPS = [
  {
    title: 'The Main Idea',
    purpose: 'Every Pokémon Champions team starts with an idea. That idea might be a Pokémon you want to use, a core you want to try, a tactic you want to enable, or a meta threat you want to beat.',
    custom: 'mainIdea',
    questions: [
      'What starting point interests me?',
      'Why am I adding this Pokémon, core, tactic, or answer?',
      'What do I want this team to do better than my current teams?'
    ],
    lookFor: ['Pokémon', 'core', 'tactic', 'meta answer', 'favourite', 'clear intent'],
    metadex: 'Use the Metadex to explore Pokémon roles, strengths, weaknesses, ability options, item options, and useful moves before solving the full team.',
    relatedPages: ['Metadex', 'Learning Hub', 'Team Builder']
  },
  {
    title: 'Adding to the Core',
    purpose: 'You have the main idea, but it is not a full team yet. Add Pokémon that help the main goal of the team work in battle.',
    custom: 'addingToCore',
    questions: [],
    lookFor: ['complementary offense', 'complementary defense', 'support', 'speed control', 'enabling'],
    metadex: 'Use the Metadex to compare possible teammates. Look at role, typing, abilities, speed, support moves, offensive pressure, defensive value, and whether the Pokémon helps your main idea.',
    relatedPages: ['Metadex', 'Team Builder', 'Analysis', 'Damage']
  },
  {
    title: 'When is the core ready?',
    purpose: 'Before moving on, check whether your main idea feels complete enough that you could imagine testing it in battle.',
    custom: 'coreReady',
    questions: [],
    lookFor: ['core structure', 'safe turns', 'offensive pressure', 'positioning', 'theory check'],
    metadex: 'If one Pokémon does not seem to fit the core, use the Metadex to find an alternative that solves the same problem while also supporting the main idea.',
    relatedPages: ['Team Builder', 'Analysis', 'Matchups', 'Metadex']
  },
  {
    title: 'Fill out the Core',
    purpose: 'Your core is mostly built. Now add the remaining Pokémon that help the team handle more matchups without losing its main identity.',
    custom: 'roundOutTeam',
    questions: [],
    lookFor: ['breadth', 'depth', 'mode', 'utility', 'matchup answers', 'backup plan', 'cohesion'],
    metadex: 'Use the Metadex to search for Pokémon that improve difficult matchups, add utility, create another mode, or give the team a second way to win without breaking the original core.',
    relatedPages: ['Metadex', 'Team Builder', 'Analysis', 'Matchups', 'Damage']
  },
  {
    title: 'Consider Weaknesses and Expand',
    purpose: 'Use the live Weakness Coverage chart to decide which problems matter most, then add answers that still support your main plan.',
    custom: 'weaknessExpand',
    questions: [],
    lookFor: ['moves', 'items', 'abilities', 'natures', 'stat points', 'benchmarks', 'roles', 'Protect', 'first draft'],
    metadex: 'Use the Metadex to understand what each Pokémon usually wants to do, what moves and abilities support that role, and what items make sense for the job you gave it.',
    relatedPages: ['Team Builder', 'Metadex', 'Damage', 'Analysis']
  },
  {
    title: 'Find the Details',
    purpose: 'Your six Pokémon are chosen. Now complete the moves, items, abilities, natures, and stat investments that make the team actually work.',
    custom: 'finishDetails',
    questions: [],
    lookFor: ['moves', 'items', 'abilities', 'natures', 'stat points', 'benchmarks', 'roles', 'Protect', 'first draft'],
    metadex: 'Use the Metadex to understand what each Pokémon usually wants to do, what moves and abilities support that role, and what items make sense for the job you gave it.',
    relatedPages: ['Team Builder', 'Metadex', 'Damage', 'Analysis']
  },
  {
    title: 'Start Testing',
    purpose: 'Your first draft is complete. Now use real battles to find what works, what fails, and what needs changing.',
    custom: 'startTesting',
    questions: [],
    lookFor: ['testing', 'first draft', 'matchup', 'speed control', 'safe turns', 'sixth Pokémon syndrome', 'iteration', 'win condition', 'testing log'],
    metadex: 'If testing shows that a Pokémon is not doing its job, use the Metadex to find alternatives with a similar role, better synergy, better matchup value, or a clearer reason to be on the team.',
    relatedPages: ['Team Builder', 'Analysis', 'Matchups', 'Damage', 'Metadex']
  }
];

export const PAGE_ROUTE_MAP = {
  Metadex: 'metadex',
  'Team Builder': 'team-builder',
  'Learning Hub': 'learning-hub',
  Analysis: 'analysis-desk',
  Matchups: 'matchups',
  Damage: 'damage'
};
