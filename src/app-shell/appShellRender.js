import { getRouteOrDefault } from '../ui/routes.js';
import { escapeText } from './appShellText.js';
import { renderNavigation, closeMobileMoreMenus } from './appShellNavigation.js';
import { focusRequestedLearningCard, renderProStudySandboxBanner } from './appShellLayout.js';
import { captureFocusedElementState, restoreFocusedElementState, captureScrollState, restoreScrollState } from './renderStatePreservation.js';

// Wrap route rendering so a single bad render() throw cannot blank the entire
// app. Without this, the previous behaviour was: route throws → innerHTML
// assignment receives the literal string "undefined" or fails partway → user
// sees a black/empty page with no diagnostic. Now we show the error in the
// content area while keeping the nav usable so the user can switch routes.
function renderRouteSafely(activeRoute, state) {
  try {
    const output = activeRoute.render(state);
    if (typeof output !== 'string' || !output.trim()) {
      return renderRouteFallback(activeRoute, new Error(`Route "${activeRoute.id}" render returned ${output === undefined ? 'undefined' : 'empty content'}.`));
    }
    return output;
  } catch (error) {
    return renderRouteFallback(activeRoute, error);
  }
}

function renderRouteFallback(activeRoute, error) {
  const message = error?.stack || error?.message || String(error);
  // The wrapper markup is fixed; only the route id and error message
  // come from data, and both are escaped via escapeText.
  return `<section class="card" role="alert">
    <h2>This page failed to render.</h2>
    <p>Route: <code>${escapeText(activeRoute.id)}</code>. The rest of the app is still usable — try switching routes from the navigation, or hard-refresh (Ctrl/Cmd+Shift+R) to retry.</p>
    <details>
      <summary>Error details</summary>
      <pre style="white-space:pre-wrap;overflow:auto;max-height:40vh;">${escapeText(message)}</pre>
    </details>
  </section>`;
}

export function renderAppShell(root, state, bind) {
  const focusedState = captureFocusedElementState(root);
  const scrollState = captureScrollState(root);
  const activeRoute = getRouteOrDefault(state.route);
  root.innerHTML = `
    <div class="app-shell" data-active-route="${escapeText(activeRoute.id)}">
      ${renderNavigation(activeRoute)}
      <main class="shell app-main mobile-safe-scroll-page" tabindex="-1">${renderProStudySandboxBanner(state)}${renderRouteSafely(activeRoute, state)}</main>
    </div>`;
  bind(root, state);
  closeMobileMoreMenus(root);
  restoreScrollState(root, scrollState);
  restoreFocusedElementState(root, focusedState);
  focusRequestedLearningCard(root, state);
}
