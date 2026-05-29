import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { buildTacticalPresentation } from '../../logic/tacticalPresenter.js';
import { escapeText } from './analysisDeskHelpers.js';
import { linkAnalysisSlotReferences } from './linkAnalysisSlotReferences.js';
import { renderPressureCoverageSection, safeBuildAnalysisDeskPressureCoverage } from './renderPressureCoverageSection.js';
import { renderBuildNotesSection, renderDefensiveGamePlanSection, renderHowThisTeamPlaysSection, renderLearningHubAnalysisLink, renderTeamStyleSection } from './renderAnalysisDeskSections.js';
import { renderWeaknessCoverageSection } from './renderWeaknessCoverageSection.js';

export function AnalysisDeskPage(state) {
  const coachingProfile = buildTeamCoachingProfile(state.team, { data: state.data });
  const analysisPressureCoverage = safeBuildAnalysisDeskPressureCoverage(state.team, state.data);
  const tacticalPresentation = buildTacticalPresentation(coachingProfile, { page: 'analysis', analysisPressureCoverage });
  const weaknessEntries = coachingProfile.defensiveProfile?.rawWeaknessCoverage || [];

  const markup = `
    <section class="page-stack analysis-desk-page">
      <header class="hero analysis-hero tactical-primary-panel">
        <div>
          <p class="eyebrow">Gold-standard workspace</p>
          <h1>Analysis Desk</h1>
          <p>Simple coaching insights to help you understand how your team wins, what threatens it, and what to improve.</p>
        </div>
        <div class="analysis-metrics">
          <span class="badge tertiary-chip">${coachingProfile.completeness?.filledSlots || 0}/6 selected</span>
          <span class="badge tertiary-chip">${escapeText(coachingProfile.archetype?.primary || 'No archetype yet')}</span>
        </div>
      </header>
      ${renderTeamStyleSection(tacticalPresentation, coachingProfile)}
      ${renderHowThisTeamPlaysSection(tacticalPresentation, coachingProfile, state.team, state.data)}
      ${renderPressureCoverageSection(tacticalPresentation)}
      ${renderWeaknessCoverageSection(tacticalPresentation, weaknessEntries, state.team, state.data, coachingProfile)}
      ${renderDefensiveGamePlanSection(tacticalPresentation, weaknessEntries, state.team, coachingProfile, state.data)}
      ${renderBuildNotesSection(state.team, state.data)}
      ${renderLearningHubAnalysisLink()}
    </section>`;
  return linkAnalysisSlotReferences(markup, state.team, state.data);
}
