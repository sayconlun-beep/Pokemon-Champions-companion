import { escapeAttr, escapeText, guideRouteButton, metadexGuideAttrs, speedControlGuideLink } from './teamBuildingGuideUtils.js';
import { renderGuideContextList } from './renderGuideSidebar.js';

export function renderMainIdeaStep(guideContext = null) {
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
  const guide = context?.tacticalPresentation?.guide || {};
  const planSummary = guide.mainPlanSummary || context?.mainPlanSummary || 'The team idea is still developing.';
  const signals = guide.mainIdeaSignals || buildMainIdeaSignals(context);
  const pressure = (guide.pressureSources || context?.pressureSources || []).slice(0, 4);

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

export function renderAddingToCoreStep(guideContext = null) {
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

  const guide = context?.tacticalPresentation?.guide || {};
  const pieces = Array.isArray(guide.corePieces) && guide.corePieces.length
    ? guide.corePieces
    : Array.isArray(context?.corePieces) && context.corePieces.length
      ? context.corePieces
      : buildFallbackCorePieces(context);
  const cohesion = guide.coreCohesion && Object.keys(guide.coreCohesion).length ? guide.coreCohesion : (context?.coreCohesion || buildFallbackCoreCohesion(context, pieces));

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


export function renderCoreReadyStep(context = null) {
  const guide = context?.tacticalPresentation?.guide || {};
  const readiness = guide.readiness || { verdict: 'Core is not ready yet. The main plan still needs more structure.', checks: [] };
  const checks = readiness.checks || [];
  const verdict = readiness.verdict || 'Core is not ready yet. The main plan still needs more structure.';

  return `<section class="team-guide-section tactical-secondary-panel">
    <p class="eyebrow">Live readiness evaluation</p>
    <h3>Core readiness verdict</h3>
    <p><strong>${escapeText(verdict)}</strong></p>
    <p class="muted">This verdict updates from the currently loaded team rather than using a fixed example.</p>
  </section>

  <section class="team-guide-section">
    <h3>Core ready checklist</h3>
    <ul class="team-guide-question-list">
      ${checks.map((check)=>`<li>${check.ok ? '✅' : '⚠️'} <strong>${escapeText(check.title)}</strong> — ${escapeText(check.detail)}</li>`).join('')}
    </ul>
  </section>

  <section class="team-guide-section">
    <h3>What this means</h3>
    <p>If you can explain the main plan, identify your pressure pieces, identify your speed control, and understand what still looks disconnected, the team is usually ready for initial testing.</p>
  </section>`;
}
