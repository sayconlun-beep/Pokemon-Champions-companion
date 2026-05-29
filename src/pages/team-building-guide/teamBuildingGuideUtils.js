import { PAGE_ROUTE_MAP, GUIDE_STEPS } from './teamBuildingGuideData.js';

export function learningTerm(label, concept) {
  return `<a href="/learning-hub?concept=${escapeAttr(concept)}" data-route="learning-hub">${escapeText(label)}</a>`;
}
export function typingGuideLink(label) {
  return `<a class="team-guide-inline-link" href="/learning-hub?concept=learning-typing" data-route="learning-hub" data-learning-concept="learning-typing">${escapeText(label)}</a>`;
}

export function speedControlGuideLink(label) {
  return `<a class="team-guide-inline-link" href="/learning-hub?article=speed-control" data-route="learning-hub" data-learning-article="speed-control">${escapeText(label)}</a>`;
}

export function stepButton(step, stepNumber, currentStep) {
  const active = stepNumber === currentStep;
  return `<button type="button" class="team-guide-step-button ${active ? 'active' : ''}" data-action="team-guide-step" data-team-guide-step="${stepNumber}" aria-current="${active ? 'step' : 'false'}"><span>${stepNumber}</span><strong>${escapeText(step.title)}</strong></button>`;
}

export function guideRouteButton(label, routeId, extraAttrs = '') {
  return `<a class="secondary-button team-guide-route-button" href="/${escapeAttr(routeId)}" data-route="${escapeAttr(routeId)}" ${extraAttrs}>${escapeText(label)}</a>`;
}

export function metadexGuideAttrs(step, intent, targetRole = '') {
  const roleAttr = targetRole ? ` data-metadex-target-role="${escapeAttr(targetRole)}"` : '';
  return `data-metadex-context-source="team-building-guide" data-metadex-guide-step="${escapeAttr(step)}" data-metadex-intent="${escapeAttr(intent)}"${roleAttr}`;
}

export function relatedPageChip(label) {
  const routeId = PAGE_ROUTE_MAP[label];
  if (!routeId) return `<span class="score-pill">${escapeText(label)}</span>`;
  return `<a class="score-pill team-guide-page-chip" href="/${escapeAttr(routeId)}" data-route="${escapeAttr(routeId)}">${escapeText(label)}</a>`;
}

export function listBlock(title, items) {
  return `<section class="team-guide-section"><h3>${escapeText(title)}</h3><ul class="team-guide-question-list">${items.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></section>`;
}

export function chipBlock(title, items) {
  return `<section class="team-guide-section"><h3>${escapeText(title)}</h3><div class="team-guide-chip-row">${items.map((item) => `<span class="score-pill">${escapeText(item)}</span>`).join('')}</div></section>`;
}

export function lightTeamHint(state) {
  const selected = Array.isArray(state.team) ? state.team.filter(Boolean) : [];
  if (!selected.length) return '<p class="notice team-guide-hint">You have not selected a main Pokémon yet. Start by browsing the Metadex or filling slot 1 in Team Builder.</p>';
  const missingItems = selected.some((slot) => !slot.item_id);
  const missingMoves = selected.some((slot) => !Array.isArray(slot.moves) || slot.moves.filter(Boolean).length < 4);
  if (missingItems || missingMoves) return '<p class="notice team-guide-hint">Some Pokémon are missing items or moves. Use the details step before playtesting.</p>';
  if (selected.length < 6) return '<p class="notice team-guide-hint">Your team is started. Use Analysis to check shared weaknesses before finalising all six slots.</p>';
  return '<p class="notice team-guide-hint">Your team has six Pokémon. Use Matchups and Damage to test problem opponents.</p>';
}

export function clampStep(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.round(parsed), 1), GUIDE_STEPS.length);
}

export function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
export function escapeAttr(value) { return escapeText(value); }
