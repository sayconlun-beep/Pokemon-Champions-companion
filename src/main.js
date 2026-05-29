// Hardened launch — always surface a visible error rather than a blank page.
//
// Three failure modes the previous version did not handle:
//   1. The dynamic import itself fails (404 on AppShell.js / a chained module).
//      The catch on mountApp() never fires because the import never resolved.
//   2. A top-level throw in any loaded module. Browsers surface this only to
//      the console; the user sees an empty <div id="app">.
//   3. Stale browser cache running an older AppShell.js against the current data
//      layout. A stale data request can 404, mountApp rejects, we catch — but
//      only if the cached main.js itself isn't stale.
//
// We wire three diagnostic surfaces so that whatever fails first, the user
// gets a visible message instead of staring at a blank screen.

const root = document.querySelector('#app');

// Track whether we are still in the bootstrap phase. The two global error
// listeners only take over the page during bootstrap; once the real app has
// mounted, normal error handling runs (errors go to the console; the app
// keeps running). Without this flag, a late-fire async error from any page
// could nuke the running app and replace it with the fatal error card.
let bootstrapInProgress = true;

function showFatal(error, kind = 'launch') {
  if (!root) return;
  const message = error?.stack || error?.message || String(error);
  // Use textContent for the stack so script-like text in error messages
  // cannot inject HTML. The wrapper markup is fixed and safe.
  const wrap = document.createElement('main');
  wrap.className = 'shell';
  const card = document.createElement('section');
  card.className = 'card';
  const h1 = document.createElement('h1');
  h1.textContent = kind === 'launch' ? 'App failed to launch' : 'App crashed';
  const intro = document.createElement('p');
  intro.textContent = 'A hard refresh (Ctrl+Shift+R, or Cmd+Shift+R on macOS) usually fixes this, especially right after a deploy. If the error persists, copy the message below and file an issue.';
  const pre = document.createElement('pre');
  pre.textContent = message;
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.overflow = 'auto';
  pre.style.maxHeight = '40vh';
  card.append(h1, intro, pre);
  wrap.append(card);
  root.replaceChildren(wrap);
}

// Catch global errors that happen OUTSIDE any promise chain. These are
// usually sync throws during module initialisation or callbacks fired later
// (event handlers, requestAnimationFrame, etc.). Without this listener they
// would land in the console only.
window.addEventListener('error', (event) => {
  if (!bootstrapInProgress) return;
  showFatal(event.error || event.message || 'Unknown error', 'launch');
});

window.addEventListener('unhandledrejection', (event) => {
  if (!bootstrapInProgress) return;
  showFatal(event.reason || 'Unhandled promise rejection', 'launch');
});

// Show a holding message instantly so a slow dynamic import never looks
// like a blank screen. AppShell.mountApp() will replace this once data loads.
// Also cancel the index.html bootstrap timer so its "did not start" warning
// does not fire while we are actually starting.
if (typeof window !== 'undefined' && window.__appLaunchTimer) {
  clearTimeout(window.__appLaunchTimer);
  window.__appLaunchTimer = null;
}
if (root) {
  root.innerHTML = '<main class="shell"><section class="card"><h1>Starting Pokémon Champions team builder…</h1><p>Loading core data.</p></section></main>';
}

try {
  const { mountApp } = await import('./ui/AppShell.js');
  await mountApp(root);
  // Bootstrap succeeded. Stop intercepting errors so the running app handles
  // its own async errors normally instead of being replaced by our fatal card.
  bootstrapInProgress = false;
} catch (error) {
  showFatal(error, 'launch');
}
