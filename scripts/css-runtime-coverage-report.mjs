import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, relative } from 'node:path';

const ROUTES = Object.freeze([
  '/',
  '/team-builder',
  '/team-building-guide',
  '/analysis-desk',
  '/matchups',
  '/damage',
  '/metadex',
  '/items',
  '/learning-hub',
  '/import-export',
  '/data-quality'
]);

const REPORT_DIR = 'reports/css-purge';
const SOURCE_CSS = 'src/styles.css';
const DIST_CSS = 'dist/src/styles.css';
const PREVIEW_ENABLED = process.env.CSS_PURGE_PREVIEW === '1' || process.argv.includes('--preview');
const PORT = Number(process.env.CSS_PURGE_PORT || 4183);
const BASE_URL = process.env.CSS_PURGE_BASE_URL || `http://localhost:${PORT}`;
const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1366, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
]);

let ACTIVE_SAFELIST = [];

const TRANSIENT_WATCHLIST_PATTERNS = Object.freeze([
  'direct-move-picker',
  'direct-item-picker',
  'direct-pokemon-picker',
  'compact-move-picker-open',
  'compact-move-picker-portal-open',
  'metadex-detail',
  'mobile-more',
]);

const STATIC_SAFELIST = Object.freeze([
  'active',
  'selected',
  'disabled',
  'hidden',
  'open',
  'expanded',
  'collapsed',
  'invalid',
  'valid',
  'focused',
  'loading',
  'warning',
  'danger',
  'positive',
  'negative',
  'neutral',
  'muted',
  /^type-/,
  /^role-/,
  /^route-/,
  /^tier-/,
  /^rank-/,
  /^score-/,
  /^risk-/,
  /^tag-/,
  /^mode-/,
  /^status-/,
  /^state-/,
  /^slot-/,
  /^team-/,
  /^pokemon-/,
  /^ability-/,
  /^item-/,
  /^move-/,
  /^nature-/,
  /^weather-/,
  /^terrain-/,
  /^archetype-/,
  /^coverage-/,
  /^synergy-/,
  /^matchup-/,
  /^threat-/,
  /^pressure-/,
  /^metadex-/,
  /^analysis-/,
  /^guide-/,
  /^mobile-/,
  /^desktop-/,
  /^selector-/,
  /^dropdown-/,
  /^badge-/,
  /^chip-/,
  /^pill-/,
  /^card-/,
  /^panel-/,
  /^section-/,
  /^nav-/,
  /^app-/,
  /^shell-/,
  /^stat-/,
  /^sp-/,
  /^ev-/,
  /^mega-/,
  /^legend-/,
  /^common-/,
  /^pro-/,
  /^learning-/,
  /^data-/,
  /^quality-/,
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0] || '/');
  const clean = normalize(decoded).replace(/^([.][.][/\\])+/, '');
  return join(root, clean);
}

async function startServer() {
  const root = join(process.cwd(), 'dist');
  const server = createServer(async (req, res) => {
    try {
      let file = safePath(root, req.url || '/');
      if (existsSync(file)) {
        const fs = await import('node:fs/promises');
        const info = await fs.stat(file);
        if (info.isDirectory()) file = join(file, 'index.html');
      }
      if (!existsSync(file)) {
        const hasExtension = Boolean(extname((req.url || '').split('?')[0] || ''));
        file = hasExtension ? '' : join(root, 'index.html');
      }
      if (!file || !existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'Server error');
    }
  });

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  return server;
}

async function collectInterpolatedPrefixes(dir = 'src', prefixes = new Set()) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectInterpolatedPrefixes(path, prefixes);
      continue;
    }
    if (!/\.(?:js|mjs|jsx|html)$/i.test(entry.name)) continue;
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(/([a-z][a-z0-9-]+)-\$\{/gi)) prefixes.add(match[1]);
  }
  return [...prefixes].sort();
}

function prefixToRegex(prefix) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}-`);
}

function containsTokenToRegex(token) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped);
}

function normaliseSafelistEntry(entry) {
  if (entry instanceof RegExp) return { type: 'regex', value: entry.source };
  return { type: 'literal', value: entry };
}

function extractClassNames(selector) {
  return [...String(selector).matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
}

function selectorMatchesSafelist(selector) {
  const selectorText = String(selector);
  if (TRANSIENT_WATCHLIST_PATTERNS.some((pattern) => selectorText.includes(pattern))) return true;

  const classNames = extractClassNames(selector);
  return classNames.some((className) => ACTIVE_SAFELIST.some((entry) => {
    if (entry instanceof RegExp) return entry.test(className);
    return entry === className;
  }));
}

function findRuleBlocks(css) {
  const rules = [];
  let selectorStart = 0;
  let depth = 0;
  let blockStart = -1;
  let quote = '';
  let inComment = false;

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') {
      if (depth === 0) blockStart = i;
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        const selector = css.slice(selectorStart, blockStart).trim();
        const start = selectorStart;
        const end = i + 1;
        if (selector && !selector.startsWith('@keyframes') && !selector.startsWith('@font-face')) {
          rules.push({ selector, start, end, bytes: end - start });
        }
        selectorStart = i + 1;
        blockStart = -1;
      }
    }
  }
  return rules;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const TRANSIENT_DROPDOWN_TRIGGER_SELECTOR = [
  '.selector-card-button',
  '[data-testid*="selector" i]',
  'button[aria-haspopup]',
  'button:has-text("Select")',
  'button:has-text("Choose")',
  'button:has-text("Ability")',
  'button:has-text("Item")',
  'button:has-text("Nature")',
  'button:has-text("Move")',
].join(', ');

const TRANSIENT_EXPANDABLE_SELECTOR = [
  'button[aria-expanded]',
  'summary',
  '.guide-step-button',
  '.accordion-button',
  '.collapse-toggle',
  '.scenario-option summary',
].join(', ');

async function maybeClick(page, selector, options = {}) {
  const target = typeof selector === 'string' ? page.locator(selector).first() : selector;
  if (!(await target.count().catch(() => 0))) return false;
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: options.timeout || 1_500, force: Boolean(options.force) }).catch(() => {});
  await page.waitForTimeout(options.wait ?? 160);
  return true;
}

async function maybeFill(page, selector, value, options = {}) {
  const target = typeof selector === 'string' ? page.locator(selector).first() : selector;
  if (!(await target.count().catch(() => 0))) return false;
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.fill(value, { timeout: options.timeout || 1_500 }).catch(() => {});
  await page.waitForTimeout(options.wait ?? 220);
  return true;
}

async function closeTransientSurface(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(6, 6).catch(() => {});
  await page.waitForTimeout(80);
}

async function exerciseGenericTransientStates(page) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  // Mobile bottom-sheet / More menu. Keep it open briefly so the open-state
  // selectors are recorded by Chrome coverage before closing it again.
  await maybeClick(page, '.mobile-more-button', { wait: 220 });
  await closeTransientSurface(page);

  const expandableCount = Math.min(await page.locator(TRANSIENT_EXPANDABLE_SELECTOR).count().catch(() => 0), 14);
  for (let index = 0; index < expandableCount; index += 1) {
    const target = page.locator(TRANSIENT_EXPANDABLE_SELECTOR).nth(index);
    if (await target.isVisible().catch(() => false)) {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click({ timeout: 900 }).catch(() => {});
      await page.waitForTimeout(90);
    }
  }

  const dropdownCount = Math.min(await page.locator(TRANSIENT_DROPDOWN_TRIGGER_SELECTOR).count().catch(() => 0), 12);
  for (let index = 0; index < dropdownCount; index += 1) {
    const target = page.locator(TRANSIENT_DROPDOWN_TRIGGER_SELECTOR).nth(index);
    if (await target.isVisible().catch(() => false)) {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click({ timeout: 900 }).catch(() => {});
      await page.waitForTimeout(140);
      await maybeFill(page, '#dropdown-portal input[type="search"], .selector-dropdown input[type="search"], [role="listbox"] input[type="search"]', 'a', { wait: 120 });
      await closeTransientSurface(page);
    }
  }
}

async function exerciseTeamBuilderTransientSurfaces(page) {
  await page.goto(`${BASE_URL}/team-builder`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // Direct Pokémon picker: open it, type in search, and select a result so the
  // slot workbench, type badges, move/item buttons, and downstream controls exist.
  await maybeClick(page, 'button.slot-pokemon-picker-card[data-selector-focus="pokemon"]', { wait: 250 });
  await maybeFill(page, '.direct-pokemon-picker-overlay .direct-pokemon-picker-search', 'char', { wait: 300 });
  await maybeClick(page, '.direct-pokemon-picker-overlay .direct-pokemon-picker-option', { wait: 550 });

  // Expand the active slot/workbench if the selected card collapsed after render.
  await maybeClick(page, '.team-slot-card button[aria-expanded="false"], .team-slot-card summary, .slot-expand-toggle', { wait: 180 });

  // Direct item picker: open it, type in search, and let recommendation / badge
  // rows render without selecting anything.
  await maybeClick(page, '[data-selector-focus="item"][data-slot="0"], button:has-text("+ Choose Item"), button:has-text("Change item")', { wait: 250 });
  await maybeFill(page, '.direct-item-picker-overlay .direct-item-picker-search', 'left', { wait: 300 });
  await closeTransientSurface(page);

  // Direct move picker: open it, type in search, and let filtered options render.
  await maybeClick(page, '[data-selector-focus="move"][data-slot="0"], button:has-text("+ Add Move"), .compact-move-hitbox', { wait: 250 });
  await maybeFill(page, '.direct-move-picker-overlay .direct-move-picker-search', 'protect', { wait: 300 });
  await closeTransientSurface(page);

  await exerciseGenericTransientStates(page);
}

async function exerciseMetadexTransientSurfaces(page) {
  await page.goto(`${BASE_URL}/metadex`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await maybeFill(page, '[data-metadex-search], input[aria-label="Search Pokémon"]', 'char', { wait: 450 });
  await maybeClick(page, '[data-metadex-card], [data-action="select-metadex-pokemon"], [data-metadex-select]', { wait: 500 });
  await page.locator('[data-metadex-detail-overlay], .metadex-detail-overlay, .metadex-detail-overlay-panel').first().waitFor({ state: 'visible', timeout: 1_500 }).catch(() => {});
  await page.mouse.wheel(0, 500).catch(() => {});
  await page.waitForTimeout(220);
  await closeTransientSurface(page);
}

async function exerciseAnalysisDeskTransientSurfaces(page) {
  await page.goto(`${BASE_URL}/analysis-desk`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await exerciseGenericTransientStates(page);
  await page.locator('details:not([open]) summary, .analysis-desk-page button[aria-expanded="false"], .analysis-page button[aria-expanded="false"]').first().click({ timeout: 900 }).catch(() => {});
  await page.waitForTimeout(180);
}

async function exerciseRoute(page, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(650);

  await exerciseGenericTransientStates(page);

  if (route === '/team-builder') await exerciseTeamBuilderTransientSurfaces(page);
  if (route === '/analysis-desk') await exerciseAnalysisDeskTransientSurfaces(page);
  if (route === '/metadex') await exerciseMetadexTransientSurfaces(page);

  const searches = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]');
  const searchCount = Math.min(await searches.count().catch(() => 0), 8);
  for (let index = 0; index < searchCount; index += 1) {
    const search = searches.nth(index);
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => {});
      await search.fill('test', { timeout: 1_000 }).catch(() => {});
      await page.waitForTimeout(120);
      await search.fill('', { timeout: 1_000 }).catch(() => {});
    }
  }

  await page.mouse.wheel(0, 900).catch(() => {});
  await page.waitForTimeout(250);
}

async function collectCoverage() {
  const { chromium } = await import('@playwright/test').catch((error) => {
    throw new Error(`Playwright is required for runtime CSS coverage. Run npm install / npx playwright install first. ${error.message}`);
  });
  if (!existsSync('dist/index.html')) {
    throw new Error('dist/ missing. Run npm run build before css runtime coverage.');
  }

  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const visited = [];
  const allUsage = [];
  const styleSheets = new Map();

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
      });
      const page = await context.newPage();
      const session = await page.context().newCDPSession(page);
      session.on('CSS.styleSheetAdded', ({ header }) => styleSheets.set(header.styleSheetId, header));

      await session.send('DOM.enable');
      await session.send('CSS.enable');
      await session.send('CSS.startRuleUsageTracking');

      for (const route of ROUTES) {
        await exerciseRoute(page, route);
        visited.push(`${viewport.name}:${route}`);
      }

      const usage = await session.send('CSS.stopRuleUsageTracking');
      allUsage.push(...(usage.ruleUsage || []));
      await context.close().catch(() => {});
    }

    return { usage: allUsage, styleSheets, visited };
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

function mergeRanges(ranges) {
  const sorted = ranges.slice().sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.startOffset > last.endOffset) merged.push({ ...range });
    else last.endOffset = Math.max(last.endOffset, range.endOffset);
  }
  return merged;
}

function removeRanges(css, ranges) {
  const merged = mergeRanges(ranges);
  let cursor = 0;
  let output = '';
  for (const range of merged) {
    output += css.slice(cursor, range.start);
    output += `\n/* CSS purge preview removed ${range.end - range.start} bytes: ${range.selector.replace(/\s+/g, ' ').slice(0, 160)} */\n`;
    cursor = range.end;
  }
  output += css.slice(cursor);
  return output;
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const css = await readFile(SOURCE_CSS, 'utf8');
  const dynamicPrefixes = await collectInterpolatedPrefixes();
  ACTIVE_SAFELIST = Object.freeze([...STATIC_SAFELIST, ...TRANSIENT_WATCHLIST_PATTERNS.map(containsTokenToRegex), ...dynamicPrefixes.map(prefixToRegex)]);
  const rules = findRuleBlocks(css);
  const { usage, styleSheets, visited } = await collectCoverage();

  const styleIds = [...styleSheets.entries()]
    .filter(([, header]) => String(header.sourceURL || '').endsWith('/src/styles.css'))
    .map(([id]) => id);

  const usedRanges = usage
    .filter((rule) => styleIds.includes(rule.styleSheetId) && rule.used)
    .map((rule) => ({ startOffset: rule.startOffset, endOffset: rule.endOffset }));

  const ruleWasUsed = (rule) => usedRanges.some((range) => overlaps(rule.start, rule.end, range.startOffset, range.endOffset));
  const candidateRules = rules.filter((rule) => {
    if (selectorMatchesSafelist(rule.selector)) return false;
    return !ruleWasUsed(rule);
  });

  const usedRules = rules.filter(ruleWasUsed);
  const keptBySafelist = rules.filter((rule) => selectorMatchesSafelist(rule.selector));
  const runtimeUsedClasses = [...new Set(usedRules.flatMap((rule) => extractClassNames(rule.selector)))].sort();
  const candidateSelectorsText = candidateRules.map((rule) => rule.selector).join('\n');
  const transientWatchlist = TRANSIENT_WATCHLIST_PATTERNS.map((pattern) => ({
    pattern,
    inCandidateList: candidateSelectorsText.includes(pattern),
    matchedRuntimeUsedClasses: runtimeUsedClasses.filter((className) => className.includes(pattern)).slice(0, 40),
  }));
  const candidateBytes = candidateRules.reduce((sum, rule) => sum + rule.bytes, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'report-only',
    previewWritten: PREVIEW_ENABLED,
    routesVisited: visited,
    sourceCss: SOURCE_CSS,
    distCss: DIST_CSS,
    totalCssBytes: Buffer.byteLength(css),
    totalRules: rules.length,
    usedRuleRanges: usedRanges.length,
    safelist: ACTIVE_SAFELIST.map(normaliseSafelistEntry),
    runtimeUsedClasses,
    transientWatchlist,
    interpolatedPrefixes: dynamicPrefixes.map((prefix) => `${prefix}-`),
    keptBySafelistCount: keptBySafelist.length,
    candidateRemoval: {
      rules: candidateRules.length,
      bytes: candidateBytes,
      kb: Number((candidateBytes / 1024).toFixed(2)),
      percentOfCss: Number(((candidateBytes / Math.max(Buffer.byteLength(css), 1)) * 100).toFixed(2)),
    },
    candidates: candidateRules.map((rule) => ({
      selector: rule.selector.replace(/\s+/g, ' ').slice(0, 240),
      start: rule.start,
      end: rule.end,
      bytes: rule.bytes,
    })),
  };

  await writeFile(`${REPORT_DIR}/runtime-css-coverage-report.json`, JSON.stringify(report, null, 2));
  await writeFile(`${REPORT_DIR}/runtime-css-candidates.txt`, candidateRules.map((rule) => `${rule.bytes} bytes :: ${rule.selector.replace(/\s+/g, ' ').slice(0, 240)}`).join('\n') + '\n');
  await writeFile(`${REPORT_DIR}/runtime-css-safelist.json`, JSON.stringify({
    activeSafelist: ACTIVE_SAFELIST.map(normaliseSafelistEntry),
    runtimeUsedClasses,
    transientWatchlist,
  }, null, 2));

  const markdown = `# Runtime CSS purge report

Generated: ${report.generatedAt}

Mode: report-only${PREVIEW_ENABLED ? ' + dist preview' : ''}

Routes exercised:

${visited.map((route) => `- ${route}`).join('\n')}

## Candidate removal summary

- Total CSS: ${(report.totalCssBytes / 1024).toFixed(2)} KB
- Total parsed top-level rules: ${report.totalRules}
- Used rule ranges from Chrome: ${report.usedRuleRanges}
- Rules protected by static/dynamic safelist: ${report.keptBySafelistCount}
- Runtime-used classes recorded: ${report.runtimeUsedClasses.length}
- Candidate removable rules: ${report.candidateRemoval.rules}
- Candidate removable size: ${report.candidateRemoval.kb} KB (${report.candidateRemoval.percentOfCss}%)

## Transient watchlist

${transientWatchlist.map((entry) => `- ${entry.pattern}: ${entry.inCandidateList ? 'STILL IN CANDIDATES' : 'not in candidates'}; runtime used classes: ${entry.matchedRuntimeUsedClasses.length ? entry.matchedRuntimeUsedClasses.join(', ') : 'none recorded'}`).join('\n')}

## Safelist / runtime-used class report

See \`runtime-css-safelist.json\`.

## Candidate list

See \`runtime-css-candidates.txt\`.
`;
  await writeFile(`${REPORT_DIR}/runtime-css-coverage-report.md`, markdown);

  if (PREVIEW_ENABLED) {
    const previewCss = removeRanges(css, candidateRules);
    await writeFile(DIST_CSS, previewCss);
    await writeFile(`${REPORT_DIR}/purged-preview-styles.css`, previewCss);
  }

  console.log(`Runtime CSS purge report written to ${REPORT_DIR}/runtime-css-coverage-report.md`);
  console.log(`Candidate removable: ${report.candidateRemoval.kb} KB across ${report.candidateRemoval.rules} rule(s).`);
  if (PREVIEW_ENABLED) console.log(`Preview CSS written to ${DIST_CSS}; source ${SOURCE_CSS} was not modified.`);
}

main().catch((error) => {
  if (String(error?.message || error).includes('@playwright/test')) {
    console.error('CSS runtime coverage requires Playwright. Install project dev dependencies, then run this script again.');
  }
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
