import { getPokemonFormLabel } from '../../utils/formGrouping.js';

const TEAM_BUILDER_LABELS = {
  'Stat allocation reviewed': 'EV allocation missing',
  'stat allocation reviewed': 'EV allocation missing',
  'damageBenchmarks coverage': 'Missing tactical benchmarks',
  'damageBenchmarks coverage.': 'Missing tactical benchmarks',
  Nature: 'Nature not selected',
  nature: 'Nature not selected'
};

export function formatTeamBuilderIssueLabel(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text.replace(/^Missing\s+/i, '');
  text = text.replace(/\.$/, '');
  const direct = TEAM_BUILDER_LABELS[text] || TEAM_BUILDER_LABELS[`${text}.`];
  if (direct) return direct;
  if (/^damageBenchmarks\s+coverage$/i.test(text)) return 'Missing tactical benchmarks';
  if (/^stat\s+allocation\s+reviewed$/i.test(text)) return 'EV allocation missing';
  if (/^nature$/i.test(text)) return 'Nature not selected';
  return `Missing ${text.replace(/([a-z])([A-Z])/g, '$1 $2')}`;
}

export function formatTeamBuilderIssue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/Missing\s+([^:.]+(?:\s+coverage)?\.?)/gi, (_, field) => formatTeamBuilderIssueLabel(field));
}

export function generatedBuildCoachNote(slot) {
  if (!slot?.generatedRole && !slot?.generatedExplanation) return '';
  return `<div class="generated-build-note"><strong>${escapeText(slot.generatedRole || 'Team role')}</strong><span>${escapeText(slot.generatedExplanation || 'This set was completed to support the generated team plan.')}</span></div>`;
}

export function formBadge(pokemon) {
  const label = getPokemonFormLabel(pokemon);
  return label ? `<span class="badge ruleset-badge">${escapeText(label)}</span>` : '';
}

export function completionBadge(completion, index = 0) {
  if (!completion) return '';
  if (completion.isComplete) return '<span class="badge legal-badge compact-completion-badge">Complete</span>';
  const issues = [
    ...(completion.legalityIssues || []),
    ...(completion.missingFields || []).map(formatTeamBuilderIssueLabel),
    ...(completion.warnings || [])
  ].map(formatTeamBuilderIssue).filter(Boolean);
  const count = issues.length || (completion.missingFields?.length || 0) + (completion.legalityIssues?.length || 0);
  const label = count ? `${count} issue${count === 1 ? '' : 's'}` : 'Review';
  const tooltip = issues.length ? issues : ['Review this slot to finish the build.'];
  const tooltipHtml = tooltip.slice(0, 5).map((issue) => `<span>${escapeText(issue)}</span>`).join('');
  return `<button type="button" class="issue-badge-button" data-slot-issues="${index}" title="${escapeText(tooltip.join(' • '))}" aria-label="${escapeText(label)}: ${escapeText(tooltip.join(', '))}"><span aria-hidden="true">⚠</span><strong>${escapeText(label)}</strong><span class="issue-tooltip" role="tooltip">${tooltipHtml}</span></button>`;
}


export function identityWarning(megaState, legality) {
  const warning = megaState?.warnings?.[0] || legality?.warnings?.[0] || legality?.missing?.[0] || '';
  return warning ? `<p class="identity-warning">${escapeText(formatTeamBuilderIssue(warning))}</p>` : '';
}

export function megaBadge(megaState) {
  if (!megaState || megaState.status === 'none') return '';
  const label = megaState.activeMega ? 'Mega active preview' : megaState.options?.length ? 'Mega Evolution' : 'Mega check';
  return `<span class="badge mega-badge">${escapeText(label)}</span>`;
}

export function spriteImage(sprite, pokemon, className) {
  return `<img class="pokemon-sprite ${className}" src="${escapeText(sprite.src)}" alt="${escapeText(sprite.alt)}" loading="${escapeText(sprite.loading)}" decoding="async" fetchpriority="low" width="80" height="80" data-pokemon-sprite data-pokemon-id="${escapeText(pokemon.ndex || pokemon.pokemon_id || '')}" data-sprite-stage="home" />`;
}


export function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
