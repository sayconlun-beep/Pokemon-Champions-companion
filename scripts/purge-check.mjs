import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', 'dist', '.git']);
const skipExtensions = new Set(['.md']);
const encodedNeedles = [
  'dG9wb2xvZ3k=',
  'dGFjdGljYWwgaW5mZXJlbmNl',
  'cHJlc3N1cmUgbWF0cml4',
  'dnVsbmVyYWJpbGl0eSBpbmRleA==',
  'Y29vcmRpbmF0aW9uIGVuZ2luZQ==',
  'c3ludGhlc2lzIGZhaWxlZA==',
  'cmVuZGVyZXIgdmFsaWRhdGlvbg==',
  'bWF0Y2h1cCBjb21wcmVzc2lvbg==',
  'dmFsaWRhdGlvbiBmYWlsZWQ=',
  'c2VudGVuY2UgcmVjb25zdHJ1Y3Rpb24gZmFpbGVk'
];
const needles = encodedNeedles.map((value) => Buffer.from(value, 'base64').toString('utf8').toLowerCase());
const findings = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (!skipExtensions.has(entry.slice(entry.lastIndexOf('.')).toLowerCase()) && /\.(js|mjs|json|html|css)$/i.test(entry)) {
      const text = readFileSync(path, 'utf8').toLowerCase();
      for (const needle of needles) {
        if (text.includes(needle)) findings.push(`${path.replace(root, '')}: ${needle}`);
      }
    }
  }
}
walk(root);
if (findings.length) {
  console.error('Sanitisation check failed:\n' + findings.join('\n'));
  process.exit(1);
}
console.log('Sanitisation check passed.');
