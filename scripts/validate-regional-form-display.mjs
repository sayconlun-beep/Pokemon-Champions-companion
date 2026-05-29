import fs from 'node:fs';
const pokemon = JSON.parse(fs.readFileSync(new URL('../public/data/pokemon.json', import.meta.url), 'utf8'));
import { getPokemonDisplayName, getPokemonFormLabel, getPokemonSearchAliases } from '../src/utils/formGrouping.js';

const required = [
  ['PKMN_0026_ALOLA', 'Raichu (Alolan Form)', ['Alolan Raichu', 'Raichu Alola', 'Raichu']],
  ['PKMN_0038_ALOLA', 'Ninetales (Alolan Form)', ['Alolan Ninetales', 'Ninetales Alola', 'Ninetales']],
  ['PKMN_0059_HISUI', 'Arcanine (Hisuian Form)', ['Hisuian Arcanine', 'Arcanine Hisui']],
  ['PKMN_0080_GALAR', 'Slowbro (Galarian Form)', ['Galarian Slowbro', 'Slowbro Galar']],
  ['PKMN_0128_PALDEA_COMBAT', 'Tauros (Paldean Combat Breed)', ['Paldean Tauros', 'Tauros Combat']],
  ['PKMN_0128_PALDEA_BLAZE', 'Tauros (Paldean Blaze Breed)', ['Tauros Blaze', 'Paldean Tauros']],
  ['PKMN_0128_PALDEA_AQUA', 'Tauros (Paldean Aqua Breed)', ['Tauros Aqua', 'Paldean Tauros']],
  ['PKMN_0157_HISUI', 'Typhlosion (Hisuian Form)', ['Hisuian Typhlosion', 'Typhlosion Hisui']],
  ['PKMN_0199_GALAR', 'Slowking (Galarian Form)', ['Galarian Slowking', 'Slowking Galar']]
];
const byId = Object.fromEntries(pokemon.map((p) => [p.pokemon_id, p]));
const failures = [];
function norm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
for (const [id, expected, queries] of required) {
  const row = byId[id];
  if (!row) failures.push(`${id}: missing row`);
  else {
    if (getPokemonDisplayName(row) !== expected) failures.push(`${id}: display ${getPokemonDisplayName(row)} !== ${expected}`);
    if (!getPokemonFormLabel(row)) failures.push(`${id}: missing form label`);
    const aliases = getPokemonSearchAliases(row).map(norm).join(' | ');
    for (const q of queries) if (!aliases.includes(norm(q))) failures.push(`${id}: query alias missing ${q}`);
  }
}
const ids = new Set(required.map(([id]) => id));
for (const [id] of required) {
  const row = byId[id];
  const base = pokemon.find((p) => p.ndex === row.ndex && String(p.form_name || 'Base').toLowerCase() === 'base');
  if (!base) failures.push(`${id}: base form not found`);
  else if (ids.has(base.pokemon_id)) failures.push(`${id}: base form collapsed into regional id`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Regional form display validation passed.');
