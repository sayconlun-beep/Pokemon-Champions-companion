export const ANALYSIS_DESK_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

export const TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A', Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD'
};

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAnalysisDeskSelectedMoves(slot = {}) {
  const rawMoves = Array.isArray(slot?.moves)
    ? slot.moves
    : [slot?.move1, slot?.move2, slot?.move3, slot?.move4];
  return rawMoves.filter(Boolean);
}

export function humanList(items = []) {
  const clean = items.filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

export function getAnalysisDeskSelectedTeam(team = []) {
  return (Array.isArray(team) ? team : []).filter((slot) => slot && slot.pokemon_id);
}

export function normalizeName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function ensureAnalysisDeskPokemonIndex(data = {}) {
  const existing = data?.indexes?.pokemonById || {};
  if (Object.keys(existing).length) return data;
  const rows = data?.collections?.pokemon || data?.pokemon || data?.pokemonRows || [];
  const pokemonById = Object.fromEntries((Array.isArray(rows) ? rows : []).filter((row) => row?.pokemon_id).map((row) => [row.pokemon_id, row]));
  return { ...data, indexes: { ...(data?.indexes || {}), pokemonById } };
}

export function getAnalysisDeskPokemonTypes(slot = {}, data = {}) {
  const indexedData = ensureAnalysisDeskPokemonIndex(data);
  const pokemonById = indexedData?.indexes?.pokemonById || {};
  const pokemon = pokemonById[slot?.pokemon_id] || slot?.pokemon || slot || {};
  const rawTypes = [
    slot?.typeOverride,
    slot?.type_1,
    slot?.type_2,
    slot?.type1,
    slot?.type2,
    pokemon?.type_1,
    pokemon?.type_2,
    pokemon?.type1,
    pokemon?.type2
  ];

  return [...new Set(rawTypes.flatMap(splitAnalysisDeskTypes).map(normalizeAnalysisDeskType).filter(Boolean))];
}

export function splitAnalysisDeskTypes(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\/,&|]+/).map((entry) => entry.trim());
}

export function normalizeAnalysisDeskType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  return ANALYSIS_DESK_TYPES.find((type) => type.toLowerCase() === clean) || '';
}

export function firstSentence(value = '', maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trim()}…` : sentence;
}

export function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function escapeAttr(value) {
  return escapeText(value);
}
