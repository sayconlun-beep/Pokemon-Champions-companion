// Archetype Learning Hub data. Wording preserved.
export const TEAM_ARCHETYPES = [
  { id: 'balanced-offense', title: 'Balanced Offense', description: 'A flexible team that mixes strong attackers, defensive pivots, and support.', tags: ['Beginner-friendly', 'Offensive', 'Flexible'], wins: 'keeps enough pressure to threaten knockouts while using pivots and support to avoid falling behind.', needs: ['reliable attackers', 'at least one support or pivot', 'basic speed control or defensive positioning'], caution: 'can become too average if every slot is flexible but none create real pressure.' },
  { id: 'hyper-offense', title: 'Hyper Offense', description: 'A fast, aggressive team that tries to overwhelm the opponent before they stabilize.', tags: ['Offensive', 'Speed Control', 'Advanced'], wins: 'forces immediate threats, trades quickly, and stops opponents from setting up their own plan.', needs: ['fast attackers', 'damage-boosting support', 'ways to prevent defensive setup'], caution: 'struggles when early pressure is denied or key attackers are forced to Protect too often.' },
  { id: 'bulky-offense', title: 'Bulky Offense', description: 'A team that uses durable Pokémon with strong damage to trade well and keep pressure.', tags: ['Beginner-friendly', 'Offensive', 'Flexible'], wins: 'survives hits, returns strong damage, and wins longer trades without becoming fully defensive.', needs: ['durable attackers', 'good defensive typing', 'positioning tools'], caution: 'can be outpaced by very fast teams if it lacks speed control or priority.' },
  { id: 'balance', title: 'Balance', description: 'A flexible team that can attack, defend, reposition, and adapt across matchups.', tags: ['Beginner-friendly', 'Defensive', 'Flexible'], wins: 'adapts its leads and mid-game plan to each matchup instead of relying on one rigid mode.', needs: ['mixed roles', 'safe switching options', 'clear win conditions'], caution: 'can feel directionless if the team has answers but no clear way to close games.' },
  { id: 'stall-control', title: 'Stall / Defensive Control', description: 'A slower team that wins by surviving, denying progress, and wearing opponents down.', tags: ['Defensive', 'Advanced'], wins: 'denies knockouts, limits opposing progress, and turns small chip damage into a long-term win.', needs: ['recovery or durability', 'disruption', 'ways to handle boosting threats'], caution: 'needs very careful play and can lose if it cannot stop strong setup or spread pressure.' },
  { id: 'trick-room', title: 'Trick Room', description: 'A team or mode that uses slow Pokémon to move first under Trick Room.', tags: ['Speed Control', 'Setup', 'Advanced'], wins: 'sets Trick Room safely, then lets slow powerful Pokémon attack before faster opponents.', needs: ['Trick Room setters', 'slow attackers', 'redirection, Fake Out, or defensive support'], caution: 'needs a plan for turns when Trick Room is not active.' },
  { id: 'tailwind-offense', title: 'Tailwind Offense', description: 'A team that uses Tailwind to let strong attackers move first and force pressure.', tags: ['Beginner-friendly', 'Offensive', 'Speed Control'], wins: 'sets Tailwind, outspeeds threats, and converts the speed window into knockouts.', needs: ['Tailwind setter', 'strong attackers', 'lead plans that create immediate pressure'], caution: 'can run out of momentum when Tailwind ends if it has no backup plan.' },
  { id: 'weather', title: 'Weather', description: 'A team built around weather effects such as sun, rain, snow, or sand.', tags: ['Weather / Field', 'Flexible'], wins: 'uses weather to boost damage, improve bulk, activate abilities, or disrupt opposing plans.', needs: ['weather setter', 'weather abusers', 'a plan when weather is changed'], caution: 'can become too dependent on keeping weather active.' },
  { id: 'terrain', title: 'Terrain', description: 'A team that uses terrain effects to empower allies or limit opposing options.', tags: ['Weather / Field', 'Flexible'], wins: 'uses terrain to strengthen key moves, protect allies, or block opposing tools.', needs: ['terrain setter', 'Pokémon that benefit from terrain', 'answers to teams that overwrite terrain'], caution: 'can lose value if terrain support does not directly help the main win condition.' },
  { id: 'setup-offense', title: 'Setup Offense', description: 'A team that creates safe turns for a Pokémon to boost and sweep.', tags: ['Offensive', 'Setup'], wins: 'protects a boosting Pokémon long enough for it to become too threatening to ignore.', needs: ['boosting attacker', 'redirection or disruption', 'ways to remove checks'], caution: 'can collapse if the setup Pokémon is stopped before it gains value.' },
  { id: 'redirection-setup', title: 'Redirection / Setup', description: 'A team that uses Follow Me, Rage Powder, or similar support to protect key Pokémon.', tags: ['Setup', 'Defensive'], wins: 'redirects danger away from a key ally while it boosts, attacks, or controls the board.', needs: ['redirection user', 'high-value partner', 'answers to spread damage'], caution: 'spread moves, Taunt, and strong double-target pressure can break the plan.' },
  { id: 'pivot-positioning', title: 'Pivot / Positioning', description: 'A team that wins by switching, cycling pressure, and getting the right Pokémon in safely.', tags: ['Flexible', 'Advanced'], wins: 'uses switching and pivot moves to create better board states than the opponent.', needs: ['safe switch-ins', 'pivot moves or tempo tools', 'clear matchup reads'], caution: 'requires good sequencing and can lose tempo if switches are too passive.' },
  { id: 'spread-damage', title: 'Spread Damage', description: 'A team that uses moves hitting multiple opponents to create constant board pressure.', tags: ['Beginner-friendly', 'Offensive'], wins: 'chips both opponents at once and makes defensive positioning harder for the other player.', needs: ['spread attackers', 'accuracy or damage support', 'single-target cleanup'], caution: 'Wide Guard, resistances, and weak single-target damage can slow it down.' },
  { id: 'priority-offense', title: 'Priority Offense', description: 'A team that uses priority moves to bypass Speed control and finish weakened targets.', tags: ['Offensive', 'Speed Control'], wins: 'ignores some speed control by picking off weakened targets before they can move.', needs: ['priority users', 'chip damage', 'answers to priority blockers'], caution: 'priority alone rarely replaces real speed control or strong board positioning.' },
  { id: 'anti-meta', title: 'Anti-Meta', description: 'A team built specifically to punish popular Pokémon, cores, or strategies.', tags: ['Advanced', 'Flexible'], wins: 'targets common threats so popular teams struggle to follow their normal plan.', needs: ['knowledge of common teams', 'specific counters', 'enough general strength'], caution: 'can become too narrow if it only beats one trend.' },
  { id: 'goodstuff', title: 'Goodstuff', description: 'A team made from individually strong Pokémon with flexible roles and broad matchup coverage.', tags: ['Beginner-friendly', 'Flexible'], wins: 'uses strong standalone Pokémon that do not need heavy setup to be useful.', needs: ['high-value Pokémon', 'role coverage', 'clear lead combinations'], caution: 'can lack synergy if the team is just six strong Pokémon with no shared plan.' },
  { id: 'mode-based', title: 'Mode-Based Team', description: 'A team with more than one game plan, such as Tailwind plus Trick Room or weather plus balance.', tags: ['Speed Control', 'Flexible', 'Advanced'], wins: 'chooses the best mode for the matchup and makes the opponent respect multiple plans.', needs: ['two compatible modes', 'clear mode selection', 'slots that work in more than one plan'], caution: 'can become cramped if each mode needs too many dedicated pieces.' },
  { id: 'core-centric', title: 'Core-Centric Team', description: 'A team built mainly to support one important Pokémon, pair, or interaction.', tags: ['Beginner-friendly', 'Setup', 'Flexible'], wins: 'identifies one powerful idea and uses the rest of the team to protect and enable it.', needs: ['main core', 'support for its weaknesses', 'backup plan if the core is denied'], caution: 'can be predictable if every game depends on the same Pokémon or pair.' }
];

export const BEGINNER_ARCHETYPE_ARTICLES = {
  'balanced-offense': {
    subtitle: 'A flexible team style that mixes strong attackers with enough support and defensive switching to keep pressure safely.',
    what: ['Balanced Offense tries to attack consistently without becoming fragile. It usually has strong damage dealers, useful support, some defensive switching, and enough speed control to avoid being overwhelmed.'],
    wins: ['It wins by creating safe attacking turns, trading efficiently, and keeping enough pressure that the opponent cannot freely set up or reposition.'],
    needs: ['one or two reliable attackers', 'speed control', 'defensive switch-ins', 'support that creates safe turns', 'at least one way to handle bad matchups', 'enough damage to punish passive turns'],
    roles: ['main attacker', 'secondary attacker', 'speed control support', 'defensive pivot', 'disruption support', 'cleaner'],
    strengths: ['flexible into many matchups', 'easier to adjust than extreme archetypes', 'can attack and defend', 'good for learning team building', 'does not rely on one single plan'],
    weaknesses: ['can lack explosive power', 'can become too generic', 'may struggle against very focused teams', 'needs clear roles or it becomes unfocused', 'can be hard to pilot if every Pokémon has too many jobs'],
    mistakes: ['adding six individually good Pokémon with no shared plan', 'not having enough speed control', 'not having a clear win condition', 'making every Pokémon half-support and losing damage', 'trying to answer every matchup at once'],
    build: ['Use the Metadex to choose a strong main attacker or core. Add support that helps that attacker get safe turns. Use Team Builder to assemble the draft, Analysis to check whether the team has enough offense, defensive coverage, and speed control, Matchups to see if focused archetypes like Trick Room, Hyper Offense, or Weather give the team problems, and Damage to test important KOs and survival benchmarks.'],
    choose: ['you want a flexible team', 'you are still learning the format', 'you want room to adapt during battle', 'you have a strong core but do not want an extreme team', 'you want a team that can be improved over time'],
    careful: ['you do not know how the team wins', 'every Pokémon is doing a different thing', 'you lack immediate pressure', 'you lack clear answers to common meta threats', 'you are relying on “good Pokémon” instead of synergy'],
    related: ['balance', 'bulky-offense', 'goodstuff', 'mode-based'],
    topics: ['Team Building Intent','What Is a Core?','Adding to a Core','Speed Control','Safe Turns','Offensive Pressure','Matchups']
  },
  'hyper-offense': {
    subtitle: 'A fast, aggressive team style that tries to overwhelm the opponent before they can stabilize.',
    what: ['Hyper Offense focuses on immediate pressure. It wants to force the opponent into defensive choices, take knockouts quickly, and prevent slower plans from getting started.'],
    wins: ['It wins by taking control early, creating constant threats, and giving the opponent very few safe turns.'],
    needs: ['fast attackers', 'strong immediate damage', 'speed control or priority', 'ways to stop setup or Trick Room', 'enough pressure to punish Protect and switching', 'backup damage if the first attacker goes down'],
    roles: ['lead attacker', 'secondary attacker', 'cleaner', 'speed control support', 'disruption support', 'priority user'],
    strengths: ['can punish slow or passive teams', 'forces opponents to react', 'can win quickly', 'strong into teams that need setup turns', 'simple game plan when built clearly'],
    weaknesses: ['can be fragile', 'can struggle if early pressure fails', 'may dislike Intimidate, redirection, screens, or bulky pivots', 'can lose badly to Trick Room if it cannot stop it', 'can run out of resources quickly'],
    mistakes: ['using only damage and no support', 'ignoring defensive typing completely', 'having no plan into Trick Room', 'having no way to handle bulky teams', 'assuming faster always means better'],
    build: ['Use Metadex to find Pokémon with immediate damage, strong Speed, priority, or disruption. Use Team Builder to keep the team focused. Use Analysis to check whether the team is too fragile. Use Matchups to test Trick Room, bulky offense, and defensive teams. Use Damage to confirm key KOs.'],
    choose: ['you like aggressive play', 'the meta is slow or setup-heavy', 'you have several strong attackers', 'you want to pressure opponents from turn one', 'you are comfortable making proactive plays'],
    careful: ['you lack ways to stop Trick Room', 'your attackers are too frail', 'you have no defensive pivots', 'your damage depends on perfect positioning', 'you struggle to recover after a bad lead'],
    related: ['tailwind-offense','priority-offense','spread-damage','setup-offense'],
    topics: ['Offensive Pressure','Speed Control','Safe Turns','Win Conditions','Matchups']
  },
  'bulky-offense': { subtitle:'A team style that uses durable Pokémon with real damage to trade well and keep pressure.', what:['Bulky Offense uses Pokémon that can take hits while still threatening meaningful damage. It does not need to be the fastest team because it can survive attacks and keep fighting.'], wins:['It wins by making strong trades, surviving long enough to keep pressure, and forcing the opponent to spend multiple turns removing key Pokémon.'], needs:['durable attackers','defensive synergy','speed control or priority','support that improves trades','recovery, protection, or positioning tools','answers to very fast offense'], roles:['bulky main attacker','defensive pivot','support attacker','speed control support','disruption support','endgame cleaner'], strengths:['forgiving for newer players','does not fold immediately to one bad turn','can trade well into many teams','can pressure while defending','often has strong endgames'], weaknesses:['may be slower than aggressive teams','can struggle against strong setup','can be worn down','may lack burst damage','can become too passive if support slots do not deal damage'], mistakes:['building too slow with no speed control','adding bulky Pokémon that do not threaten damage','relying only on defensive typing','ignoring recovery or positioning','having no clear way to finish games'], build:['Use Metadex to find Pokémon with good bulk and useful damage. Add support that helps them stay on the field and attack safely. Use Analysis to check defensive overlap and offensive pressure. Use Damage to test whether important attacks survive or secure KOs.'], choose:['you want a stable team','you like trading hits','you want attackers that do not faint immediately','you want a forgiving style while learning','your core has strong bulk and damage'], careful:['your team becomes too slow','your team cannot break defensive cores','your support Pokémon do not add pressure','your team lacks a cleaner','fast teams can overwhelm you before you respond'], related:['balanced-offense','balance','goodstuff','stall-control'], topics:['Defensive Synergy','Offensive Pressure','Positioning','Speed Control','Win Conditions'] },
  'balance': { subtitle:'A flexible team style that can attack, defend, reposition, and adapt across different matchups.', what:['Balance teams try to have tools for many situations. They usually combine damage, support, defensive switching, speed control, and matchup answers.'], wins:['It wins by adapting better than the opponent, preserving important Pokémon, and choosing the right mode or win condition for each game.'], needs:['flexible Pokémon','defensive pivots','reliable support','speed control','clear win conditions','matchup coverage','good positioning tools'], roles:['flexible attacker','defensive pivot','speed control support','utility support','matchup answer','cleaner'], strengths:['can adapt to many opponents','rewards good positioning','less matchup-polarized than extreme teams','good for learning competitive fundamentals','can use multiple win conditions'], weaknesses:['can be difficult to pilot','may lack immediate pressure','may become unfocused','needs strong decision-making','can lose to teams with a clearer plan'], mistakes:['confusing balance with random good Pokémon','not choosing a clear win condition','adding too many reactive answers','lacking damage','trying to cover every possible matchup'], build:['Use Metadex to find Pokémon with role compression. Use Team Builder to make sure every Pokémon has a reason. Use Analysis to check whether the team has enough damage, support, speed control, and defensive structure. Use Matchups to identify which archetypes still give the team trouble.'], choose:['you like flexible teams','you want to learn positioning','you want multiple plans','you have a strong core with broad support options','you do not want an extreme all-in style'], careful:['you cannot explain how the team wins','the team has too many small answers','you lack pressure','every matchup feels playable but none feel good','your Pokémon roles overlap too much'], related:['balanced-offense','bulky-offense','goodstuff','mode-based'], topics:['Team Cohesion','Team Breadth','Team Depth','Positioning','Matchups'] },
  'trick-room': { subtitle:'A speed control archetype or mode where slower Pokémon move first after Trick Room is set.', what:['Trick Room teams use slow, powerful Pokémon that become faster while Trick Room is active. Some teams are fully built around Trick Room, while others use it as one mode.'], wins:['It wins by setting Trick Room safely, then using slow attackers to apply heavy pressure while they move before faster opponents.'], needs:['Trick Room setter','slow attackers','ways to set Trick Room safely','redirection, Fake Out, bulk, or disruption','enough damage during Trick Room turns','a plan when Trick Room is not active'], roles:['Trick Room setter','slow main attacker','secondary slow attacker','redirection support','Fake Out support','defensive pivot','non-Trick Room backup mode'], strengths:['punishes fast teams','makes slow powerful Pokémon dangerous','can reverse the opponent’s speed advantage','creates clear battle turns','strong when the setup turn is protected well'], weaknesses:['can struggle if Trick Room is denied','limited number of active turns','predictable if the whole team depends on it','may struggle outside Trick Room','can be pressured by Taunt, disruption, double-targeting, or strong spread damage'], mistakes:['having only one setter','having no way to protect the setup turn','using slow Pokémon that do not hit hard enough','forgetting the plan outside Trick Room','wasting Trick Room turns with passive moves'], build:['Use Metadex to find Trick Room setters, slow attackers, and support that creates safe setup turns. Use Team Builder to decide whether the team is full Trick Room or has Trick Room as a mode. Use Analysis to check whether the team collapses without Trick Room. Use Damage to confirm your slow attackers get important KOs.'], choose:['you like slower powerful Pokémon','the meta is very fast','your core benefits from moving first under Trick Room','you can protect the setup turn','you want a clear speed control plan'], careful:['your team cannot function without Trick Room','you lack safe setup tools','your attackers are too passive','you have no answer to Taunt or disruption','you waste too many turns setting up'], related:['mode-based','bulky-offense','redirection-setup','anti-meta'], topics:['Speed Control','Safe Turns','Positioning','Team Modes','Win Conditions'] },
  'tailwind-offense': { subtitle:'A speed control archetype that uses Tailwind to let strong attackers move first.', what:['Tailwind Offense uses Tailwind to give the team a temporary Speed advantage. It usually pairs Tailwind support with attackers that become much harder to handle when they move first.'], wins:['It wins by setting Tailwind, using the speed advantage to apply pressure, and taking knockouts before the opponent can stabilize.'], needs:['Tailwind setter','strong attackers','good lead options','ways to punish Protect or switching','enough damage during Tailwind turns','a plan after Tailwind ends'], roles:['Tailwind setter','lead attacker','spread attacker','cleaner','disruption support','secondary speed control'], strengths:['clear and easy-to-understand speed plan','helps strong attackers move first','pressures offensive and balanced teams','can force immediate defensive play','works well with spread damage'], weaknesses:['limited number of turns','can struggle if Tailwind setter is removed early','may lose momentum when Tailwind ends','can struggle into Trick Room','can become predictable'], mistakes:['setting Tailwind without applying pressure','wasting Tailwind turns with passive plays','having attackers that still do not outspeed enough','having no plan into Trick Room','relying on only one speed control option'], build:['Use Metadex to find Tailwind setters and attackers that benefit from moving first. Use Damage to test what those attackers can KO during Tailwind. Use Analysis to check if the team still works after Tailwind ends. Use Matchups to test Trick Room and priority-heavy teams.'], choose:['you have strong attackers that need Speed help','you want a simple speed control plan','you like aggressive positioning','you want to pressure from the lead','your team can capitalize quickly'], careful:['your team is passive after Tailwind','your setter is too easy to remove','you have no backup speed control','Trick Room teams are common','your attackers do not hit hard enough'], related:['hyper-offense','spread-damage','balanced-offense','mode-based'], topics:['Speed Control','Offensive Pressure','Safe Turns','Positioning','Matchups'] },
  'weather': { subtitle:'A team style built around weather effects such as sun, rain, snow, or sand.', what:['Weather teams use weather to strengthen certain Pokémon, enable abilities, improve damage, or change defensive interactions. Some teams are fully weather-focused, while others use weather as one mode.'], wins:['It wins by controlling weather, enabling weather-based attackers or support, and forcing the opponent to fight under conditions that favour your team.'], needs:['weather setter','Pokémon that benefit from that weather','ways to keep or reset weather','backup plan if weather is removed','good positioning','matchup answers outside weather'], roles:['weather setter','weather abuser','secondary attacker','defensive pivot','speed control support','weather-independent backup'], strengths:['can create powerful offensive or defensive boosts','gives the team a clear identity','can enable unique Pokémon','pressures opponents to answer weather','can combine well with speed control'], weaknesses:['can rely too much on weather','opposing weather can disrupt the plan','weather turns can be wasted','team may become predictable','some matchups may resist the weather plan well'], mistakes:['building six Pokémon that only work in weather','having no backup plan','forgetting weather can be changed','wasting weather turns','using weather without enough payoff'], build:['Use Metadex to find weather setters and Pokémon that benefit from weather abilities, moves, or defensive effects. Use Team Builder to decide whether weather is the main plan or a secondary mode. Use Analysis to check if the team still functions without weather. Use Matchups to test opposing weather and anti-weather teams.'], choose:['you have a weather core you want to build around','weather gives your attackers or support clear value','you want a clear team direction','the meta struggles with that weather style','you can still play if weather is disrupted'], careful:['your whole team depends on weather','you cannot reset weather reliably','opposing weather is common','your weather abusers are too narrow','you lack defensive synergy outside weather'], related:['mode-based','tailwind-offense','bulky-offense','core-centric'], topics:['Team Modes','Speed Control','Positioning','Matchups','Win Conditions'] },
  'setup-offense': { subtitle:'A team style that creates safe turns for a Pokémon to boost and become a major win condition.', what:['Setup Offense focuses on enabling one or more Pokémon to use boosting moves or abilities, then take over the game. The team is built around creating the safe turn needed to set up.'], wins:['It wins by protecting the setup Pokémon long enough for it to boost, then using that boosted threat to force knockouts or dominate the endgame.'], needs:['setup Pokémon','safe turn creation','redirection, Fake Out, screens, disruption, or defensive support','ways to remove opposing answers','speed control or priority protection','backup plan if setup fails'], roles:['setup attacker','redirection support','Fake Out support','screen support','disruption support','cleaner','matchup answer'], strengths:['strong snowball potential','gives the team a clear win condition','can punish passive opponents','can force opponents into awkward targeting','works well with support-heavy cores'], weaknesses:['can fail if setup is denied','can be weak to disruption, phazing, Haze-style effects, Taunt, or strong double-targeting','may rely too much on one Pokémon','can lose momentum if the setup turn is wasted','may struggle against immediate pressure'], mistakes:['adding a setup Pokémon without enough support','setting up when attacking would be better','having no backup win condition','ignoring opposing disruption','building the whole team around one fragile plan'], build:['Use Metadex to find setup Pokémon and support that creates safe turns. Use Team Builder to make sure the setup plan has protection and backup pressure. Use Analysis to check whether the team is too dependent on one Pokémon. Use Damage to test what the boosted Pokémon can KO and what it survives.'], choose:['you want a clear win condition','your chosen Pokémon becomes dangerous after boosting','you have strong support options','the meta gives setup opportunities','you like planning around key turns'], careful:['your setup Pokémon is too easy to stop','your support is too passive','your team has no backup plan','common teams can deny setup easily','you struggle to identify safe setup turns'], related:['redirection-setup','core-centric','hyper-offense','mode-based'], topics:['Safe Turns','Win Conditions','Positioning','Offensive Pressure','Team Cohesion'] }

};

export const ADVANCED_ARCHETYPE_ARTICLES = {
  "stall-control": {
    "subtitle": "A slower team style that wins by surviving, denying progress, and wearing opponents down.",
    "what": [
      "Defensive Control teams focus on limiting the opponent’s progress. They use bulk, recovery, disruption, positioning, and defensive synergy to make it difficult for opponents to take clean knockouts."
    ],
    "wins": [
      "It wins by outlasting threats, forcing inefficient attacks, removing key opposing resources, and reaching an endgame where the opponent can no longer break through."
    ],
    "needs": [
      "strong defensive synergy",
      "recovery or protection",
      "disruption",
      "reliable damage over time",
      "ways to stop setup",
      "clear endgame plan",
      "careful positioning"
    ],
    "roles": [
      "defensive anchor",
      "disruption support",
      "recovery user",
      "defensive pivot",
      "chip damage user",
      "endgame win condition"
    ],
    "strengths": [
      "can punish reckless offense",
      "can make opponents run out of options",
      "strong if piloted patiently",
      "rewards good matchup knowledge",
      "can be hard to break without specific answers"
    ],
    "weaknesses": [
      "can be passive",
      "may struggle against strong setup",
      "games can be long and difficult",
      "requires careful positioning",
      "can lose if it lacks enough damage"
    ],
    "mistakes": [
      "building too passively",
      "having no win condition",
      "relying only on bulk",
      "ignoring setup threats",
      "letting opponents reposition for free"
    ],
    "build": [
      "Use Metadex to find durable Pokémon with disruption, recovery, or defensive utility. Use Analysis to check defensive structure and whether the team lacks damage. Use Matchups to identify setup teams or strong attackers that threaten the plan. Use Damage to test important survival benchmarks."
    ],
    "choose": [
      "you like patient play",
      "you understand defensive positioning",
      "you want to punish aggressive teams",
      "you have strong defensive cores",
      "you have a reliable endgame plan"
    ],
    "careful": [
      "you cannot explain how the team wins",
      "you lack damage",
      "setup teams are common",
      "you dislike long games",
      "your defensive answers are too narrow"
    ],
    "related": [
      "balance",
      "bulky-offense",
      "pivot-positioning",
      "anti-meta"
    ],
    "topics": [
      "Positioning",
      "Matchups",
      "Win Conditions",
      "Team Cohesion",
      "Testing Teams"
    ]
  },
  "terrain": {
    "subtitle": "A field-control archetype that uses terrain effects to empower allies or limit opposing options.",
    "what": [
      "Terrain teams use field effects to support their Pokémon. Terrain may boost certain attacks, protect against status, weaken certain moves, or enable specific abilities and strategies."
    ],
    "wins": [
      "It wins by keeping useful terrain active, gaining advantages from that terrain, and forcing the opponent to play under field conditions that benefit your team."
    ],
    "needs": [
      "terrain setter",
      "Pokémon that benefit from terrain",
      "ways to keep pressure while terrain is active",
      "backup plan without terrain",
      "positioning to preserve the setter",
      "answers to opposing field control"
    ],
    "roles": [
      "terrain setter",
      "terrain abuser",
      "main attacker",
      "support Pokémon",
      "defensive pivot",
      "backup mode Pokémon"
    ],
    "strengths": [
      "gives the team a clear field advantage",
      "can enable specific Pokémon",
      "can support offense or defense",
      "can disrupt opposing plans",
      "pairs well with certain cores"
    ],
    "weaknesses": [
      "can depend too much on terrain",
      "opposing terrain can disrupt the plan",
      "terrain turns can be wasted",
      "terrain abusers may be narrow",
      "can be predictable"
    ],
    "mistakes": [
      "adding terrain without enough payoff",
      "relying on terrain for every matchup",
      "forgetting terrain can be overwritten",
      "not protecting the terrain setter",
      "having no plan when terrain ends"
    ],
    "build": [
      "Use Metadex to find terrain setters and Pokémon that benefit from terrain. Use Team Builder to decide whether terrain is the main plan or a support mode. Use Analysis to check if the team still functions without terrain. Use Matchups to review opposing terrain, weather, and speed control teams."
    ],
    "choose": [
      "terrain enables your chosen core",
      "terrain improves several Pokémon",
      "you want field control",
      "you can play without terrain if needed",
      "terrain helps important matchups"
    ],
    "careful": [
      "only one Pokémon benefits from terrain",
      "your terrain setter is too easy to remove",
      "opposing field control is common",
      "the team has no backup plan",
      "terrain does not help your win condition"
    ],
    "related": [
      "weather",
      "mode-based",
      "core-centric",
      "balance"
    ],
    "topics": [
      "Team Modes",
      "Positioning",
      "Win Conditions",
      "Matchups"
    ]
  },
  "redirection-setup": {
    "subtitle": "A team style that uses redirection or protection to create safe turns for key Pokémon.",
    "what": [
      "Redirection / Setup teams use tools like Follow Me, Rage Powder, defensive support, or pressure control to protect an important Pokémon while it sets up or attacks safely."
    ],
    "wins": [
      "It wins by forcing the opponent to deal with support first while the main threat gains momentum, boosts, or takes important knockouts."
    ],
    "needs": [
      "key Pokémon worth protecting",
      "redirection or protection support",
      "strong payoff for the safe turn",
      "answers to spread damage",
      "backup pressure",
      "careful positioning"
    ],
    "roles": [
      "redirection support",
      "setup attacker",
      "main attacker",
      "Fake Out support",
      "screen support",
      "disruption support",
      "cleaner"
    ],
    "strengths": [
      "creates clear safe turns",
      "protects important win conditions",
      "punishes opponents without spread damage",
      "works well with setup Pokémon",
      "can force awkward targeting"
    ],
    "weaknesses": [
      "can struggle against spread damage",
      "support can become passive",
      "relies on correct positioning",
      "can be disrupted by Taunt or strong double pressure",
      "may depend too much on one threat"
    ],
    "mistakes": [
      "protecting a Pokémon that does not create enough payoff",
      "ignoring spread moves",
      "using support that never pressures the opponent",
      "having no backup plan",
      "redirecting when switching or attacking would be better"
    ],
    "build": [
      "Use Metadex to find redirection support, setup threats, and Pokémon that reward safe turns. Use Analysis to check whether the team has enough pressure outside the protected Pokémon. Use Damage to test whether the setup Pokémon survives key attacks and gets important KOs."
    ],
    "choose": [
      "your core needs one safe turn",
      "your setup Pokémon has strong payoff",
      "your support can protect without being useless",
      "you like planned board states",
      "you can handle spread damage"
    ],
    "careful": [
      "spread damage is common",
      "your protected Pokémon is too easy to stop",
      "your support adds no pressure",
      "your team collapses if setup fails",
      "you struggle with positioning"
    ],
    "related": [
      "setup-offense",
      "core-centric",
      "trick-room",
      "mode-based"
    ],
    "topics": [
      "Safe Turns",
      "Positioning",
      "Win Conditions",
      "Offensive Pressure"
    ]
  },
  "pivot-positioning": {
    "subtitle": "A team style that wins by switching, cycling pressure, and getting the right Pokémon in safely.",
    "what": [
      "Pivot / Positioning teams focus on board control. They use switching, defensive synergy, Fake Out-style pressure, Intimidate-style cycling, resistances, and flexible threats to control which Pokémon are on the field."
    ],
    "wins": [
      "It wins by repeatedly creating better board states than the opponent, forcing awkward attacks, and bringing in the right threat at the right time."
    ],
    "needs": [
      "defensive synergy",
      "useful switch-ins",
      "Pokémon with flexible roles",
      "pressure after switching",
      "speed control or disruption",
      "clear endgame plan"
    ],
    "roles": [
      "defensive pivot",
      "utility pivot",
      "flexible attacker",
      "speed control support",
      "disruption support",
      "cleaner"
    ],
    "strengths": [
      "rewards good play",
      "can adapt during battle",
      "makes opponents waste turns",
      "preserves important Pokémon",
      "strong into predictable teams"
    ],
    "weaknesses": [
      "harder for beginners to pilot",
      "can become too passive",
      "needs strong role clarity",
      "can lose momentum if switches are punished",
      "requires matchup knowledge"
    ],
    "mistakes": [
      "switching without gaining anything",
      "using pivots that do not threaten damage",
      "having no clear win condition",
      "overvaluing defensive synergy",
      "letting the opponent set up for free"
    ],
    "build": [
      "Use Metadex to find Pokémon with defensive value, utility, and role compression. Use Analysis to check whether the team has enough pressure. Use Matchups to identify when switching is safe or risky. Use Damage to test whether pivots survive important hits."
    ],
    "choose": [
      "you like flexible play",
      "you enjoy positioning",
      "your Pokémon have useful switch-ins",
      "your team can punish bad board states",
      "you want to outplay rather than all-in"
    ],
    "careful": [
      "you are new to positioning",
      "your team lacks damage",
      "your pivots are too passive",
      "setup teams are common",
      "you cannot identify your win condition"
    ],
    "related": [
      "balance",
      "bulky-offense",
      "defensive-control",
      "goodstuff"
    ],
    "topics": [
      "Positioning",
      "Safe Turns",
      "Team Cohesion",
      "Matchups",
      "Win Conditions"
    ]
  },
  "spread-damage": {
    "subtitle": "A team style that uses attacks hitting multiple opponents to create constant board pressure.",
    "what": [
      "Spread Damage teams use moves that hit both opposing Pokémon or apply pressure across the board. This can make switching, Protect decisions, and positioning harder for the opponent."
    ],
    "wins": [
      "It wins by damaging multiple targets at once, forcing awkward defensive turns, and setting up endgames where weakened opponents can be cleaned up."
    ],
    "needs": [
      "strong spread attackers",
      "ways to protect your own side",
      "speed control",
      "partners that avoid or resist friendly spread effects if relevant",
      "single-target damage to finish key threats",
      "positioning support"
    ],
    "roles": [
      "spread attacker",
      "speed control support",
      "cleaner",
      "defensive pivot",
      "disruption support",
      "single-target breaker"
    ],
    "strengths": [
      "pressures both opponents",
      "punishes switching",
      "creates chip damage quickly",
      "pairs well with speed control",
      "can overwhelm defensive positioning"
    ],
    "weaknesses": [
      "spread damage may be reduced compared to single-target attacks",
      "Wide Guard-style effects or immunities can be a problem if present",
      "may struggle to remove one specific threat quickly",
      "can damage allies if using friendly-fire moves",
      "can be predictable"
    ],
    "mistakes": [
      "relying only on spread moves",
      "lacking single-target damage",
      "ignoring partner safety",
      "using spread damage without speed control",
      "failing to finish weakened targets"
    ],
    "build": [
      "Use Metadex to find strong spread attackers and partners that support or avoid their damage. Use Damage to test important spread and single-target damage ranges. Use Analysis to check whether the team has enough finishing power and speed control."
    ],
    "choose": [
      "you want constant board pressure",
      "your attackers have strong spread options",
      "you can control Speed",
      "your team can clean up weakened targets",
      "you want to punish switching and passive play"
    ],
    "careful": [
      "you cannot finish key threats",
      "your spread moves hurt your own team too much",
      "opponents commonly block or resist your spread plan",
      "you lack speed control",
      "your damage is too shallow"
    ],
    "related": [
      "tailwind-offense",
      "hyper-offense",
      "weather",
      "priority-offense"
    ],
    "topics": [
      "Offensive Pressure",
      "Speed Control",
      "Positioning",
      "Damage Benchmarks",
      "Win Conditions"
    ]
  },
  "priority-offense": {
    "subtitle": "A team style that uses priority moves to bypass Speed control and finish weakened targets.",
    "what": [
      "Priority Offense uses moves that act before normal attacks. This can help the team ignore Speed disadvantages, pick off weakened Pokémon, and threaten faster opponents."
    ],
    "wins": [
      "It wins by creating chip damage, then using priority to finish targets before they can move."
    ],
    "needs": [
      "priority users",
      "ways to chip opponents into range",
      "strong main attackers",
      "matchup awareness",
      "answers to priority-blocking effects if present",
      "enough non-priority damage"
    ],
    "roles": [
      "priority attacker",
      "chip damage attacker",
      "main breaker",
      "speed control support",
      "disruption support",
      "cleaner"
    ],
    "strengths": [
      "can bypass Speed control",
      "strong at finishing games",
      "punishes frail attackers",
      "helps against faster teams",
      "pairs well with spread damage"
    ],
    "weaknesses": [
      "priority may be weaker than normal attacks",
      "can struggle against bulky teams",
      "may be blocked or resisted by certain effects",
      "can become too reliant on chip",
      "may lack early pressure"
    ],
    "mistakes": [
      "treating priority as the whole damage plan",
      "lacking ways to chip targets first",
      "ignoring bulky opponents",
      "having no answer when priority is blocked",
      "using priority users that do not fit the team"
    ],
    "build": [
      "Use Metadex to find Pokémon with useful priority and strong supporting damage. Use Damage to test what targets priority can finish after chip. Use Analysis to check whether the team has enough normal damage and matchup coverage."
    ],
    "choose": [
      "fast offense is common",
      "your team creates lots of chip damage",
      "you want a strong cleanup plan",
      "you need insurance against Speed control",
      "your priority users also offer other value"
    ],
    "careful": [
      "your priority moves are too weak",
      "bulky teams are common",
      "your team cannot create chip",
      "priority-blocking effects are common",
      "your priority Pokémon do little outside cleanup"
    ],
    "related": [
      "hyper-offense",
      "spread-damage",
      "balanced-offense",
      "anti-meta"
    ],
    "topics": [
      "Offensive Pressure",
      "Speed Control",
      "Win Conditions",
      "Damage Benchmarks"
    ]
  },
  "anti-meta": {
    "subtitle": "A team style built to punish popular Pokémon, cores, or strategies.",
    "what": [
      "Anti-Meta teams are built with the current format in mind. Instead of only asking “what is strongest?”, they ask “what beats what people are using most?”"
    ],
    "wins": [
      "It wins by targeting common threats, denying popular strategies, and forcing opponents into uncomfortable matchups."
    ],
    "needs": [
      "knowledge of common meta threats",
      "specific matchup answers",
      "enough general team strength",
      "clear win condition",
      "flexibility outside targeted matchups",
      "testing against popular archetypes"
    ],
    "roles": [
      "meta answer",
      "disruption support",
      "flexible attacker",
      "defensive pivot",
      "speed control support",
      "surprise tech user"
    ],
    "strengths": [
      "can punish popular teams",
      "rewards format knowledge",
      "can catch opponents unprepared",
      "strong when the meta is narrow",
      "helps players think critically about matchups"
    ],
    "weaknesses": [
      "can become too narrow",
      "may lose to uncommon teams",
      "can age badly as the meta changes",
      "may lack natural synergy",
      "can overfocus on one threat"
    ],
    "mistakes": [
      "countering one Pokémon but losing to everything else",
      "using weak Pokémon only because they beat one thing",
      "forgetting the team still needs a win condition",
      "overreacting to one loss",
      "not updating the team as the meta changes"
    ],
    "build": [
      "Use Matchups and Analysis to identify what gives your team trouble. Use Metadex to find Pokémon that answer those threats while still fitting your core. Use Damage to confirm the answer actually works. Avoid adding a Pokémon that only helps one matchup unless that matchup is extremely important."
    ],
    "choose": [
      "the format has clear popular threats",
      "you understand what you want to beat",
      "your answers still have general value",
      "your core already has a strong plan",
      "you are comfortable adjusting often"
    ],
    "careful": [
      "you are guessing the meta",
      "your team becomes too reactive",
      "your answers are too narrow",
      "your team loses its own game plan",
      "the meta changes quickly"
    ],
    "related": [
      "balance",
      "goodstuff",
      "defensive-control",
      "mode-based"
    ],
    "topics": [
      "Matchups",
      "Team Breadth",
      "Team Cohesion",
      "Testing Teams",
      "Team Iteration"
    ]
  },
  "goodstuff": {
    "subtitle": "A flexible team style built from individually strong Pokémon with broad usefulness.",
    "what": [
      "Goodstuff teams use Pokémon that are strong on their own and useful in many matchups. The team may not revolve around one narrow combo, but every Pokémon should still have a reason to be there."
    ],
    "wins": [
      "It wins by using high-value Pokémon, flexible tools, and strong fundamentals to outplay different opponents."
    ],
    "needs": [
      "individually strong Pokémon",
      "role compression",
      "enough speed control",
      "enough damage",
      "defensive synergy",
      "clear endgame options",
      "no wasted slots"
    ],
    "roles": [
      "flexible attacker",
      "utility support",
      "defensive pivot",
      "speed control support",
      "disruption support",
      "cleaner"
    ],
    "strengths": [
      "flexible",
      "less reliant on one combo",
      "can adapt well",
      "usually has strong individual pieces",
      "good for learning fundamentals"
    ],
    "weaknesses": [
      "can lack a clear identity",
      "can become “six good Pokémon” with no plan",
      "may struggle against focused archetypes",
      "synergy can be overlooked",
      "win condition may be unclear"
    ],
    "mistakes": [
      "assuming strong Pokémon automatically make a strong team",
      "ignoring role overlap",
      "lacking a main idea",
      "not checking defensive synergy",
      "not knowing what to bring in each matchup"
    ],
    "build": [
      "Use Metadex to find Pokémon with strong general value and role compression. Use Team Builder to make sure every slot has a purpose. Use Analysis to check whether the team has a real identity and enough synergy. Use Matchups to see whether focused archetypes exploit the team."
    ],
    "choose": [
      "you want flexible strong Pokémon",
      "you are learning the format",
      "you prefer fundamentals over combos",
      "you have several reliable Pokémon you trust",
      "you can explain each slot clearly"
    ],
    "careful": [
      "the team has no main plan",
      "roles overlap too much",
      "you lack speed control",
      "you lack a win condition",
      "focused archetypes beat you consistently"
    ],
    "related": [
      "balance",
      "balanced-offense",
      "bulky-offense",
      "pivot-positioning"
    ],
    "topics": [
      "Team Building Intent",
      "Team Cohesion",
      "Role Compression",
      "Matchups",
      "Win Conditions"
    ]
  },
  "mode-based": {
    "subtitle": "A team with more than one game plan, such as Tailwind plus Trick Room or weather plus balance.",
    "what": [
      "Mode-Based teams can play different styles depending on the matchup. A mode is a planned way for part of the team to function together."
    ],
    "wins": [
      "It wins by choosing the right mode for the opponent and forcing them to respect multiple possible plans."
    ],
    "needs": [
      "at least two clear modes",
      "Pokémon that work in more than one mode if possible",
      "clear lead plans",
      "strong team cohesion",
      "enough damage in each mode",
      "matchup knowledge"
    ],
    "roles": [
      "mode enabler",
      "mode attacker",
      "flexible support",
      "role-compression Pokémon",
      "backup win condition",
      "matchup specialist"
    ],
    "strengths": [
      "flexible into many matchups",
      "harder for opponents to predict",
      "can cover weaknesses of one plan with another",
      "rewards strong team building",
      "lets one team play multiple styles"
    ],
    "weaknesses": [
      "can become unfocused",
      "may not have enough slots for each mode",
      "harder to pilot",
      "modes can conflict with each other",
      "may lack depth if each mode is too shallow"
    ],
    "mistakes": [
      "adding two modes that do not support each other",
      "having too few Pokémon for each mode",
      "not knowing which mode to bring",
      "making the team too complicated",
      "losing the original core identity"
    ],
    "build": [
      "Use Team Builder to define each mode clearly. Use Metadex to find Pokémon that fit multiple modes or enable a mode efficiently. Use Analysis to check cohesion and contradictions. Use Matchups to decide which mode is used into which archetype."
    ],
    "choose": [
      "your core can support multiple plans",
      "you want flexibility",
      "one mode covers another mode’s weaknesses",
      "your Pokémon have role compression",
      "you enjoy matchup-based decisions"
    ],
    "careful": [
      "the team becomes confusing",
      "each mode is too weak",
      "your modes fight each other",
      "you cannot explain your leads",
      "you lack practice choosing modes"
    ],
    "related": [
      "weather",
      "trick-room",
      "tailwind-offense",
      "balance",
      "core-centric"
    ],
    "topics": [
      "Team Modes",
      "Team Depth",
      "Team Cohesion",
      "Matchups",
      "Win Conditions"
    ]
  },
  "core-centric": {
    "subtitle": "A team built mainly to support one important Pokémon, pair, or interaction.",
    "what": [
      "Core-Centric teams begin with a specific Pokémon, pair, or interaction. The rest of the team is chosen to help that core function, cover its weaknesses, and create winning positions."
    ],
    "wins": [
      "It wins by enabling the core often enough that the opponent must respect it, while using the rest of the team to support, protect, or complement that plan."
    ],
    "needs": [
      "clear core",
      "clear reason the core is strong",
      "support for the core",
      "answers to the core’s weaknesses",
      "backup plan",
      "enough team cohesion"
    ],
    "roles": [
      "core Pokémon",
      "core partner",
      "support Pokémon",
      "defensive pivot",
      "speed control support",
      "matchup answer",
      "backup attacker"
    ],
    "strengths": [
      "very clear team purpose",
      "easy to understand why slots are added",
      "strong if the core is powerful",
      "helps newer players build with intent",
      "works well with the Team Building Guide"
    ],
    "weaknesses": [
      "can become too dependent on the core",
      "may struggle if the core is countered",
      "can over-support one idea",
      "backup plan may be weak",
      "team may become predictable"
    ],
    "mistakes": [
      "adding support that only helps one Pokémon",
      "ignoring matchups where the core is bad",
      "not having a backup mode",
      "forcing the core every game",
      "refusing to change the core after testing"
    ],
    "build": [
      "Start with the Team Building Guide. Use Metadex to understand the chosen Pokémon or pair. Use Team Builder to add Pokémon that improve offensive synergy, defensive synergy, support, speed control, and matchups. Use Analysis and Matchups to check whether the team still functions when the core is not ideal."
    ],
    "choose": [
      "you have a Pokémon or pair you really want to use",
      "the core has a clear strength",
      "you know what support it needs",
      "you want a focused building process",
      "you are using the Team Building Guide"
    ],
    "careful": [
      "the core is too easy to stop",
      "every slot only supports one plan",
      "you lack backup options",
      "you ignore bad matchups",
      "you keep forcing the core when testing shows it is not working"
    ],
    "related": [
      "setup-offense",
      "weather",
      "redirection-setup",
      "mode-based",
      "balanced-offense"
    ],
    "topics": [
      "What Is a Core?",
      "Adding to a Core",
      "When Is the Core Ready?",
      "Team Cohesion",
      "Testing Teams"
    ]
  }
};

export const ARCHETYPE_ARTICLES = {
  ...BEGINNER_ARCHETYPE_ARTICLES,
  ...ADVANCED_ARCHETYPE_ARTICLES
};
