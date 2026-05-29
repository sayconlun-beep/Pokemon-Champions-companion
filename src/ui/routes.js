import { TeamBuilderPage } from '../pages/TeamBuilderPage.js';
import { TeamBuildingGuidePage } from '../pages/TeamBuildingGuidePage.js';
import { AnalysisDeskPage } from '../pages/AnalysisDeskPage.js';
import { MatchupsPage } from '../pages/MatchupsPage.js';
import { DamagePage } from '../pages/DamagePage.js';
import { MetaDexPage } from '../pages/MetaDexPage.js';
import { ItemsPage } from '../pages/ItemsPage.js';
import { LearningHubPage } from '../pages/LearningHubPage.js';
import { ImportExportPage } from '../pages/ImportExportPage.js';
import { DataQualityPage } from '../pages/DataQualityPage.js';

export const DEFAULT_ROUTE_ID = 'team-builder';
export const DEFAULT_ROUTE_PATH = '/team-builder';

export const routes = [
  { id: 'team-builder', path: '/team-builder', label: 'Team Builder', shortLabel: 'Builder', icon: '⚔️', render: TeamBuilderPage },
  { id: 'team-building-guide', path: '/team-building-guide', label: 'Team Building Guide', shortLabel: 'Guide', icon: '📖', render: TeamBuildingGuidePage },
  { id: 'analysis-desk', path: '/analysis-desk', label: 'Analysis Desk', shortLabel: 'Analysis', icon: '📊', render: AnalysisDeskPage },
  { id: 'matchups', path: '/matchups', label: 'Matchups', shortLabel: 'Matchups', icon: '🎯', render: MatchupsPage },
  { id: 'damage', path: '/damage', label: 'Damage', shortLabel: 'Damage', icon: '💥', render: DamagePage },
  { id: 'metadex', path: '/metadex', label: 'MetaDex', shortLabel: 'MetaDex', icon: '🔎', render: MetaDexPage },
  { id: 'items', path: '/items', label: 'Items', shortLabel: 'Items', icon: '🎒', render: ItemsPage },
  { id: 'learning-hub', path: '/learning-hub', label: 'Learning Hub', shortLabel: 'Learn', icon: '📚', render: LearningHubPage },
  { id: 'import-export', path: '/import-export', label: 'Import/Export', shortLabel: 'Import', icon: '⇄', render: ImportExportPage },
  { id: 'data-quality', path: '/data-quality', label: 'Data Quality', shortLabel: 'Quality', icon: '📈', render: DataQualityPage }
];

export const defaultRoute = routes.find((route) => route.id === DEFAULT_ROUTE_ID) || routes[0];

export function getRoute(routeId) {
  return routes.find((route) => route.id === routeId) || null;
}

export function getRouteOrDefault(routeId) {
  return getRoute(routeId) || defaultRoute;
}

export function routeFromPath(pathname = '/') {
  const clean = normalisePath(pathname);
  return routes.find((route) => route.path === clean) || null;
}

export function safeRouteFromLocation(location = window.location) {
  return routeFromPath(location.pathname) || defaultRoute;
}

export function isKnownRoutePath(pathname = '/') {
  return Boolean(routeFromPath(pathname));
}

export function normalisePath(pathname = '/') {
  const pathOnly = String(pathname || '/').split(/[?#]/)[0];
  const path = pathOnly.replace(/\/+$/, '') || '/';
  return path === '/' ? DEFAULT_ROUTE_PATH : path;
}
