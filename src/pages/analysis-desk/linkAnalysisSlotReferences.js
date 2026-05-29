import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { escapeRegExp, escapeText } from './analysisDeskHelpers.js';

export function linkAnalysisSlotReferences(markup = '', team = [], data = {}) {
  const names = (Array.isArray(team) ? team : []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null;
    const name = pokemon ? getPokemonDisplayName(pokemon) : '';
    return name ? { name, index } : null;
  }).filter(Boolean).sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return markup;

  const chunks = String(markup).split(/(<[^>]+>)/g);
  return chunks.map((chunk) => {
    if (!chunk || chunk.startsWith('<')) return chunk;
    let out = chunk;
    names.forEach(({ name, index }) => {
      const escaped = escapeText(name);
      const pattern = new RegExp(`(^|[^\\w-])(${escapeRegExp(escaped)})(?=$|[^\\w-])`, 'g');
      out = out.replace(pattern, `$1<a class="analysis-slot-reference" href="/team-builder" data-route="team-builder" data-scroll-slot="${index}">$2</a>`);
    });
    return out;
  }).join('');
}
