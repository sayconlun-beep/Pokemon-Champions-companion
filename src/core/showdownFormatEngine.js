import { normaliseStatAllocation, validateStatAllocation, STAT_DEFINITIONS } from './statAllocationEngine.js';
import { normaliseEvs, normaliseIvs, normaliseLevel, normaliseFinalStats, formatShowdownEvs, formatFinalStats, calculateFinalStats, buildCalculatedStatPoints, getCanonicalStatKey } from './statFormulaEngine.js';
import { analyseItemClause } from './itemClauseEngine.js';
import { getReadablePokemonName, getReadableAbilityName, getReadableMoveName, getReadableItemName } from '../utils/displayNames.js';

const STAT_LABELS = {
  hp: 'HP', attack: 'Atk', defense: 'Def', specialAttack: 'SpA', specialDefense: 'SpD', speed: 'Spe'
};
const SHOWDOWN_TO_STAT = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'specialAttack', spd: 'specialDefense', spe: 'speed' };
const NATURE_RE = /^([A-Za-z][A-Za-z .'-]+)\s+Nature$/i;

export function normalizeShowdownName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[’‘`]/g, "'")
    .replace(/[♀]/g, '-f')
    .replace(/[♂]/g, '-m')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

export function exportTeamToShowdown(team = [], options = {}) {
  const mode = options.mode || 'standard';
  const includeComments = Boolean(options.includeComments || mode === 'champions');
  const database = options.database;
  const warnings = [];
  const blocks = [];

  for (const slot of team || []) {
    if (!slot?.pokemon_id) continue;
    const pokemon = lookupById(database, 'pokemon', slot.pokemon_id);
    const species = pokemon ? getReadablePokemonName(pokemon) : getReadablePokemonName({ name: slot.species, pokemon_id: slot.pokemon_id });
    const nickname = clean(slot.nickname);
    const itemRecord = lookupById(database, 'items', slot.item_id);
    const item = itemRecord ? getReadableItemName(itemRecord, '') : getReadableItemName(clean(slot.item) || slot.item_id || '', '');
    const abilityRecord = lookupById(database, 'abilities', slot.ability_id);
    const ability = abilityRecord ? getReadableAbilityName(abilityRecord, '') : getReadableAbilityName(clean(slot.ability) || slot.ability_id || '', '');
    const nature = clean(slot.nature);
    const teraType = clean(slot.teraType || slot.tera_type);
    const moves = (slot.moves || []).map((moveId) => getReadableMoveName(lookupById(database, 'moves', moveId) || clean(moveId), '')).filter(Boolean).slice(0, 4);

    const header = `${nickname && nickname !== species ? `${nickname} (${species})` : species}${item ? ` @ ${item}` : ''}`;
    const lines = [header];
    if (ability) lines.push(`Ability: ${ability}`); else warnings.push(`${species}: missing Ability omitted from Showdown export.`);
    lines.push(`Level: ${Number(slot.level) || 50}`);
    if (teraType) lines.push(`Tera Type: ${teraType}`);
    const exportEvs = normaliseEvs(slot.evs, slot.importedShowdownEvs, slot.rawEvs, slot.showdownEvs);
    if (mode !== 'final-stats' && hasAnyStat(exportEvs)) lines.push(`EVs: ${formatShowdownEvs(exportEvs)}`);
    if (mode === 'final-stats') {
      const baseStats = database?.indexes?.statsByPokemon?.[slot.pokemon_id] || pokemon?.baseStats || pokemon?.stats || {};
      const finalStats = calculateFinalStats({ pokemon, baseStats, evs: exportEvs, ivs: slot.ivs, level: slot.level || 50, nature });
      if (hasAnyStat(finalStats)) lines.push(`Calculated Stats: ${formatFinalStats(finalStats)}`);
    }
    if (nature) lines.push(`${nature} Nature`);
    for (const move of moves) lines.push(`- ${move}`);
    if (includeComments) {
      const points = formatChampionsPoints(slot.statAllocation || slot.skillPoints || slot.sp || {});
      if (points) lines.push(`Pokémon Champions Points: ${points}`);
      if (slot.notes) lines.push(`// Notes: ${String(slot.notes).replace(/\n/g, ' ')}`);
    }
    blocks.push(lines.join('\n'));
  }

  if (options.itemClause && database) {
    const itemClause = analyseItemClause(team, database);
    if (!itemClause.legal) warnings.push(...itemClause.duplicates.map((entry) => `Duplicate item warning: ${entry.itemName} on ${entry.pokemonNames.join(', ')}.`));
  }

  return { text: blocks.join('\n\n'), warnings };
}

export function importTeamFromShowdown(text, database, options = {}) {
  const blocks = String(text || '').split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean).slice(0, 6);
  const warnings = [];
  const ignoredLines = [];
  const filledSlots = [];
  const team = Array.from({ length: 6 }, () => null);

  blocks.forEach((block, index) => {
    const parsed = parseShowdownSet(block);
    warnings.push(...parsed.warnings.map((w) => `Slot ${index + 1}: ${w}`));
    ignoredLines.push(...parsed.ignoredLines.map((line) => `Slot ${index + 1}: ${line}`));

    const pokemon = matchNamed(database?.collections?.pokemon, parsed.species, 'pokemon_id');
    if (!pokemon) {
      warnings.push(`Slot ${index + 1}: unmatched Pokémon "${parsed.species || parsed.header || 'unknown'}".`);
      return;
    }

    const slot = { pokemon_id: pokemon.pokemon_id, moves: [], statAllocation: {}, level: 50, evs: normaliseEvs({}), ivs: normaliseIvs({}) };
    if (parsed.nickname) slot.nickname = parsed.nickname;
    slot.level = normaliseLevel(parsed.level, 50);
    if (parsed.teraType) slot.teraType = parsed.teraType;

    const item = matchNamed(database?.collections?.items, parsed.item, 'item_id');
    if (parsed.item && item) slot.item_id = item.item_id;
    else if (parsed.item) warnings.push(`Slot ${index + 1}: unmatched item "${parsed.item}".`);

    const ability = matchNamed(database?.collections?.abilities, parsed.ability, 'ability_id');
    if (parsed.ability && ability) slot.ability_id = ability.ability_id;
    else if (parsed.ability) warnings.push(`Slot ${index + 1}: unmatched ability "${parsed.ability}".`);

    if (parsed.nature) slot.nature = parsed.nature;

    parsed.moves.forEach((moveName) => {
      const move = matchNamed(database?.collections?.moves, moveName, 'move_id');
      if (move) slot.moves.push(move.move_id);
      else warnings.push(`Slot ${index + 1}: unmatched move "${moveName}".`);
    });
    slot.moves = slot.moves.slice(0, 4);

    const hasImportedEvs = Boolean(parsed.evs);
    const evLineIsChampionsPoints = isChampionsStatPointSpread(parsed.evs, options);
    const hasStandardImportedEvs = hasImportedEvs && !evLineIsChampionsPoints;
    const championsPointsFromEvs = evLineIsChampionsPoints ? normaliseStatAllocation(canonicaliseParsedStats(parsed.evs)) : null;
    if (hasStandardImportedEvs) {
      slot.evs = normaliseEvs(parsed.evs);
      slot.importedShowdownEvs = normaliseEvs(parsed.evs);
      warnings.push(`Slot ${index + 1}: Showdown EVs were imported as EVs and kept separate from Pokémon Champions stat points.`);
    } else if (evLineIsChampionsPoints) {
      warnings.push(`Slot ${index + 1}: EVs line was recognised as Pokémon Champions Stat Points and applied to stat allocation.`);
    }

    if (parsed.ivs) slot.ivs = normaliseIvs(parsed.ivs);

    const baseStats = database?.indexes?.statsByPokemon?.[pokemon.pokemon_id] || pokemon?.baseStats || pokemon?.stats || {};
    if (parsed.finalStats) {
      slot.importedFinalStats = normaliseFinalStats(parsed.finalStats);
      if (hasStandardImportedEvs) {
        slot.statPoints = buildCalculatedStatPoints({ pokemon, baseStats, evs: slot.evs, ivs: slot.ivs, level: slot.level, nature: slot.nature || '' });
        warnings.push(`Slot ${index + 1}: imported final stats were not stored as EVs; EVs are the source of truth and displayed stat points were recalculated.`);
      } else {
        slot.statPoints = normaliseFinalStats(parsed.finalStats);
        warnings.push(`Slot ${index + 1}: final stat values were stored as statPoints metadata and were not converted into EVs.`);
      }
    } else if (hasStandardImportedEvs) {
      slot.statPoints = buildCalculatedStatPoints({ pokemon, baseStats, evs: slot.evs, ivs: slot.ivs, level: slot.level, nature: slot.nature || '' });
    }

    if (parsed.championsPoints) {
      const validation = validateStatAllocation(parsed.championsPoints);
      slot.statAllocation = validation.allocation;
      if (championsPointsFromEvs && !sameStatAllocation(championsPointsFromEvs, validation.allocation)) {
        warnings.push(`Slot ${index + 1}: EVs line and Pokémon Champions Points comment differed; Pokémon Champions Points were used.`);
      }
      if (!validation.isLegal) warnings.push(`Slot ${index + 1}: Champions Points were clamped to 66 total and +32 per stat (${validation.errors.join('; ')}).`);
    } else if (championsPointsFromEvs) {
      const validation = validateStatAllocation(championsPointsFromEvs);
      slot.statAllocation = validation.allocation;
      if (!validation.isLegal) warnings.push(`Slot ${index + 1}: EVs line Stat Points were clamped to 66 total and +32 per stat (${validation.errors.join('; ')}).`);
    } else {
      slot.statAllocation = normaliseStatAllocation({});
    }

    team[index] = slot;
    filledSlots.push(index + 1);
  });

  if (options.itemClause && database) {
    const itemClause = analyseItemClause(team, database);
    if (!itemClause.legal) warnings.push(...itemClause.duplicates.map((entry) => `Duplicate item warning: ${entry.itemName} on ${entry.pokemonNames.join(', ')}.`));
  }

  return { team, warnings, ignoredLines, filledSlots, summary: `${filledSlots.length} slot${filledSlots.length === 1 ? '' : 's'} filled` };
}


export function isChampionsStatPointSpread(parsedEvs, options = {}) {
  const mode = String(options.importMode || options.mode || 'champions').toLowerCase();
  if (['standard', 'showdown', 'pokemon-showdown', 'normal'].includes(mode)) return false;
  if (!parsedEvs || typeof parsedEvs !== 'object') return false;
  const values = Object.values(parsedEvs).map((value) => Number(value));
  if (!values.length) return false;
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 32)) return false;
  return values.reduce((sum, value) => sum + Math.round(value), 0) <= 66;
}

function canonicaliseParsedStats(stats = {}) {
  const canonical = {};
  for (const [rawKey, rawValue] of Object.entries(stats || {})) {
    const key = getCanonicalStatKey(rawKey);
    if (key) canonical[key] = Number(rawValue) || 0;
  }
  return canonical;
}

function sameStatAllocation(a = {}, b = {}) {
  const left = normaliseStatAllocation(a);
  const right = normaliseStatAllocation(b);
  return STAT_DEFINITIONS.every((stat) => Number(left[stat.key] || 0) === Number(right[stat.key] || 0));
}

export function parseShowdownSet(block) {
  const lines = String(block || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = { header: lines[0] || '', species: '', nickname: '', item: '', ability: '', level: 50, teraType: '', nature: '', moves: [], evs: null, ivs: null, finalStats: null, championsPoints: null, warnings: [], ignoredLines: [] };
  if (!lines.length) return result;
  parseHeader(result, lines[0]);

  for (const line of lines.slice(1)) {
    if (/^Ability:/i.test(line)) result.ability = valueAfterColon(line);
    else if (/^Level:/i.test(line)) result.level = Number(valueAfterColon(line)) || 50;
    else if (/^Tera Type:/i.test(line)) result.teraType = valueAfterColon(line);
    else if (/^EVs:/i.test(line)) result.evs = parseShowdownStats(valueAfterColon(line));
    else if (/^IVs:/i.test(line)) result.ivs = parseShowdownStats(valueAfterColon(line));
    else if (/^Pok[eé]mon Champions Points:/i.test(line)) result.championsPoints = parseChampionsPoints(line);
    else if (/^(Final|Calculated) Stats:/i.test(line)) result.finalStats = parseFinalStats(valueAfterColon(line));
    else if (/^-\s*/.test(line)) result.moves.push(line.replace(/^-\s*/, '').trim());
    else {
      const nature = line.match(NATURE_RE);
      if (nature) result.nature = nature[1].trim();
      else if (!/^\s*(\/\/|#)/.test(line)) result.ignoredLines.push(line);
    }
  }
  return result;
}

export function parseChampionsPoints(line) {
  const text = String(line || '').replace(/^Pok[eé]mon Champions Points:\s*/i, '');
  const points = {};
  for (const part of text.split('/')) {
    const match = part.trim().match(/^(HP|Atk|Attack|Def|SpA|Sp\. Attack|SpD|Sp\. Defense|Spe|Speed)\s*\+?\s*(-?\d+)/i);
    if (!match) continue;
    const key = SHOWDOWN_TO_STAT[normalizeStatLabel(match[1])] || normalizeStatLabel(match[1]);
    points[key] = Number(match[2]);
  }
  return normaliseStatAllocation(points);
}

export function formatChampionsPoints(points = {}) {
  const normalised = normaliseStatAllocation(points);
  return STAT_DEFINITIONS
    .filter((stat) => normalised[stat.key] > 0)
    .map((stat) => `${STAT_LABELS[stat.key]} +${normalised[stat.key]}`)
    .join(' / ');
}

function parseHeader(result, header) {
  let left = header;
  const itemSplit = header.match(/^(.*?)\s*@\s*(.+)$/);
  if (itemSplit) { left = itemSplit[1].trim(); result.item = itemSplit[2].trim(); }
  const nicknameSpecies = left.match(/^(.*?)\s*\(([^()]+)\)$/);
  if (nicknameSpecies) { result.nickname = nicknameSpecies[1].trim(); result.species = nicknameSpecies[2].trim(); }
  else result.species = left.trim();
}

function parseShowdownStats(text) {
  const stats = {};
  for (const part of String(text || '').split('/')) {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) continue;
    stats[match[2]] = Number(match[1]);
  }
  return stats;
}

function parseFinalStats(text) {
  const stats = {};
  for (const part of String(text || '').split('/')) {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) continue;
    stats[getCanonicalStatKey(match[2])] = Number(match[1]);
  }
  return stats;
}

function hasAnyStat(stats = {}) { return Object.values(stats || {}).some((value) => Number(value || 0) > 0); }

function matchNamed(rows = [], name, idKey) {
  const wanted = normalizeShowdownName(name);
  if (!wanted) return null;
  return rows.find((row) => normalizeShowdownName(row.name) === wanted || normalizeShowdownName(row[idKey]) === wanted) || null;
}

function lookupById(database, collectionName, id) {
  if (!database || !id) return null;
  const mapName = collectionName === 'pokemon' ? 'pokemonById' : collectionName === 'items' ? 'itemsById' : collectionName === 'moves' ? 'movesById' : 'abilitiesById';
  return database.indexes?.[mapName]?.[id] || database.collections?.[collectionName]?.find((row) => Object.values(row).includes(id));
}

function valueAfterColon(line) { return String(line || '').split(':').slice(1).join(':').trim(); }
function clean(value) { return String(value || '').trim(); }
function normalizeStatLabel(label) { return String(label || '').replace(/\./g, '').replace(/\s+/g, '').toLowerCase().replace('attack', 'atk').replace('specialattack', 'spa').replace('specialdefense', 'spd').replace('speed', 'spe'); }
