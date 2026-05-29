import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const srcRoot = join(root, 'src');
const skippedDirs = new Set(['node_modules', 'dist', '.git']);
const sourceExtensions = ['.js', '.mjs'];
const importPattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const violations = [];
const checkedEdges = [];

const rules = [
  {
    from: 'src/core/',
    blocked: ['src/pages/', 'src/ui/', 'src/app-shell/', 'src/components/'],
    reason: 'core must stay UI-free and framework-free.'
  },
  {
    from: 'src/utils/',
    blocked: ['src/pages/', 'src/ui/', 'src/app-shell/', 'src/components/'],
    reason: 'utils must not depend on rendering/UI layers.'
  },
  {
    from: 'src/logic/',
    blocked: ['src/pages/', 'src/ui/', 'src/app-shell/', 'src/components/'],
    reason: 'logic must not depend on rendering/UI layers.'
  }
];

function toPosix(path) {
  return path.split(sep).join('/');
}

function rel(path) {
  return toPosix(relative(root, path));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (skippedDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (sourceExtensions.includes(extname(path))) files.push(path);
  }
  return files;
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;

  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    join(base, 'index.js'),
    join(base, 'index.mjs')
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return normalize(candidate);
  }

  return normalize(base);
}

function toKebab(value) {
  return value
    .replace(/Page$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function pageFeature(path) {
  const normalized = toPosix(path);
  const prefix = 'src/pages/';
  if (!normalized.startsWith(prefix)) return '';
  const remainder = normalized.slice(prefix.length);
  const [first] = remainder.split('/');
  if (remainder.includes('/')) return first.toLowerCase().replace(/-/g, '');
  return toKebab(first.replace(/\.(m?js)$/, '')).replace(/-/g, '');
}

function checkPageInternalBoundary(fromRel, toRel, specifier) {
  if (!fromRel.startsWith('src/pages/') || !toRel.startsWith('src/pages/')) return;
  const fromFeature = pageFeature(fromRel);
  const toFeature = pageFeature(toRel);
  if (!fromFeature || !toFeature || fromFeature === toFeature) return;

  violations.push({
    from: fromRel,
    to: toRel,
    specifier,
    reason: `pages may not import another page feature's internals (${fromFeature} -> ${toFeature}). Use core/logic/utils/components for shared code.`
  });
}

function checkLayerRules(fromRel, toRel, specifier) {
  for (const rule of rules) {
    if (!fromRel.startsWith(rule.from)) continue;
    const blocked = rule.blocked.find((prefix) => toRel.startsWith(prefix));
    if (!blocked) continue;
    violations.push({ from: fromRel, to: toRel, specifier, reason: rule.reason });
  }
}

for (const file of walk(srcRoot)) {
  const source = readFileSync(file, 'utf8');
  const fromRel = rel(file);
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] || match[2];
    const target = resolveImport(file, specifier);
    if (!target || !target.startsWith(srcRoot)) continue;
    const toRel = rel(target);
    checkedEdges.push(`${fromRel} -> ${toRel}`);
    checkLayerRules(fromRel, toRel, specifier);
    checkPageInternalBoundary(fromRel, toRel, specifier);
  }
}

if (violations.length) {
  console.error('Architecture boundary check failed. Import direction violations found:\n');
  for (const violation of violations) {
    console.error(`- ${violation.from}`);
    console.error(`  imports ${violation.to} via ${JSON.stringify(violation.specifier)}`);
    console.error(`  ${violation.reason}\n`);
  }
  process.exit(1);
}

console.log(`Architecture boundary check passed (${checkedEdges.length} local import edge(s) checked).`);
