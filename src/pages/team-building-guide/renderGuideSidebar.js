import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { buildTeamGuideContext } from '../../logic/teamGuideContext.js';
import { buildTacticalPresentation } from '../../logic/tacticalPresenter.js';
import { renderArchetypeBadge, renderNextTeammateSuggestions } from '../../ui/teamCoachingRenderers.js';
import { escapeText } from './teamBuildingGuideUtils.js';

export function renderGuideCoachingCheckpoint(state = {}, currentStep = 1, sharedContext = null) {
  const context = sharedContext || state.__teamGuideContext || buildTeamGuideContext(state.team, { data: state.data, profile: state.__teamGuideCoachingProfile });
  const profile = context.profile || state.__teamGuideCoachingProfile || buildTeamCoachingProfile(state.team, { data: state.data });
  const presentation = state.__teamGuideTacticalPresentation || context.tacticalPresentation || buildTacticalPresentation(profile, { page: 'guide', guideContext: context, currentStep });
  const guide = presentation.guide || {};
  const nextStep = guide.nextAction || guideNextStepSuggestion(profile, currentStep);
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
        <dd><span>${escapeText(guide.mainPlanSummary || context.mainPlanSummary || 'Add selected moves and abilities to reveal the main plan.')}</span></dd>
      </div>
      <div>
        <dt>Core signals</dt>
        <dd>${renderGuideContextList(guide.coreSignals || context.coreSynergySignals, 'No strong core synergy signal is visible yet.')}</dd>
      </div>
      <div>
        <dt>Speed control</dt>
        <dd>${renderGuideContextList(guide.speedControlSources || context.speedControlSources, 'No selected speed control source yet.')}</dd>
      </div>
      <div>
        <dt>Pressure</dt>
        <dd>${renderGuideContextList(guide.pressureSources || context.pressureSources, 'No clear pressure source selected yet.')}</dd>
      </div>
      <div>
        <dt>Watch out for</dt>
        <dd>${renderGuideContextList(guide.riskSummaries || context.topDefensiveRisks, 'No major shared risk is visible yet.')}</dd>
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

export function renderGuideContextList(entries = [], fallback = '') {
  const clean = (Array.isArray(entries) ? entries : []).filter(Boolean).slice(0, 3);
  if (!clean.length) return fallback ? `<span>${escapeText(fallback)}</span>` : '';
  return `<ul class="team-guide-live-mini-list">${clean.map((entry) => `<li>${escapeText(entry)}</li>`).join('')}</ul>`;
}

// SHARED PROFILE DISPLAY: converts profile completeness/risks into guide-step next action text.
export function guideNextStepSuggestion(profile = {}, currentStep = 1) {
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
