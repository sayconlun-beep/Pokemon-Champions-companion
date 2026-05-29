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

let ACTIVE_SAFELIST = [];

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

function normaliseSafelistEntry(entry) {
  if (entry instanceof RegExp) return { type: 'regex', value: entry.source };
  return { type: 'literal', value: entry };
}

function selectorMatchesSafelist(selector) {
  const classNames = [...String(selector).matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
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

async function exerciseRoute(page, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(650);

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.locator('.mobile-more-button').first().click({ timeout: 1_000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  const expandableCount = Math.min(await page.locator('button[aria-expanded], summary, .guide-step-button, .accordion-button, .collapse-toggle').count().catch(() => 0), 10);
  for (let index = 0; index < expandableCount; index += 1) {
    const target = page.locator('button[aria-expanded], summary, .guide-step-button, .accordion-button, .collapse-toggle').nth(index);
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: 800 }).catch(() => {});
      await page.waitForTimeout(75);
    }
  }

  const dropdownCount = Math.min(await page.locator('.selector-card-button, button[aria-haspopup], button:has-text("Select"), button:has-text("Choose"), button:has-text("Ability"), button:has-text("Item"), button:has-text("Nature"), button:has-text("Move")').count().catch(() => 0), 8);
  for (let index = 0; index < dropdownCount; index += 1) {
    const target = page.locator('.selector-card-button, button[aria-haspopup], button:has-text("Select"), button:has-text("Choose"), button:has-text("Ability"), button:has-text("Item"), button:has-text("Nature"), button:has-text("Move")').nth(index);
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: 800 }).catch(() => {});
      await page.waitForTimeout(120);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  if (route === '/metadex') {
    const search = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]').first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill('char');
      await page.waitForTimeout(450);
      await search.fill('');
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const session = await page.context().newCDPSession(page);
  const styleSheets = new Map();
  session.on('CSS.styleSheetAdded', ({ header }) => styleSheets.set(header.styleSheetId, header));

  await session.send('DOM.enable');
  await session.send('CSS.enable');
  await session.send('CSS.startRuleUsageTracking');

  const visited = [];
  try {
    for (const route of ROUTES) {
      await exerciseRoute(page, route);
      visited.push(route);
    }
    const usage = await session.send('CSS.stopRuleUsageTracking');
    return { usage: usage.ruleUsage || [], styleSheets, visited };
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
  ACTIVE_SAFELIST = Object.freeze([...STATIC_SAFELIST, ...dynamicPrefixes.map(prefixToRegex)]);
  const rules = findRuleBlocks(css);
  const { usage, styleSheets, visited } = await collectCoverage();

  const styleIds = [...styleSheets.entries()]
    .filter(([, header]) => String(header.sourceURL || '').endsWith('/src/styles.css'))
    .map(([id]) => id);

  const usedRanges = usage
    .filter((rule) => styleIds.includes(rule.styleSheetId) && rule.used)
    .map((rule) => ({ startOffset: rule.startOffset, endOffset: rule.endOffset }));

  const candidateRules = rules.filter((rule) => {
    if (selectorMatchesSafelist(rule.selector)) return false;
    return !usedRanges.some((range) => overlaps(rule.start, rule.end, range.startOffset, range.endOffset));
  });

  const keptBySafelist = rules.filter((rule) => selectorMatchesSafelist(rule.selector));
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
  await writeFile(`${REPORT_DIR}/runtime-css-safelist.json`, JSON.stringify(ACTIVE_SAFELIST.map(normaliseSafelistEntry), null, 2));

  const markdown = `# Runtime CSS purge report\n\nGenerated: ${report.generatedAt}\n\nMode: report-only${PREVIEW_ENABLED ? ' + dist preview' : ''}\n\nRoutes exercised:\n\n${visited.map((route) => `- ${route}`).join('\n')}\n\n## Candidate removal summary\n\n- Total CSS: ${(report.totalCssBytes / 1024).toFixed(2)} KB\n- Total parsed top-level rules: ${report.totalRules}\n- Used rule ranges from Chrome: ${report.usedRuleRanges}\n- Rules protected by safelist: ${report.keptBySafelistCount}\n- Candidate removable rules: ${report.candidateRemoval.rules}\n- Candidate removable size: ${report.candidateRemoval.kb} KB (${report.candidateRemoval.percentOfCss}%)\n\n## Safelist\n\nSee \`runtime-css-safelist.json\`.\n\n## Candidate list\n\nSee \`runtime-css-candidates.txt\`.\n`;
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
