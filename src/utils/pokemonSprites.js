import { getReadablePokemonName } from './displayNames.js';
const HOME_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home';
const POKEAPI_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const SILHOUETTE_SRC = '/assets/pokemon-silhouette.svg';

const spriteCache = new Map();
const preloadCache = new Map();

export function getPokemonSprite(pokemon, options = {}) {
  const id = resolvePokemonId(pokemon);
  const name = getReadablePokemonName(pokemon || { pokemon_id: id }, 'Pokémon');
  const sprite = getPokemonSpriteById(id, { ...options, name });
  return {
    src: sprite.src,
    alt: `${name} sprite`,
    loading: 'lazy'
  };
}

export function getPokemonSpriteById(id, options = {}) {
  const resolvedId = normalizeId(id);
  const variant = normalizeVariant(options);
  const stage = options.stage || 'home';
  const cacheKey = `${resolvedId || 'missing'}:${variant.shiny ? 'shiny' : 'normal'}:${variant.form || 'base'}:${stage}`;

  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);

  const src = buildSpriteUrl(resolvedId, variant, stage);
  const result = {
    src,
    alt: `${options.name || `Pokémon ${resolvedId || ''}`.trim() || 'Pokémon'} sprite`,
    loading: 'lazy'
  };

  spriteCache.set(cacheKey, result);
  return result;
}

export function preloadPokemonSprite(id, options = {}) {
  const resolvedId = normalizeId(id);
  if (!resolvedId || typeof Image === 'undefined') return Promise.resolve(getPokemonSpriteById(resolvedId, { ...options, stage: 'silhouette' }));

  const cacheKey = `${resolvedId}:${options.shiny ? 'shiny' : 'normal'}:${options.form || 'base'}`;
  if (preloadCache.has(cacheKey)) return preloadCache.get(cacheKey);

  const promise = loadSprite(getPokemonSpriteById(resolvedId, { ...options, stage: 'home' }).src)
    .then(() => getPokemonSpriteById(resolvedId, { ...options, stage: 'home' }))
    .catch(() => loadSprite(getPokemonSpriteById(resolvedId, { ...options, stage: 'pokeapi' }).src)
      .then(() => getPokemonSpriteById(resolvedId, { ...options, stage: 'pokeapi' }))
      .catch(() => getPokemonSpriteById(resolvedId, { ...options, stage: 'silhouette' })));

  preloadCache.set(cacheKey, promise);
  return promise;
}

function buildSpriteUrl(id, variant, stage) {
  if (!id) return SILHOUETTE_SRC;
  if (stage === 'silhouette') return SILHOUETTE_SRC;

  const shinySegment = variant.shiny ? '/shiny' : '';
  const fileName = `${id}.png`;

  if (stage === 'pokeapi') return `${POKEAPI_BASE_URL}${shinySegment}/${fileName}`;
  return `${HOME_BASE_URL}${shinySegment}/${fileName}`;
}

function loadSprite(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(src);
    image.onerror = reject;
    image.src = src;
  });
}

function resolvePokemonId(pokemon) {
  return normalizeId(pokemon?.ndex ?? pokemon?.national_dex ?? pokemon?.nationalDex ?? pokemon?.id ?? pokemon?.pokemon_id);
}

function normalizeId(id) {
  if (id === null || id === undefined) return '';
  const raw = String(id).trim();
  if (!raw) return '';
  const numeric = raw.match(/(?:PKMN[_-]?)?(\d+)/i)?.[1] || raw.match(/\d+/)?.[0];
  if (!numeric) return '';
  return String(Number(numeric));
}

function normalizeVariant(options = {}) {
  return {
    shiny: Boolean(options.shiny),
    form: options.form ? String(options.form).trim().toLowerCase() : ''
  };
}
