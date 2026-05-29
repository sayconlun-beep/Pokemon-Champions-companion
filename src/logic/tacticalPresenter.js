import { ensureSentence, normalizeTacticalDisplayText } from '../core/tacticalNormalization.js';
const EMPTY_MATCHUP_PROMPT = 'Choose an opposing Pokémon in the Battle Scenario Planner to generate matchup-specific coaching cards.';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(values) {
  return safeArray(values).filter((value) => String(value || '').trim());
}

function uniq(values) {
  return [...new Set(compact(values))];
}

function cleanSentence(value = '') {
  return ensureSentence(value);
}

function joinNames(values = [], glue = ' or ') {
  return uniq(values).slice(0, 2).join(glue);
}

function stripWatchOutSentence(value = '') {
  return String(value || '').replace(/\s*Watch out for [^.!?]+[.!?]/gi, '').trim();
}

function factKey(parts = []) {
  return parts.map((part) => String(part || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).join(':');
}

function displayOpponentName(context = {}) {
  return String(context.selectedOpponentName || context.opponentName || '').trim();
}

function displayOpponentTypes(context = {}) {
  return safeArray(context.selectedOpponentTypes || context.opponentTypes).filter(Boolean);
}

function pokemonNameFromScenario(item = {}) {
  return String(item.displayName || item.pokemonName || item.name || item.pokemon?.name || item.pokemon?.species || '').trim();
}

function scenarioExplanation(item = {}) {
  return String(item.explanation || item.reason || item.detail || '').trim();
}

function buildTeamIdentity(profile = {}) {
  const archetype = String(profile?.archetype?.primary || 'No clear archetype yet').trim();
  const framing = stripWatchOutSentence(profile?.coaching?.beginnerSummary || profile?.beginnerSummary || 'This page uses the same detected team plan as the Analysis Desk.');
  if (!framing) return cleanSentence(`${archetype}: This page uses the detected team plan for matchup preparation.`);
  return framing.toLowerCase().includes(archetype.toLowerCase()) ? cleanSentence(framing) : cleanSentence(`${archetype}: ${framing}`);
}


function buildSpeedControlPresentation(profile = {}) {
  const summary = cleanSentence(profile?.speedProfile?.summary || 'No clear speed control has been selected yet.');
  const risks = safeArray(profile?.speedProfile?.risks).map(cleanSentence).filter(Boolean);
  return {
    summary,
    risks,
    bullets: uniq([summary, ...risks])
  };
}

function buildMatchupsOverview(profile = {}, context = {}) {
  const identity = buildTeamIdentity(profile);
  const opponentName = displayOpponentName(context);
  const biggestRisk = profile?.risks?.[0]?.type
    ? `Watch out for ${profile.risks[0].type} pressure when selecting your lead pair.`
    : opponentName
      ? `Prepare your lead pair around ${opponentName} without changing the team's core plan.`
      : 'Pick an opposing Pokémon below to turn this shared plan into matchup-specific preparation.';
  return cleanSentence(`${identity} ${biggestRisk}`);
}

function buildLeadPresentations(profile = {}) {
  return safeArray(profile?.coaching?.recommendedLeads).map((lead, index) => ({
    key: factKey(['lead', lead.kind || lead.title || index, ...safeArray(lead.members)]),
    title: String(lead.title || (index === 0 ? 'Best opening' : 'Secondary lead')).trim(),
    members: safeArray(lead.members),
    reason: cleanSentence(lead.reason),
    turnOne: cleanSentence(lead.turnOne),
    watchOut: cleanSentence(lead.watchOut),
    backHalf: cleanSentence(lead.backHalf)
  })).filter((lead) => lead.members.length && (lead.turnOne || lead.reason));
}

function leadNames(profile = {}) {
  const firstLead = safeArray(profile?.coaching?.recommendedLeads)[0];
  return safeArray(firstLead?.members).join(' + ');
}

function commonRiskContext(type = '') {
  const text = String(type || '').toLowerCase();
  if (/flying/.test(text)) return 'Common in Flying-heavy pressure or Ground-immune pivot cores, especially when the opponent pairs a fast attacker with a bulky switch-in.';
  if (/ground/.test(text)) return 'Common in Earthquake-style offense and Intimidate pivot teams that pressure grounded supports while their partner protects or floats above the attack.';
  if (/fire/.test(text)) return 'Common in sun offense and Fire-type breaker leads that punish Steel, Grass, Ice, or Bug partners before they can support.';
  if (/water/.test(text)) return 'Common in rain offense and bulky Water leads that force defensive switches while their partner sets speed control.';
  if (/electric/.test(text)) return 'Common in fast Electric pressure, paralysis support, and Volt Switch-style positioning cores.';
  if (/ice/.test(text)) return 'Common in Ice coverage from fast coverage attackers and Blizzard-style spread teams.';
  if (/rock/.test(text)) return 'Common in Rock Slide pressure, where flinch odds can punish passive setup turns.';
  if (/fairy/.test(text)) return 'Common in Fairy-heavy balance teams that punish Dragon, Fighting, or Dark attackers trying to force early KOs.';
  if (/speed|tailwind/.test(text)) return 'Common against Tailwind offense, where the opponent can make your normal speed assumptions unsafe for several turns.';
  if (/trick room/.test(text)) return 'Common against Trick Room teams, where slower attackers become the immediate threat once the room is active.';
  if (/taunt|encore|fake out|disrupt/.test(text)) return 'Common into disruption leads that deny your first support move instead of racing your damage directly.';
  if (/weather|rain|sun|sand|snow/.test(text)) return 'Common into weather teams that compress damage boosts, speed boosts, and field control into the first few turns.';
  if (/setup|boost/.test(text)) return 'Common into setup attackers that punish a passive first turn with an immediate damage threat.';
  return 'This risk matters most when the opposing lead can pressure your enabler before it creates the field state your team needs.';
}

function leadAdjustment(type = '', names = '') {
  const text = String(type || '').toLowerCase();
  if (/fighting/.test(text)) return names
    ? `Lead adjustment: if ${names} exposes a Fighting-weak piece on turn 1, open with a Fake Out user first to deny the initial attack.`
    : 'Lead adjustment: open with a Fake Out user to deny the first attack rather than exposing a Fighting-weak piece immediately.';
  if (/ground/.test(text)) return names
    ? `Lead adjustment: if ${names} puts a Ground-weak piece at risk, pivot to a Ground-immune or floating partner first.`
    : 'Lead adjustment: pivot to a Ground-immune Pokémon before committing your grounded pieces.';
  if (/flying/.test(text)) return names
    ? `Lead adjustment: if ${names} exposes a Flying-weak piece, delay the Tailwind setter and open with a bulkier front to buy a safer setup window.`
    : 'Lead adjustment: avoid leading your Tailwind setter directly into Flying pressure; find a safer window for the setup turn.';
  if (/rock/.test(text)) return 'Lead adjustment: Rock Slide flinch odds punish passive setup turns; avoid protecting into a Rock Slide lead without a safe answer ready.';
  if (/psychic/.test(text)) return 'Lead adjustment: keep Psychic-weak pieces off the field until the Psychic attacker is identified or chipped down.';
  if (/water/.test(text)) return 'Lead adjustment: front with a Water-resistant pivot rather than exposing Fire or Ground pieces into a Water lead.';
  if (/electric/.test(text)) return 'Lead adjustment: keep Water or Flying pieces behind a redirect or Ground-immune partner if Electric pressure is obvious on turn 1.';
  return names
    ? `Lead adjustment: if ${names} exposes the enabler into this pressure, choose a safer opening or Protect first.`
    : 'Lead adjustment: avoid opening with the Pokémon that must survive to enable your main plan if this pressure is obvious.';
}

function riskLabel(risk = {}) {
  const type = String(risk.type || '').trim();
  const lower = `${type} ${risk.beginnerAdvice || risk.reason || ''}`.toLowerCase();
  if (/speed|tailwind|trick room|icy wind|paralysis/.test(lower)) return 'Speed-control pressure';
  if (/taunt|encore|fake out|disrupt|parting shot|snarl|intimidate/.test(lower)) return 'Disruption pressure';
  if (/weather|rain|sun|sand|snow/.test(lower)) return 'Weather pressure';
  if (/setup|boost/.test(lower)) return 'Setup pressure';
  return type ? `${risk.severity || 'Mapped'} ${type} pressure` : 'Mapped matchup pressure';
}

function buildPrimaryRisks(profile = {}, context = {}) {
  const risks = safeArray(profile?.risks);
  const opponentName = displayOpponentName(context);
  const opponentTypes = displayOpponentTypes(context);
  const names = leadNames(profile);
  const filledSlots = Number(profile?.completeness?.filledSlots || 0);

  if (!filledSlots) {
    return [{
      key: factKey(['matchup-risk', 'empty-team']),
      empty: true,
      title: 'No team selected',
      question: 'No team selected',
      answer: 'Select or import a team to surface matchup risks.'
    }];
  }

  const primaryRisks = risks.map((risk) => {
    const type = String(risk.type || '').trim();
    if (!type && !risk.beginnerAdvice && !risk.reason) return null;
    const label = riskLabel(risk);
    const opponentContext = opponentName
      ? `${opponentName}${opponentTypes.length ? ` brings ${opponentTypes.join(' / ')} pressure, so this risk matters most when that slot can attack your support piece freely.` : ' is the selected opposing Pokémon, so position around that slot before committing your setup.'}`
      : commonRiskContext(type || risk.beginnerAdvice || risk.reason);
    const exposed = joinNames(risk.affectedPokemon || [], ' or ');
    const answers = joinNames(risk.softAnswers || [], ' or ');
    const rosterContext = exposed && answers
      ? `The main exposed slots are ${exposed}; keep ${answers} available as the safer answer when possible.`
      : exposed
        ? `The main exposed slots are ${exposed}, so use Protect, pivoting, or offensive pressure before exposing them.`
        : '';
    const adjustment = leadAdjustment(type, names);
    return {
      key: factKey(['matchup-risk', type || label]),
      title: label,
      question: label,
      answer: cleanSentence(`${opponentContext} ${rosterContext} ${adjustment}`),
      sourceRisk: risk
    };
  }).filter(Boolean).slice(0, 3);

  if (primaryRisks.length) return primaryRisks;

  return [{
    key: factKey(['matchup-risk', 'no-shared-risk', opponentName || 'general']),
    empty: true,
    title: 'No major matchup risk surfaced',
    question: 'No major matchup risk surfaced',
    answer: opponentName
      ? cleanSentence(`No major shared risk is highlighted yet. Use the planner below to compare your team into ${opponentName}.`)
      : 'No major shared risk is highlighted yet. Choose an opposing Pokémon below for matchup-specific preparation.'
  }];
}

function buildSpeedBattleTip(profile = {}, opponentName = '') {
  const sources = safeArray(profile?.teamFunctions?.speedControl).map((entry) => entry.pokemon || entry.name).filter(Boolean);
  if (!sources.length || !opponentName) return null;
  const mode = profile?.speedProfile?.mode || 'speed control';
  return {
    key: factKey(['battle-tip', 'speed', opponentName, ...sources]),
    title: `Speed plan into ${opponentName}`,
    detail: cleanSentence(`${joinNames(sources)} gives you ${mode} into ${opponentName}. Treat Icy Wind, Tailwind, Trick Room, paralysis, and priority as speed positioning tools, not just damage pressure.`)
  };
}

function buildDisruptionBattleTip(profile = {}, opponentName = '') {
  const sources = uniq([
    ...safeArray(profile?.teamFunctions?.fakeOut),
    ...safeArray(profile?.teamFunctions?.disruption),
    ...safeArray(profile?.teamFunctions?.intimidate)
  ].map((entry) => entry.pokemon || entry.name));
  if (!sources.length || !opponentName) return null;
  return {
    key: factKey(['battle-tip', 'disruption', opponentName, ...sources]),
    title: `Disruption into ${opponentName}`,
    detail: cleanSentence(`${joinNames(sources)} can buy tempo into ${opponentName}. Use these turns to deny actions, lower damage, or reset positioning rather than treating them as raw damage pressure.`)
  };
}

function buildBestAnswerTip(context = {}) {
  const opponentName = displayOpponentName(context);
  const recommendations = safeArray(context.scenarioRecommendations);
  const best = recommendations.find((item) => item.tier !== 'avoid') || recommendations[0];
  const bestName = pokemonNameFromScenario(best);
  if (!opponentName || !bestName) return null;
  return {
    key: factKey(['battle-tip', 'best-answer', opponentName, bestName]),
    title: `Best answer into ${opponentName}`,
    detail: cleanSentence(`${bestName} is your safest immediate answer into ${opponentName}. ${scenarioExplanation(best) || 'Use it to steady the board before committing your main damage route.'}`)
  };
}

function buildPositioningRiskTip(context = {}) {
  const opponentName = displayOpponentName(context);
  const opponentTypes = displayOpponentTypes(context);
  const riskyNames = safeArray(context.scenarioRecommendations).filter((item) => item.tier === 'avoid').map(pokemonNameFromScenario).filter(Boolean).slice(0, 2);
  if (!opponentName || !opponentTypes.length || !riskyNames.length) return null;
  return {
    key: factKey(['battle-tip', 'positioning', opponentName, ...riskyNames]),
    title: `Positioning risk into ${opponentName}`,
    detail: cleanSentence(`${opponentName}'s ${opponentTypes.join(' / ')} typing makes direct positioning awkward for ${riskyNames.join(' or ')}. Use Protect, a pivot turn, or your safer answer before exposing them.`)
  };
}

function buildBattleTips(profile = {}, context = {}) {
  const opponentName = displayOpponentName(context);
  if (!opponentName) return [];
  return compact([
    buildBestAnswerTip(context),
    buildSpeedBattleTip(profile, opponentName),
    buildDisruptionBattleTip(profile, opponentName),
    buildPositioningRiskTip(context)
  ]).filter((card) => card?.title && card?.detail).slice(0, 4);
}

function buildBattleCoachingPresentation(profile = {}, context = {}) {
  const items = buildBattleTips(profile, context);
  return {
    title: 'Battle Coaching',
    kicker: 'Battle coaching',
    summary: 'Opponent-reactive matchup advice only. General team strategy stays on the Analysis Desk.',
    emptyMessage: EMPTY_MATCHUP_PROMPT,
    items
  };
}

function buildRecommendations(profile = {}) {
  return safeArray(profile?.recommendations).map((text, index) => ({
    key: factKey(['recommendation', index, text]),
    text: cleanSentence(text)
  })).filter((item) => item.text);
}

function buildAnalysisRiskDisplay(risk = {}) {
  const type = String(risk.type || '').trim();
  const exposed = joinNames(risk.affectedPokemon || [], ' or ');
  const answers = joinNames(risk.softAnswers || [], ' or ');
  const summary = cleanSentence(risk.beginnerAdvice || risk.reason || (type ? `Use safer positioning into ${type} pressure.` : 'Use safer positioning into this pressure.'));
  const title = type ? `${risk.severity || 'Mapped'} ${type} risk` : 'Team risk';
  const currentAnswerText = answers
    ? `Keep ${answers} available as safer answers when possible.`
    : 'Use typing, immunity, resistance, Protect turns, and offensive pressure as your current soft answers.';
  const lookForText = type
    ? `Use safer positioning into ${type} pressure: scout with Protect, avoid repeated free switches, and answer dangerous boards before they become predictable.`
    : 'Use safer positioning into pressure: scout with Protect, avoid repeated free switches, and answer dangerous boards before they become predictable.';
  const suggestedSlotText = type
    ? `${type}-weak slot; review whether that role can be adjusted without breaking the main plan.`
    : 'Review the most flexible support slot before changing a key enabler.';
  const multipleSlotText = type
    ? `${type} pressure affects multiple slots — review the team holistically.`
    : 'Multiple slots affected — review the team holistically.';
  return {
    title,
    summary,
    currentAnswerText: cleanSentence(currentAnswerText),
    lookForText: cleanSentence(lookForText),
    suggestedSlotText: cleanSentence(suggestedSlotText),
    multipleSlotText: cleanSentence(multipleSlotText),
    exposedText: exposed ? `Exposed slots: ${exposed}.` : '',
    answerText: answers ? `Safer answers: ${answers}.` : ''
  };
}

function buildAnalysisRisks(profile = {}) {
  return safeArray(profile?.risks).map((risk) => {
    const display = buildAnalysisRiskDisplay(risk);
    if (!display.summary) return null;
    const type = String(risk.type || '').trim();
    const exposed = joinNames(risk.affectedPokemon || [], ' or ');
    const answers = joinNames(risk.softAnswers || [], ' or ');
    return {
      key: factKey(['analysis-risk', type || risk.severity || display.summary]),
      title: display.title,
      summary: display.summary,
      exposed,
      answers,
      severity: risk.severity || 'Low',
      display,
      sourceRisk: risk
    };
  }).filter(Boolean).slice(0, 6);
}

function buildDefensiveGamePlan(profile = {}) {
  const risks = buildAnalysisRisks(profile);
  const top = risks[0];
  const fallbackConcern = cleanSentence(profile?.defensiveProfile?.summary || 'No single defensive concern stands out yet. Finish the team to make this section more precise.');
  return {
    concern: top ? cleanSentence(`${top.title}: ${top.summary}`) : fallbackConcern,
    softAnswers: top?.display?.currentAnswerText || 'Use typing, immunity, resistance, Protect turns, and offensive pressure as your current soft answers.',
    lookFor: top?.display?.lookForText || 'Use safer positioning into pressure: scout with Protect, avoid repeated free switches, and answer dangerous boards before they become predictable.',
    actionableTitle: 'Actionable risk checks',
    actionableEmptyMessage: 'No major defensive pressure stands out yet.',
    risks
  };
}


function humanList(values = []) {
  const items = uniq(values).slice(0, 4);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function normalizeCoverageStatus(value = '') {
  const text = String(value || '').toLowerCase();
  if (text.includes('exposed')) return 'Exposed';
  if (text.includes('cover')) return 'Covered';
  return 'Needs attention';
}

function defensiveAnswerCount(entry = {}) {
  return Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);
}

function competitiveTypePriority(typeName = '') {
  const priorityTypes = ['Ground', 'Fighting', 'Water', 'Fire', 'Electric', 'Ice', 'Fairy', 'Dragon', 'Dark', 'Rock'];
  const index = priorityTypes.indexOf(typeName);
  return index === -1 ? 0 : priorityTypes.length - index;
}

function topWeaknessConcern(entries = []) {
  return safeArray(entries)
    .filter((entry) => Number(entry?.weakCount || 0) > 0)
    .map((entry) => ({
      ...entry,
      answerCount: defensiveAnswerCount(entry),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .sort((a, b) => {
      const exposedDelta = Number(normalizeCoverageStatus(b.classification) === 'Exposed') - Number(normalizeCoverageStatus(a.classification) === 'Exposed');
      if (exposedDelta) return exposedDelta;
      const weakDelta = b.weakScore - a.weakScore;
      if (weakDelta) return weakDelta;
      const answerDelta = a.answerCount - b.answerCount;
      if (answerDelta) return answerDelta;
      return b.priority - a.priority;
    })[0] || null;
}

function topWeaknessStrength(entries = [], excludedType = '') {
  return safeArray(entries)
    .filter((entry) => entry?.attackingType !== excludedType)
    .map((entry) => ({
      ...entry,
      answerCount: defensiveAnswerCount(entry),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .filter((entry) => normalizeCoverageStatus(entry.classification) === 'Covered' && entry.answerCount >= 2)
    .sort((a, b) => {
      const answerDelta = b.answerCount - a.answerCount;
      if (answerDelta) return answerDelta;
      const weakDelta = a.weakScore - b.weakScore;
      if (weakDelta) return weakDelta;
      return b.priority - a.priority;
    })[0] || null;
}

const DEFENSIVE_TYPE_ANSWERS = {
  Normal: ['Rock-types resist Normal', 'Steel-types resist Normal', 'Ghost-types are immune to Normal'],
  Fire: ['Water-types resist Fire', 'Rock-types resist Fire', 'Dragon-types resist Fire'],
  Water: ['Grass-types resist Water', 'Dragon-types resist Water', 'Water-types resist Water'],
  Electric: ['Ground-types are immune to Electric', 'Grass-types resist Electric', 'Dragon-types resist Electric'],
  Grass: ['Fire-types resist Grass', 'Flying-types resist Grass', 'Steel-types resist Grass'],
  Ice: ['Fire-types resist Ice', 'Water-types resist Ice', 'Steel-types resist Ice'],
  Fighting: ['Flying-types resist Fighting', 'Psychic-types resist Fighting', 'Ghost-types are immune to Fighting'],
  Poison: ['Steel-types are immune to Poison', 'Ground-types threaten Poison offensively', 'Psychic-types threaten Poison offensively'],
  Ground: ['Flying-types are immune to Ground', 'Grass-types resist Ground', 'Bug-types resist Ground'],
  Flying: ['Electric-types resist Flying', 'Rock-types resist Flying', 'Steel-types resist Flying'],
  Psychic: ['Dark-types are immune to Psychic', 'Steel-types resist Psychic', 'Bug- or Ghost-type pressure can threaten Psychic-types'],
  Bug: ['Fire-types resist Bug', 'Flying-types resist Bug', 'Steel-types resist Bug'],
  Rock: ['Fighting-types resist Rock', 'Ground-types resist Rock', 'Steel-types resist Rock'],
  Ghost: ['Normal-types are immune to Ghost', 'Dark-types resist Ghost', 'Dark-type pressure threatens Ghost-types'],
  Dragon: ['Fairy-types are immune to Dragon', 'Steel-types resist Dragon', 'Ice or Fairy pressure threatens Dragon-types'],
  Dark: ['Fighting-types resist Dark', 'Fairy-types resist Dark', 'Dark-types resist Dark'],
  Steel: ['Fire-types resist Steel', 'Water-types resist Steel', 'Electric-types resist Steel'],
  Fairy: ['Steel-types resist Fairy', 'Poison-types resist Fairy', 'Fire-types resist Fairy']
};

function weaknessAnswerAdvice(typeName = '') {
  const answers = DEFENSIVE_TYPE_ANSWERS[typeName] || [];
  return answers.length
    ? `${answers.join(', ')}, or a teammate that can safely switch into common ${typeName}-type attacks`
    : `a safer switch-in, offensive pressure into ${typeName}-types, or support that helps your team avoid taking clean hits`;
}

function profileSoftAnswerNames(profile = {}) {
  const f = profile?.teamFunctions || {};
  const names = [];
  if (safeArray(f.speedControl).length || profile?.speedProfile?.mode) names.push('speed control');
  if (safeArray(f.fakeOut).length) names.push('Fake Out');
  if (safeArray(f.intimidate).length) names.push('Intimidate');
  if (safeArray(f.redirection).length) names.push('redirection');
  if (safeArray(f.disruption).length) names.push('disruption');
  if (safeArray(f.screenSetters).length) names.push('screens');
  return uniq(names);
}

function usefulSupportText(profile = {}) {
  const softAnswers = profileSoftAnswerNames(profile);
  return softAnswers.length
    ? `${humanList(softAnswers)} can reduce risk, but still keep a true defensive answer healthy when possible.`
    : 'Protect, speed control, Fake Out, redirection, Intimidate, or status can buy safer turns while you look for a better answer.';
}

function weaknessTileDisplay(entry = {}, profile = {}) {
  const typeName = entry.attackingType || 'This type';
  const status = normalizeCoverageStatus(entry.classification);
  const weak = Number(entry.weakCount || 0);
  const answers = defensiveAnswerCount(entry);
  const currentProfile = `${Number(entry.resistCount || 0)} resist, ${Number(entry.immuneCount || 0)} immune, ${weak} weak.`;

  const whyDetail = (() => {
    if (status === 'Exposed') {
      if (answers === 0 && weak >= 2) return 'several Pokémon are weak to it and the team has limited safe switch-ins.';
      if (answers === 0) return 'the team has limited safe switch-ins for this attacking type.';
      if (answers === 1 && weak >= 2) return 'several Pokémon are weak to it and the team leans heavily on one defensive answer.';
      if (answers === 1) return 'the team leans on one resist or immunity, so keep that answer healthy.';
      return 'it can still pressure multiple teammates if your main answers are weakened early.';
    }
    if (status === 'Covered') {
      return answers >= 3
        ? 'you have several resistances, immunities, or practical answers available.'
        : 'you have multiple resistances, immunities, or practical answers available.';
    }
    if (answers === 1 && weak >= 2) return 'you have one answer, but several teammates are weak to it.';
    if (answers === 1) return 'you have one answer, so the matchup can become risky if that Pokémon is weakened.';
    if (weak > 0) return 'it can pressure part of the team and your answers may not be completely safe.';
    return 'there are limited safe switch-ins even though no teammate is directly weak to it.';
  })();

  const headline = status === 'Exposed'
    ? `${typeName} has limited safe switch-ins.`
    : status === 'Covered'
      ? `${typeName} is reasonably covered.`
      : `${typeName} pressure needs attention.`;

  const softAnswers = profileSoftAnswerNames(profile);
  return {
    key: factKey(['weakness-coverage', typeName]),
    type: typeName,
    status,
    headline: cleanSentence(headline),
    why: cleanSentence(`${headline} ${whyDetail}`),
    currentProfile,
    lookFor: cleanSentence(weaknessAnswerAdvice(typeName)),
    usefulSupport: cleanSentence(usefulSupportText(profile)),
    softAnswersText: softAnswers.length ? cleanSentence(`${humanList(softAnswers)} can help, but they do not fully replace a safe switch-in.`) : '',
    coveredSummary: cleanSentence(`${headline} ${whyDetail}`)
  };
}

function buildWeaknessCoveragePresentation(profile = {}) {
  const entries = safeArray(profile?.defensiveProfile?.rawWeaknessCoverage);
  const concern = topWeaknessConcern(entries);
  const strength = topWeaknessStrength(entries, concern?.attackingType);
  const concernDisplay = concern ? weaknessTileDisplay(concern, profile) : null;
  const strengthDisplay = strength ? weaknessTileDisplay(strength, profile) : null;
  const rows = entries.map((entry) => weaknessTileDisplay(entry, profile));
  const summary = concernDisplay
    ? `${concernDisplay.headline} ${strengthDisplay ? `${strengthDisplay.type} is one of the safer defensive areas.` : 'Use the tile details to compare safe answers before changing slots.'}`
    : 'No major type weakness stands out yet. Use the tile details to compare defensive answers.';
  return {
    title: 'Weakness Coverage',
    summary: 'A quick view of which attacking types your team handles well and which ones may need safer answers.',
    collapsedPreview: 'Type weakness coverage tiles available.',
    fallbackSummary: 'A simple coverage overview will show here once this team has complete typing data.',
    fallbackPreview: 'Typing data needed for coverage tiles.',
    fallbackBody: 'Type coverage will appear once this team has complete typing data.',
    coachingSummary: cleanSentence(summary),
    rows,
    byType: Object.fromEntries(rows.map((row) => [row.type, row]))
  };
}

function buildPressureCoveragePresentation(pressure = {}) {
  const types = safeArray(pressure.types);
  const covered = types.filter((entry) => entry.strength === 'COVERED').map((entry) => entry.type);
  const light = types.filter((entry) => entry.strength === 'LIGHT').map((entry) => entry.type);
  const none = types.filter((entry) => entry.strength === 'NONE').map((entry) => entry.type);
  const strongText = covered.length
    ? `strong pressure in ${humanList(covered)}`
    : light.length
      ? `some pressure in ${humanList(light)}`
      : 'very little confirmed offensive pressure';
  const lackingText = none.length ? ` but lacks ${humanList(none)} coverage` : ' with no uncovered offensive types';
  return {
    title: 'Pressure Coverage',
    summary: cleanSentence(`Your team has ${strongText}${lackingText}`),
    members: safeArray(pressure.members),
    types
  };
}

function buildImportantPokemon(profile = {}) {
  const plans = safeArray(profile?.gameplans);
  const winPieces = uniq(safeArray(profile?.winConditions).flatMap((condition) => safeArray(condition.pieces)));
  const supportEntries = uniq([
    ...safeArray(profile?.teamFunctions?.speedControl),
    ...safeArray(profile?.teamFunctions?.weatherSetters),
    ...safeArray(profile?.teamFunctions?.screenSetters),
    ...safeArray(profile?.teamFunctions?.fakeOut),
    ...safeArray(profile?.teamFunctions?.disruption)
  ].map((entry) => entry.pokemon || entry.member));
  return uniq([
    ...safeArray(plans[0]?.enablers),
    ...safeArray(plans[0]?.abusers),
    ...winPieces,
    ...supportEntries
  ]).slice(0, 4).map((pokemon) => {
    const enables = plans.find((plan) => safeArray(plan.enablers).includes(pokemon));
    const converts = plans.find((plan) => safeArray(plan.abusers).includes(pokemon));
    const winCondition = safeArray(profile?.winConditions).find((condition) => safeArray(condition.pieces).includes(pokemon));
    const role = enables ? 'Plan Enabler' : converts || winCondition ? 'Damage Converter' : 'Support Piece';
    const planLabel = enables?.label || converts?.label || winCondition?.label || profile?.archetype?.primary || 'the team plan';
    return {
      key: factKey(['important', pokemon, role, planLabel]),
      pokemon,
      role,
      why: cleanSentence(`${pokemon} matters because it helps ${planLabel} function during the turns where your team wants control.`),
      strongestWhen: cleanSentence(enables ? `Strongest when it creates the field state before your attackers commit.` : `Strongest when it enters after support has created a safer attacking window.`),
      protectFrom: cleanSentence(`Protect ${pokemon} from direct pressure before it has completed that job.`)
    };
  });
}


function buildGuideCoreSignals(profile = {}) {
  const f = profile?.teamFunctions || {};
  return uniq([
    ...safeArray(f.weatherSetters).map((entry) => `${entry.pokemon}: ${entry.detail} sets weather`),
    ...safeArray(f.weatherAbusers).map((entry) => `${entry.pokemon}: ${entry.detail} benefits from weather`),
    ...safeArray(f.screenSetters).map((entry) => `${entry.pokemon}: ${entry.detail} support`),
    ...safeArray(f.fakeOut).map((entry) => `${entry.pokemon}: Fake Out tempo support`),
    ...safeArray(f.redirection).map((entry) => `${entry.pokemon}: ${entry.detail} redirection`),
    ...safeArray(f.intimidate).map((entry) => `${entry.pokemon}: Intimidate pivot support`),
    ...safeArray(f.scalingWinConditions).map((entry) => `${entry.pokemon}: ${entry.detail} scaling win condition`)
  ]).slice(0, 8).map(cleanSentence);
}

function buildGuideSpeedSources(profile = {}) {
  const sources = safeArray(profile?.teamFunctions?.speedControl).map((entry) => `${entry.pokemon}: ${entry.detail}`);
  if (!sources.length && profile?.speedProfile?.summary) return [cleanSentence(profile.speedProfile.summary)];
  return uniq(sources).slice(0, 6).map(cleanSentence);
}

function buildGuidePressureSources(profile = {}) {
  const f = profile?.teamFunctions || {};
  const pressure = [
    ...safeArray(profile?.offensiveProfile?.attackers).map((entry) => `${entry.pokemon}: ${entry.attackBias || 'damage'} attacker`),
    ...safeArray(f.spreadDamage).map((entry) => `${entry.pokemon}: ${entry.detail} spread pressure`),
    ...safeArray(f.priority).map((entry) => `${entry.pokemon}: ${entry.detail} priority`),
    ...safeArray(f.setupThreats).map((entry) => `${entry.pokemon}: ${entry.detail} setup threat`),
    ...safeArray(profile?.offensiveProfile?.scalingWinConditions).map((entry) => `${entry.pokemon}: ${entry.source} cleaner`)
  ];
  return uniq(pressure).slice(0, 8).map(cleanSentence);
}

function buildGuideRiskSummaries(profile = {}) {
  return buildAnalysisRisks(profile).slice(0, 3).map((risk) => cleanSentence(`${risk.title}: ${risk.summary}`));
}

function buildGuideMainPlan(profile = {}) {
  const plan = safeArray(profile?.gameplans)[0];
  if (plan?.label) return cleanSentence(`${plan.label}: ${plan.beginnerTip || plan.advice || 'Use this as the team\'s main battle plan.'}`);
  return buildTeamIdentity(profile) || 'Add selected moves and abilities to reveal the main plan.';
}

function buildGuideNextAction(profile = {}, currentStep = 1) {
  const suggestion = profile?.coaching?.nextTeammateSuggestions?.[0];
  const plan = safeArray(profile?.gameplans)[0]?.label;
  const risk = safeArray(profile?.risks)[0];
  const filledSlots = Number(profile?.completeness?.filledSlots || 0);
  const missingSlots = Number(profile?.completeness?.missingSlots || 0);
  const hasOpenTeamSlot = !profile?.completeness?.isFullTeam && missingSlots > 0;
  if (!filledSlots) return 'Choose a Pokémon, core, or tactic to start shaping the team.';
  if (hasOpenTeamSlot && suggestion) return cleanSentence(suggestion);
  if (hasOpenTeamSlot) return 'Add another teammate that supports your main plan.';
  if (currentStep <= 3) return plan ? cleanSentence(`Check whether each teammate supports ${plan}.`) : 'Check that every teammate has a clear job.';
  if (currentStep <= 5 && risk?.type) return cleanSentence(`Plan how you will position around ${risk.type}-type pressure.`);
  if (currentStep === 6) return 'Finish selected moves, items, abilities, natures, and stat points.';
  return 'Test a few games and note which matchups or turns feel awkward.';
}

function buildGuideReadiness(profile = {}, guideContext = {}) {
  const filledSlots = Number(profile?.completeness?.filledSlots || guideContext?.teamCompleteness?.filledSlots || 0);
  const archetype = profile?.archetype?.primary || guideContext?.archetype || 'Unknown plan';
  const supports = safeArray(guideContext?.coreCohesion?.supportsMainPlan).length ? safeArray(guideContext.coreCohesion.supportsMainPlan) : buildGuideCoreSignals(profile);
  const disconnected = safeArray(guideContext?.coreCohesion?.disconnectedPieces);
  const speedSources = buildGuideSpeedSources(profile);
  const pressureSources = buildGuidePressureSources(profile);
  const riskSummaries = buildGuideRiskSummaries(profile);
  const checks = [
    { ok: filledSlots >= 3, title: 'Clear main plan', detail: filledSlots >= 3 ? `Detected archetype: ${archetype}.` : 'Main plan is not fully established yet.' },
    { ok: pressureSources.length >= 2 || supports.length >= 2, title: 'Enough offensive pressure', detail: pressureSources.length >= 2 ? 'The core shows multiple pressure signals.' : 'Add another way to convert support into damage.' },
    { ok: speedSources.length > 0, title: 'Enough speed control', detail: speedSources.length ? speedSources[0] : 'Consider Tailwind, Trick Room, Icy Wind, priority, or similar tools.' },
    { ok: supports.length > 0, title: 'Enough support/disruption', detail: supports.length ? 'Support pieces are contributing to the plan.' : 'The team needs more enabling or disruption.' },
    { ok: riskSummaries.length === 0, title: 'No major defensive concerns visible', detail: riskSummaries.length ? riskSummaries[0] : 'No obvious issue detected yet.' },
    { ok: disconnected.length === 0, title: 'No disconnected pieces', detail: disconnected.length ? disconnected.slice(0, 2).join(' • ') : 'Every visible piece appears connected.' }
  ];
  const passed = checks.filter((check) => check.ok).length;
  const verdict = passed >= 5
    ? 'Core looks testable and supports a clear game plan.'
    : passed >= 3
      ? `Core looks testable, but ${riskSummaries[0] || disconnected[0] || 'a few areas still need attention'}.`
      : 'Core is not ready yet. The main plan still needs more structure.';
  return { verdict: cleanSentence(verdict), checks };
}

function buildGuideRoundOut(profile = {}, guideContext = {}) {
  const gaps = [];
  if (!buildGuideSpeedSources(profile).length) gaps.push('speed control');
  if (!safeArray(profile?.teamFunctions?.disruption).length && !safeArray(profile?.teamFunctions?.fakeOut).length && !safeArray(profile?.teamFunctions?.redirection).length) gaps.push('support/disruption');
  if (buildGuidePressureSources(profile).length < 2) gaps.push('secondary pressure');
  if (safeArray(guideContext?.coreCohesion?.disconnectedPieces).length) gaps.push('cohesion support');
  return {
    gaps,
    gapText: gaps.length ? gaps.join(', ') : 'no major role gaps detected'
  };
}

function buildGuideMainIdeaSignals(profile = {}, guideContext = {}) {
  const synergy = safeArray(guideContext?.coreSynergySignals).length ? safeArray(guideContext.coreSynergySignals) : buildGuideCoreSignals(profile);
  const speed = buildGuideSpeedSources(profile);
  const pressure = buildGuidePressureSources(profile);
  const archetype = profile?.archetype?.primary || guideContext?.archetype || '';
  const hasSunTailwind = /sun\s*\+\s*tailwind/i.test(archetype) || (archetype.toLowerCase().includes('sun') && archetype.toLowerCase().includes('tailwind'));
  const find = (entries, pattern) => safeArray(entries).find((entry) => pattern.test(String(entry || ''))) || '';
  if (hasSunTailwind) {
    return [
      { label: 'Drought user', text: cleanSentence(find(synergy, /drought|sets sun/i) || 'A Drought user is the sun setter that starts the weather plan.') },
      { label: 'Tailwind user', text: cleanSentence(find(speed, /tailwind/i) || find(synergy, /tailwind/i) || 'A Tailwind user gives the team temporary speed control.') },
      { label: 'Sun abuser', text: cleanSentence(find(synergy, /chlorophyll|solar power|benefits from weather|abuses the sun/i) || 'A sun abuser such as Chlorophyll converts the weather into stronger tempo or damage.') },
      { label: 'Pressure angle', text: cleanSentence(pressure.slice(0, 2).join('; ') || 'The team converts sun and speed turns into offensive pressure.') }
    ];
  }
  return [
    { label: 'Core signals', text: cleanSentence(synergy.slice(0, 2).join('; ') || 'Add more moves, abilities, or teammates to reveal the core synergy.') },
    { label: 'Speed plan', text: cleanSentence(speed.slice(0, 2).join('; ') || 'No clear speed control source is visible yet.') },
    { label: 'Pressure angle', text: cleanSentence(pressure.slice(0, 2).join('; ') || 'Add clear attackers or pressure tools to show how the team wins.') }
  ];
}

function buildGuidePresentation(profile = {}, context = {}) {
  const guideContext = context.guideContext || context;
  const currentStep = Number(context.currentStep || guideContext.currentStep || 1);
  const risks = buildAnalysisRisks(profile).slice(0, 3);
  const leads = buildLeadPresentations(profile);
  return {
    mainPlanSummary: buildGuideMainPlan(profile),
    coreSignals: buildGuideCoreSignals(profile),
    speedControlSources: buildGuideSpeedSources(profile),
    pressureSources: buildGuidePressureSources(profile),
    riskSummaries: buildGuideRiskSummaries(profile),
    riskCards: risks.map((risk, index) => ({
      key: risk.key,
      title: `#${index + 1} ${risk.title}`,
      exposed: risk.exposed ? `Who is exposed: ${risk.exposed}.` : 'Who is exposed: Team members identified by the weakness analysis.',
      impact: `Main plan impact: ${risk.summary}`,
      answers: risk.answers ? `Possible answers: keep ${risk.answers} available as safer answers when possible.` : 'Possible answers: resist, pivot, speed control, offensive pressure, or item/move adjustments.'
    })),
    nextAction: buildGuideNextAction(profile, currentStep),
    mainIdeaSignals: buildGuideMainIdeaSignals(profile, guideContext),
    corePieces: safeArray(guideContext?.corePieces),
    coreCohesion: guideContext?.coreCohesion || {},
    readiness: buildGuideReadiness(profile, guideContext),
    roundOut: buildGuideRoundOut(profile, guideContext),
    testing: {
      leads: leads.slice(0, 4).map((lead) => ({
        key: lead.key,
        title: safeArray(lead.members).join(' + ') || lead.title,
        detail: lead.turnOne || lead.reason || 'Test this pairing as an opening option and record whether it creates pressure, positioning, speed control, or setup opportunities for the rest of the team.'
      })),
      risks: risks.map((risk) => risk.title)
    }
  };
}




function simplifyStudySentence(text = '') {
  return cleanSentence(String(text || '')
    .replace(/speed-control sequencing/gi, 'keeping your speed-control Pokémon healthy')
    .replace(/preserve speed control/gi, 'keep your speed-control Pokémon healthy')
    .replace(/tactical identity/gi, 'game plan')
    .replace(/pressure routing/gi, 'safe attacking plan')
    .replace(/conversion route/gi, 'path to winning')
    .replace(/conversion/gi, 'turning an advantage into a win')
    .replace(/positioning advantage/gi, 'safer board position')
    .replace(/pressure/gi, 'threat')
    .replace(/sequencing/gi, 'timing')
    .replace(/preserve/gi, 'keep')
    .trim());
}

function studyBullets(primary = [], fallback = []) {
  return uniq([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])])
    .map(simplifyStudySentence)
    .filter(Boolean)
    .slice(0, 4);
}

function buildProTeamBeginnerSummaryPresentation(team = {}, primaryStyle = '') {
  const style = String(primaryStyle || team.styleLabel || '');
  if (/bulky|defensive/i.test(style)) {
    return 'This team tries to stay safe early, protect its important Pokémon, and win once the opponent has fewer good switches.';
  }
  if (/speed|tailwind/i.test(style)) {
    return 'This team wants to control turn order first, then let its attackers move before the opponent can respond.';
  }
  if (/offense|setup/i.test(style)) {
    return 'This team wants to start quickly, create safe attacking turns, and finish before the opponent stabilizes.';
  }
  return 'This team has a clear tournament plan: make safe early turns, protect key Pokémon, and choose the right moment to attack.';
}

function buildProTeamKeyPokemonPresentation(members = [], profile = {}) {
  const important = buildImportantPokemon(profile).map((entry) => entry.pokemon);
  const winPieces = safeArray(profile?.winConditions).flatMap((condition) => safeArray(condition.pieces));
  return uniq([...important, ...winPieces, ...safeArray(members).slice(0, 3)])
    .slice(0, 4)
    .map((name) => cleanSentence(`${name} is worth studying because it shapes the team's safest game plan.`));
}

function buildProTeamOpeningPlansPresentation(team = {}, profile = {}) {
  const presenterLeads = buildLeadPresentations(profile).slice(0, 3).map((lead) => {
    const names = safeArray(lead.members).join(' + ') || lead.title;
    return `${names}: ${lead.turnOne || lead.reason}`;
  });
  const savedLeads = safeArray(team.commonLeads).slice(0, 3).map((lead) => `${lead}: use this opening when you want a safer first turn and a clear path into your main attacker.`);
  const plans = uniq([...presenterLeads, ...savedLeads]);
  if (!plans.length) plans.push('Lead with one helper Pokémon and one attacker so you can either protect your attacker or start dealing damage.');
  plans.push('Before attacking hard, ask what your opponent can threaten on turn one.');
  return plans.map(simplifyStudySentence).filter(Boolean).slice(0, 4);
}

function buildProTeamCommonMistakesPresentation(team = {}, members = []) {
  const mistakes = [];
  if (safeArray(members).some((name) => /whimsicott|raichu/i.test(name))) {
    mistakes.push('Do not let your speed-control Pokémon take too much damage early, or your attackers may move second later.');
  }
  if (safeArray(members).some((name) => /kangaskhan/i.test(name))) {
    mistakes.push('Do not send your main cleaner into danger before the opponent has been weakened.');
  }
  if (/bulky|defensive/i.test(team.styleLabel || '')) {
    mistakes.push('Do not trade Pokémon too quickly; bulky teams usually get stronger when the game slows down.');
  }
  if (/offense|setup/i.test(team.styleLabel || '')) {
    mistakes.push('Do not switch too often once your attacking plan is ready, or you may lose momentum.');
  }
  mistakes.push('Avoid clicking strong attacks without checking whether the opponent has a safe switch or speed advantage.');
  return uniq(mistakes).map(simplifyStudySentence).filter(Boolean).slice(0, 4);
}

export function buildProTeamStudyPresentation(profile = {}, context = {}) {
  const team = context.team || {};
  const members = safeArray(context.members);
  const primaryStyle = profile?.archetype?.primary || team.styleLabel || 'Balanced Team';
  const beginnerSummary = buildProTeamBeginnerSummaryPresentation(team, primaryStyle);
  const presentation = buildTacticalPresentation(profile, { page: 'pro-team-study' });
  return {
    primaryStyle,
    secondaryIdentity: profile?.archetype?.secondary || '',
    styleExplanation: simplifyStudySentence(safeArray(presentation.archetype?.reasons)[0] || beginnerSummary),
    tacticalIdentity: simplifyStudySentence(presentation.summaries?.teamIdentity || `${team.styleLabel || primaryStyle} built around clear roles, safe turns, and a planned endgame.`),
    beginnerSummary,
    winPlan: studyBullets(presentation.gameplans.map((plan) => plan.summary || plan.advice), team.usageNotes || team.coachingNotes),
    keyPokemon: buildProTeamKeyPokemonPresentation(members, profile),
    openingPlans: buildProTeamOpeningPlansPresentation(team, profile),
    commonMistakes: buildProTeamCommonMistakesPresentation(team, members),
    dangerousMatchups: studyBullets(team.dangerousMatchups, ['Teams that stop your speed control can make attacking turns harder.'])
  };
}

const PRESENTER_TOKEN_REPLACEMENTS = [
  [/strategicStrengths/gi, 'strategic strengths'],
  [/pressureTypes/gi, 'pressure types'],
  [/opponentConstraints/gi, 'opponent constraints'],
  [/conversionPatterns/gi, 'conversion patterns'],
  [/preferredBoardStates/gi, 'preferred board states'],
  [/endgamePatterns/gi, 'endgame patterns'],
  [/supportRequirements/gi, 'support requirements'],
  [/damageBenchmarks/gi, 'damage benchmarks'],
  [/failureConditions/gi, 'failure conditions'],
  [/positioningLost/gi, 'lost positioning'],
  [/supportDependencyExposed/gi, 'support dependency exposed'],
  [/failureChains/gi, 'failure chains']
];

function cleanPresenterDisplayText(value = '') {
  let text = normalizeTacticalDisplayText(value, { replaceWordSeparators: true });
  PRESENTER_TOKEN_REPLACEMENTS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  return normalizeTacticalDisplayText(text, { splitCamel: true });
}

export function formatTacticalPresenterText(value = '', options = {}) {
  const text = cleanPresenterDisplayText(value);
  if (!text) return '';
  return options.ensureSentence ? cleanSentence(text) : text;
}

export function formatTacticalPresenterLabel(value = '', fallback = '') {
  const text = cleanPresenterDisplayText(value || fallback).replace(/[.:]+$/g, '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function createPresenterLineDeduper(minWords = 1) {
  const seen = new Set();
  return (value = '', options = {}) => {
    const text = formatTacticalPresenterText(value, options);
    if (!text) return '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < minWords) return text;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) return '';
    seen.add(key);
    return text;
  };
}

export function presenterConclusion(value = '') {
  return formatTacticalPresenterText(value, { ensureSentence: true });
}

export function presenterSignalCount(items = [], fallback = 0) {
  return safeArray(items).length || fallback || 0;
}

export function buildDamageOverviewPresentation(profile = {}) {
  const breaker = profile.breaker;
  const cleaner = profile.cleaner;
  const weakest = profile.weakest;
  const support = profile.support;
  return {
    breaker: breaker?.attacker
      ? `${breaker.attacker} is the main breaker because ${breaker.primaryMove} reaches its best pressure range into ${breaker.primaryTarget}.`
      : 'Add Pokémon and moves to see which teammate breaks bulky opponents.',
    cleaner: cleaner?.attacker
      ? `${cleaner.attacker} is the cleaner because ${cleaner.primaryMove} can finish chipped ${cleaner.primaryTarget}.`
      : 'Add stronger attacks to see who should finish games.',
    weakest: weakest?.attacker
      ? `${weakest.attacker} has the weakest damage profile: ${weakest.primaryMove} may need chip or support before it finishes ${weakest.primaryTarget}.`
      : 'No major offensive weak spot is showing from the current damage checks.',
    support: support?.attacker
      ? `${support.attacker} provides offensive support with ${support.supportMove || support.primaryMove}, helping stronger attackers convert damage into knockouts.`
      : 'No clear offensive support move is showing yet.'
  };
}

export function buildDamageCleanupSteps(input = {}) {
  const cleaner = input.cleaner || {};
  const earlyBreaker = input.earlyBreaker || null;
  const support = input.support || null;
  const target = input.target || 'opposing targets that do not resist this move';
  const finishingMove = input.finishingMove || cleaner.primaryMove || 'its strongest attack';
  const steps = [];
  steps.push(earlyBreaker?.attacker
    ? `Use ${earlyBreaker.attacker} early to weaken bulky opponents for ${cleaner.attacker}.`
    : `Use your strongest attacks early so ${cleaner.attacker} has easier targets later.`);
  steps.push(support?.attacker
    ? `Use ${support.attacker}'s ${support.primaryMove} in the mid-game to chip or control ${target} for ${cleaner.attacker}.`
    : `Preserve ${cleaner.attacker} specifically for ${target}; avoid spending it before ${cleaner.primaryMove} can finish those targets.`);
  steps.push(`Use ${finishingMove} once the opponent has been chipped into range.`);
  steps.push(`${cleaner.attacker} should close the route only after its checks are weakened or forced to protect.`);
  return steps.map((step) => cleanSentence(step));
}

export function buildDamageSupportPathSteps(input = {}) {
  const group = input.group || {};
  const finisher = input.finisher || null;
  const move = group.primaryMove || 'its safest attack';
  const targetClass = group.primaryTarget || 'opposing targets that do not resist this move';
  const finisherText = finisher?.attacker ? ` so ${finisher.attacker} can finish later` : ' so the real cleaners can finish later';
  return [
    `Use ${move} for chip into ${targetClass}${finisherText}.`,
    `Do not treat ${group.attacker} as the closer; preserve your stronger damage pieces for the final knockout turns.`,
    `Pair ${group.attacker} with ${finisher?.attacker || 'a stronger attacker'} when opponents are still healthy, then switch the closer in after chip damage lands.`
  ].map((step) => cleanSentence(step));
}

export function buildDamageRoleBullets(input = {}) {
  const row = input.primary || {};
  const role = input.role || 'Damage Support';
  const attacker = input.attacker || 'This Pokémon';
  const support = input.support || null;
  const high = Number(input.high || 0);
  const targetClass = input.targetClass || 'opposing targets that do not resist this move';
  const move = row.move || 'its main move';
  const threat = (() => {
    if (!row?.move) return 'Use this Pokémon to help teammates find safer attacks.';
    if (role === 'Damage Support') return `${move} gives this Pokémon a reliable way to threaten ${targetClass} — for example, use it when those opposing targets need chip before your cleaner enters.`;
    if (role === 'Cleaner') return `${move} is useful for finishing weakened ${targetClass}.`;
    if (role === ('Wa' + 'llbreaker')) return `${move} threatens bulky ${targetClass} that try to switch in safely.`;
    return `${move} pressures ${targetClass}.`;
  })();
  const bestUse = (() => {
    if (role === 'Cleaner') return `Best saved for later, after ${targetClass} have been chipped into ${move} range.`;
    if (role === 'Damage Support') {
      const supportMove = support?.move || move || 'its support move';
      return `Best used when ${supportMove} changes the damage race against ${targetClass}, rather than when you need an immediate knockout.`;
    }
    if (high >= 75) return `Best used early or mid-game to remove important ${targetClass}.`;
    if (high >= 50) return `Best used to weaken bulky ${targetClass} before your cleaner takes over.`;
    return `Best used after another teammate has already softened ${targetClass}.`;
  })();
  const warning = (() => {
    if (role === 'Damage Support') return 'Do not label this as a main closer unless its damage range improves; it should create openings for stronger attackers.';
    if (role === 'Cleaner') return 'Avoid sending it in too early if the opponent still has healthy defensive Pokémon that resist its finishing move.';
    if (high < 35) return 'It may need chip damage from teammates before it can secure KOs.';
    return 'Avoid reckless switches into faster attackers or super-effective hits.';
  })();
  return uniq([threat, bestUse, warning]).map((text) => cleanSentence(text));
}

export function buildDamageBenchmarkBullets(input = {}) {
  const primary = input.primary || {};
  const secondary = input.secondary || null;
  const mode = input.mode || 'strong';
  const range = input.range || '—';
  const high = Number(input.high || 0);
  const isUtilityMove = Boolean(input.isUtilityMove);
  const isPriorityMove = Boolean(input.isPriorityMove);
  const isFakeOut = Boolean(input.isFakeOut);
  const utilitySummary = () => {
    const move = String(primary.move || '');
    const moveKey = move.toLowerCase().trim();
    if (isFakeOut) return 'Fake Out buys a safe turn and can help a teammate attack first.';
    if (moveKey === 'icy wind') return 'Icy Wind provides reliable speed-control support.';
    if (moveKey === 'thunder wave') return 'Thunder Wave slows faster threats so your attackers can move before them.';
    if (moveKey === 'electroweb') return 'Electroweb adds chip damage while slowing the opposing side.';
    if (isPriorityMove) return `${move} can finish weakened targets before they move.`;
    return `${move} helps control turn order for the team.`;
  };
  if (mode === 'warning') {
    return uniq([
      high < 25 ? `${primary.move} struggles to deal meaningful damage into bulky targets like ${primary.target}.` : high < 35 ? `${primary.move} often needs teammate support or chip damage before it can finish ${primary.target}.` : `${primary.move} can struggle to secure knockouts consistently without support from teammates.`,
      high < 25 ? 'Can struggle to finish bulky opponents without teammate support.' : high < 35 ? 'Usually works better after teammates have already weakened the opposing team.' : 'This matchup may require stronger attackers or extra chip damage support.',
      `Current damage range: ${range}. Focus more on support or chip damage than direct knockouts.`
    ]).map((text) => cleanSentence(text));
  }
  if (mode === 'utility') {
    return uniq([
      utilitySummary(),
      secondary ? `${secondary.move} gives this Pokémon another way to help the team.` : 'Helps create safer turns for offensive teammates.',
      `Damage range shown here: ${range}.`
    ]).map((text) => cleanSentence(text));
  }
  return uniq([
    high >= 75 ? `${primary.move} can heavily damage or remove key targets.` : high >= 50 ? `${primary.move} helps break bulky defensive Pokémon.` : `${primary.move} gives steady damage into neutral targets.`,
    secondary ? `${secondary.move} gives ${input.attacker || 'this Pokémon'} another useful attacking option.` : 'Deals reliable neutral damage into common targets.',
    `Damage range shown here: ${range}.`
  ]).map((text) => cleanSentence(text));
}

export function buildTacticalPresentation(profile = {}, context = {}) {
  const battleCoaching = buildBattleCoachingPresentation(profile, context);
  const pressureCoverage = buildPressureCoveragePresentation(context.analysisPressureCoverage || {});
  const weaknessCoverage = buildWeaknessCoveragePresentation(profile);
  return {
    factsByKey: {},
    summaries: {
      teamIdentity: buildTeamIdentity(profile),
      analysisOverview: buildTeamIdentity(profile),
      matchupsOverview: buildMatchupsOverview(profile, context),
      speedPlan: cleanSentence(profile?.speedProfile?.summary || ''),
      weatherPlan: cleanSentence(profile?.weatherProfile?.summary || ''),
      defensivePlan: cleanSentence(profile?.defensiveProfile?.summary || ''),
      offensivePlan: cleanSentence(profile?.offensiveProfile?.summary || '')
    },
    speedControl: buildSpeedControlPresentation(profile),
    archetype: {
      label: profile?.archetype?.primary || 'No clear archetype yet',
      confidence: profile?.archetype?.confidence || '',
      reasons: safeArray(profile?.archetype?.reasons).map(cleanSentence).filter(Boolean)
    },
    gameplans: safeArray(profile?.gameplans).map((plan, index) => ({
      key: factKey(['gameplan', plan.label || index]),
      label: plan.label || 'Team plan',
      summary: cleanSentence(plan.beginnerTip || plan.advice),
      advice: cleanSentence(plan.advice),
      enablers: safeArray(plan.enablers),
      abusers: safeArray(plan.abusers),
      support: safeArray(plan.support)
    })),
    risks: buildAnalysisRisks(profile),
    importantPokemon: buildImportantPokemon(profile),
    analysis: {
      overview: buildTeamIdentity(profile),
      defensiveGamePlan: buildDefensiveGamePlan(profile),
      pressureCoverage,
      weaknessCoverage,
      risks: buildAnalysisRisks(profile),
      importantPokemon: buildImportantPokemon(profile)
    },
    leads: buildLeadPresentations(profile),
    matchup: {
      overview: buildMatchupsOverview(profile, context),
      primaryRisks: buildPrimaryRisks(profile, context),
      battleCoaching,
      battleTips: battleCoaching.items,
      emptyBattlePrompt: battleCoaching.emptyMessage
    },
    recommendations: buildRecommendations(profile),
    guide: buildGuidePresentation(profile, context)
  };
}
