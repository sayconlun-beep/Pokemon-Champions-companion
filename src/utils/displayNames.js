const RAW_ID_PREFIXES = /^(PKMN|ABILITY|MOVE|ITEM)_/i;

export function readableFromId(value = '', fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const pokemonMatch = raw.match(/^PKMN_0*(\d+)(?:_(.+))?$/i);
  if (pokemonMatch) {
    const suffix = pokemonMatch[2] ? ` ${titleCase(pokemonMatch[2])}` : '';
    return `Pokémon #${pokemonMatch[1]}${suffix}`;
  }
  return titleCase(raw
    .replace(/^(ABILITY|MOVE|ITEM)_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()) || fallback || raw;
}

function titleCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isRawDatabaseId(value = '') {
  return RAW_ID_PREFIXES.test(String(value || '').trim());
}

export function getReadablePokemonName(pokemon = {}, fallback = 'Unknown Pokémon') {
  pokemon ||= {};
  const candidates = [pokemon.display_name, pokemon.displayName, pokemon.name, pokemon.base_species, pokemon.species, pokemon.pokemon_name];
  const named = candidates.map((value) => String(value || '').trim()).find((value) => value && !isRawDatabaseId(value));
  if (named) return named;
  return readableFromId(pokemon.pokemon_id || pokemon.id, fallback);
}

export function getReadableAbilityName(ability = {}, fallback = 'Unknown Ability') {
  if (typeof ability === 'string') return readableFromId(ability, fallback);
  ability ||= {};
  const candidates = [ability.display_name, ability.displayName, ability.name, ability.ability_name];
  const named = candidates.map((value) => String(value || '').trim()).find((value) => value && !isRawDatabaseId(value));
  if (named) return named;
  return readableFromId(ability.ability_id || ability.id, fallback);
}

export function getReadableMoveName(move = {}, fallback = 'Unknown Move') {
  if (typeof move === 'string') return readableFromId(move, fallback);
  move ||= {};
  const candidates = [move.display_name, move.displayName, move.name, move.move_name];
  const named = candidates.map((value) => String(value || '').trim()).find((value) => value && !isRawDatabaseId(value));
  if (named) return named;
  return readableFromId(move.move_id || move.id, fallback);
}

export function getReadableItemName(item = {}, fallback = 'No item') {
  if (typeof item === 'string') return readableFromId(item, fallback);
  item ||= {};
  const candidates = [item.display_name, item.displayName, item.name, item.item_name];
  const named = candidates.map((value) => String(value || '').trim()).find((value) => value && !isRawDatabaseId(value));
  if (named) return named;
  return readableFromId(item.item_id || item.id, fallback);
}
