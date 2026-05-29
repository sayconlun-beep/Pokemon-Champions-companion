import { validateDatabase } from './schemaValidator.js';
import { getReadablePokemonName } from '../utils/displayNames.js';

export const DATA_CACHE_VERSION = 'move-picker-split-data-only-2026-05-29';

const STARTUP_COLLECTIONS = Object.freeze(['core', 'pokemon', 'moves', 'items', 'abilities', 'team_building_principles', 'learning_concepts']);
const COLLECTION_FILES = Object.freeze({
  core: 'core.json',
  pokemon: 'pokemon.json',
  moves: 'moves.json',
  items: 'items.json',
  abilities: 'abilities.json',
  pokemon_moves: 'pokemon_moves.json',
  pokemon_abilities: 'pokemon_abilities.json',
  rulesets: 'rulesets.json',
  formats: 'formats.json',
  stats: 'stats.json',
  pokemon_biographies: 'pokemon_biographies.json',
  team_building_principles: 'team_building_principles.json',
  learning_concepts: 'learning_concepts.json',
  archetypes: 'archetypes.json',
  competitive_cores: 'competitive_cores.json',
  threat_checks: 'threat_checks.json',
  pro_teams: 'pro_teams.json'
});

function runtimeAssetUrl(path) {
  // Resolve split data beside the built app instead of assuming the site is
  // deployed at domain root. This keeps lazy move learnsets working on Netlify,
  // local preview servers, nested routes, and file-based smoke checks.
  return new URL(`../../data/${path}`, import.meta.url).href;
}


const collectionCache = new Map();
const collectionPromises = new Map();
let activeDataRef = null;

export async function loadGoldStandardData() {
  try {
    const parts = await Promise.all(STARTUP_COLLECTIONS.map(loadDataCollection));
    const db = mergeCollectionPayloads(parts);
    const validation = validateDatabase(db);

    if (validation.warnings.length > 0) {
      console.warn('⚠️ Database validation warnings:', validation.warnings);
    }

    const isCompromised = validation.missingFieldReport.length > 50;

    activeDataRef = {
      db,
      ...validation,
      indexes: createIndexes(validation.collections),
      lazyCollections: {
        pokemonMoves: false
      },
      isCompromised,
      loadedAt: new Date().toISOString()
    };

    return activeDataRef;
  } catch (error) {
    const message = `Failed to load split gold-standard data: ${error.message}`;
    console.error('🔴 Data load failed:', message);
    throw new Error(message);
  }
}

export async function loadMoveLegalityData(data = activeDataRef) {
  if (!data) throw new Error('Cannot load move legality data before the core database has loaded.');
  if (data.lazyCollections?.pokemonMoves && data.collections?.pokemonMoves?.length) return data;

  let payload;
  let rows = [];
  try {
    payload = await loadDataCollection('pokemon_moves');
    rows = Array.isArray(payload?.pokemon_moves) ? payload.pokemon_moves : Array.isArray(payload) ? payload : [];
  } catch (splitError) {
    console.warn('Move learnset split file failed, trying alternate split paths:', splitError);
    try {
      payload = await loadSplitMoveLegalityFallback();
      rows = Array.isArray(payload?.pokemon_moves) ? payload.pokemon_moves : Array.isArray(payload) ? payload : [];
    } catch (fallbackError) {
      console.warn('Move learnset split fallback failed, deriving from embedded Pokémon move references:', fallbackError);
      rows = deriveMoveLegalityRowsFromPokemonProfiles(data);
    }
  }

  if (!rows.length) {
    rows = deriveMoveLegalityRowsFromPokemonProfiles(data);
  }
  if (!rows.length) throw new Error('Move learnset payload was empty.');

  data.db ||= {};
  data.collections ||= {};
  data.indexes ||= {};
  data.db.pokemon_moves = rows;
  data.collections.pokemonMoves = rows;
  data.indexes.movesByPokemon = groupBy(rows, 'pokemon_id');
  data.lazyCollections ||= {};
  data.lazyCollections.pokemonMoves = true;
  return data;
}

async function loadSplitMoveLegalityFallback() {
  const attempts = [
    runtimeAssetUrl('pokemon_moves.json'),
    '/data/pokemon_moves.json',
    'data/pokemon_moves.json',
    './data/pokemon_moves.json'
  ];
  let lastError = null;
  for (const path of attempts) {
    try {
      const response = await fetch(withCacheBust(path));
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
      const payload = await response.json();
      if (Array.isArray(payload?.pokemon_moves) && payload.pokemon_moves.length) return payload;
      if (Array.isArray(payload) && payload.length) return { pokemon_moves: payload };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to load move learnset data.');
}

export function hasMoveLegalityData(data = activeDataRef) {
  return Boolean(data?.lazyCollections?.pokemonMoves && data?.collections?.pokemonMoves?.length);
}



function normalizeMoveLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function deriveMoveLegalityRowsFromPokemonProfiles(data = {}) {
  const pokemonRows = data.collections?.pokemon || data.db?.pokemon || [];
  const moveRows = data.collections?.moves || data.db?.moves || [];
  if (!Array.isArray(pokemonRows) || !Array.isArray(moveRows) || !pokemonRows.length || !moveRows.length) return [];

  const moveByKey = new Map();
  for (const move of moveRows) {
    const keys = [move.move_id, move.name, String(move.move_id || '').replace(/^MOVE_/, '')];
    for (const key of keys) {
      const normalized = normalizeMoveLookupKey(key);
      if (normalized && !moveByKey.has(normalized)) moveByKey.set(normalized, move);
    }
  }

  const rows = [];
  for (const pokemon of pokemonRows) {
    const referencedMoves = new Set();
    const addMoveName = (value) => {
      if (typeof value === 'string' && value.trim()) referencedMoves.add(value.trim());
    };

    const championReference = pokemon.showdownMechanicalLayer?.championsLegalMoveReference?.moves;
    if (Array.isArray(championReference)) championReference.forEach(addMoveName);

    const commonBuilds = Array.isArray(pokemon.commonBuilds) ? pokemon.commonBuilds : [];
    for (const build of commonBuilds) {
      if (Array.isArray(build.coreMoves)) build.coreMoves.forEach(addMoveName);
      if (Array.isArray(build.commonFourthMoves)) build.commonFourthMoves.forEach(addMoveName);
    }

    for (const moveName of referencedMoves) {
      const move = moveByKey.get(normalizeMoveLookupKey(moveName));
      if (!move?.move_id || !pokemon?.pokemon_id) continue;
      rows.push({
        pokemon_id: pokemon.pokemon_id,
        move_id: move.move_id,
        pokemon_name: getReadablePokemonName(pokemon),
        move_name: move.name || moveName,
        is_legal: 'Yes',
        learn_method: 'Embedded Pokémon profile fallback',
        source: 'pokemon.showdownMechanicalLayer.championsLegalMoveReference/commonBuilds'
      });
    }
  }
  return rows;
}

function withCacheBust(path) {
  const separator = String(path).includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(DATA_CACHE_VERSION)}`;
}

export function loadDataCollection(name) {
  if (collectionCache.has(name)) return Promise.resolve(collectionCache.get(name));
  if (collectionPromises.has(name)) return collectionPromises.get(name);

  const path = COLLECTION_FILES[name];
  if (!path) return Promise.reject(new Error(`Unknown data collection: ${name}`));

  const urls = [runtimeAssetUrl(path), `/data/${path}`, `data/${path}`, `./data/${path}`];

  const promise = fetchFirstJson(urls)
    .then((payload) => {
      collectionCache.set(name, payload);
      collectionPromises.delete(name);
      return payload;
    })
    .catch((error) => {
      collectionPromises.delete(name);
      throw error;
    });

  collectionPromises.set(name, promise);
  return promise;
}


async function fetchFirstJson(urls) {
  let lastError = null;
  for (const url of [...new Set(urls)]) {
    try {
      const response = await fetch(withCacheBust(url));
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      try {
        return await response.json();
      } catch (parseError) {
        throw new Error(`${url} is invalid JSON: ${parseError.message}`);
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to fetch data collection.');
}

function mergeCollectionPayloads(parts) {
  return parts.reduce((db, payload) => {
    if (Array.isArray(payload)) return db;
    return { ...db, ...(payload || {}) };
  }, {});
}

function createIndexes(collections) {
  return {
    pokemonById: indexBy(collections.pokemon, 'pokemon_id'),
    pokemonByName: indexByName(collections.pokemon),
    movesById: indexBy(collections.moves, 'move_id'),
    abilitiesById: indexBy(collections.abilities, 'ability_id'),
    itemsById: indexBy(collections.items, 'item_id'),
    statsByPokemon: indexBy(collections.stats, 'pokemon_id'),
    movesByPokemon: groupBy(collections.pokemonMoves, 'pokemon_id'),
    abilitiesByPokemon: groupBy(collections.pokemonAbilities, 'pokemon_id')
  };
}

function indexBy(rows = [], key) {
  return Object.fromEntries(rows.map((row) => [row[key], row]).filter(([id]) => id));
}

function indexByName(rows = []) {
  return Object.fromEntries(rows.map((row) => [normalize(row.name || row.pokemon_id), row]).filter(([name]) => name));
}

function groupBy(rows = [], key) {
  return rows.reduce((acc, row) => {
    const id = row[key];
    if (!id) return acc;
    (acc[id] ||= []).push(row);
    return acc;
  }, {});
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}
