import { analyseTeamValidation } from '../../core/legalityEngine.js';
import { renderArchetypeBadge } from '../../ui/teamCoachingRenderers.js';
import { escapeText, firstSentence } from './analysisDeskHelpers.js';
import { renderActionableRiskSummary } from './analysisDeskSlotSuggestions.js';

export function renderHowThisTeamPlaysSection(presentation = {}, profile = {}, team = [], data = {}) {
  const gameplans = Array.isArray(presentation?.gameplans) ? presentation.gameplans : [];
  const sections = [
    ['Speed control', presentation?.summaries?.speedPlan || 'No speed control summary yet.'],
    ['Weather / field plan', presentation?.summaries?.weatherPlan || 'No weather plan selected yet.'],
    ['Offensive profile', presentation?.summaries?.offensivePlan || 'No offensive profile yet.'],
    ['Defensive profile', presentation?.analysis?.defensiveGamePlan?.concern || presentation?.summaries?.defensivePlan || 'Use the Team Defense grid below to see the exact danger types and soft answers.']
  ];
  const recommendations = Array.isArray(presentation?.recommendations) ? presentation.recommendations.slice(0, 4) : [];
  const recommendationCard = recommendations.length
    ? `<article class="mini-card team-style-detail-card"><h3>Next improvements</h3><ul>${recommendations.map((item) => `<li>${escapeText(firstSentence(item.text, 140))}</li>`).join('')}</ul></article>`
    : '';

  return `<section class="analysis-section tactical-section-group how-this-team-plays-section gameplans-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>How This Team Plays</h2></div></div>
    ${renderPresenterGameplanCards(gameplans)}
    <details class="analysis-nested-expander team-breakdown-expander">
      <summary><span>Full breakdown</span><span class="muted">Speed, field plan, offense, defense, and next improvements</span></summary>
      <div class="team-style-detail-grid">
        ${sections.map(([title, text]) => `<article class="mini-card team-style-detail-card"><h3>${escapeText(title)}</h3><p>${escapeText(text)}</p></article>`).join('')}
        ${recommendationCard}
      </div>
    </details>
  </section>`;
}

function renderPresenterGameplanCards(gameplans = []) {
  const cards = (Array.isArray(gameplans) ? gameplans : []).slice(0, 3);
  if (!cards.length) return '<p class="muted">Add more selected moves, abilities, and items so the app can identify the team plan from real evidence.</p>';
  return `<div class="team-coaching-gameplans gameplan-card-grid">${cards.map((plan) => `<article class="mini-card team-style-detail-card gameplan-card">
    <h3>${escapeText(plan.label || 'Team plan')}</h3>
    ${plan.summary ? `<p>${escapeText(plan.summary)}</p>` : ''}
    ${plan.advice && plan.advice !== plan.summary ? `<p class="muted">${escapeText(plan.advice)}</p>` : ''}
    ${renderPresenterRoleLine('Enablers', plan.enablers)}
    ${renderPresenterRoleLine('Converters', plan.abusers)}
    ${renderPresenterRoleLine('Support', plan.support)}
  </article>`).join('')}</div>`;
}

function renderPresenterRoleLine(label = '', names = []) {
  const clean = Array.isArray(names) ? names.filter(Boolean).slice(0, 4) : [];
  return clean.length ? `<p class="team-style-role-line"><b>${escapeText(label)}:</b> ${escapeText(clean.join(', '))}</p>` : '';
}

export function renderDefensiveGamePlanSection(presentation = {}, weaknessEntries = [], team = [], coachingProfile = {}, data = {}) {
  const plan = presentation?.analysis?.defensiveGamePlan || {};
  const biggest = plan.concern || 'No single defensive concern stands out yet. Finish the team to make this section more precise.';
  const soft = plan.softAnswers || 'Use typing, immunity, resistance, Protect turns, and offensive pressure as your current soft answers.';
  const lookFor = plan.lookFor || 'Use safer positioning into pressure: scout with Protect, avoid repeated free switches, and answer dangerous boards before they become predictable.';
  return `<section class="analysis-section tactical-section-group defensive-game-plan-section what-this-means-section risk-callouts-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>Defensive Game Plan</h2></div></div>
    <div class="team-style-detail-grid">
      <article class="mini-card team-style-detail-card"><h3>Biggest concern</h3><p>${escapeText(biggest)}</p></article>
      <article class="mini-card team-style-detail-card"><h3>Current soft answers</h3><p>${escapeText(soft)}</p></article>
      <article class="mini-card team-style-detail-card"><h3>What to look for</h3><p>${escapeText(lookFor)}</p></article>
    </div>
    ${renderActionableRiskSummary(presentation, team, { limit: 6, compact: false, showSeverity: true, data, sourceProfile: coachingProfile })}
  </section>`;
}

export function renderBuildNotesSection(team = [], data = {}) {
  const validation = analyseTeamValidation(team, data);
  const strengths = Array.isArray(validation?.strengths) ? validation.strengths : [];
  const clarifications = Array.isArray(validation?.clarifications) ? validation.clarifications : [];
  if (!strengths.length && !clarifications.length) return '';
  return `<section class="analysis-section tactical-section-group build-notes-analysis-section intentional-synergies-analysis-section clarifications-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>Build Notes</h2></div></div>
    ${strengths.length ? `<div class="build-notes-group"><h3>Intentional synergies</h3><div class="success-stack team-strength-stack">${strengths.slice(0, 8).map((issue) => `<p class="success">${escapeText(issue.message)}</p>`).join('')}</div></div>` : ''}
    ${clarifications.length ? `<div class="build-notes-group"><h3>Clarifications</h3><div class="team-style-detail-grid single-card">${clarifications.slice(0, 8).map((issue) => `<article class="mini-card team-style-detail-card"><h3>Not an error</h3><p>${escapeText(issue.message)}</p></article>`).join('')}</div></div>` : ''}
  </section>`;
}


export function renderLearningHubAnalysisLink() {
  return `
    <section class="analysis-section tactical-section-group learning-hub-analysis-link summary-surface">
      <div class="card learning-hub-link-card">
        <div>
          <h2>Learning Hub</h2>
          <p class="section-summary">Use the Learning Hub for simple explanations of team roles, speed control, safe switching, and common battle mistakes.</p>
        </div>
        <a class="button primary" href="/learning-hub" data-route="learning-hub">Open Learning Hub</a>
      </div>
    </section>`;
}

export function renderTeamStyleSection(presentation = {}, profile = {}) {
  const reasons = Array.isArray(presentation?.archetype?.reasons) && presentation.archetype.reasons.length
    ? presentation.archetype.reasons
    : ['Add selected moves, abilities, and items so the app can read the team plan from real evidence.'];
  const detailCards = [
    reasons.length ? `<article class="mini-card team-style-detail-card"><h3>Why this was detected</h3><ul>${reasons.slice(0, 4).map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></article>` : ''
  ].filter(Boolean);
  return `<section class="analysis-section tactical-section-group team-style-section summary-surface">
    <div class="section-heading-row team-style-heading-row">
      <div><h2>Team Archetype</h2></div>
      <div class="team-style-badges">${renderArchetypeBadge(profile, { compact: true })}</div>
    </div>
    <p class="section-summary team-style-summary">${escapeText(presentation?.summaries?.analysisOverview || presentation?.summaries?.teamIdentity || 'Start by choosing a Pokémon or core.')}</p>
    ${detailCards.length ? `<div class="team-style-detail-grid ${detailCards.length === 1 ? 'single-card' : ''}">${detailCards.join('')}</div>` : ''}
  </section>`;
}
