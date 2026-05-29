import fs from 'node:fs';
import { getPokemonDisplayName, getPokemonFormLabel, getPokemonSearchAliases } from '../src/utils/formGrouping.js';

const pokemon = JSON.parse(fs.readFileSync(new URL('../public/data/pokemon.json', import.meta.url), 'utf8'));
const bios = JSON.parse(fs.readFileSync(new URL('../public/data/pokemon_biographies.json', import.meta.url), 'utf8'));
const biographyRows = Array.isArray(bios) ? bios : Object.values(bios);
const added = pokemon.filter((p) => p.goldStandardSourceVersion === 'regional-form-fill-v1-2026-05-16');

const requiredIdentityFields = ['pokemon_id','ndex','name','base_species','form_name','is_mega','is_regional_or_alt','type_1','typing','champions_legal','goldStandardId'];
const requiredDataFields = ['commonBuilds','speedBenchmarkData','damageProfile','boardStateProfiles','targetingPressure','simulationFlags','aiRecognitionProfiles','decisionMakingHeuristics','strategicStrengths','threatResponses','positioningBehavior','resourceEconomy','pressureWindows','competitiveInsights','reliabilityMetrics'];
const requiredStrategicFields = ['coreStrengths','pressureTypes','opponentConstraints','conversionPatterns','failureConditions','preferredBoardStates','endgamePatterns','supportRequirements'];
const requiredConfidenceFields = ['confidenceStatus','confidenceReason','requiresOfficialReview','strictModeEligible'];
const requiredBiographyFields = ['biography_id','biography_reference'];
const expectedTyping = {
  PKMN_0026_ALOLA: 'Electric / Psychic',
  PKMN_0038_ALOLA: 'Ice / Fairy',
  PKMN_0059_HISUI: 'Fire / Rock',
  PKMN_0080_GALAR: 'Poison / Psychic',
  PKMN_0128_PALDEA_COMBAT: 'Fighting',
  PKMN_0128_PALDEA_BLAZE: 'Fighting / Fire',
  PKMN_0128_PALDEA_AQUA: 'Fighting / Water',
  PKMN_0157_HISUI: 'Fire / Ghost',
  PKMN_0199_GALAR: 'Poison / Psychic'
};
const searchExpectations = {
  PKMN_0026_ALOLA: ['Alolan Raichu','Raichu Alola','Raichu'],
  PKMN_0038_ALOLA: ['Alolan Ninetales','Ninetales Alola','Ninetales'],
  PKMN_0059_HISUI: ['Hisuian Arcanine','Arcanine Hisui'],
  PKMN_0080_GALAR: ['Galarian Slowbro','Slowbro Galar'],
  PKMN_0128_PALDEA_COMBAT: ['Paldean Tauros','Tauros Combat'],
  PKMN_0128_PALDEA_BLAZE: ['Paldean Tauros','Tauros Blaze'],
  PKMN_0128_PALDEA_AQUA: ['Paldean Tauros','Tauros Aqua'],
  PKMN_0157_HISUI: ['Hisuian Typhlosion','Typhlosion Hisui'],
  PKMN_0199_GALAR: ['Galarian Slowking','Slowking Galar']
};
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const missing = (row, field) => row[field] === undefined || row[field] === null || row[field] === '';
const idCounts = new Map();
const goldCounts = new Map();
for (const row of pokemon) {
  idCounts.set(row.pokemon_id, (idCounts.get(row.pokemon_id) || 0) + 1);
  if (row.goldStandardId) goldCounts.set(row.goldStandardId, (goldCounts.get(row.goldStandardId) || 0) + 1);
}

const report = {
  validationName: 'Pokemon Champions Regional Form Gold Standard Validation Pass',
  generatedAt: new Date().toISOString(),
  scope: 'Added regional/permanent forms from regional-form-fill-v1-2026-05-16 only; no battle, legality, analysis, or recommendation engines altered.',
  summary: { totalAddedFormsChecked: added.length, passed: 0, failed: 0, duplicatePokemonIds: [], duplicateGoldStandardIds: [], uiVisibilityIssues: [], incorrectTyping: [], missingFieldCount: 0 },
  passedForms: [],
  failedForms: [],
  missingFields: {},
  incorrectTyping: [],
  duplicateIds: [],
  duplicateGoldStandardIds: [],
  uiVisibilityIssues: [],
  fieldsMarkedNeedsChampionsConfirmation: [],
  recommendedFixes: []
};

for (const [id,count] of idCounts) if (count > 1) report.duplicateIds.push({ pokemon_id: id, count });
for (const [id,count] of goldCounts) if (count > 1) report.duplicateGoldStandardIds.push({ goldStandardId: id, count });

const byId = Object.fromEntries(pokemon.map((p) => [p.pokemon_id, p]));
for (const row of added) {
  const failures = [];
  const missingFields = [];
  for (const f of [...requiredIdentityFields, ...requiredDataFields, ...requiredConfidenceFields, ...requiredBiographyFields]) {
    if (missing(row, f)) missingFields.push(f);
  }
  if (!row.strategicStrengths || typeof row.strategicStrengths !== 'object') {
    failures.push('Missing strategicStrengths object');
  } else {
    for (const f of requiredStrategicFields) {
      if (!Array.isArray(row.strategicStrengths[f])) missingFields.push(`strategicStrengths.${f}`);
    }
  }
  const base = pokemon.find((p) => p.ndex === row.ndex && String(p.form_name || 'Base') === 'Base' && p.pokemon_id !== row.pokemon_id);
  if (!base) failures.push('Base species entry could not be independently confirmed');
  if (base && base.pokemon_id === row.pokemon_id) failures.push('Regional form shares pokemon_id with base form');
  if (row.form_name === 'Base') failures.push('Regional form has form_name Base');
  if (row.is_regional_or_alt !== 'Yes') failures.push('Regional form is not marked is_regional_or_alt Yes');
  if (row.champions_legal !== 'Yes') failures.push('Regional form is not marked champions_legal Yes');
  const expected = expectedTyping[row.pokemon_id];
  if (expected && row.typing !== expected) {
    const issue = { pokemon_id: row.pokemon_id, name: row.name, expected, actual: row.typing };
    report.incorrectTyping.push(issue);
    failures.push(`Incorrect typing: expected ${expected}, found ${row.typing}`);
  }
  const bio = biographyRows.find((b) => b.pokemon_id === row.pokemon_id || b.biography_id === row.biography_id);
  if (!bio) failures.push('Missing matching pokemon_biographies.json entry');
  else {
    for (const f of ['pokemon_id','name','base_species','ndex','short_biography','database_summary','references','note','confidenceStatus','confidenceReason','requiresOfficialReview','strictModeEligible']) {
      if (missing(bio, f)) missingFields.push(`biography.${f}`);
    }
  }
  const displayName = getPokemonDisplayName(row);
  const formLabel = getPokemonFormLabel(row);
  const aliases = getPokemonSearchAliases(row).map(norm).join(' | ');
  const queryIssues = [];
  for (const q of (searchExpectations[row.pokemon_id] || [])) if (!aliases.includes(norm(q))) queryIssues.push(q);
  if (!displayName.includes('(') || !formLabel) queryIssues.push('missing visible form label/display name');
  if (queryIssues.length) {
    const issue = { pokemon_id: row.pokemon_id, name: row.name, displayName, missingAliasesOrLabels: queryIssues };
    report.uiVisibilityIssues.push(issue);
    failures.push(`UI visibility/search issue: ${queryIssues.join(', ')}`);
  }
  if (missingFields.length) {
    report.missingFields[row.pokemon_id] = missingFields;
    failures.push(`Missing required fields: ${missingFields.join(', ')}`);
  }
  if (row.confidenceStatus === 'Needs Champions Confirmation' || row.has_moves === 'Needs Review' || row.has_abilities === 'Needs Review' || row.has_sprite === 'Needs Review' || row.requiresOfficialReview === true) {
    report.fieldsMarkedNeedsChampionsConfirmation.push({ pokemon_id: row.pokemon_id, name: row.name, fields: ['confidenceStatus','has_moves','has_abilities','has_sprite','requiresOfficialReview','strictModeEligible'].filter((f) => row[f] === 'Needs Champions Confirmation' || row[f] === 'Needs Review' || row[f] === true || row[f] === false) });
  }
  if (failures.length) report.failedForms.push({ pokemon_id: row.pokemon_id, name: row.name, form_name: row.form_name, failures });
  else report.passedForms.push({ pokemon_id: row.pokemon_id, displayName, typing: row.typing, goldStandardId: row.goldStandardId });
}
report.summary.passed = report.passedForms.length;
report.summary.failed = report.failedForms.length;
report.summary.duplicatePokemonIds = report.duplicateIds;
report.summary.duplicateGoldStandardIds = report.duplicateGoldStandardIds;
report.summary.uiVisibilityIssues = report.uiVisibilityIssues;
report.summary.incorrectTyping = report.incorrectTyping;
report.summary.missingFieldCount = Object.values(report.missingFields).reduce((n, arr) => n + arr.length, 0);
if (report.failedForms.length === 0 && report.duplicateIds.length === 0 && report.duplicateGoldStandardIds.length === 0) {
  report.recommendedFixes.push('No required fixes. Continue to replace Needs Review / Needs Champions Confirmation fields when official Champions-specific move, ability, sprite, and strict-mode data is available.');
} else {
  report.recommendedFixes.push('Fill the listed missing fields without changing base species or battle/analysis engines.');
  report.recommendedFixes.push('Correct any listed typing or UI alias issue before strict-mode use.');
}
fs.mkdirSync(new URL('../public/data/audits/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../public/data/audits/pokemon-champions-regional-form-gold-standard-validation.json', import.meta.url), JSON.stringify(report, null, 2));

const md = [
  '# Pokémon Champions Regional Form Gold Standard Validation',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  `- Added forms checked: ${report.summary.totalAddedFormsChecked}`,
  `- Passed forms: ${report.summary.passed}`,
  `- Failed forms: ${report.summary.failed}`,
  `- Duplicate pokemon_id values: ${report.duplicateIds.length}`,
  `- Duplicate goldStandardId values: ${report.duplicateGoldStandardIds.length}`,
  `- Incorrect typing issues: ${report.incorrectTyping.length}`,
  `- UI visibility issues: ${report.uiVisibilityIssues.length}`,
  `- Missing required fields: ${report.summary.missingFieldCount}`,
  '',
  '## Passed Forms',
  ...report.passedForms.map((p) => `- ${p.displayName} — ${p.typing} — ${p.pokemon_id}`),
  '',
  '## Failed Forms',
  ...(report.failedForms.length ? report.failedForms.map((p) => `- ${p.name} (${p.pokemon_id}): ${p.failures.join('; ')}`) : ['- None']),
  '',
  '## Fields Marked Needs Champions Confirmation',
  ...report.fieldsMarkedNeedsChampionsConfirmation.map((p) => `- ${p.name} (${p.pokemon_id}): ${p.fields.join(', ')}`),
  '',
  '## Recommended Fixes',
  ...report.recommendedFixes.map((f) => `- ${f}`)
].join('\n');
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../docs/pokemon-champions-regional-form-gold-standard-validation.md', import.meta.url), md);

if (report.failedForms.length || report.duplicateIds.length || report.duplicateGoldStandardIds.length) {
  console.error(JSON.stringify(report.summary, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report.summary, null, 2));
