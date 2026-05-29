const POKEMON_TYPE_COLORS = Object.freeze({
  Normal: '#A8A77A',
  Fire: '#EE8130',
  Water: '#6390F0',
  Electric: '#F7D02C',
  Grass: '#7AC74C',
  Ice: '#96D9D6',
  Fighting: '#C22E28',
  Poison: '#A33EA1',
  Ground: '#E2BF65',
  Flying: '#A98FF3',
  Psychic: '#F95587',
  Bug: '#A6B91A',
  Rock: '#B6A136',
  Ghost: '#735797',
  Dragon: '#6F35FC',
  Dark: '#705746',
  Steel: '#B7B7CE',
  Fairy: '#D685AD'
});

const TYPE_ALIASES = new Map(Object.keys(POKEMON_TYPE_COLORS).map((type) => [type.toLowerCase(), type]));
const FALLBACK_TYPE_COLOR = '#9AA4BD';

export const POKEMON_TYPE_ORDER = Object.freeze(Object.keys(POKEMON_TYPE_COLORS));

export function normalizePokemonType(type) {
  const key = String(type || '').trim().toLowerCase();
  return TYPE_ALIASES.get(key) || '';
}

export function getPokemonTypeColor(type) {
  const normalized = normalizePokemonType(type);
  return POKEMON_TYPE_COLORS[normalized] || FALLBACK_TYPE_COLOR;
}

export function getPokemonTypeBackground(type) {
  const color = getPokemonTypeColor(type);
  return `linear-gradient(180deg, ${hexToRgba(color, 0.38)}, ${hexToRgba(color, 0.22)})`;
}

export function getPokemonTypeBorder(type) {
  return hexToRgba(getPokemonTypeColor(type), 0.78);
}

export function getPokemonTypeText(type) {
  const color = getPokemonTypeColor(type);
  const { r, g, b } = hexToRgb(color);
  const luminance = (0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b));
  return luminance > 0.58 ? '#111827' : '#F8FAFC';
}

export function getPokemonTypeChipStyle(type) {
  const color = getPokemonTypeColor(type);
  const text = getPokemonTypeText(type);
  const shadow = text === '#111827' ? '0 1px 0 rgba(255,255,255,.24)' : '0 1px 1px rgba(0,0,0,.35)';
  return [
    `--type-color:${color}`,
    `--type-border:${getPokemonTypeBorder(type)}`,
    `background:${getPokemonTypeBackground(type)}`,
    `border-color:${getPokemonTypeBorder(type)}`,
    `color:${text}`,
    `text-shadow:${shadow}`,
    `box-shadow:inset 0 1px 0 rgba(255,255,255,.16), 0 0 0 1px ${hexToRgba(color, 0.12)}, 0 2px 10px rgba(0,0,0,.18)`
  ].join(';');
}

function hexToRgb(hex) {
  const clean = String(hex || FALLBACK_TYPE_COLOR).replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean.padEnd(6, '0').slice(0, 6);
  const int = Number.parseInt(value, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function srgb(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
