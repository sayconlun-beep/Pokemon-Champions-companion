import { calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { escapeAttr, escapeText, guideRouteButton, metadexGuideAttrs, typingGuideLink } from './teamBuildingGuideUtils.js';

export function renderWeaknessExpandStep(state) {
 const guide = state.__teamGuideTacticalPresentation?.guide || state.__teamGuideContext?.tacticalPresentation?.guide || {};
 const risks = Array.isArray(guide.riskCards) ? guide.riskCards.slice(0, 3) : [];
 return `<section class="team-guide-section"><h3>Practical risk ranking</h3>${risks.length?risks.map((risk)=>`<article class="mini-card"><h4>${escapeText(risk.title)}</h4><p><strong>${escapeText(risk.exposed)}</strong></p><p><strong>${escapeText(risk.impact)}</strong></p><p><strong>${escapeText(risk.answers)}</strong></p></article>`).join(''):'<p>No major risks detected yet.</p>'}</section>
 <section class="team-guide-section"><h3>How to use this checkpoint</h3><ul class="team-guide-question-list"><li>Prioritise risks that directly stop the main plan.</li><li>Fix recurring matchup problems before niche concerns.</li><li>Prefer solutions that add value in multiple matchups.</li></ul></section>`;
}

export function renderCoreDefensiveCheck(state) {
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
export function renderWeaknessPriorities(state) {
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
export function renderDetailWeaknessPatchSection(state) {
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
