import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { buildTeamGuideContext } from '../../logic/teamGuideContext.js';
import { buildTacticalPresentation } from '../../logic/tacticalPresenter.js';
import { GUIDE_STEPS } from './teamBuildingGuideData.js';
import { chipBlock, clampStep, guideRouteButton, lightTeamHint, listBlock, relatedPageChip, stepButton, escapeText } from './teamBuildingGuideUtils.js';
import { renderGuideCoachingCheckpoint } from './renderGuideSidebar.js';
import { renderMainIdeaStep, renderAddingToCoreStep, renderCoreReadyStep } from './renderCorePlanningSteps.js';
import { renderRoundOutTeamStep, renderFinishDetailsStep, renderStartTestingStep } from './renderGuideDetailSteps.js';
import { renderWeaknessExpandStep } from './renderGuideWeaknessSteps.js';

export function TeamBuildingGuidePage(state) {
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const guideContext = buildTeamGuideContext(state.team, { data: state.data, profile: coachingProfile });
  const currentStep = clampStep(state.teamBuildingGuideStep || 1);
  const tacticalPresentation = buildTacticalPresentation(coachingProfile, { page: 'guide', guideContext, currentStep });
  guideContext.tacticalPresentation = tacticalPresentation;
  state.__teamGuideCoachingProfile = coachingProfile;
  state.__teamGuideContext = guideContext;
  state.__teamGuideTacticalPresentation = tacticalPresentation;
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
