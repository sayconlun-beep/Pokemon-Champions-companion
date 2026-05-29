// Base Learning Hub data. Wording preserved.
export const BASE_PRO_TEAM_FILTERS = [
  ['all', 'All teams'],
  ['beginner', 'Beginner-friendly'],
  ['Balanced Offense', 'Balanced Offense'],
  ['Speed Control Balance', 'Speed Control'],
  ['Bulky Balance', 'Bulky Balance'],
  ['Setup Offense', 'Setup Offense'],
  ['Victory Road', 'Victory Road'],
  ['LabMaus', 'LabMaus'],
  ['Limitless', 'Limitless'],
  ['Trainer Tower', 'Trainer Tower']
];

export const LEARNING_SECTIONS = [
  {
    id: 'team-building-intent',
    title: 'Team Building Intent',
    helper: 'Understand what an idea or intent means when building a Pokémon Champions team.',
    kind: 'overview',
    preview: 'Why every team choice should eventually have a purpose.',
    items: [
      ['Team Building Intent', 'Intent means knowing why a Pokémon, move, item, ability, or EV spread is on the team. It can be simple, competitive, or tactical.']
    ]
  },

  { id: 'pokemon-team-cores', title: 'What Is a Core?', helper: 'Learn what a Pokémon team core is and why it gives a team direction.', kind: 'custom' },
  { id: 'adding-to-a-core', title: 'Adding to a Core', helper: 'Learn how to add Pokémon that help your main idea actually function.', kind: 'custom' },
  { id: 'safe-turns', title: 'Safe Turns', helper: 'Creating turns where important Pokémon can act safely.', kind: 'custom' },
  { id: 'offensive-pressure', title: 'Offensive Pressure', helper: 'Making the opponent respect your damage.', kind: 'custom' },
  { id: 'positioning', title: 'Positioning', helper: 'Getting the right Pokémon on the field at the right time.', kind: 'custom' },
  { id: 'theory-checking-a-team', title: 'Theory Checking a Team', helper: 'Imagining battles before full playtesting.', kind: 'custom' },
  { id: 'complementary-offense', title: 'Complementary Offense', helper: 'Adding damage that helps your core pressure more matchups.', kind: 'custom' },
  { id: 'complementary-defense', title: 'Complementary Defense', helper: 'Adding Pokémon that make switching, positioning, and surviving easier.', kind: 'custom' },
  { id: 'support-options', title: 'Support Options', helper: 'Helping your main Pokémon get safe and useful turns.', kind: 'custom' },
  { id: 'speed-control', title: 'Speed Control', helper: 'Learn why moving first matters and how Tailwind, Trick Room, speed drops, priority, and natural Speed shape battles.', kind: 'custom' },
  { id: 'learning-team-breadth', title: 'Team Breadth', helper: 'Helping your team handle a wider range of matchups.', kind: 'custom' },
  { id: 'learning-team-depth', title: 'Team Depth', helper: 'Giving your core more ways to play.', kind: 'custom' },
  { id: 'learning-team-modes', title: 'Team Modes', helper: 'Adding another plan your team can use in battle.', kind: 'custom' },
  { id: 'learning-utility', title: 'Utility', helper: 'Useful tools that help your team function.', kind: 'custom' },
  { id: 'learning-matchups', title: 'Matchups', helper: 'Thinking about how your team plays into opposing teams.', kind: 'custom' },
  { id: 'learning-team-cohesion', title: 'Team Cohesion', helper: 'Making sure your six Pokémon still feel like one team.', kind: 'custom' },
  { id: 'learning-backup-plans', title: 'Backup Plans', helper: 'What your team does when the first plan is stopped.', kind: 'custom' },
  { id: 'learning-movesets', title: 'Movesets', helper: 'Choosing moves that match a Pokémon’s job.', kind: 'custom' },
  { id: 'learning-typing', title: 'Typing', helper: 'Understanding weaknesses, resistances, STAB, coverage, and how typing affects team structure.', kind: 'custom' },
  { id: 'learning-items', title: 'Items', helper: 'Choosing items that help a Pokémon perform its role.', kind: 'custom' },
  { id: 'learning-abilities', title: 'Abilities', helper: 'Choosing the ability that best supports the team plan.', kind: 'custom' },
  { id: 'learning-natures', title: 'Natures and Stat Points', helper: 'Making a Pokémon’s stats match its job.', kind: 'custom' },
  { id: 'learning-stat-points', title: 'Natures and Stat Points', helper: 'Making a Pokémon’s stats match its job.', kind: 'custom' },
  { id: 'learning-benchmarks', title: 'Benchmarks', helper: 'Specific damage, survival, or speed goals.', kind: 'custom' },
  { id: 'learning-pokemon-roles', title: 'Pokémon Roles', helper: 'Knowing what each Pokémon is meant to do.', kind: 'custom' },
  { id: 'learning-protect-positioning', title: 'Protect and Positioning', helper: 'Why defensive turns matter in doubles-style battles.', kind: 'custom' },
  { id: 'learning-first-drafts', title: 'First Draft Teams', helper: 'Finishing a usable version before perfecting it.', kind: 'custom' },
  { id: 'learning-testing-teams', title: 'Testing Teams', helper: 'Using real games to improve your first draft.', kind: 'custom' },
  { id: 'learning-sixth-pokemon-syndrome', title: 'Sixth Pokémon Syndrome', helper: 'When the final team slot never feels right.', kind: 'custom' },
  { id: 'learning-team-iteration', title: 'Team Iteration', helper: 'Making small improvements after testing.', kind: 'custom' },
  { id: 'learning-win-conditions', title: 'Win Conditions', helper: 'Understanding how your team actually wins games.', kind: 'custom' },
  { id: 'learning-testing-log', title: 'Testing Logs', helper: 'Tracking what happens so changes are based on patterns.', kind: 'custom' },
  {
    id: 'quick-competitive-tips',
    title: 'Quick Competitive Tips',
    helper: 'Small reminders that help newer competitive players make cleaner decisions in games.',
    kind: 'overview',
    items: [
      ['setting up win conditions', 'Winning teams consistently convert small advantages into decisive current matchups.'],
      ['Handling Bad Positions', 'Bad switching or losing momentum can quickly put your team behind.'],
      ['Preserve Key Tools', 'Avoid trading away the Pokémon that your win condition needs later.'],
      ['Plan Safer Turns', 'Use support, pivots and defensive switching before committing your main attacker.']
    ]
  }
];

export const LEARNING_CATEGORY_LABELS = {
  basics: 'Team Building Basics',
  core: 'Building Around a Core',
  rounding: 'Rounding Out a Team',
  details: 'Finishing Details',
  concrete: 'Concrete Building Blocks',
  testing: 'Testing and Iteration',
  archetypes: 'Team Archetypes',
  quick: 'Quick Help'
};

export const LEARNING_CATEGORY_ORDER = ['basics', 'core', 'rounding', 'details', 'concrete', 'testing', 'archetypes', 'quick'];

export const ARCHETYPE_FILTERS = ['All', 'Beginner-friendly', 'Offensive', 'Defensive', 'Speed Control', 'Weather / Field', 'Setup', 'Flexible', 'Advanced'];

export const LEARNING_CATEGORY_BY_ID = {
  'team-building-intent': 'basics',
  'pokemon-team-cores': 'basics',
  'adding-to-a-core': 'basics',
  'theory-checking-a-team': 'basics',
  'learning-first-drafts': 'basics',
  'complementary-offense': 'core',
  'complementary-defense': 'core',
  'support-options': 'core',
  'speed-control': 'core',
  'safe-turns': 'core',
  'offensive-pressure': 'core',
  positioning: 'core',
  'learning-team-breadth': 'rounding',
  'learning-team-depth': 'rounding',
  'learning-team-modes': 'rounding',
  'learning-utility': 'rounding',
  'learning-matchups': 'rounding',
  'learning-team-cohesion': 'rounding',
  'learning-backup-plans': 'rounding',
  'learning-movesets': 'details',
  'learning-typing': 'concrete',
  'learning-items': 'details',
  'learning-abilities': 'details',
  'learning-natures': 'details',
  'learning-stat-points': 'details',
  'learning-benchmarks': 'details',
  'learning-pokemon-roles': 'details',
  'learning-protect-positioning': 'details',
  'learning-testing-teams': 'testing',
  'learning-sixth-pokemon-syndrome': 'testing',
  'learning-team-iteration': 'testing',
  'learning-win-conditions': 'testing',
  'learning-testing-log': 'testing',
  'team-archetypes': 'archetypes',
  'quick-competitive-tips': 'quick',
  'learn-from-pro-teams': 'quick'
};
