import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'index.html'];
const skippedNames = new Set(['node_modules', 'dist', '.git']);
const skippedExtensions = new Set(['.md']);
const self = relative(root, new URL(import.meta.url).pathname);

// Keep this list small and structural: deleted system identifiers only.
// Do not block ordinary competitive words in user-facing guide copy.
const deletedSystemNeedles = [
  'roles.json',
  'roleTags',
  'old Team Builder',
  'old Analysis Desk'
];

const findings = [];

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index).toLowerCase();
}

function removeJsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function shouldScanFile(path) {
  if (relative(root, path) === self) return false;
  const ext = extensionOf(path);
  if (skippedExtensions.has(ext)) return false;
  return /\.(js|mjs|cjs|json|html|css)$/i.test(path);
}

function scanFile(path) {
  const raw = readFileSync(path, 'utf8');
  const searchable = removeJsComments(raw).toLowerCase();
  const rel = relative(root, path);

  for (const needle of deletedSystemNeedles) {
    const lowerNeedle = needle.toLowerCase();
    const index = searchable.indexOf(lowerNeedle);
    if (index === -1) continue;
    const line = searchable.slice(0, index).split('\n').length;
    findings.push(`${rel}:${line} references deleted legacy system identifier: ${needle}`);
  }
}

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (skippedNames.has(entry)) continue;
      walk(join(path, entry));
    }
    return;
  }
  if (shouldScanFile(path)) scanFile(path);
}

for (const entry of scanRoots) {
  walk(join(root, entry));
}

if (findings.length) {
  console.error('Deleted legacy system guard failed. Remove these active-source references before building:\n');
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('Deleted legacy system guard passed.');
