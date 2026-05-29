import { calculateWeaknessCoverageProfile } from '../core/weaknessCoverageProfile.js';
import { getPokemonDisplayName } from '../utils/formGrouping.js';
import { getReadableAbilityName, getReadableItemName, getReadableMoveName, getReadablePokemonName } from '../utils/displayNames.js';
import { buildTeamCoachingProfile } from '../logic/teamCoachingProfile.js';
import { buildTeamGuideContext } from '../logic/teamGuideContext.js';
import { renderArchetypeBadge, renderNextTeammateSuggestions } from '../ui/teamCoachingRenderers.js';

const GUIDE_STEPS = [
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

const PAGE_ROUTE_MAP = {
  Metadex: 'metadex',
  'Team Builder': 'team-builder',
  'Learning Hub': 'learning-hub',
  Analysis: 'analysis-desk',
  Matchups: 'matchups',
  Damage: 'damage'
};

export function TeamBuildingGuidePage(state) {
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const guideContext = buildTeamGuideContext(state.team, { data: state.data, profile: coachingProfile });
  state.__teamGuideCoachingProfile = coachingProfile;
  state.__teamGuideContext = guideContext;
  const currentStep = clampStep(state.teamBuildingGuideStep || 1);
  const step = GUIDE_STEPS[currentStep - 1];
  return `<section class="page-stack team-building-guide-page">
    <header class="hero team-guide-hero tactical-primary-panel">
      <div>
        <h1>Team Building Guide</h1>
        <p>A step-by-step Pokémon Champions workflow for building clearer, stronger teams.</p>
      </div>
    </header>

    <section class="card compact-card team-guide-intro-card">
      <div>
        <p class="eyebrow">How this guide works</p>
        <h2>Plan first, then build with purpose</h2>
        <p class="muted">Use this page to plan your team before or while editing it. Each step explains what you are trying to solve, what to look for in the Metadex, and when to check your team in Team Builder, Analysis, Matchups, or Damage.</p>
      </div>
      <div class="team-guide-quick-actions">
        ${guideRouteButton('Open Metadex', 'metadex')}
        ${guideRouteButton('Open Team Builder', 'team-builder')}
        ${guideRouteButton('Open Analysis', 'analysis-desk')}
        ${guideRouteButton('Open Matchups', 'matchups')}
      </div>
    </section>

    <section class="team-guide-layout">
      <aside class="card compact-card team-guide-progress" aria-label="Team building guide steps">
        <p class="eyebrow">Guide progress</p>
        <div class="team-guide-step-list">
          ${GUIDE_STEPS.map((entry, index) => stepButton(entry, index + 1, currentStep)).join('')}
        </div>
        ${lightTeamHint(state)}
        ${renderGuideCoachingCheckpoint(state, currentStep, guideContext)}
      </aside>

      <article class="card team-guide-active-step" aria-live="polite">
        <div class="team-guide-step-header">
          <span class="badge">Step ${currentStep} of ${GUIDE_STEPS.length}</span>
          <h2>${escapeText(step.title)}</h2>
          <p class="muted">${escapeText(step.purpose)}</p>
        </div>

        ${step.custom === 'mainIdea' ? renderMainIdeaStep(guideContext) : step.custom === 'addingToCore' ? renderAddingToCoreStep(guideContext) : step.custom === 'coreReady' ? renderCoreReadyStep(guideContext) : step.custom === 'roundOutTeam' ? renderRoundOutTeamStep(state) : step.custom === 'weaknessExpand' ? renderWeaknessExpandStep(state) : step.custom === 'finishDetails' ? renderFinishDetailsStep(state) : step.custom === 'startTesting' ? renderStartTestingStep(guideContext) : `
        ${listBlock('Key questions', step.questions)}
        ${chipBlock('What to look for', step.lookFor)}
        <section class="team-guide-section">
          <h3>How to use the Metadex here</h3>
          <p>${escapeText(step.metadex)}</p>
        </section>`}
        <section class="team-guide-section">
          <h3>Related app pages</h3>
          <div class="team-guide-chip-row">
            ${step.relatedPages.map((label) => relatedPageChip(label)).join('')}
          </div>
        </section>

        <div class="team-guide-controls">
          <button type="button" class="secondary-button" data-action="team-guide-prev" ${currentStep === 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" data-action="team-guide-next" ${currentStep === GUIDE_STEPS.length ? 'disabled' : ''}>Next</button>
        </div>
      </article>
    </section>
  </section>`;
}



// SHARED GUIDE CONTEXT DISPLAY: renders the sidebar from buildTeamGuideContext without rewriting guide steps.
function renderGuideCoachingCheckpoint(state = {}, currentStep = 1, sharedContext = null) {
  const context = sharedContext || state.__teamGuideContext || buildTeamGuideContext(state.team, { data: state.data, profile: state.__teamGuideCoachingProfile });
  const profile = context.profile || state.__teamGuideCoachingProfile || buildTeamCoachingProfile(state.team, { data: state.data });
  const nextStep = guideNextStepSuggestion(profile, currentStep);
  const filledSlots = Number(context.teamCompleteness?.filledSlots || profile.completeness?.filledSlots || 0);
  const confidence = String(context.confidence || '').trim();
  const hasStablePlan = filledSlots >= 6 && Array.isArray(profile.gameplans) && profile.gameplans.length > 0;
  const confidenceBadge = /^high$/i.test(confidence) || (hasStablePlan && confidence && !/^low$/i.test(confidence)) ? `<span class="badge">${escapeText(confidence)} confidence</span>` : '';
  const selectedSummary = context.selectedPokemon?.length ? context.selectedPokemon.map((entry) => entry.name).slice(0, 6).join(', ') : 'No Pokémon selected yet.';
  return `<section class="card compact-card tactical-secondary-panel team-guide-live-coach">
    <div class="team-guide-live-head">
      <p class="eyebrow">Live team read</p>
      ${confidenceBadge}
    </div>
    <dl class="team-guide-live-list">
      <div>
        <dt>Team</dt>
        <dd><span>${escapeText(selectedSummary)}</span><span class="muted small-copy">${escapeText(filledSlots)}/6 selected</span></dd>
      </div>
      <div>
        <dt>Archetype</dt>
        <dd>${renderArchetypeBadge(profile, { compact: true, showConfidence: false })}</dd>
      </div>
      <div>
        <dt>Main plan</dt>
        <dd><span>${escapeText(context.mainPlanSummary || 'Add selected moves and abilities to reveal the main plan.')}</span></dd>
      </div>
      <div>
        <dt>Core signals</dt>
        <dd>${renderGuideContextList(context.coreSynergySignals, 'No strong core synergy signal is visible yet.')}</dd>
      </div>
      <div>
        <dt>Speed control</dt>
        <dd>${renderGuideContextList(context.speedControlSources, 'No selected speed control source yet.')}</dd>
      </div>
      <div>
        <dt>Pressure</dt>
        <dd>${renderGuideContextList(context.pressureSources, 'No clear pressure source selected yet.')}</dd>
      </div>
      <div>
        <dt>Watch out for</dt>
        <dd>${renderGuideContextList(context.topDefensiveRisks, 'No major shared risk is visible yet.')}</dd>
      </div>
      ${context.inactiveAbilityWarnings?.length ? `<div>
        <dt>Inactive ability</dt>
        <dd>${renderGuideContextList(context.inactiveAbilityWarnings, '')}</dd>
      </div>` : ''}
      <div>
        <dt>Next step</dt>
        <dd>${renderNextTeammateSuggestions(profile, { compact: true, limit: 1 }) || escapeText(nextStep)}</dd>
      </div>
    </dl>
  </section>`;
}

function renderGuideContextList(entries = [], fallback = '') {
  const clean = (Array.isArray(entries) ? entries : []).filter(Boolean).slice(0, 3);
  if (!clean.length) return fallback ? `<span>${escapeText(fallback)}</span>` : '';
  return `<ul class="team-guide-live-mini-list">${clean.map((entry) => `<li>${escapeText(entry)}</li>`).join('')}</ul>`;
}

// SHARED PROFILE DISPLAY: converts profile completeness/risks into guide-step next action text.
function guideNextStepSuggestion(profile = {}, currentStep = 1) {
  const suggestion = profile.coaching?.nextTeammateSuggestions?.[0];
  const plan = profile.gameplans?.[0]?.label;
  const risk = profile.risks?.[0];
  const filledSlots = Number(profile.completeness?.filledSlots || 0);
  const missingSlots = Number(profile.completeness?.missingSlots || 0);
  const hasOpenTeamSlot = !profile.completeness?.isFullTeam && missingSlots > 0;

  if (!filledSlots) return 'Choose a Pokémon, core, or tactic to start shaping the team.';
  if (hasOpenTeamSlot && suggestion) return suggestion;
  if (hasOpenTeamSlot) return 'Add another teammate that supports your main plan.';
  if (currentStep <= 3) return plan ? `Check whether each teammate supports ${plan}.` : 'Check that every teammate has a clear job.';
  if (currentStep <= 5 && risk?.type) return `Plan how you will position around ${risk.type}-type pressure.`;
  if (currentStep === 6) return 'Finish selected moves, items, abilities, natures, and stat points.';
  return 'Test a few games and note which matchups or turns feel awkward.';
}

function renderMainIdeaStep(guideContext = null) {
  const ideaLink = '<a href="/learning-hub?concept=team-building-intent" data-route="learning-hub">idea</a>';
  return `${renderMainIdeaLivePanel(guideContext)}

  <section class="team-guide-section">
    <p>Every team begins with an ${ideaLink}: a Pokémon, core, tactic, weather style, speed plan, matchup answer, or favourite you want to make work.</p>
    <p>The goal of Step 1 is intent. You are not solving the full team yet — you are naming what the team is trying to become.</p>
  </section>

  <section class="team-guide-section">
    <h3>Common ways to start</h3>
    <div class="learning-grid">
      ${[
        ['Start from a Pokémon', 'Build around one Pokémon and ask what support lets it do its job.'],
        ['Start from a core', 'Build around two or three Pokémon that already enable each other.'],
        ['Start from a tactic', 'Build around weather, Tailwind, Trick Room, redirection, Fake Out, setup, or spread pressure.'],
        ['Start from a meta problem', 'Build around answering a matchup or threat that keeps causing trouble.'],
        ['Start from a favourite', 'Pick something you enjoy, then find the structure that makes it useful.']
      ].map(([title, text]) => `<article class="mini-card"><h4>${escapeText(title)}</h4><p>${escapeText(text)}</p></article>`).join('')}
    </div>
  </section>

  <section class="team-guide-section">
    <h3>Intent check</h3>
    <p>Before moving on, try to answer one sentence: <strong>“I am building this team because…”</strong></p>
    <ul class="team-guide-question-list">
      <li>I want to use a specific Pokémon or core.</li>
      <li>I want to enable a specific tactic.</li>
      <li>I want a clear way to create safe turns and convert them into pressure.</li>
      <li>I want the team’s first idea to stay visible as I add the next Pokémon.</li>
    </ul>
  </section>

  <section class="team-guide-section">
    <h3>What to do now</h3>
    <ul class="team-guide-question-list">
      <li>Pick the Pokémon, core, tactic, or archetype that interests you.</li>
      <li>Check whether the loaded team already shows that idea clearly.</li>
      <li>Do not worry about perfect EVs, exact movesets, or every teammate yet.</li>
      <li>Once the starting idea is clear, move to Step 2.</li>
    </ul>
    <div class="team-guide-action-row">${guideRouteButton('Find main Pokémon in MetaDex', 'metadex', metadexGuideAttrs(3, 'core', 'main'))}</div>
  </section>`;
}

function renderMainIdeaLivePanel(context = null) {
  const filledSlots = Number(context?.teamCompleteness?.filledSlots || 0);
  if (!filledSlots) {
    return `<section class="team-guide-section team-guide-main-idea-live tactical-secondary-panel">
      <p class="eyebrow">Live Team Idea</p>
      <h3>Your current team idea: Not detected yet</h3>
      <p class="muted">Load or select Pokémon with abilities and moves, then this step will explain the team idea using the same read as the Analysis Desk.</p>
    </section>`;
  }

  const archetype = context?.archetype || 'Unclear / Mixed Team';
  const confidence = context?.confidence ? ` <span class="badge">${escapeText(context.confidence)} confidence</span>` : '';
  const planSummary = context?.mainPlanSummary || 'The team idea is still developing.';
  const signals = buildMainIdeaSignals(context);
  const pressure = (context?.pressureSources || []).slice(0, 4);

  return `<section class="team-guide-section team-guide-main-idea-live tactical-secondary-panel">
    <div class="team-guide-main-idea-head">
      <p class="eyebrow">Live Team Idea</p>
      ${confidence}
    </div>
    <h3>Your current team idea: ${escapeText(archetype)}</h3>
    <p>${escapeText(planSummary)}</p>
    ${signals.length ? `<div class="team-guide-live-signal-grid">${signals.map((entry) => `<article class="mini-card"><h4>${escapeText(entry.label)}</h4><p>${escapeText(entry.text)}</p></article>`).join('')}</div>` : ''}
    ${pressure.length ? `<div class="team-guide-main-pressure"><h4>Main offensive pressure</h4>${renderGuideContextList(pressure, '')}</div>` : ''}
  </section>`;
}

function buildMainIdeaSignals(context = {}) {
  const synergy = context.coreSynergySignals || [];
  const speed = context.speedControlSources || [];
  const pressure = context.pressureSources || [];
  const hasSunTailwind = /sun\s*\+\s*tailwind/i.test(context.archetype || '') || ((context.archetype || '').toLowerCase().includes('sun') && (context.archetype || '').toLowerCase().includes('tailwind'));

  if (hasSunTailwind) {
    return [
      { label: 'Drought user', text: findSignal(synergy, /drought|sets sun/i) || 'A Drought user is the sun setter that starts the weather plan.' },
      { label: 'Tailwind user', text: findSignal(speed, /tailwind/i) || findSignal(synergy, /tailwind/i) || 'A Tailwind user gives the team temporary speed control.' },
      { label: 'Sun abuser', text: findSignal(synergy, /chlorophyll|solar power|benefits from weather|abuses the sun/i) || 'A sun abuser such as Chlorophyll converts the weather into stronger tempo or damage.' },
      { label: 'Pressure angle', text: pressure.slice(0, 2).join('; ') || 'The team converts sun and speed turns into offensive pressure.' }
    ];
  }

  return [
    { label: 'Core signals', text: synergy.slice(0, 2).join('; ') || 'Add more moves, abilities, or teammates to reveal the core synergy.' },
    { label: 'Speed plan', text: speed.slice(0, 2).join('; ') || 'No clear speed control source is visible yet.' },
    { label: 'Pressure angle', text: pressure.slice(0, 2).join('; ') || 'Add clear attackers or pressure tools to show how the team wins.' }
  ];
}

function findSignal(entries = [], pattern) {
  return (Array.isArray(entries) ? entries : []).find((entry) => pattern.test(String(entry || ''))) || '';
}

function learningTerm(label, concept) {
  return `<a href="/learning-hub?concept=${escapeAttr(concept)}" data-route="learning-hub">${escapeText(label)}</a>`;
}

function renderAddingToCoreStep(guideContext = null) {
  const offense = learningTerm('complementary offense', 'complementary-offense');
  const defense = learningTerm('complementary defense', 'complementary-defense');
  const support = learningTerm('support', 'support-options');
  const speed = learningTerm('speed control', 'speed-control');
  const enabling = learningTerm('enabling', 'adding-to-a-core');
  return `${renderAddingToCoreLivePanel(guideContext)}

  <section class="team-guide-section">
    <p>Once you have a main idea, your next job is to add Pokémon that make that idea stronger, safer, or easier to execute.</p>
    <p>You do not need perfect EVs, final items, or exact movesets yet. Step 2 is about checking whether each Pokémon has a clear reason to be part of the core.</p>
    <p class="muted team-guide-context-link">${speedControlGuideLink('Learn how Speed Control works')}</p>
  </section>

  <section class="team-guide-section">
    <h3>Why add a Pokémon?</h3>
    <div class="learning-grid">
      ${[
        [offense, 'Adds damage, coverage, priority, spread pressure, or a second way to threaten opponents.'],
        [defense, 'Gives safer switch-ins, useful resistances, defensive abilities, or better positioning.'],
        [support, 'Helps the main idea work through Fake Out, redirection, screens, healing, disruption, or status.'],
        [speed, 'Helps the team move first or control turn order with Tailwind, Trick Room, Icy Wind, Thunder Wave, or similar tools.'],
        [enabling, 'Directly helps the main Pokémon or core do what it wants to do, such as setting weather for a weather abuser.']
      ].map(([title, text]) => `<article class="mini-card"><h4>${title}</h4><p>${escapeText(text)}</p></article>`).join('')}
    </div>
  </section>

  <section class="team-guide-section">
    <h3>Do not lose the main idea</h3>
    <p>At this stage, try to add Pokémon that further your team’s main strength rather than picking a different answer for every possible matchup.</p>
    <p>It is fine if a Pokémon also helps against common threats, but it should still belong to the team’s main plan. If every Pokémon is added only to counter something different, the team can lose cohesion and become hard to pilot.</p>
  </section>

  <section class="team-guide-section">
    <h3>What to do now</h3>
    <ul class="team-guide-question-list">
      <li>Check the live core pieces above.</li><li>Keep the enablers that make your main plan work.</li><li>Keep the abusers that actually convert that support into pressure.</li><li>Review any disconnected pieces and decide whether they need a clearer job.</li><li>Try to reach around 3 to 5 purposeful Pokémon before moving on.</li>
    </ul>
    <div class="team-guide-action-row">${guideRouteButton('Find core partners in MetaDex', 'metadex', metadexGuideAttrs(4, 'fill-core', 'partner'))}</div>
  </section>

  <section class="team-guide-section">
    <h3>How to use the Metadex here</h3>
    <p>Use the Metadex to compare possible teammates. Look at role, typing, abilities, speed, support moves, offensive pressure, defensive value, and whether the Pokémon helps your main idea.</p>
  </section>

`;
}

function renderAddingToCoreLivePanel(context = null) {
  const filledSlots = Number(context?.teamCompleteness?.filledSlots || 0);
  if (!filledSlots) {
    return `<section class="team-guide-section team-guide-main-idea-live tactical-secondary-panel">
      <p class="eyebrow">Live core read</p>
      <h3>No loaded core yet</h3>
      <p class="muted">Load or select Pokémon and this step will show each member’s likely contribution to the current core.</p>
    </section>`;
  }

  const pieces = Array.isArray(context?.corePieces) && context.corePieces.length
    ? context.corePieces
    : buildFallbackCorePieces(context);
  const cohesion = context?.coreCohesion || buildFallbackCoreCohesion(context, pieces);

  return `<section class="team-guide-section team-guide-main-idea-live tactical-secondary-panel">
    <div class="team-guide-main-idea-head">
      <p class="eyebrow">Live core read</p>
      ${context?.archetype ? `<span class="badge">${escapeText(context.archetype)}</span>` : ''}
    </div>
    <h3>Your current core pieces</h3>
    <p class="muted">This uses the same team read as the Analysis Desk, then explains what each selected Pokémon appears to contribute to the main plan.</p>
    <div class="learning-grid">
      ${pieces.map((piece) => renderCorePieceCard(piece)).join('')}
    </div>
    <div class="team-guide-core-cohesion">
      <h3>Core cohesion</h3>
      <div class="learning-grid">
        <article class="mini-card"><h4>Supports the main plan</h4>${renderGuideContextList(cohesion.supportsMainPlan, 'No strong support signal is visible yet.')}</article>
        <article class="mini-card"><h4>Slightly disconnected</h4>${renderGuideContextList(cohesion.disconnectedPieces, 'No obvious disconnected piece is visible yet.')}</article>
        <article class="mini-card"><h4>Enablers vs abusers</h4><p>${escapeText(cohesion.enablerAbuserSummary || 'Add more team details to separate enablers from abusers.')}</p></article>
      </div>
    </div>
  </section>`;
}

function renderCorePieceCard(piece = {}) {
  const roles = Array.isArray(piece.roles) ? piece.roles : [];
  const details = Array.isArray(piece.details) ? piece.details : [];
  const roleChips = roles.length ? `<div class="team-guide-chip-row">${roles.slice(0, 4).map((role) => `<span class="team-guide-chip">${escapeText(role)}</span>`).join('')}</div>` : '<p class="muted">No clear role detected yet.</p>';
  const detailList = details.length ? renderGuideContextList(details, '') : '';
  const category = piece.coreCategory ? `<p class="eyebrow">${escapeText(piece.coreCategory)}</p>` : '';
  return `<article class="mini-card">
    ${category}
    <h4>${escapeText(piece.name || 'Selected Pokémon')}</h4>
    <p>${escapeText(piece.summary || 'This Pokémon needs more moves, ability, or item detail before its core job is clear.')}</p>
    ${roleChips}
    ${detailList}
  </article>`;
}

function buildFallbackCorePieces(context = {}) {
  return (context.selectedPokemon || []).map((member) => ({
    name: member.name,
    roles: [],
    details: [],
    coreCategory: 'Needs role detail',
    summary: 'Selected, but the guide needs moves, ability, or item detail to identify its contribution.'
  }));
}

function buildFallbackCoreCohesion(context = {}, pieces = []) {
  const enablers = pieces.filter((piece) => /enabler/i.test(piece.coreCategory || '')).map((piece) => piece.name);
  const abusers = pieces.filter((piece) => /abuser/i.test(piece.coreCategory || '')).map((piece) => piece.name);
  return {
    supportsMainPlan: (context.coreSynergySignals || []).slice(0, 3),
    disconnectedPieces: pieces.filter((piece) => !piece.roles?.length).map((piece) => `${piece.name}: needs a clearer role`).slice(0, 3),
    enablerAbuserSummary: enablers.length || abusers.length ? `${enablers.length ? `Enablers: ${enablers.join(', ')}. ` : ''}${abusers.length ? `Abusers: ${abusers.join(', ')}.` : ''}` : ''
  };
}


function renderCoreReadyStep(context = null) {
  const filledSlots = Number(context?.teamCompleteness?.filledSlots || 0);
  const archetype = context?.archetype || 'Unknown plan';
  const supports = context?.coreCohesion?.supportsMainPlan || [];
  const disconnected = context?.coreCohesion?.disconnectedPieces || [];
  const offensiveReady = supports.length >= 2;
  const speedReady = supports.some(v => /tailwind|trick room|speed|icy wind|paralysis/i.test(String(v)));
  const supportReady = supports.length >= 1;
  const planReady = filledSlots >= 3;
  const defensiveRisks = disconnected.slice(0,2);

  const checks = [
    [planReady,'Clear main plan', planReady ? `Detected archetype: ${archetype}.` : 'Main plan is not fully established yet.'],
    [offensiveReady,'Enough offensive pressure', offensiveReady ? 'The core shows multiple pressure signals.' : 'Add another way to convert support into damage.'],
    [speedReady,'Enough speed control', speedReady ? 'Speed control signals were detected.' : 'Consider Tailwind, Trick Room, Icy Wind, priority, or similar tools.'],
    [supportReady,'Enough support/disruption', supportReady ? 'Support pieces are contributing to the plan.' : 'The team needs more enabling or disruption.'],
    [defensiveRisks.length === 0,'No major defensive concerns visible', defensiveRisks.length === 0 ? 'No obvious issue detected yet.' : defensiveRisks.join(' • ')],
    [disconnected.length === 0,'No disconnected pieces', disconnected.length === 0 ? 'Every visible piece appears connected.' : disconnected.join(' • ')]
  ];

  const passed = checks.filter(c=>c[0]).length;
  const verdict = passed >= 5
    ? 'Core looks testable and supports a clear game plan.'
    : passed >= 3
      ? `Core looks testable, but ${defensiveRisks[0] || 'a few areas still need attention'}.`
      : 'Core is not ready yet. The main plan still needs more structure.';

  return `<section class="team-guide-section tactical-secondary-panel">
    <p class="eyebrow">Live readiness evaluation</p>
    <h3>Core readiness verdict</h3>
    <p><strong>${escapeText(verdict)}</strong></p>
    <p class="muted">This verdict updates from the currently loaded team rather than using a fixed example.</p>
  </section>

  <section class="team-guide-section">
    <h3>Core ready checklist</h3>
    <ul class="team-guide-question-list">
      ${checks.map(([ok,title,detail])=>`<li>${ok ? '✅' : '⚠️'} <strong>${escapeText(title)}</strong> — ${escapeText(detail)}</li>`).join('')}
    </ul>
  </section>

  <section class="team-guide-section">
    <h3>What this means</h3>
    <p>If you can explain the main plan, identify your pressure pieces, identify your speed control, and understand what still looks disconnected, the team is usually ready for initial testing.</p>
  </section>`;
}
function renderRoundOutTeamStep(state) {
  const guideContext = state.__teamGuideContext || {};
  const gaps = [];
  if (!(guideContext.speedControlSources||[]).length) gaps.push('speed control');
  if (!(guideContext.supportSources||[]).length) gaps.push('support/disruption');
  if ((guideContext.pressureSources||[]).length < 2) gaps.push('secondary pressure');
  if ((guideContext.disconnectedPieces||[]).length) gaps.push('cohesion support');
  const gapText = gaps.length ? gaps.join(', ') : 'no major role gaps detected';
  return `<section class="team-guide-section"><h3>Fill out the Core</h3><p>This step now focuses on what your current team is still missing.</p><p><strong>Current gaps:</strong> ${escapeText(gapText)}.</p></section>
  <section class="team-guide-section"><h3>Recommended additions</h3><ul class="team-guide-question-list">
  ${gaps.includes('speed control')?'<li>Add a speed control piece that supports the existing gameplan rather than replacing it.</li>':''}
  ${gaps.includes('support/disruption')?'<li>Add disruption, pivoting, screens, Intimidate, redirection, or other support that helps your main attackers function.</li>':''}
  ${gaps.includes('secondary pressure')?'<li>Add a secondary attacker or cleaner so the team is not reliant on one threat.</li>':''}
  ${gaps.includes('cohesion support')?'<li>Look for a glue Pokémon that connects disconnected pieces and improves positioning.</li>':''}
  ${!gaps.length?'<li>Your core looks structurally complete. Focus on matchup coverage and refinement.</li>':''}
  </ul></section>
  <section class="team-guide-section"><h3>Do not break the plan</h3><p>Every addition should reinforce the main plan shown above. Prefer roles that solve multiple problems at once instead of adding isolated matchup patches.</p></section>`;
}

function renderFinishDetailsStep(state) {
  const moves = learningTerm('moves', 'learning-movesets');
  const items = learningTerm('items', 'learning-items');
  const abilities = learningTerm('abilities', 'learning-abilities');
  const natures = learningTerm('natures', 'learning-natures');
  const statPoints = learningTerm('stat points', 'learning-stat-points');
  const benchmarks = learningTerm('benchmarks', 'learning-benchmarks');
  const roles = learningTerm('roles', 'learning-pokemon-roles');
  const protect = learningTerm('Protect', 'learning-protect-positioning');
  const firstDraft = learningTerm('first draft', 'learning-first-drafts');
  const detailAudit = buildStep6DetailAudit(state);
  return `<section class="team-guide-section">
    <p>At this point, you should know the six Pokémon that are going to be on your team.</p>
    <p>You should also have imagined some ways you want to battle with them: common leads, backup plans, support partners, and win conditions.</p>
    <p>Now it is time to fill in the details you skipped earlier: ${moves}, ${items}, ${abilities}, ${natures}, ${statPoints}, final ${roles}, and important damage or survival ${benchmarks}.</p>
    <p class="muted team-guide-context-link">${speedControlGuideLink('Read the Speed Control guide')}</p>
    <p>Once this step is complete, the ${firstDraft} of your team is ready to test.</p>
  </section>

  ${renderStep6LiveChecklist(detailAudit)}

  ${renderDetailWeaknessPatchSection(state)}

  <section class="team-guide-section"><h3>What details need finishing?</h3><div class="learning-grid">
    <article class="mini-card"><h4>Moves</h4><p>Choose moves that match each Pokémon’s job on the team.</p><ul><li>damage moves for pressure</li><li>${protect} for positioning</li><li>speed control moves</li><li>support or disruption moves</li><li>coverage moves for specific threats</li></ul></article>
    <article class="mini-card"><h4>Items</h4><p>Choose items that help the Pokémon perform its role.</p><ul><li>damage items for attackers</li><li>defensive items for bulky Pokémon</li><li>recovery or sustain items</li><li>utility items for support Pokémon</li><li>matchup-specific items if needed</li></ul></article>
    <article class="mini-card"><h4>Abilities</h4><p>Choose the ability that best supports the team’s plan.</p><ul><li>weather abilities</li><li>defensive abilities</li><li>offensive abilities</li><li>speed-related abilities</li><li>utility abilities</li></ul></article>
    <article class="mini-card"><h4>Natures and stat points</h4><p>Choose stat investments that help the Pokémon do its job.</p><ul><li>enough Speed for important targets</li><li>enough bulk to survive key attacks</li><li>enough damage to secure important KOs</li><li>simple role-based spreads if exact benchmarks are not known yet</li></ul></article>
    <article class="mini-card"><h4>Final role clarity</h4><p>Make sure every Pokémon has a clear job.</p><ul><li>main attacker</li><li>secondary attacker</li><li>support</li><li>speed control</li><li>defensive pivot</li><li>setup option</li><li>cleaner</li><li>matchup answer</li></ul></article>
  </div></section>

  <section class="team-guide-section"><h3>How to read the live checklist</h3><p>Pass rows mean the choice is complete or clearly aligned with the current role read. Warning rows are coaching prompts, not legality errors. They tell you where to confirm a move, item, ability, nature, or stat direction before testing.</p></section>

  <section class="team-guide-section"><h3>Do not over-perfect yet</h3><p>This is still only the first draft.</p><p>You do not need perfect stat spreads or exact matchup benchmarks before testing.</p><p>Start with sensible choices that match the Pokémon’s role, then improve them after real games.</p><p>If you spend too long trying to perfect the team before testing, you may optimise for problems that never actually happen.</p></section>

  <section class="team-guide-section"><h3>Simple priority order</h3><ol class="team-guide-question-list"><li>Choose the Pokémon’s role.</li><li>Choose the moves it needs to do that role.</li><li>Choose the ability that best supports that role.</li><li>Choose the item that helps it perform that role.</li><li>Choose nature and stat points last.</li><li>Only add advanced benchmarks once you know what matters.</li></ol></section>

  <section class="team-guide-section"><h3>Example</h3><article class="mini-card"><p>You added a Pokémon because your team needed speed control.</p><ul><li>give it a speed control move</li><li>give it Protect or useful support if needed</li><li>choose an item that helps it survive long enough to use its support</li><li>choose a nature and stat spread that let it perform that job consistently</li></ul><p class="muted">The exact numbers can be improved later after testing.</p></article></section>

  ${listBlock('What to do now', ['Open Team Builder.','Fill in moves, items, abilities, natures, and stat points for each Pokémon.','Use the Metadex to check common role, move, ability, and item ideas.','Use Damage to test important attacks or survival benchmarks.','Use Analysis to check whether the final draft still has enough roles, speed control, pressure, and defensive value.','Once every Pokémon has complete details, move to playtesting.'])}

  <section class="team-guide-section"><h3>How to use the Metadex here</h3><p>Use the Metadex to understand what each Pokémon usually wants to do, what moves and abilities support that role, and what items make sense for the job you gave it.</p></section>`;
}


function buildStep6DetailAudit(state = {}) {
  const data = state.data || {};
  const indexes = data.indexes || data || {};
  const pokemonById = indexes.pokemonById || {};
  const abilitiesById = indexes.abilitiesById || {};
  const itemsById = indexes.itemsById || {};
  const movesById = indexes.movesById || {};
  const context = state.__teamGuideContext || buildTeamGuideContext(state.team, { data, profile: state.__teamGuideCoachingProfile });
  const piecesByName = new Map((context.corePieces || []).map((piece) => [String(piece.name || '').toLowerCase(), piece]));
  const inactiveWarnings = context.inactiveAbilityWarnings || [];
  const slots = (Array.isArray(state.team) ? state.team : []).filter((slot) => slot && (slot.pokemon_id || slot.pokemon));

  const rows = slots.map((slot, index) => {
    const pokemon = pokemonById[slot.pokemon_id] || slot.pokemon || slot;
    const name = getPokemonDisplayName(pokemon) || getReadablePokemonName(pokemon, `Slot ${index + 1}`);
    const rolePiece = piecesByName.get(String(name).toLowerCase()) || {};
    const role = rolePiece.roles?.length ? rolePiece.roles.join(', ') : 'Needs clearer job';
    const moveIds = (Array.isArray(slot.moves) ? slot.moves : [slot.move1, slot.move2, slot.move3, slot.move4]).filter(Boolean);
    const moveNames = moveIds.map((id) => getReadableMoveName(movesById[id] || id, String(id))).filter(Boolean);
    const abilityName = slot.ability_id || slot.ability ? getReadableAbilityName(abilitiesById[slot.ability_id] || abilitiesById[slot.ability] || slot.ability || slot.ability_id, '') : '';
    const itemName = slot.item_id || slot.item ? getReadableItemName(itemsById[slot.item_id] || itemsById[slot.item] || slot.item || slot.item_id, '') : '';
    const nature = String(slot.nature || '').trim();
    const statDirection = describeStatInvestmentDirection(slot);
    const lowered = [name, abilityName].join(' ').toLowerCase();
    const inactive = inactiveWarnings.find((warning) => String(warning).toLowerCase().includes(String(name).toLowerCase()) || (abilityName && String(warning).toLowerCase().includes(abilityName.toLowerCase())));
    const roleText = String(role).toLowerCase();
    const moveText = moveNames.join(' ').toLowerCase();
    const itemText = String(itemName || '').toLowerCase();
    const natureText = nature.toLowerCase();
    const statText = statDirection.toLowerCase();

    const checks = [
      detailCheck(Boolean(abilityName), 'Ability selected', abilityName ? `${abilityName} is selected.` : 'Choose an ability so this Pokémon has a defined battle function.'),
      detailCheck(Boolean(itemName), 'Item selected', itemName ? `${itemName} supports or modifies this slot.` : 'Choose an item that supports this Pokémon’s job.'),
      detailCheck(Boolean(nature), 'Nature selected', nature ? `${nature} nature is selected.` : 'Pick a nature that matches damage, Speed, or bulk needs.'),
      detailCheck(moveNames.length >= 4, 'Moves complete', moveNames.length >= 4 ? `Moves: ${moveNames.slice(0, 4).join(', ')}.` : `${moveNames.length}/4 moves selected.`),
      detailCheck(Boolean(statDirection), 'Stat investment direction', statDirection || 'No visible Champions stat point direction yet.'),
      detailCheck(!inactive, 'Ability is active in this team', inactive || 'No inactive ability warning detected.'),
      detailCheck(roleFitsDetails({ roleText, moveText, itemText, natureText, statText }), 'Choices match role', roleFitDetail({ role, moveNames, itemName, nature, statDirection }))
    ];
    return { name, role, checks, warningCount: checks.filter((c) => !c.ok).length };
  });

  const allRows = rows.flatMap((row) => row.checks);
  return {
    rows,
    passCount: allRows.filter((row) => row.ok).length,
    warningCount: allRows.filter((row) => !row.ok).length,
    filledSlots: slots.length
  };
}

function detailCheck(ok, label, detail) {
  return { ok: Boolean(ok), label, detail };
}

function describeStatInvestmentDirection(slot = {}) {
  const allocation = slot.statAllocation || slot.stat_allocation || slot.skillPoints || slot.skill_points || slot.sp || {};
  const labels = { hp: 'HP', atk: 'Attack', attack: 'Attack', def: 'Defense', defense: 'Defense', spa: 'Sp. Attack', sp_atk: 'Sp. Attack', special_attack: 'Sp. Attack', spd: 'Sp. Defense', sp_def: 'Sp. Defense', special_defense: 'Sp. Defense', spe: 'Speed', speed: 'Speed' };
  const entries = Object.entries(allocation || {})
    .map(([key, value]) => ({ key, label: labels[key] || key, value: Number(value || 0) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!entries.length) return '';
  const top = entries.slice(0, 3).map((entry) => `${entry.label} +${entry.value}`).join(' / ');
  return `Current direction: ${top}`;
}

function roleFitsDetails({ roleText = '', moveText = '', itemText = '', natureText = '', statText = '' }) {
  if (/needs clearer job/i.test(roleText)) return false;
  if (/speed control/.test(roleText)) return /tailwind|icy wind|trick room|thunder wave|electroweb|glare|nuzzle|scary face|speed/.test(moveText + ' ' + statText + ' ' + natureText);
  if (/weather setter/.test(roleText)) return /drought|drizzle|snow warning|sand stream|aurora veil|heat rock|icy rock|smooth rock|weather/.test(moveText + ' ' + itemText);
  if (/support|disruption|pivot|stability/.test(roleText)) return /protect|fake out|parting shot|taunt|encore|snarl|will o wisp|aurora veil|reflect|light screen|leftovers|sitrus|focus sash|bulk|hp|defense|sp\. defense/.test(moveText + ' ' + itemText + ' ' + statText);
  if (/attacker|abuser/.test(roleText)) return /attack|sp\. attack|speed|life orb|choice|expert belt|focus sash|last respects|bullet punch|blizzard|heat wave|dazzling gleam|liquidation|flare blitz/.test(moveText + ' ' + itemText + ' ' + statText + ' ' + natureText);
  return true;
}

function roleFitDetail({ role, moveNames, itemName, nature, statDirection }) {
  if (/needs clearer job/i.test(role || '')) return 'This Pokémon is selected, but the current team read does not yet see a clear role connection.';
  const visible = [moveNames.length ? `${moveNames.length} moves` : '', itemName ? itemName : '', nature ? `${nature} nature` : '', statDirection].filter(Boolean).join(' • ');
  return visible ? `Role read: ${role}. Details visible: ${visible}.` : `Role read: ${role}, but the detailed choices are still unfinished.`;
}

function renderStep6LiveChecklist(audit = {}) {
  if (!audit.filledSlots) {
    return `<section class="team-guide-section tactical-secondary-panel"><p class="eyebrow">Live detail check</p><h3>No team details to inspect yet</h3><p class="muted">Add Pokémon in Team Builder, then Step 6 will inspect abilities, items, natures, moves, stat direction, inactive abilities, and role fit.</p></section>`;
  }
  const verdict = audit.warningCount
    ? `${audit.warningCount} detail warning${audit.warningCount === 1 ? '' : 's'} to review before testing.`
    : 'All visible details pass the first-draft check.';
  return `<section class="team-guide-section tactical-secondary-panel">
    <p class="eyebrow">Live detail check</p>
    <h3>Step 6 checklist verdict</h3>
    <p><strong>${escapeText(verdict)}</strong></p>
    <p class="muted">This checks the loaded team’s current abilities, items, natures, moves, stat investment direction, inactive ability warnings, and whether each Pokémon’s choices match its detected role.</p>
    <div class="learning-grid">
      ${audit.rows.map((row) => `<article class="mini-card"><h4>${escapeText(row.name)}</h4><p class="muted"><strong>Role read:</strong> ${escapeText(row.role)}</p><ul>${row.checks.map((check) => `<li>${check.ok ? '✅' : '⚠️'} <strong>${escapeText(check.label)}</strong> — ${escapeText(check.detail)}</li>`).join('')}</ul></article>`).join('')}
    </div>
  </section>`;
}

function renderStartTestingStep(guideContext = {}) {
  const team = Array.isArray(guideContext.team) ? guideContext.team.filter(Boolean) : [];
  const names = team.map((p) => getPokemonDisplayName?.(p) || p?.name || 'Pokémon').slice(0, 6);
  const leadPairs = [];
  for (let i = 0; i < Math.min(names.length, 4); i += 2) {
    if (names[i + 1]) leadPairs.push([names[i], names[i + 1]]);
  }
  const testing = learningTerm('testing', 'learning-testing-teams');
  const firstDraft = learningTerm('first draft', 'learning-first-drafts');
  const matchup = learningTerm('matchup', 'learning-matchups');
  const speedControl = learningTerm('speed control', 'speed-control');
  const safeTurns = learningTerm('safe turns', 'safe-turns');
  const sixth = learningTerm('Sixth Pokémon Syndrome', 'learning-sixth-pokemon-syndrome');
  const iteration = learningTerm('iteration', 'learning-team-iteration');
  const winCondition = learningTerm('win condition', 'learning-win-conditions');
  const testingLog = learningTerm('testing log', 'learning-testing-log');
  const leadSection = leadPairs.length ? `<section class="team-guide-section"><h3>Suggested lead pairs</h3><div class="learning-grid">${leadPairs.map((pair)=>`<article class="mini-card"><h4>${pair[0]} + ${pair[1]}</h4><p>Test this pairing as an opening option and record whether it consistently creates pressure, positioning, speed control, or setup opportunities for the rest of the team.</p></article>`).join('')}</div></section>` : '';
  return `<section class="team-guide-section">
    <p>The ${firstDraft} of your team is unlikely to be the final draft.</p>
    <p>Up to this point, you have made educated guesses. You have imagined leads, matchups, support plans, damage pressure, ${speedControl}, and ${winCondition}s.</p>
    <p>${testing} is how you find out which guesses were right. You may discover that some Pokémon are excellent, some moves never get clicked, some items do not help, or one ${matchup} is much harder than expected.</p>
    <p>That is normal. Team building is an ${iteration} process.</p>
  </section>

  ${leadSection}

  <section class="team-guide-section"><h3>Matchups to watch for</h3><ul class="team-guide-question-list"><li>Teams that deny your preferred opening.</li><li>Faster speed-control archetypes.</li><li>Bulky defensive cores that stall your pressure.</li><li>Setup attackers that punish passive turns.</li><li>Weather, Trick Room, or other field-control strategies.</li></ul></section>

  <section class="team-guide-section"><h3>Questions to answer after games</h3><ul class="team-guide-question-list"><li>Which lead pair felt strongest and why?</li><li>Did the team create the board state it was designed to create?</li><li>Which Pokémon overperformed or underperformed?</li><li>Were there moves, items, or abilities that never mattered?</li><li>What matchup exposed the biggest weakness?</li></ul></section>

  <section class="team-guide-section"><h3>When changes are justified</h3><ul class="team-guide-question-list"><li>Change a move if it is repeatedly unused or fails its intended job.</li><li>Change an item if it rarely influences games.</li><li>Change a nature or investment if key speed or damage benchmarks are consistently missed.</li><li>Replace a Pokémon only after repeated evidence that it cannot perform its intended role.</li></ul></section>

  <section class="team-guide-section"><h3>What testing is for</h3><div class="learning-grid">
    <article class="mini-card"><h4>Check your main idea</h4><p>Does the team actually do what you built it to do?</p><ul><li>Can your core get onto the field safely?</li><li>Can your main attacker apply pressure?</li><li>Can your support Pokémon create useful turns?</li></ul></article>
    <article class="mini-card"><h4>Check your matchups</h4><p>Find which opposing Pokémon, cores, or archetypes give you trouble.</p><ul><li>fast offense</li><li>bulky balance</li><li>Trick Room</li><li>weather</li><li>setup teams</li><li>strong priority</li><li>defensive switching</li></ul></article>
    <article class="mini-card"><h4>Check your details</h4><p>See whether your moves, items, abilities, natures, and stat points are actually helping.</p><ul><li>moves you never click</li><li>items that never matter</li><li>abilities that do not support the plan</li><li>Pokémon that faint before doing their job</li><li>stat spreads that feel too slow, too weak, or too frail</li></ul></article>
    <article class="mini-card"><h4>Check your usage</h4><p>Notice which Pokémon you bring often and which Pokémon stay on the bench.</p><ul><li>a Pokémon you never bring may not fit</li><li>a Pokémon you always bring may need more support</li><li>a Pokémon that only works in one matchup may need to justify its slot</li></ul></article>
  </div></section>

  ${listBlock('Questions after each game', ['What four Pokémon did I bring?','Which two Pokémon did I leave behind?','Did my lead make sense?','Did my main idea work?','Did I have enough damage pressure?','Did I have enough speed control?','Did I create safe turns?','Did any Pokémon feel useless?','Did any move, item, or ability fail to matter?','What opposing Pokémon or strategy caused the biggest problem?','Was the loss caused by the team, the matchup, or my play?'])}

  <section class="team-guide-section"><h3>What to change first</h3><p>Do not rebuild the whole team after one bad game. Start with the smallest useful change.</p><ol class="team-guide-question-list"><li>Change how you lead or play the matchup.</li><li>Change a move that is not being used.</li><li>Change an item that is not helping.</li><li>Adjust nature or stat points if the Pokémon is too slow, weak, or frail.</li><li>Replace one Pokémon if it repeatedly fails its role.</li><li>Revisit the core only if the main idea itself is not working.</li></ol></section>

  <section class="team-guide-section"><h3>${sixth}</h3><p>Sometimes the team feels mostly right, but the final slot never seems to fit. This is common.</p><ul class="team-guide-question-list"><li>the core needs a different kind of support</li><li>the team lacks a clear backup plan</li><li>the team is trying to answer too many matchups at once</li><li>one earlier Pokémon is not doing enough</li><li>the team needs a different mode</li><li>the final slot needs to support the whole team, not just patch one weakness</li></ul><p>If the sixth Pokémon never gets brought or never helps, use the Metadex and Analysis tools to rethink what the team actually needs.</p></section>

  <section class="team-guide-section"><h3>When to move on</h3><div class="learning-grid"><article class="mini-card"><h4>Keep working on the team if</h4><ul><li>the main idea is fun or promising</li><li>the core works in some games</li><li>the problems seem fixable</li><li>you understand what needs changing</li><li>you are learning from the games</li></ul></article><article class="mini-card"><h4>Consider starting over if</h4><ul><li>the main idea almost never works</li><li>every fix creates a new problem</li><li>the team has no clear win condition</li><li>you dislike using the team</li><li>you cannot explain what the team is trying to do anymore</li></ul></article></div></section>

  <section class="team-guide-section"><h3>Simple ${testingLog}</h3><p>After a few games, write down:</p><div class="team-guide-chip-row">${['What I brought most often','What I rarely brought','What beat me most often','What worked well','What felt awkward','What I want to change next'].map((item)=>`<span class="score-pill">${escapeText(item)}</span>`).join('')}</div><p class="muted">This helps you adjust based on patterns instead of emotions after one loss.</p></section>

  ${listBlock('What to do now', ['Play games with the team.','Use Team Builder to make small changes.','Use Analysis to check whether changes create new weaknesses.','Use Matchups to review difficult opposing archetypes.','Use Damage to test important KOs or survival benchmarks.','Use the Metadex to find replacements if a Pokémon repeatedly fails its role.','Return to earlier guide steps if the main idea or core needs rebuilding.'])}

  <section class="team-guide-section"><h3>How to use the Metadex here</h3><p>If testing shows that a Pokémon is not doing its job, use the Metadex to find alternatives with a similar role, better synergy, better matchup value, or a clearer reason to be on the team.</p></section>`;
}


function renderWeaknessExpandStep(state) {
 const guideContext = state.__teamGuideContext || {};
 const risks=(guideContext.topDefensiveRisks||[]).slice(0,3);
 return `<section class="team-guide-section"><h3>Practical risk ranking</h3>${risks.length?risks.map((r,i)=>`<article class="mini-card"><h4>#${i+1} ${escapeText(r)}</h4><p><strong>Who is exposed:</strong> Team members identified by the weakness analysis.</p><p><strong>Main plan impact:</strong> Evaluate whether this risk interrupts your primary win condition, speed control, or positioning.</p><p><strong>Possible answers:</strong> Resist, pivot, speed control, offensive pressure, or item/move adjustments.</p></article>`).join(''):'<p>No major risks detected yet.</p>'}</section>
 <section class="team-guide-section"><h3>How to use this checkpoint</h3><ul class="team-guide-question-list"><li>Prioritise risks that directly stop the main plan.</li><li>Fix recurring matchup problems before niche concerns.</li><li>Prefer solutions that add value in multiple matchups.</li></ul></section>`;
}

function renderCoreDefensiveCheck(state) {
  const summary = getWeaknessGuideSummary(state);
  if (summary.memberCount < 2) {
    return `<section class="team-guide-section team-guide-weakness-check" id="weakness-coverage-guide">
      <h3>Core defensive check</h3>
      <p class="notice">Add more Pokémon to see meaningful weakness coverage.</p>
      <p class="muted">The goal here is not to perfect the team. Once you have at least two Pokémon, this checkpoint helps guide the next teammate choices.</p>
      <p class="muted team-guide-context-link">${typingGuideLink('Read the Typing guide')}</p>
    </section>`;
  }
  const exposed = summary.exposed[0];
  const attention = summary.needsAttention[0];
  const focus = exposed || attention;
  const focusType = focus?.attackingType || 'defensive';
  const suggestion = focus ? `Your core currently looks ${focusType}-exposed. When filling out the core, consider a teammate that resists ${focusType}, pressures ${focusType}-types offensively, or supports safer positioning into ${focusType} attacks.` : 'Your core has no obvious top exposed type yet. Keep adding teammates that support the main plan while preserving defensive variety.';
  return `<section class="team-guide-section team-guide-weakness-check" id="weakness-coverage-guide">
    <h3>Core defensive check</h3>
    <div class="learning-grid">
      <article class="mini-card"><h4>Top exposed type</h4><p>${exposed ? escapeText(exposed.attackingType) : 'None obvious yet'}</p></article>
      <article class="mini-card"><h4>Needs attention</h4><p>${attention ? escapeText(attention.attackingType) : 'None obvious yet'}</p></article>
    </div>
    <p>${escapeText(suggestion)}</p>
    <p class="muted">This does not mean your team is wrong. It is a practical checkpoint for choosing the next teammate.</p>
    <p class="muted team-guide-context-link">${typingGuideLink('Read the Typing guide')}</p>
    <a class="secondary-button" href="#weakness-priorities">View full weakness coverage</a>
  </section>`;
}

// UI RENDERER: renders guide-specific raw weakness priorities without redefining team identity.
function renderWeaknessPriorities(state) {
  const summary = getWeaknessGuideSummary(state);
  if (summary.memberCount < 2) {
    return `<section class="team-guide-section team-guide-weakness-priorities" id="weakness-priorities">
      <h3>Weakness priorities</h3>
    <div class="team-guide-action-row">${guideRouteButton('Find weakness answers in MetaDex', 'metadex', metadexGuideAttrs(5, 'weakness-expand', 'weakness'))}</div>
      <p class="notice">Add more Pokémon to see meaningful weakness coverage.</p>
      <p class="muted">Once your team has at least two Pokémon, this section will show exposed types, needs-attention types, covered types, and suggested answer qualities.</p>
      <p class="muted team-guide-context-link">${typingGuideLink('Not sure what this weakness means?')}</p>
    </section>`;
  }
  const concerns = [...summary.exposed, ...summary.needsAttention].slice(0, 3);
  const softAnswers = summary.covered.slice(0, 5).map((entry) => entry.attackingType);
  return `<section class="team-guide-section team-guide-weakness-priorities" id="weakness-priorities">
    <h3>Weakness priorities</h3>
    ${renderWeaknessCoverageMiniChart(summary.profile)}
    <div class="team-guide-action-row">${guideRouteButton('Open Analysis for full chart', 'analysis-desk')}</div>
    <article class="mini-card team-guide-fix-first">
      <h4>What to fix first</h4>
      ${concerns.length ? `<ul>${concerns.map((entry) => `<li><strong>${escapeText(entry.attackingType)}</strong>: ${escapeText(answerQualityText(entry.attackingType))}</li>`).join('')}</ul>` : '<p>No urgent exposed type stands out yet.</p>'}
      ${softAnswers.length ? `<p class="muted"><strong>Current soft answers:</strong> ${escapeText(softAnswers.join(', '))} tools can help, but they do not fully replace safe switch-ins.</p>` : '<p class="muted"><strong>Current soft answers:</strong> No strong covered group is visible yet.</p>'}
    </article>
    <p class="notice">Do not fix every weakness at once. Prioritise weaknesses that affect common meta matchups or stop your main game plan.</p>
    <div class="team-guide-help-row"><span>Need help?</span>${typingGuideLink('Not sure what this weakness means?')}<a href="/learning/speed-control" data-route="learning-speed-control">Understand turn order tools</a></div>
  </section>`;
}

// UI RENDERER: renders guide-specific weakness patch notes from raw coverage facts.
function renderDetailWeaknessPatchSection(state) {
  const summary = getWeaknessGuideSummary(state);
  if (summary.memberCount < 2) {
    return `<section class="team-guide-section team-guide-weakness-check">
      <h3>Can details patch any remaining weaknesses?</h3>
    <div class="team-guide-action-row">${guideRouteButton('Check detail options in MetaDex', 'metadex', metadexGuideAttrs(6, 'details', 'glue'))}</div>
      <p class="notice">Add more Pokémon to see meaningful weakness coverage.</p>
      <p class="muted">Later, this checkpoint can suggest move, item, ability, nature, bulk, speed control, disruption, screens, priority, or recovery changes without forcing a Pokémon replacement.</p>
      <p class="muted team-guide-context-link">${typingGuideLink('Use the Typing guide to understand resistances and coverage')}</p>
    </section>`;
  }
  const focus = summary.exposed[0] || summary.needsAttention[0];
  const focusText = focus ? `Your team is still ${focus.attackingType}-exposed. If you do not want to change Pokémon, consider ${detailPatchText(focus.attackingType)}.` : 'No major remaining type exposure stands out. Use details to preserve your main plan rather than changing Pokémon unnecessarily.';
  return `<section class="team-guide-section team-guide-weakness-check">
    <h3>Can details patch any remaining weaknesses?</h3>
    <p>${escapeText(focusText)}</p>
    <div class="team-guide-chip-row">${['move coverage','item choice','ability choice','nature/stat investment','Protect/recovery','speed control','disruption','screens/Aurora Veil','priority'].map((item)=>`<span class="score-pill">${escapeText(item)}</span>`).join('')}</div>
    <p class="muted">Do not force Pokémon changes at this stage. Sometimes a move, item, ability, bulk benchmark, or support option patches the issue well enough.</p>
    <p class="muted team-guide-context-link">${typingGuideLink('Use the Typing guide to understand resistances and coverage')}</p>
  </section>`;
}

// RAW CALCULATION SORTING: summarizes raw weakness coverage entries for guide checkpoints.
function getWeaknessGuideSummary(state = {}) {
  const team = Array.isArray(state.team) ? state.team.filter((slot) => slot && slot.pokemon_id) : [];
  const coachingProfile = state.__teamGuideCoachingProfile || buildTeamCoachingProfile(state.team, { data: state.data });
  const rawProfile = calculateWeaknessCoverageProfile(team, state.data || {});
  const sharedRisks = Array.isArray(coachingProfile?.risks) ? coachingProfile.risks : [];
  const riskToEntry = (risk = {}) => ({
    attackingType: risk.type,
    classification: risk.severity === 'High' ? 'Exposed' : risk.severity === 'Medium' ? 'Needs Attention' : 'Covered',
    weakCount: Array.isArray(risk.affectedPokemon) ? risk.affectedPokemon.length : 1,
    resistCount: Array.isArray(risk.softAnswers) ? risk.softAnswers.length : 0,
    immuneCount: 0,
    sharedRisk: risk
  });
  const exposed = sharedRisks.filter((risk) => risk.severity === 'High').map(riskToEntry);
  const needsAttention = sharedRisks.filter((risk) => risk.severity !== 'High').map(riskToEntry);
  const covered = rawProfile.filter((entry) => entry.classification === 'Covered').sort((a, b) => (b.resistCount + b.immuneCount) - (a.resistCount + a.immuneCount));
  return { memberCount: team.length, profile: rawProfile, exposed, needsAttention, covered, coachingProfile };
}

// RAW CALCULATION SORTING: orders weakness entries by displayed severity.
function sortWeaknessEntries(a, b) {
  return (b.weakCount - a.weakCount) || ((a.resistCount + a.immuneCount) - (b.resistCount + b.immuneCount)) || String(a.attackingType).localeCompare(String(b.attackingType));
}

// UI RENDERER: compact guide chart for raw weakness coverage entries.
function renderWeaknessCoverageMiniChart(profile = []) {
  const priorityOrder = { Exposed: 0, 'Needs Attention': 1, Covered: 2 };
  const visibleEntries = [...profile]
    .sort((a, b) => (priorityOrder[a.classification] ?? 3) - (priorityOrder[b.classification] ?? 3) || sortWeaknessEntries(a, b))
    .slice(0, 8);
  return `<div class="weakness-coverage-grid team-guide-weakness-grid" aria-label="Weakness Coverage chart">
    ${visibleEntries.map((entry) => `<article class="weakness-coverage-tile ${weaknessGuideToneClass(entry.classification)}"><strong>${escapeText(entry.attackingType)}</strong><span>${escapeText(entry.classification)}</span><small>${entry.weakCount} weak · ${entry.resistCount} resist · ${entry.immuneCount} immune</small>${['Exposed','Needs Attention'].includes(entry.classification) ? weaknessAnswerLink(entry.attackingType) : ''}</article>`).join('')}
  </div>`;
}

function weaknessAnswerLink(typeName = '') {
  return `<a class="secondary-button compact weakness-answer-link" href="/metadex?answerType=${escapeAttr(typeName)}" data-route="metadex" data-metadex-answer-type="${escapeAttr(typeName)}">Find answers in MetaDex</a>`;
}

function weaknessGuideToneClass(status = '') {
  const key = String(status).toLowerCase().replace(/\s+/g, '-');
  return `coverage-${key || 'safe'}`;
}

// UI RENDERER: explains raw answer type categories for the guide.
function answerQualityText(typeName = '') {
  const type = String(typeName || 'that type');
  const map = {
    Fairy: 'Look for a Steel, Poison, or Fire defensive answer, or add faster pressure into Fairy-types.',
    Ice: 'Look for a Fire, Water, Steel, or Ice resist, or pressure Ice attackers before they can target your shared weakness.',
    Rock: 'Look for Ground, Steel, or Fighting pressure, safer switching, or speed control against Rock attackers.',
    Fire: 'Look for Water, Fire, Rock, or Dragon defensive value, or faster pressure into Fire-types.',
    Water: 'Look for Water, Grass, or Dragon defensive value, or Electric/Grass pressure that fits the team.',
    Electric: 'Look for Ground immunity/value, Grass or Dragon resistance, or disruption against Electric attackers.',
    Ground: 'Look for Flying immunity, Grass or Bug resistance, or support that protects grounded teammates.',
    Fighting: 'Look for Ghost immunity, Flying/Psychic/Fairy resistance, or offensive pressure that stops Fighting attackers.',
    Dragon: 'Look for Fairy immunity to Dragon, Steel resistance, or faster Dragon/Fairy/Ice pressure.',
    Dark: 'Look for Fighting, Fairy, or Dark defensive value, or disruption against Dark attackers.',
    Ghost: 'Look for Normal immunity, Dark resistance, or faster pressure into Ghost-types.',
    Steel: 'Look for Fire, Water, Electric, or Steel defensive value, or Ground/Fire/Fighting pressure.',
    Poison: 'Look for Steel immunity, Ground/Poison/Rock/Ghost resistance, or Psychic/Ground pressure.',
    Flying: 'Look for Electric, Rock, or Steel defensive value, or speed control into Flying attackers.',
    Psychic: 'Look for Dark immunity, Steel/Psychic resistance, or faster Ghost/Dark/Bug pressure.',
    Bug: 'Look for Fire, Flying, Fighting, Poison, Ghost, Steel, or Fairy defensive value.',
    Grass: 'Look for Fire, Grass, Poison, Flying, Bug, Dragon, or Steel defensive value.',
    Normal: 'Look for Ghost immunity, Rock/Steel resistance, or disruption against strong neutral attackers.'
  };
  return map[type] || `Look for a resist, immunity, offensive pressure, or support that improves the ${type} matchup.`;
}

// UI RENDERER: explains raw type patch ideas for guide details.
function detailPatchText(typeName = '') {
  const type = String(typeName || 'problem type');
  const map = {
    Fairy: 'Steel or Poison coverage, more speed control, disruption, or bulk investment on your best neutral switch-in',
    Ice: 'Fire or Steel coverage, defensive items, speed control, or Aurora Veil/screens support',
    Rock: 'Ground/Fighting/Steel coverage, Protect positioning, recovery, or bulk on key switch-ins',
    Fire: 'Water/Ground/Rock coverage, defensive items, weather control, or speed control',
    Water: 'Electric/Grass coverage, recovery, special bulk, or disruption against Water attackers',
    Electric: 'Ground coverage or immunity support, speed control, or safer positioning for Water/Flying teammates',
    Ground: 'Flying partners, Protect, grassy-style mitigation if available, or speed control before Ground attackers move'
  };
  return map[type] || `${type}-resisting coverage, defensive item choices, better speed control, disruption, recovery, priority, or bulk investment`;
}



function typingGuideLink(label) {
  return `<a class="team-guide-inline-link" href="/learning-hub?concept=learning-typing" data-route="learning-hub" data-learning-concept="learning-typing">${escapeText(label)}</a>`;
}

function speedControlGuideLink(label) {
  return `<a class="team-guide-inline-link" href="/learning-hub?article=speed-control" data-route="learning-hub" data-learning-article="speed-control">${escapeText(label)}</a>`;
}

function stepButton(step, stepNumber, currentStep) {
  const active = stepNumber === currentStep;
  return `<button type="button" class="team-guide-step-button ${active ? 'active' : ''}" data-action="team-guide-step" data-team-guide-step="${stepNumber}" aria-current="${active ? 'step' : 'false'}"><span>${stepNumber}</span><strong>${escapeText(step.title)}</strong></button>`;
}

function guideRouteButton(label, routeId, extraAttrs = '') {
  return `<a class="secondary-button team-guide-route-button" href="/${escapeAttr(routeId)}" data-route="${escapeAttr(routeId)}" ${extraAttrs}>${escapeText(label)}</a>`;
}

function metadexGuideAttrs(step, intent, targetRole = '') {
  const roleAttr = targetRole ? ` data-metadex-target-role="${escapeAttr(targetRole)}"` : '';
  return `data-metadex-context-source="team-building-guide" data-metadex-guide-step="${escapeAttr(step)}" data-metadex-intent="${escapeAttr(intent)}"${roleAttr}`;
}

function relatedPageChip(label) {
  const routeId = PAGE_ROUTE_MAP[label];
  if (!routeId) return `<span class="score-pill">${escapeText(label)}</span>`;
  return `<a class="score-pill team-guide-page-chip" href="/${escapeAttr(routeId)}" data-route="${escapeAttr(routeId)}">${escapeText(label)}</a>`;
}

function listBlock(title, items) {
  return `<section class="team-guide-section"><h3>${escapeText(title)}</h3><ul class="team-guide-question-list">${items.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></section>`;
}

function chipBlock(title, items) {
  return `<section class="team-guide-section"><h3>${escapeText(title)}</h3><div class="team-guide-chip-row">${items.map((item) => `<span class="score-pill">${escapeText(item)}</span>`).join('')}</div></section>`;
}

function lightTeamHint(state) {
  const selected = Array.isArray(state.team) ? state.team.filter(Boolean) : [];
  if (!selected.length) return '<p class="notice team-guide-hint">You have not selected a main Pokémon yet. Start by browsing the Metadex or filling slot 1 in Team Builder.</p>';
  const missingItems = selected.some((slot) => !slot.item_id);
  const missingMoves = selected.some((slot) => !Array.isArray(slot.moves) || slot.moves.filter(Boolean).length < 4);
  if (missingItems || missingMoves) return '<p class="notice team-guide-hint">Some Pokémon are missing items or moves. Use the details step before playtesting.</p>';
  if (selected.length < 6) return '<p class="notice team-guide-hint">Your team is started. Use Analysis to check shared weaknesses before finalising all six slots.</p>';
  return '<p class="notice team-guide-hint">Your team has six Pokémon. Use Matchups and Damage to test problem opponents.</p>';
}

function clampStep(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.round(parsed), 1), GUIDE_STEPS.length);
}

function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeText(value); }
