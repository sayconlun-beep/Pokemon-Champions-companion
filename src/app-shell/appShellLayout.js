import { escapeText } from './appShellText.js';

function isMetaDexMobileViewport() {
  return window.matchMedia?.('(max-width: 1020px)').matches ?? false;
}

export function scrollSelectedMetadexIntoView(root) {
  if (!isMetaDexMobileViewport()) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const selectedDetail = root.querySelector('.metadex-detail-overlay-panel') || root.querySelector('.metadex-detail-overlay');
      const selectedTile = root.querySelector('.metadex-grid .metadex-tile.active');
      const scrollTarget = selectedDetail || selectedTile;
      if (!scrollTarget) return;
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scrollTarget.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  });
}


export function focusSelectedMetadexDetail(root) {
  window.requestAnimationFrame(() => {
    const detailPanel = root.querySelector('.metadex-detail-overlay-panel') || root.querySelector('.metadex-layout > .metadex-detail-panel');
    if (!detailPanel) return;
    detailPanel.setAttribute('tabindex', '-1');
    detailPanel.focus?.({ preventScroll: true });
    detailPanel.querySelector('[data-action="close-metadex-detail"]')?.focus?.({ preventScroll: true });
  });
}

export function focusRequestedLearningCard(root, state) {
  if (state.route !== 'learning-hub') return;
  let raw = '';
  try {
    const params = new URLSearchParams(window.location.search || '');
    raw = params.get('concept') || params.get('learning') || (window.location.hash || '').replace(/^#/, '');
  } catch {
    raw = '';
  }
  if (!raw) return;
  const slug = String(raw).toLowerCase().trim().replace(/^learning-card-/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return;
  window.requestAnimationFrame(() => {
    const card = root.querySelector(`#learning-card-${CSS.escape(slug)}`);
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.querySelector('summary')?.focus?.({ preventScroll: true });
  });
}


export function renderProStudySandboxBanner(state) {
  const sandbox = state.proStudySelectionState?.activeSandbox;
  if (!sandbox?.teamId) return '';
  return `
    <section class="card pro-study-sandbox-banner" role="status" aria-live="polite">
      <div>
        <span class="section-kicker">Pro team sandbox</span>
        <strong>Studying ${escapeText(sandbox.playerName || 'a pro team')}</strong>
        <p class="muted">Your saved team and previous analysis session are preserved. Exit study mode to restore them.</p>
      </div>
      <button class="secondary-button" type="button" data-action="exit-pro-study-sandbox">Exit Pro Study</button>
    </section>
  `;
}
