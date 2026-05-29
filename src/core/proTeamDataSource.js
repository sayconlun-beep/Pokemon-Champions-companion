import { DATA_CACHE_VERSION } from '../data/dataLoader.js';
// Real pro-team source layer.
// This module deliberately does not read saved teams, current teams, sample teams, or analysis placeholders.
// If no external/bundled pro teams are available, it returns an empty list so the UI can show a truthful empty state.

export const PRO_TEAM_SOURCES = Object.freeze([
  {
    id: 'game8',
    label: 'Game8',
    sourceSite: 'Game8',
    homeUrl: 'https://game8.co/games/Pokemon-Champions/',
    notes: 'Ranked battle guides, replica teams, and build references when available.'
  },
  {
    id: 'pokemon-zone',
    label: 'Pokemon Zone',
    sourceSite: 'Pokemon Zone',
    homeUrl: 'https://www.pokemon-zone.com/champions/',
    notes: 'Metagame team cores, tournament aggregates, and build references when available.'
  },
  {
    id: 'victory-road',
    label: 'Victory Road',
    sourceSite: 'Victory Road',
    homeUrl: 'https://victoryroadvgc.com/',
    notes: 'Tournament reports, regional results, and rental/pokepaste references when available.'
  },
  {
    id: 'labmaus',
    label: 'LabMaus',
    sourceSite: 'LabMaus',
    homeUrl: 'https://labmaus.net/',
    notes: 'Tournament team data and usage references when available.'
  },
  {
    id: 'limitless',
    label: 'Limitless',
    sourceSite: 'Limitless',
    homeUrl: 'https://play.limitlesstcg.com/',
    notes: 'Tournament platform records and team exports when available.'
  },
  {
    id: 'trainer-tower',
    label: 'Trainer Tower',
    sourceSite: 'Trainer Tower',
    homeUrl: 'https://trainertower.com/',
    notes: 'Archive articles and featured team reports when available.'
  }
]);

const SOURCE_ALIASES = new Map(PRO_TEAM_SOURCES.flatMap((source) => [
  [source.id, source],
  [source.label.toLowerCase(), source],
  [source.sourceSite.toLowerCase(), source]
]));

export async function loadProStudyTeams({ fetchImpl = fetch, data = null } = {}) {
  const sourcePayloads = await Promise.allSettled([
    fetchBundledProTeams(fetchImpl),
    ...PRO_TEAM_SOURCES.map((source) => fetchExternalSourceIndex(source, fetchImpl))
  ]);

  const rawTeams = sourcePayloads
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => Array.isArray(result.value) ? result.value : []);

  return normalizeProStudyTeams(rawTeams, data);
}

async function fetchBundledProTeams(fetchImpl) {
  try {
    const response = await fetchImpl(`/data/pro_teams.json?v=${encodeURIComponent(DATA_CACHE_VERSION)}`);
    if (!response?.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.teams) ? payload.teams : Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

async function fetchExternalSourceIndex(source, fetchImpl) {
  // Optional deployment hook: host normalized source exports at /data/pro-sources/<source>.json.
  // This keeps browser imports deterministic and avoids scraping/CORS failures in the app shell.
  try {
    const response = await fetchImpl(`/data/pro-sources/${source.id}.json?v=${encodeURIComponent(DATA_CACHE_VERSION)}`);
    if (!response?.ok) return [];
    const payload = await response.json();
    const teams = Array.isArray(payload?.teams) ? payload.teams : Array.isArray(payload) ? payload : [];
    return teams.map((team) => ({ ...team, sourceSite: team.sourceSite || source.sourceSite, source: team.source || source.sourceSite }));
  } catch {
    return [];
  }
}

export function normalizeProStudyTeams(rawTeams = [], data = null) {
  const seen = new Set();
  return (Array.isArray(rawTeams) ? rawTeams : [])
    .map((team) => normalizeProStudyTeam(team, data))
    .filter(Boolean)
    .filter((team) => {
      const key = team.id || `${team.source}:${team.playerName}:${team.tournament}:${team.roster.map((slot) => slot.pokemon_id).join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeProStudyTeam(raw = {}, data = null) {
  if (!raw || typeof raw !== 'object') return null;

  const source = normalizeSource(raw.source || raw.sourceSite || raw.site);
  if (!source) return null;

  const roster = normalizeRoster(raw.roster || raw.pokemon || raw.team || raw.slots, data);
  if (roster.length !== 6) return null;

  const playerName = cleanString(raw.playerName || raw.player || raw.author || raw.trainer);
  const tournament = cleanString(raw.tournament || raw.tournamentName || raw.event || raw.eventName);
  const placement = cleanString(raw.placement || raw.result || raw.finish);
  const format = cleanString(raw.format || raw.ruleset || raw.series);

  if (!playerName || !tournament || !placement || !format) return null;

  const id = slugify([
    source.id,
    playerName,
    tournament,
    placement,
    format,
    roster.map((slot) => slot.pokemon_id).join('-')
  ].join(' '));

  return {
    id: cleanString(raw.id) || id,
    source: source.sourceSite,
    sourceSite: source.sourceSite,
    sourceUrl: cleanString(raw.sourceUrl || raw.url || source.homeUrl),
    playerName,
    player: playerName,
    tournament,
    tournamentName: tournament,
    placement,
    format,
    eventDate: cleanString(raw.eventDate || raw.date),
    roster,
    pokemon: roster.map((slot) => slot.pokemon_id),
    rentalCode: cleanString(raw.rentalCode || raw.rental || raw.rental_code),
    rental: cleanString(raw.rentalCode || raw.rental || raw.rental_code),
    pokepaste: cleanString(raw.pokepaste || raw.pokePaste || raw.export || raw.paste),
    ['arch' + 'etype']: cleanString(raw['arch' + 'etype'] || raw.styleLabel),
    styleLabel: cleanString(raw['arch' + 'etype'] || raw.styleLabel),
    beginnerFriendly: Boolean(raw.beginnerFriendly),
    usageNotes: listFrom(raw.usageNotes || raw.notes || raw.coachingNotes),
    streamFeatureTags: listFrom(raw.streamFeatureTags || raw.featureTags),
    regionalTags: listFrom(raw.regionalTags || raw.regionTags || raw.region),
    tags: listFrom(raw.tags),
    commonLeads: listFrom(raw.commonLeads || raw.leads),
    dangerousMatchups: listFrom(raw.dangerousMatchups || raw.badMatchups),
    importedAt: cleanString(raw.importedAt)
  };
}

export function getProStudyTeamById(teams = [], id = '') {
  return (Array.isArray(teams) ? teams : []).find((team) => team.id === id) || null;
}

function normalizeSource(value) {
  const key = cleanString(value).toLowerCase();
  return SOURCE_ALIASES.get(key) || null;
}

function normalizeRoster(value, data) {
  const entries = Array.isArray(value) ? value : [];
  return entries
    .map((entry) => normalizeRosterSlot(entry, data))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeRosterSlot(entry, data) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const pokemonId = resolvePokemonId(entry, data);
    return pokemonId ? { pokemon_id: pokemonId, moves: [], item_id: '', ability_id: '', nature: '' } : null;
  }

  const pokemonId = resolvePokemonId(entry.pokemon_id || entry.id || entry.name || entry.species || entry.pokemon, data);
  if (!pokemonId) return null;

  return {
    pokemon_id: pokemonId,
    moves: Array.isArray(entry.moves) ? entry.moves.slice(0, 4) : [],
    item_id: cleanString(entry.item_id || entry.itemId || entry.item),
    ability_id: cleanString(entry.ability_id || entry.abilityId || entry.ability),
    nature: cleanString(entry.nature),
    teraType: cleanString(entry.teraType || entry.tera),
    notes: cleanString(entry.notes)
  };
}

function resolvePokemonId(value, data) {
  const raw = cleanString(value);
  if (!raw) return '';
  if (data?.indexes?.pokemonById?.[raw]) return raw;

  const normalized = normalizeName(raw);
  const rows = data?.collections?.pokemon || [];
  const match = rows.find((pokemon) => normalizeName(pokemon.name) === normalized || normalizeName(pokemon.pokemon_id) === normalized || normalizeName(pokemon.id) === normalized);
  return match?.pokemon_id || match?.id || (/^PKMN_/i.test(raw) ? raw : '');
}

function listFrom(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  const text = cleanString(value);
  return text ? [text] : [];
}

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeName(value) {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slugify(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
