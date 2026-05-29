import { STAT_DEFINITIONS } from './statAllocationEngine.js';

const STAT_AUDIT_ROWS = [
  {
    area: 'Import / Export page',
    file: 'src/pages/ImportExportPage.js',
    handles: ['export mode', 'Showdown export text', 'App JSON export text', 'import result warnings'],
    storedFormat: 'Renders whatever the export/import engines produce. It does not convert stat values itself.',
    risk: 'Low. This page is display/control flow only, but it should surface warnings from the engines clearly.'
  },
  {
    area: 'Showdown export',
    file: 'src/core/showdownFormatEngine.js',
    handles: ['level', 'nature', 'EVs', 'Champions Points', 'moves', 'item', 'ability'],
    storedFormat: 'Exports slot.statAllocation as Pokémon Champions Points. Standard Showdown EVs are exported only from EV fields such as slot.evs/importedShowdownEvs.',
    risk: 'Low. Standard export now keeps EV output separate from Champions point comments.'
  },
  {
    area: 'Showdown import',
    file: 'src/core/showdownFormatEngine.js',
    handles: ['EVs', 'IVs', 'nature', 'level', 'Champions Points'],
    storedFormat: 'Showdown EVs are stored as EV data/metadata. Champions Points become slot.statAllocation.',
    risk: 'Low. EVs are not converted into statAllocation in this path, so Showdown EVs are not directly mistaken for Champions stat points here.'
  },
  {
    area: 'JSON import / migration',
    file: 'src/core/teamMigrationEngine.js',
    handles: ['statAllocation', 'skillPoints', 'sp', 'evs', 'EVs'],
    storedFormat: 'Normalises only Champions point fields into slot.statAllocation. EV-shaped fields are preserved as EVs and final-stat-shaped fields are preserved as metadata.',
    risk: 'Low. Legacy evs/EVs are no longer accepted as statAllocation input.'
  },
  {
    area: 'Stat allocation engine',
    file: 'src/core/statAllocationEngine.js',
    handles: ['raw stat points', 'legacy keys', 'final displayed stat bonus', 'base stats'],
    storedFormat: 'Canonical storage is slot.statAllocation using Champions point keys: hp, attack, defense, specialAttack, specialDefense, speed.',
    risk: 'Low. getSlotStatAllocation no longer reads slot.evs/slot.EVs as Champions point fallbacks.'
  },
  {
    area: 'Team builder stat panel',
    file: 'src/components/TeamSlotCard.js',
    handles: ['base stats', 'bonus points', 'final displayed stat'],
    storedFormat: 'Displays base stat + Champions allocation. It does not use official Pokémon stat formula output.',
    risk: 'Medium. The UI label “Final” means base + Champions bonus, not a level/nature/EV calculated battle stat.'
  },
  {
    area: 'Damage benchmarks',
    file: 'src/core/damageBenchmarkEngine.js',
    handles: ['base stats', 'nature', 'level 50', 'selected stat points'],
    storedFormat: 'Uses Champions allocation as if it were EV-like input in the level 50 Pokémon stat formula.',
    risk: 'High. selectedPoints are Champions points, but finalStat divides them by 4 like EVs, causing a possible EV/stat-point conversion mismatch.'
  }
];

export function getStatConversionAuditReport(team = [], data = {}) {
  const storedFormats = inspectStoredStatFormats(team);
  return {
    title: 'Import / Export Stat Conversion Audit',
    summary: 'The app keeps Champions stat points and EV values in separate fields during import/export. EV-shaped JSON fields are no longer treated as Champions stat points.',
    canonicalFormat: 'slot.statAllocation stores raw Pokémon Champions stat points. slot.evs/importedShowdownEvs store EV investment values. Final battle stats should be calculated from base stats, IV, EV, level, and nature.',
    baseStatsSource: 'Base stats are read from data.indexes.statsByPokemon[pokemon_id].',
    rows: STAT_AUDIT_ROWS,
    storedFormats,
    possibleEVMisreads: findPossibleEVMisreads(team)
  };
}

function inspectStoredStatFormats(team = []) {
  const formats = new Set();
  for (const slot of team || []) {
    if (!slot) continue;
    if (slot.statAllocation) formats.add('raw Champions stat points: slot.statAllocation');
    if (slot.importedShowdownEvs) formats.add('preserved Showdown EV metadata: slot.importedShowdownEvs');
    if (slot.evs) formats.add('EV investment field: slot.evs');
    if (slot.EVs) formats.add('legacy EV investment field: slot.EVs');
    if (slot.skillPoints) formats.add('legacy Champions points: slot.skillPoints');
    if (slot.sp) formats.add('legacy Champions points: slot.sp');
    if (hasFinalStatLikeFields(slot)) formats.add('possible calculated stat points/final stats on custom fields');
  }
  return Array.from(formats);
}

function findPossibleEVMisreads(team = []) {
  const findings = [];
  for (const [index, slot] of (team || []).entries()) {
    if (!slot) continue;
    if (slot.evs || slot.EVs) {
      findings.push(`Slot ${index + 1}: contains evs/EVs; these are now preserved as EV investment values and should not be read as Champions points.`);
    }
    if (slot.importedShowdownEvs && slot.statAllocation && hasAnyPoints(slot.statAllocation)) {
      findings.push(`Slot ${index + 1}: contains both importedShowdownEvs metadata and statAllocation; verify export mode does not mix Showdown EVs with Champions points.`);
    }
    if (hasSuspiciousLargeStatValues(slot.statAllocation)) {
      findings.push(`Slot ${index + 1}: statAllocation contains values above the Champions +32 single-stat cap before normalisation.`);
    }
  }
  return findings;
}

function hasAnyPoints(points = {}) {
  return STAT_DEFINITIONS.some((stat) => Number(points?.[stat.key] || 0) > 0);
}

function hasSuspiciousLargeStatValues(points = {}) {
  return STAT_DEFINITIONS.some((stat) => Number(points?.[stat.key] || 0) > 32);
}

function hasFinalStatLikeFields(slot = {}) {
  return ['finalStats', 'calculatedStats', 'statPoints', 'stats'].some((key) => slot[key] && typeof slot[key] === 'object');
}
