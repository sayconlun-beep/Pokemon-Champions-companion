import { POKEMON_TYPE_ORDER, getPokemonTypeChipStyle, normalizePokemonType } from '../constants/pokemonTypeColors.js';

const TYPE_SET = new Set(POKEMON_TYPE_ORDER.map((type) => type.toLowerCase()));

export function TypeBadges(pokemon, extraClass = '') {
  const types = pokemonTypes(pokemon);
  if (!types.length) return TypeBadge('Unknown', extraClass);
  return types.map((type) => TypeBadge(type, extraClass)).join('');
}

export function TypeBadge(type, extraClass = '') {
  const clean = cleanType(type) || 'Unknown';
  const classType = clean === 'Unknown' ? 'unknown' : clean.toLowerCase();
  return `<span class="badge type-badge type-${escapeAttr(classType)} ${escapeAttr(extraClass)}" style="${escapeAttr(getPokemonTypeChipStyle(clean))}">${escapeText(clean)}</span>`;
}

export function pokemonTypes(pokemon) {
  const typed = [pokemon?.type_1, pokemon?.type_2, pokemon?.type1, pokemon?.type2].filter(Boolean).map(cleanType).filter(Boolean);
  if (typed.length) return [...new Set(typed)];
  return String(pokemon?.typing || '')
    .split(/[\/,&]+/)
    .map(cleanType)
    .filter(Boolean);
}

function cleanType(value) {
  const normalized = normalizePokemonType(value);
  if (normalized) return normalized;
  const formatted = String(value || '').trim().toLowerCase();
  if (!formatted || !TYPE_SET.has(formatted)) return '';
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeText(value); }
