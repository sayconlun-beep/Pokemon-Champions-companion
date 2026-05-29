const SCROLL_CONTAINER_SELECTORS = [
  'main.app-main',
  '.mobile-safe-scroll-page',
  '.metadex-detail-panel',
  '.item-dropdown',
  '.selector-dropdown',
  '[data-selector-options-scroll]',
  '.table-scroll',
  '[data-preserve-scroll]'
];

const STABLE_DATA_ATTRIBUTES = [
  'data-testid',
  'data-selector-search',
  'data-selector-kind',
  'data-slot',
  'data-move-index',
  'data-items-search',
  'data-metadex-search',
  'data-stat-slot',
  'data-stat-key',
  'data-move-slot',
  'data-ability-slot',
  'data-item-slot',
  'data-nature-slot',
  'data-portal-id'
];

export function captureFocusedElementState(root) {
  const active = document.activeElement;
  if (!active || active === document.body || !root.contains(active)) return null;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) return null;

  const selector = getStableSelector(active, root);
  if (!selector) return null;

  return {
    selector,
    value: 'value' in active ? active.value : '',
    selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    scrollTop: active.scrollTop || 0,
    scrollLeft: active.scrollLeft || 0
  };
}

export function restoreFocusedElementState(root, state) {
  if (!state?.selector) return;
  const next = safeQuery(root, state.selector);
  if (!next || !(next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement || next instanceof HTMLSelectElement)) return;

  try { next.focus({ preventScroll: true }); } catch { try { next.focus(); } catch {} }
  next.scrollTop = state.scrollTop || 0;
  next.scrollLeft = state.scrollLeft || 0;

  if (typeof next.setSelectionRange === 'function' && state.selectionStart !== null && state.selectionEnd !== null) {
    const max = String(next.value || '').length;
    const start = Math.max(0, Math.min(max, Number(state.selectionStart) || 0));
    const end = Math.max(start, Math.min(max, Number(state.selectionEnd) || start));
    try { next.setSelectionRange(start, end); } catch {}
  }
}

export function captureScrollState(root) {
  const containers = [];
  const seen = new Set();

  containers.push({ selector: '__window__', scrollTop: window.scrollY || 0, scrollLeft: window.scrollX || 0 });

  SCROLL_CONTAINER_SELECTORS.forEach((containerSelector) => {
    root.querySelectorAll(containerSelector).forEach((element) => {
      if (!(element instanceof HTMLElement) || seen.has(element)) return;
      seen.add(element);
      if (element.scrollTop === 0 && element.scrollLeft === 0 && element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) return;
      const selector = getStableSelector(element, root, containerSelector);
      if (!selector) return;
      containers.push({ selector, scrollTop: element.scrollTop || 0, scrollLeft: element.scrollLeft || 0 });
    });
  });

  return containers;
}

export function restoreScrollState(root, state) {
  if (!Array.isArray(state)) return;
  state.forEach((entry) => {
    if (!entry?.selector) return;
    if (entry.selector === '__window__') {
      try { window.scrollTo(entry.scrollLeft || 0, entry.scrollTop || 0); } catch {}
      return;
    }
    const element = safeQuery(root, entry.selector);
    if (!(element instanceof HTMLElement)) return;
    element.scrollTop = entry.scrollTop || 0;
    element.scrollLeft = entry.scrollLeft || 0;
  });
}

function getStableSelector(element, root, fallbackSelector = '') {
  if (element.id) return `#${cssEscape(element.id)}`;

  const direct = buildAttributeSelector(element);
  if (direct && root.querySelectorAll(direct).length === 1) return direct;

  const parent = element.closest('[data-selector-wrap], [data-portal-id], [data-metadex-search-wrap], .app-main, .app-shell');
  if (parent && parent !== element) {
    const parentSelector = getStableSelector(parent, root);
    const childSelector = direct || fallbackSelector || element.tagName.toLowerCase();
    const combined = `${parentSelector} ${childSelector}`;
    if (root.querySelectorAll(combined).length === 1) return combined;
  }

  if (fallbackSelector && root.querySelectorAll(fallbackSelector).length === 1) return fallbackSelector;
  return getIndexedSelector(element, root, fallbackSelector || element.tagName.toLowerCase());
}

function buildAttributeSelector(element) {
  const parts = [];
  STABLE_DATA_ATTRIBUTES.forEach((attr) => {
    if (element.hasAttribute(attr)) {
      const value = element.getAttribute(attr);
      parts.push(value === '' ? `[${attr}]` : `[${attr}="${cssEscape(value)}"]`);
    }
  });
  if (element.getAttribute('name')) parts.push(`[name="${cssEscape(element.getAttribute('name'))}"]`);
  if (element.getAttribute('aria-label')) parts.push(`[aria-label="${cssEscape(element.getAttribute('aria-label'))}"]`);
  if (!parts.length) return '';
  return `${element.tagName.toLowerCase()}${parts.join('')}`;
}

function getIndexedSelector(element, root, baseSelector) {
  const matches = Array.from(root.querySelectorAll(baseSelector));
  const index = matches.indexOf(element);
  if (index < 0) return '';
  return `${baseSelector}:nth-of-type(${index + 1})`;
}

function safeQuery(root, selector) {
  try { return root.querySelector(selector); } catch { return null; }
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
