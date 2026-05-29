import { getRoute, defaultRoute } from '../ui/routes.js';
import { escapeText } from './appShellText.js';

export const PRIMARY_NAV_ROUTE_IDS = [
  'team-builder',
  'team-building-guide',
  'analysis-desk',
  'matchups',
  'damage',
  'metadex',
  'items',
  'learning-hub'
];

// Desktop nav section groupings — label + route IDs
export const DESKTOP_NAV_SECTIONS = [
  { label: 'Team', routeIds: ['team-builder', 'team-building-guide'] },
  { label: 'Tools', routeIds: ['analysis-desk', 'matchups', 'damage', 'metadex', 'items'] },
  { label: 'Learn', routeIds: ['learning-hub'] },
];

export const SECONDARY_NAV_ROUTE_IDS = [
  'import-export',
  'data-quality'
];

export const MOBILE_PRIMARY_NAV_ROUTE_IDS = [
  'team-builder',
  'team-building-guide',
  'analysis-desk',
  'metadex',
  'items'
];

export const MOBILE_MORE_NAV_ROUTE_IDS = [
  'matchups',
  'damage',
  'learning-hub',
  'import-export',
  'data-quality'
];

export const MAIN_NAV_ROUTE_IDS = new Set([
  ...PRIMARY_NAV_ROUTE_IDS,
  ...SECONDARY_NAV_ROUTE_IDS
]);

export function renderNavLink(route, activeNavRouteId, className = 'nav-link') {
  const isActive = route.id === activeNavRouteId;
  const content = `<span class="nav-icon" aria-hidden="true">${escapeText(route.icon)}</span><span class="nav-label">${escapeText(route.shortLabel || route.label)}</span>`;
  if (isActive) {
    return `<span class="${className} active" data-active-route="${route.id}" aria-label="${escapeText(route.label)}" aria-current="page" aria-disabled="true" title="${escapeText(route.label)}">${content}</span>`;
  }
  return `<a class="${className}" href="${route.path}" data-route="${route.id}" data-app-route-link="true" aria-label="${escapeText(route.label)}" aria-current="false" title="${escapeText(route.label)}">${content}</a>`;
}

export function renderNavigation(activeRoute) {
  const activeNavRouteId = MAIN_NAV_ROUTE_IDS.has(activeRoute.id) ? activeRoute.id : 'learning-hub';
  const desktopSecondaryRoutes = SECONDARY_NAV_ROUTE_IDS.map(getRoute).filter(Boolean);
  const mobilePrimaryRoutes = MOBILE_PRIMARY_NAV_ROUTE_IDS.map(getRoute).filter(Boolean);
  const mobileMoreRoutes = MOBILE_MORE_NAV_ROUTE_IDS.map(getRoute).filter(Boolean);
  const isMoreActive = MOBILE_MORE_NAV_ROUTE_IDS.includes(activeNavRouteId);

  const desktopSectionsHtml = DESKTOP_NAV_SECTIONS.map((section) => {
    const routes = section.routeIds.map(getRoute).filter(Boolean);
    if (!routes.length) return '';
    return `<div class="nav-section">
      <span class="nav-section-label">${escapeText(section.label)}</span>
      ${routes.map((route) => renderNavLink(route, activeNavRouteId)).join('')}
    </div>`;
  }).join('');

  return `<nav class="app-nav" aria-label="Primary navigation">
    <a class="brand-mark" href="${defaultRoute.path}" data-route="${defaultRoute.id}" aria-label="Kahmii's Champions Companion home">
      <span class="brand-emblem" aria-hidden="true">
        <span class="brand-emblem-ring"></span>
        <span class="brand-emblem-core"></span>
      </span>
      <span class="brand-copy">
        <span class="brand-title">Kahmii's Champions</span>
        <span class="brand-subtitle">Companion</span>
      </span>
    </a>

    <div class="nav-list desktop-nav-list">
      ${desktopSectionsHtml}
      <div class="nav-section nav-section-secondary" aria-label="Secondary navigation">
        ${desktopSecondaryRoutes.map((route) => renderNavLink(route, activeNavRouteId, 'nav-link nav-link-secondary')).join('')}
      </div>
    </div>

    <div class="mobile-nav-list" role="menubar" aria-label="Mobile navigation">
      ${mobilePrimaryRoutes.map((route) => renderNavLink(route, activeNavRouteId, 'mobile-nav-link')).join('')}
      <details class="mobile-more" data-mobile-more>
        <summary class="mobile-nav-link mobile-more-button ${isMoreActive ? 'active' : ''}" aria-label="More navigation options" aria-expanded="false">
          <span class="nav-icon" aria-hidden="true">•••</span>
          <span class="nav-label">More</span>
        </summary>
        <div class="mobile-more-sheet" role="menu" aria-label="More navigation options">
          ${mobileMoreRoutes.map((route) => renderNavLink(route, activeNavRouteId, 'mobile-more-row')).join('')}
        </div>
      </details>
    </div>
  </nav>`;
}

export function syncMobileMoreAria(menu) {
  if (!(menu instanceof HTMLDetailsElement)) return;
  const summary = menu.querySelector('.mobile-more-button');
  if (summary) summary.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
}

export function setMobileMoreOpen(menu, open) {
  if (!(menu instanceof HTMLDetailsElement)) return;
  if (open) menu.setAttribute('open', '');
  else menu.removeAttribute('open');
  syncMobileMoreAria(menu);
}

export function closeMobileMoreMenus(root, exceptMenu = null) {
  root.querySelectorAll('[data-mobile-more][open]').forEach((menu) => {
    if (menu !== exceptMenu) setMobileMoreOpen(menu, false);
  });
}

export function bindMobileMoreDocumentGuards(root) {
  if (root.__mobileMoreDocumentGuardsBound) return;
  root.__mobileMoreDocumentGuardsBound = true;

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!root.contains(target) || !target.closest('[data-mobile-more]')) {
      closeMobileMoreMenus(root);
    }
    if (!root.contains(target) || !target.closest('[data-items-filter]')) {
      root.querySelectorAll('.items-filter-trigger[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
      root.querySelectorAll('.items-filter-menu').forEach((panel) => panel.classList.add('force-closed'));
      document.body.classList.remove('dropdown-open-no-page-scroll');
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openItemFilter = root.querySelector('.items-filter-trigger[aria-expanded="true"]');
    if (openItemFilter) {
      event.preventDefault();
      root.querySelectorAll('.items-filter-trigger[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
      root.querySelectorAll('.items-filter-menu').forEach((panel) => panel.classList.add('force-closed'));
      document.body.classList.remove('dropdown-open-no-page-scroll');
      openItemFilter.focus?.({ preventScroll: true });
      return;
    }
    const openMenu = root.querySelector('[data-mobile-more][open]');
    if (!openMenu) return;
    event.preventDefault();
    setMobileMoreOpen(openMenu, false);
    openMenu.querySelector('summary')?.focus?.();
  }, true);
}
