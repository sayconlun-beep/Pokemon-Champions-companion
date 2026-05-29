import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'src';
const REPORT_DIR = 'reports/css-purge';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

const TEMPLATE_CLASS_PATTERN = /(class(?:Name)?\s*=\s*[`"'][^\n]*\$\{|classList\.(?:add|remove|toggle)\(|\.className\s*=|\$\{[^\n]{0,120}(?:active|selected|prefix|class|status|tier|type|route|mode|risk|score|slot|team)[^\n]{0,120}\})/i;
const PREFIX_PATTERN = /([a-z][a-z0-9-]+)-\$\{/gi;

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (/\.(?:js|mjs|jsx|html)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const files = await walk(ROOT);
  const findings = [];
  const prefixes = new Set();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (TEMPLATE_CLASS_PATTERN.test(line)) {
        findings.push({ file: relative(process.cwd(), file), line: index + 1, text: line.trim().slice(0, 260) });
      }
      for (const match of line.matchAll(PREFIX_PATTERN)) prefixes.add(`${match[1]}-`);
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dynamicClassConstructionLines: findings.length,
    interpolatedPrefixes: [...prefixes].sort(),
    findings,
  };

  await writeFile(`${REPORT_DIR}/dynamic-class-safelist-findings.json`, JSON.stringify(report, null, 2));
  await writeFile(`${REPORT_DIR}/dynamic-class-prefixes.txt`, [...prefixes].sort().join('\n') + '\n');
  await writeFile(`${REPORT_DIR}/dynamic-class-safelist-findings.md`, `# Dynamic class construction findings\n\nGenerated: ${report.generatedAt}\n\nDetected ${findings.length} lines that may construct classes dynamically.\n\n## Interpolated prefixes\n\n${[...prefixes].sort().map((prefix) => `- \`${prefix}\``).join('\n') || '- None detected'}\n\n## Findings\n\n${findings.map((finding) => `- ${finding.file}:${finding.line} — \`${finding.text.replace(/`/g, '\\`')}\``).join('\n')}\n`);

  console.log(`Dynamic class report written to ${REPORT_DIR}/dynamic-class-safelist-findings.md`);
  console.log(`Detected ${findings.length} dynamic class construction line(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
