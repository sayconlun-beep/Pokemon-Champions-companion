import { ATTACKING_TYPES, TYPE_EFFECTIVENESS } from '../core/weaknessCoverageProfile.js';
import { getPokemonTypeColor, getPokemonTypeText } from '../constants/pokemonTypeColors.js';
import { escapeText } from './SearchableSelector.js';

// Read-only Learning Hub display component.
// This renders the existing type effectiveness table for education only.
// Do not mutate this data or use this component for battle calculations.
export function TypeChartReference() {
  const types = ATTACKING_TYPES || [];
  const typeHeaderStyle = (type) => {
    const background = getPokemonTypeColor(type);
    const color = getPokemonTypeText(type);
    const shadow = color === '#111827' ? '0 1px 0 rgba(255,255,255,.22)' : '0 1px 1px rgba(0,0,0,.38)';
    return `background:${background};color:${color};text-shadow:${shadow};`;
  };

  const typeHeader = (type, extraClass = '') => `<th class="type-chart-type-header${extraClass ? ` ${extraClass}` : ''}" style="${typeHeaderStyle(type)}">${escapeText(type)}</th>`;

  const cell = (attacking, defending) => {
    const value = TYPE_EFFECTIVENESS?.[attacking]?.[defending] ?? 1;
    if (value === 2) return '<td class="type-chart-cell type-chart-super">2×</td>';
    if (value === 0.5) return '<td class="type-chart-cell type-chart-resist">½×</td>';
    if (value === 0) return '<td class="type-chart-cell type-chart-immune">0×</td>';
    return '<td class="type-chart-cell type-chart-neutral" aria-label="1× neutral"></td>';
  };

  return `<div class="type-chart-wrap" role="region" aria-label="Pokémon type chart" tabindex="0">
    <div class="type-chart-legend">
      <span><strong>2×</strong> = super effective</span>
      <span><strong>½×</strong> = resisted</span>
      <span><strong>0×</strong> = immune</span>
      <span>blank = neutral</span>
    </div>
    <table class="learning-type-chart">
      <thead>
        <tr><th class="type-chart-corner">Attack ↓ / Defend →</th>${types.map((type) => typeHeader(type)).join('')}</tr>
      </thead>
      <tbody>
        ${types.map((attacking) => `<tr>${typeHeader(attacking, 'type-chart-row-header')}${types.map((defending) => cell(attacking, defending)).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
