import { normaliseStatAllocation, validateStatAllocation } from './statAllocationEngine.js';
import { normaliseEvs, normaliseIvs, normaliseLevel, normaliseFinalStats, buildCalculatedStatPoints } from './statFormulaEngine.js';

const STORAGE_KEY = 'gold-standard-rebuild.savedTeams';
const OLD_STORAGE_KEYS = [
  'pokemon-champions.savedTeams',
  'pokemonChampions.savedTeams',
  'pokemon-champions-team-builder.savedTeams',
  'pokemonChampionsTeamBuilder.savedTeams',
  'pokemon-champions-teams',
  'pokemonChampionsTeams',
  'teamBuilder.savedTeams',
  'teamBuilder.teams',
  'team-builder.savedTeams',
  'savedTeams',
  'saved-teams',
  'teams'
];


const BLOCKED_SLOT_FIELDS = new Set([
  'role',
  'roles',
  'role' + 'Tags',
  'arch' + 'etype',
  'physicalOnly',
  'specialOnly',
  'support' + 'Role',
  'syn' + 'ergy' + 'Score',
  'identity',
  'teamIdentity',
  'identityScore',
  'offenseScore',
  'defenseScore',
  'compositionScore',
  'finalStats',
  'calculatedStats',
  'importedFinalStats'
]);

export function migrateLegacyTeamToGoldStandard(team) {
  const source = unwrapTeamSource(team);
  const sourceSlots = Array.isArray(source) ? source : [];
  return Array.from({ length: 6 }, (_, index) => cleanSlot(sourceSlots[index]));
}

export function sanitizeTeam(team) {
  return migrateLegacyTeamToGoldStandard(team);
}

export function migrateImportedTeam(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return migrateLegacyTeamToGoldStandard(parsed);
  } catch (error) {
    console.warn('Team import failed sanitisation.', error);
    return Array.from({ length: 6 }, () => null);
  }
}

export function exportTeam(team, data = null) {
  const safeTeam = migrateLegacyTeamToGoldStandard(team).filter(Boolean).map((slot) => prepareSlotForJsonExport(slot, data));
  const statLegality = safeTeam.map((slot, index) => ({
    slot: index + 1,
    pokemon_id: slot.pokemon_id,
    ...validateStatAllocation(slot.statAllocation || {})
  }));
  return JSON.stringify({
    version: 5,
    format: 'gold-standard-team',
    team: safeTeam,
    statLegalitySummary: statLegality.map(({ slot, pokemon_id, isLegal, totalAllocated, remainingPoints, errors }) => ({ slot, pokemon_id, isLegal, totalAllocated, remainingPoints, errors }))
  }, null, 2);
}


function prepareSlotForJsonExport(slot, data = null) {
  const exported = {
    ...slot,
    evs: normaliseEvs(slot.evs, slot.importedShowdownEvs, slot.rawEvs, slot.showdownEvs),
    ivs: normaliseIvs(slot.ivs),
    level: normaliseLevel(slot.level, 50),
    nature: firstText(slot.nature)
  };

  const pokemon = lookupById(data, 'pokemon', exported.pokemon_id);
  const baseStats = data?.indexes?.statsByPokemon?.[exported.pokemon_id] || pokemon?.baseStats || pokemon?.stats || null;
  if (pokemon || baseStats) {
    exported.calculatedStats = buildCalculatedStatPoints({
      pokemon,
      baseStats,
      evs: exported.evs,
      ivs: exported.ivs,
      level: exported.level,
      nature: exported.nature
    });
    exported.statPoints = exported.calculatedStats;
  } else if (slot.statPoints && typeof slot.statPoints === 'object') {
    exported.statPoints = normaliseFinalStats(slot.statPoints);
  }

  delete exported.finalStats;
  delete exported.rawEvs;
  delete exported.showdownEvs;
  return exported;
}

function lookupById(data, collection, id) {
  if (!data || !id) return null;
  const key = collection === 'pokemon' ? 'pokemon_id' : `${collection.slice(0, -1)}_id`;
  return data?.collections?.[collection]?.find?.((row) => row?.[key] === id || row?.id === id) || null;
}

export function saveTeam(name, team) {
  const saved = loadSavedTeams();
  const fallbackName = `Team ${new Date().toLocaleString()}`;
  const requestedName = String(name || '').trim();
  const baseName = requestedName || fallbackName;
  const safeName = uniqueSavedTeamName(saved, baseName);
  const now = new Date().toISOString();
  const id = makeSavedTeamId(safeName, now);
  saved[safeName] = {
    id,
    teamName: safeName,
    title: safeName,
    savedAt: now,
    updatedAt: now,
    team: migrateLegacyTeamToGoldStandard(team).filter(Boolean)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return { id, name: safeName };
}

export function updateSavedTeam(idOrName, name, team) {
  const saved = loadSavedTeams();
  const match = findSavedTeamRecord(saved, idOrName);
  if (!match) return null;

  const currentEntry = match.entry || {};
  const currentKey = match.key;
  const currentId = currentEntry.id || makeSavedTeamId(currentKey, currentEntry.savedAt || currentKey);
  const requestedName = cleanName(name);
  const nextName = requestedName || cleanName(currentEntry.teamName || currentEntry.title || currentKey) || currentKey;
  const safeName = nextName === currentKey ? currentKey : uniqueSavedTeamNameWithout(saved, nextName, currentKey);
  const now = new Date().toISOString();
  const updatedEntry = {
    ...currentEntry,
    id: currentId,
    teamName: safeName,
    title: safeName,
    savedAt: currentEntry.savedAt || now,
    updatedAt: now,
    team: migrateLegacyTeamToGoldStandard(team).filter(Boolean)
  };

  if (safeName !== currentKey) delete saved[currentKey];
  saved[safeName] = updatedEntry;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return { id: currentId, name: safeName };
}

export function getSavedTeamEntries() {
  const saved = loadSavedTeams();
  return Object.entries(saved).map(([name, entry]) => ({
    ...entry,
    id: entry?.id || makeSavedTeamId(name, entry?.savedAt || name),
    teamName: cleanName(entry?.teamName || entry?.title || name),
    title: cleanName(entry?.title || entry?.teamName || name),
    storageKey: name
  }));
}

export function loadSavedTeamById(idOrName) {
  const saved = loadSavedTeams();
  const match = findSavedTeamRecord(saved, idOrName);
  return match ? match.entry.team : [];
}

export function renameSavedTeam(idOrName, nextName) {
  const saved = loadSavedTeams();
  const match = findSavedTeamRecord(saved, idOrName);
  if (!match) return null;

  const cleanNextName = cleanName(nextName);
  if (!cleanNextName) return null;

  const currentKey = match.key;
  const currentEntry = match.entry;
  const currentId = currentEntry?.id || makeSavedTeamId(currentKey, currentEntry?.savedAt || currentKey);
  const sameName = currentKey === cleanNextName;
  const safeName = sameName ? currentKey : uniqueSavedTeamNameWithout(saved, cleanNextName, currentKey);
  const renamedEntry = {
    ...currentEntry,
    id: currentId,
    teamName: safeName,
    title: safeName,
    updatedAt: new Date().toISOString(),
    team: migrateLegacyTeamToGoldStandard(currentEntry?.team || currentEntry).filter(Boolean)
  };

  if (!sameName) delete saved[currentKey];
  saved[safeName] = renamedEntry;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return { id: currentId, name: safeName };
}

function uniqueSavedTeamName(saved, name) {
  return uniqueSavedTeamNameWithout(saved, name, '');
}

function uniqueSavedTeamNameWithout(saved, name, allowedExistingKey = '') {
  const clean = cleanName(name || `Team ${Object.keys(saved || {}).length + 1}`);
  if (!saved?.[clean] || clean === allowedExistingKey) return clean;
  let index = 2;
  let candidate = `${clean} (${index})`;
  while (saved[candidate] && candidate !== allowedExistingKey) {
    index += 1;
    candidate = `${clean} (${index})`;
  }
  return candidate;
}

function findSavedTeamRecord(saved, idOrName) {
  const target = String(idOrName || '');
  if (!target) return null;
  if (saved[target]) return { key: target, entry: saved[target] };
  for (const [key, entry] of Object.entries(saved || {})) {
    const entryId = entry?.id || makeSavedTeamId(key, entry?.savedAt || key);
    if (entryId === target) return { key, entry };
  }
  return null;
}


export function deleteSavedTeam(idOrName) {
  const saved = loadSavedTeams();
  const match = findSavedTeamRecord(saved, idOrName);
  if (!match) return null;

  const deletedEntry = match.entry;
  const deletedId = deletedEntry?.id || makeSavedTeamId(match.key, deletedEntry?.savedAt || match.key);
  delete saved[match.key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return { id: deletedId, name: match.key };
}

export function loadSavedTeams() {
  const canonical = normaliseSavedCollection(safeReadStorage(STORAGE_KEY));
  const compactCanonical = compactSavedTeams(canonical);

  // Once the app has a canonical saved-team bucket, trust that bucket only.
  // The previous implementation re-scanned legacy/localStorage keys every render,
  // then merged the already-migrated canonical copy back together with old keys.
  // That caused empty placeholder teams to multiply as "Saved team (2/3/4...)"
  // whenever the saved-team UI was opened, renamed, loaded, or deleted.
  if (Object.keys(compactCanonical).length) {
    persistMigratedSavedTeams(compactCanonical);
    return compactCanonical;
  }

  const merged = {};
  const storageKeys = collectLegacySavedTeamStorageKeys();
  for (const key of storageKeys) {
    const raw = safeReadStorage(key);
    if (!raw) continue;
    mergeSavedCollections(merged, normaliseSavedCollection(raw));
  }

  const compactMerged = compactSavedTeams(merged);
  if (Object.keys(compactMerged).length) persistMigratedSavedTeams(compactMerged);
  return compactMerged;
}

function collectLegacySavedTeamStorageKeys() {
  const keys = new Set(OLD_STORAGE_KEYS);
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (/(saved.*team|team.*saved|teamBuilder|pokemon.*champions|champions.*team|metadex.*team|builder.*team|^teams$|^savedTeams$)/i.test(key)) {
        keys.add(key);
      }
    }
  } catch (error) {
    console.warn('Could not scan saved team storage keys.', error);
  }
  return Array.from(keys);
}


function compactSavedTeams(savedTeams) {
  const compact = {};
  Object.entries(savedTeams || {}).forEach(([name, entry]) => {
    const clean = cleanName(entry?.teamName || entry?.title || name);
    if (!clean) return;
    const team = Array.isArray(entry?.team) ? entry.team.filter(Boolean) : [];

    // Remove the auto-created empty placeholders that were produced by the
    // old merge loop. Real named teams are kept even if currently empty.
    if (!team.length && /^Saved team( \(\d+\))?$/i.test(clean)) return;

    const key = compact[clean] ? uniqueSavedTeamNameWithout(compact, clean, '') : clean;
    compact[key] = {
      ...entry,
      id: entry?.id || makeSavedTeamId(key, entry?.savedAt || entry?.updatedAt || key),
      teamName: key,
      title: key,
      team
    };
  });
  return compact;
}

function mergeSavedCollections(target, source) {
  Object.entries(source || {}).forEach(([name, entry]) => {
    const clean = cleanName(name || entry?.teamName || entry?.title || 'Saved team');
    if (!clean) return;
    const key = target[clean] ? uniqueSavedTeamNameWithout(target, clean, '') : clean;
    target[key] = { ...entry, teamName: key, title: key };
  });
}

function persistMigratedSavedTeams(savedTeams) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedTeams));
  } catch (error) {
    console.warn('Could not persist migrated teams.', error);
  }
}

function safeReadStorage(key) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.warn(`Could not read saved team storage key: ${key}`, error);
    return null;
  }
}

function normaliseSavedCollection(value) {
  const result = {};

  if (looksLikeSavedTeamEntry(value)) {
    const name = cleanName(value?.teamName || value?.name || value?.title || 'Saved team');
    if (name) result[name] = normaliseSavedTeamEntry(name, value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const name = cleanName(entry?.teamName || entry?.name || entry?.title || `Team ${index + 1}`);
      result[name] = normaliseSavedTeamEntry(name, entry);
    });
    return result;
  }

  if (value && typeof value === 'object') {
    const collection = value.savedTeams || value.teams || value.teamList || value;
    if (Array.isArray(collection)) return normaliseSavedCollection(collection);

    Object.entries(collection || {}).forEach(([name, entry], index) => {
      if (!looksLikeSavedTeamEntry(entry)) return;
      const savedName = cleanName(entry?.teamName || entry?.name || entry?.title || name || `Team ${index + 1}`);
      if (!savedName) return;
      result[savedName] = normaliseSavedTeamEntry(savedName, entry);
    });
  }

  return result;
}


function looksLikeSavedTeamEntry(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(Boolean);
  return Array.isArray(value.team) || Array.isArray(value.slots) || Array.isArray(value.pokemon) || Array.isArray(value.members) || Array.isArray(value.teamSlots);
}

function normaliseSavedTeamEntry(name, entry) {
  const existingSavedAt = firstText(entry?.savedAt, entry?.createdAt, entry?.timestamp, entry?.dateSaved);
  const team = migrateLegacyTeamToGoldStandard(entry).filter(Boolean);
  const savedAt = existingSavedAt || '';
  const existingId = firstText(entry?.id, entry?.teamId, entry?.savedTeamId);
  return {
    ...(entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}),
    id: existingId || makeSavedTeamId(name, savedAt || name),
    teamName: name,
    title: name,
    ...(existingSavedAt ? { savedAt: existingSavedAt } : {}),
    team
  };
}

function makeSavedTeamId(name, seed = '') {
  const input = `${name || 'team'}|${seed || ''}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return `team_${Math.abs(hash).toString(36)}`;
}

function unwrapTeamSource(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.team)) return value.team;
  if (Array.isArray(value.slots)) return value.slots;
  if (Array.isArray(value.pokemon)) return value.pokemon;
  if (Array.isArray(value.members)) return value.members;
  if (Array.isArray(value.teamSlots)) return value.teamSlots;
  return [];
}

function cleanSlot(slot) {
  if (!slot || typeof slot !== 'object') return null;

  const pokemonId = firstText(slot.pokemon_id, slot.pokemonId, slot.species_id, slot.speciesId, slot.id, slot.dexId);
  if (!pokemonId) return null;

  const rawStatAllocation = slot.statAllocation || slot.stat_allocation || slot.skillPoints || slot.skill_points || slot.sp;
  const rawEvs = slot.evs || slot.EVs || slot.importedShowdownEvs || slot.rawEvs || slot.showdownEvs;
  const rawIvs = slot.ivs || slot.IVs;
  const rawFinalStats = slot.finalStats || slot.calculatedStats || slot.statPoints || slot.importedFinalStats;
  const rawLevel = slot.level;
  const statValidation = validateStatAllocation(rawStatAllocation || {});
  const cleaned = {
    pokemon_id: pokemonId,
    moves: cleanMoves(slot.moves || slot.move_ids || slot.moveIds),
    ability_id: firstText(slot.ability_id, slot.abilityId, slot.ability),
    item_id: firstText(slot.item_id, slot.itemId, slot.item),
    nature: firstText(slot.nature),
    level: normaliseLevel(rawLevel, 50),
    evs: normaliseEvs({}),
    ivs: normaliseIvs({}),
    statAllocation: cleanStatAllocation(rawStatAllocation)
  };

  const hasRawEvs = rawEvs && typeof rawEvs === 'object';
  if (hasRawEvs) cleaned.evs = normaliseEvs(rawEvs);
  if (rawIvs && typeof rawIvs === 'object') cleaned.ivs = normaliseIvs(rawIvs);
  if (rawFinalStats && typeof rawFinalStats === 'object') {
    cleaned.importedFinalStats = normaliseFinalStats(rawFinalStats);
    if (!hasRawEvs) cleaned.statPoints = normaliseFinalStats(rawFinalStats);
    cleaned.importWarnings = [
      ...(cleaned.importWarnings || []),
      hasRawEvs
        ? 'Imported final stat values were ignored for EV storage because EVs are the source of truth.'
        : 'Imported final stat values were preserved as statPoints metadata and were not stored as EVs.'
    ];
  }
  if (statValidation.errors.length) cleaned.importWarnings = [...(cleaned.importWarnings || []), ...statValidation.errors];

  copyOptionalText(cleaned, 'notes', slot.notes, slot.note, slot.comment);
  copyOptionalText(cleaned, 'teraType', slot.teraType, slot.tera_type, slot.tera, slot.TeraType);
  copyOptionalText(cleaned, 'typeOverride', slot.typeOverride, slot.type_override, slot.typeData, slot.types);

  copyUnknownSafeFields(cleaned, slot);
  return cleaned;
}

function copyUnknownSafeFields(cleaned, slot) {
  Object.entries(slot).forEach(([key, value]) => {
    if (BLOCKED_SLOT_FIELDS.has(key)) return;
    if (key in cleaned) return;
    if (value === undefined || typeof value === 'function') return;
    if (/^(pokemon|species|dex|move|ability|item|nature|skill|statAllocation|stat_allocation|evs?|sp|notes?|comment|tera|type)/i.test(key)) return;
    if (isPlainJsonValue(value)) cleaned[key] = value;
  });
}

function cleanMoves(moves) {
  if (!Array.isArray(moves)) return [];
  return moves
    .slice(0, 4)
    .map((move) => firstText(move?.move_id, move?.moveId, move?.id, move?.name, move))
    .filter(Boolean);
}

function cleanStatAllocation(points) {
  return normaliseStatAllocation(points);
}

function copyOptionalText(target, key, ...values) {
  const value = firstText(...values);
  if (value) target[key] = value;
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function clampNumber(value, min, max) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanName(value) {
  return String(value || '').trim() || 'Imported Team';
}

function isPlainJsonValue(value) {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isPlainJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isPlainJsonValue);
  return false;
}
