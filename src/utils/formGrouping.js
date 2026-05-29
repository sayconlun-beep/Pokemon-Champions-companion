import { getReadablePokemonName, readableFromId } from './displayNames.js';
const FORM_GROUP_CACHE = new WeakMap();

const MECHANICAL_POKEMON_FIELDS = Object.freeze([
  'type_1',
  'type_2',
  'typing',
  'champions_legal',
  'requiresOfficialReview',
  'strictModeEligible',
  'is_mega',
  'megaStoneRequired',
  'requiredItemName',
  'itemRestrictions',
  'evolutionMethod',
  'breedingGroup',
  'championsCustomBehaviour',
  'customBehaviour',
  'showdownMechanicalLayer',
  'commonBuilds',
  'championsRoleIdentity',
  'roleIdentity'
]);

const STAT_FIELDS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst']);

export function getDisplaySpeciesKey(pokemon = {}) {
  return normalizeSpeciesName(pokemon.base_species || pokemon.species || pokemon.name || pokemon.pokemon_id);
}

export function getMechanicalSignature(pokemon = {}, data = {}) {
  const stats = data.indexes?.statsByPokemon?.[pokemon.pokemon_id]
    || (data.collections?.stats || []).find((row) => row.pokemon_id === pokemon.pokemon_id)
    || null;
  const abilities = data.indexes?.abilitiesByPokemon?.[pokemon.pokemon_id] || [];
  const moves = data.indexes?.movesByPokemon?.[pokemon.pokemon_id] || [];

  return stableStringify({
    species: getDisplaySpeciesKey(pokemon),
    pokemon: pickMechanicalFields(pokemon),
    stats: stats ? pickFields(stats, STAT_FIELDS) : null,
    abilities: sortedMechanicalRows(abilities, ['ability_id', 'ability_name', 'name']),
    moves: sortedMechanicalRows(moves, ['move_id', 'move_name', 'name']),
    legality: pickLegalityFields(pokemon)
  });
}

export function isCosmeticOnlyVariant(a, b, data = {}) {
  if (!a || !b) return false;
  if (getDisplaySpeciesKey(a) !== getDisplaySpeciesKey(b)) return false;
  return getMechanicalSignature(a, data) === getMechanicalSignature(b, data);
}

export function groupCosmeticForms(pokemonList = [], data = {}) {
  const source = pokemonList || [];
  const cacheKey = data || source;
  const cached = FORM_GROUP_CACHE.get(cacheKey);
  if (cached?.source === source) return cached.groups;

  const buckets = new Map();
  for (const pokemon of source) {
    if (!pokemon?.pokemon_id) continue;
    const key = `${getDisplaySpeciesKey(pokemon)}|${getMechanicalSignature(pokemon, data)}`;
    const bucket = buckets.get(key) || [];
    bucket.push(pokemon);
    buckets.set(key, bucket);
  }

  const groups = Array.from(buckets.values()).map((forms) => makeDisplayGroup(forms, data));
  groups.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || String(a.pokemon_id || '').localeCompare(String(b.pokemon_id || '')));
  FORM_GROUP_CACHE.set(cacheKey, { source, groups });
  return groups;
}

export function getGroupedPokemonOptions(data = {}) {
  return groupCosmeticForms(data.collections?.pokemon || [], data);
}

export function resolveGroupedPokemonId(pokemonId, data = {}) {
  if (!pokemonId) return '';
  const original = data.indexes?.pokemonById?.[pokemonId];
  if (!original) return pokemonId;
  const match = getGroupedPokemonOptions(data).find((entry) => entry.cosmeticFormIds?.includes(pokemonId));
  return match?.pokemon_id || pokemonId;
}

export function getPokemonDisplayName(pokemon = {}) {
  const base = String(getReadablePokemonName(pokemon)).trim();
  const form = String(pokemon.form_name || '').trim();
  if (!form || /^base$/i.test(form)) return base;

  const regionalName = getRegionalDisplayName(base, form);
  if (regionalName) return regionalName;

  return `${base} (${formatFormLabel(form)})`;
}

function getRegionalDisplayName(base, form) {
  const label = formatFormLabel(form);
  const region = label.match(/^(Alolan|Galarian|Hisuian|Paldean)\b/i)?.[1];
  if (!region) return '';

  const suffix = label
    .replace(new RegExp(`^${region}\\s*`, 'i'), '')
    .replace(/^Form\s*-?\s*/i, '')
    .replace(/\s*Form$/i, '')
    .trim();

  // Mobile selector cards have limited width, so show the common searchable form
  // name first: "Alolan Ninetales" instead of "Ninetales (Alolan Form)".
  // Extra breed details are still kept for forms such as Paldean Tauros.
  return suffix ? `${region} ${base} ${suffix}` : `${region} ${base}`;
}

export function getPokemonFormLabel(pokemon = {}) {
  const form = String(pokemon.form_name || '').trim();
  return form && !/^base$/i.test(form) ? formatFormLabel(form) : '';
}

export function formatFormLabel(formName = '') {
  const raw = String(formName || '').trim();
  if (!raw) return '';
  const paldea = raw.match(/^Paldean Form\s*-\s*(.+)$/i);
  if (paldea) return `Paldean ${paldea[1].replace(/\s+/g, ' ').trim()}`;
  return raw.replace(/\s+/g, ' ').trim();
}

function formPrefixAliases(pokemon = {}) {
  const base = String(pokemon.base_species || pokemon.species || '').trim();
  const form = String(pokemon.form_name || '').trim();
  if (!base || !form || /^base$/i.test(form)) return [];
  const compactForm = formatFormLabel(form);
  const regionalPrefix = compactForm.replace(/\s*Form$/i, '').replace(/\s+Breed$/i, '').trim();
  const aliases = [
    `${compactForm} ${base}`,
    `${base} ${compactForm}`,
    regionalPrefix && `${regionalPrefix} ${base}`,
    regionalPrefix && `${base} ${regionalPrefix}`
  ];
  if (/^Paldean/i.test(compactForm)) {
    const breed = compactForm.replace(/^Paldean\s+/i, '').replace(/\s+Breed$/i, '').trim();
    aliases.push(`Paldean ${base}`, `${base} Paldean`, `${base} ${breed}`, `${breed} ${base}`, `Paldean ${base} ${breed}`, `${base} Paldean ${breed}`);
  }
  if (/^Alolan/i.test(compactForm)) aliases.push(`${base} Alola`, `Alola ${base}`);
  if (/^Hisuian/i.test(compactForm)) aliases.push(`${base} Hisui`, `Hisui ${base}`);
  if (/^Galarian/i.test(compactForm)) aliases.push(`${base} Galar`, `Galar ${base}`);
  return aliases.filter(Boolean);
}

export function getPokemonSearchAliases(pokemon = {}) {
  return [
    getPokemonDisplayName(pokemon),
    pokemon.name,
    pokemon.pokemon_id,
    pokemon.base_species,
    pokemon.form_name,
    pokemon.ndex,
    pokemon.typing,
    pokemon.type_1,
    pokemon.type_2,
    ...formPrefixAliases(pokemon),
    ...(pokemon.cosmeticAliases || []),
    ...(pokemon.cosmeticFormIds || [])
  ].filter(Boolean);
}

function makeDisplayGroup(forms, data) {
  const representative = chooseRepresentative(forms);
  const aliases = unique(forms.flatMap((form) => [form.name, form.pokemon_id, form.base_species, form.form_name]));
  const ids = unique(forms.map((form) => form.pokemon_id).filter(Boolean));
  const collapsed = forms.length > 1;
  const displayName = collapsed ? cleanBaseSpeciesName(representative) : getPokemonDisplayName(representative);

  return {
    ...representative,
    name: displayName,
    display_name: displayName,
    canonicalPokemonId: representative.pokemon_id,
    cosmeticAliases: aliases,
    cosmeticFormIds: ids,
    cosmeticFormCount: forms.length,
    collapsedCosmeticForms: collapsed,
    mechanicalSignature: getMechanicalSignature(representative, data)
  };
}

function chooseRepresentative(forms) {
  return forms.slice().sort((a, b) => representativeRank(a) - representativeRank(b) || String(a.name || '').localeCompare(String(b.name || '')))[0];
}

function representativeRank(pokemon = {}) {
  const name = normalizeSpeciesName(pokemon.name);
  const base = getDisplaySpeciesKey(pokemon);
  const form = normalizeSpeciesName(pokemon.form_name);
  if (name === base || form === 'base' || !form) return 0;
  if (String(pokemon.pokemon_id || '').match(/^PKMN_\d+$/)) return 1;
  return 5;
}

function cleanBaseSpeciesName(pokemon = {}) {
  return getReadablePokemonName(pokemon);
}

function pickMechanicalFields(pokemon) {
  return pickFields(pokemon, MECHANICAL_POKEMON_FIELDS);
}

function pickLegalityFields(pokemon) {
  return Object.fromEntries(Object.entries(pokemon || {}).filter(([key]) => /legal|ruleset|restriction|champions|custom/i.test(key)).sort(([a], [b]) => a.localeCompare(b)));
}

function pickFields(source = {}, fields = []) {
  return Object.fromEntries(fields.map((field) => [field, normalizeValue(source[field])]).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function sortedMechanicalRows(rows = [], fields = []) {
  return rows.map((row) => pickFields(row, fields)).map(stableStringify).sort();
}

function normalizeSpeciesName(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue).filter((entry) => entry !== undefined && entry !== null && entry !== '');
  if (value && typeof value === 'object') {
    const clean = Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested)]).filter(([, nested]) => nested !== undefined && nested !== null && nested !== ''));
    return Object.keys(clean).length ? clean : undefined;
  }
  if (typeof value === 'string') return value.trim();
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
