export function createAppShellRouteHandlers(deps) {
  const {
    getRoute,
    routeFromPath,
    closeMobileMoreMenus,
    closeAllOpenSelectors,
    buildMetadexContextFromLink,
    applyMetadexContextToView,
    getDelegatedState,
    render
  } = deps;

  function resolveRouteFromLink(routeLink) {
    if (!routeLink) return null;
    const rawRoute = String(routeLink.dataset?.route || '').trim();
    const aliases = {
      builder: 'team-builder',
      teamBuilder: 'team-builder',
      TeamBuilder: 'team-builder',
      team_builder: 'team-builder',
      guide: 'team-building-guide',
      teamGuide: 'team-building-guide',
      team_building_guide: 'team-building-guide',
      analysis: 'analysis-desk',
      analysisDesk: 'analysis-desk',
      meta: 'metadex',
      metaDex: 'metadex',
      MetaDex: 'metadex',
      pokedex: 'metadex'
    };
    let route = getRoute(rawRoute) || getRoute(aliases[rawRoute]);
    if (!route) {
      const href = routeLink.getAttribute?.('href') || '';
      try {
        const url = new URL(href, window.location.origin);
        route = routeFromPath(url.pathname);
      } catch {
        route = routeFromPath(href);
      }
    }
    return route;
  }

  function findRouteLinkFromTarget(root, target) {
    if (!(target instanceof Element)) return null;
    const candidate = target.closest('[data-route], a[href]');
    if (!candidate || !root.contains(candidate)) return null;
    return resolveRouteFromLink(candidate) ? candidate : null;
  }


  function navigateToRoute(root, state, routeLink) {
    const route = resolveRouteFromLink(routeLink);
    if (!route) return false;
    closeMobileMoreMenus(root);
    closeAllOpenSelectors(root);
    state.route = route.id;
    if (route.id === 'items') {
      state.items ||= { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' };
      const itemId = routeLink.dataset.itemId || routeLink.dataset.itemDetail || '';
      if (itemId) {
        state.items.selectedId = itemId;
        state.items.search = '';
      }
    }
    if (route.id === 'metadex') {
      const context = buildMetadexContextFromLink(routeLink, state);
      if (context) {
        applyMetadexContextToView(state, context);
      }
    }
    const href = routeLink.getAttribute('href') || route.path;
    const navigationPath = href.startsWith(route.path) ? href : route.path;
    window.history.pushState({ routeId: route.id }, '', navigationPath);
    render(root, state);
    root.querySelector('.app-main')?.focus({ preventScroll: true });
    const scrollSlot = routeLink.dataset?.scrollSlot;
    if (route.id === 'team-builder' && scrollSlot !== undefined) {
      window.requestAnimationFrame?.(() => {
        const targetSlot = root.querySelector(`[data-slot-card="${scrollSlot}"]`);
        targetSlot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return true;
  }

  function handleDelegatedRouteClick(root, event) {
    const state = getDelegatedState(root);
    const target = event.target;
    if (!(target instanceof Element)) return;
    const routeLink = findRouteLinkFromTarget(root, target);
    if (!routeLink) return;
    // Only intercept links that resolve to a real app route. This keeps internal
    // Learning Hub article links working without trapping invalid or stale
    // data-route values from old builds.
    const route = resolveRouteFromLink(routeLink);
    if (!route) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      navigateToRoute(root, state, routeLink);
    } catch (error) {
      console.error('App navigation failed; falling back to normal route load.', error);
      const href = routeLink.getAttribute('href') || route.path;
      window.location.assign(href.startsWith('/') ? href : route.path);
    }
  }

  return { resolveRouteFromLink, findRouteLinkFromTarget, navigateToRoute, handleDelegatedRouteClick };
}
