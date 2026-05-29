import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('public/data/audits/pokemon-champions-regional-form-audit.json', 'utf8'));
console.log(JSON.stringify(report.summary, null, 2));
console.log('Missing forms:');
for (const form of report.formsMissingFromLocalDatabase) {
  console.log(`- ${form.species} — ${form.form}`);
}
