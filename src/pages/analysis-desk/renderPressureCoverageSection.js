import { buildSpecificPressureTags } from '../../components/TeamSlotCard.js';
import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { ANALYSIS_DESK_TYPES, TYPE_COLORS, escapeAttr, escapeText, getAnalysisDeskPokemonTypes, humanList, normalizeAnalysisDeskType } from './analysisDeskHelpers.js';

export function safeBuildAnalysisDeskPressureCoverage(team = [], data = {}) {
  try {
    return buildAnalysisDeskPressureCoverage(team, data);
  } catch (error) {
    console.warn('Pressure coverage render failed.', error);
    return { members: [], types: [] };
  }
}

export function renderPressureCoverageSection(presentation = {}) {
  const pressure = presentation?.analysis?.pressureCoverage || {};
  if (!Array.isArray(pressure.members) || !pressure.members.length) return '';
  return `<section class="analysis-section tactical-section-group pressure-coverage-analysis-section summary-surface">
    <div class="section-heading-row team-style-heading-row"><div><h2>${escapeText(pressure.title || 'Pressure Coverage')}</h2></div></div>
    <p class="section-summary">${escapeText(pressure.summary || 'Selected moves decide which attacking types this team can pressure.')}</p>
    <div class="pressure-coverage-grid weakness-coverage-grid" aria-label="Team offensive pressure coverage">
      ${(pressure.types || []).map((entry) => renderPressureCoverageTile(entry)).join('')}
    </div>
  </section>`;
}

function buildAnalysisDeskPressureCoverage(team = [], data = {}) {
  const pokemonById = data?.indexes?.pokemonById || {};
  const movesById = data?.indexes?.movesById || {};
  const members = (Array.isArray(team) ? team : []).map((slot, index) => {
    const pokemon = slot?.pokemon_id ? pokemonById[slot.pokemon_id] : null;
    if (!pokemon) return null;
    const types = getAnalysisDeskPokemonTypes(slot, data);
    const moves = getAnalysisDeskSelectedMoves(slot).map((id) => movesById[id] || (typeof id === 'object' ? id : null)).filter(Boolean);
    return { slot, index, pokemon, name: getPokemonDisplayName(pokemon), types, moves, tags: buildSpecificPressureTags(slot, pokemon, data, 8) };
  }).filter(Boolean);

  const byType = new Map(ANALYSIS_DESK_TYPES.map((type) => [type, []]));
  members.forEach((member) => {
    member.moves.forEach((move) => {
      const type = normalizeAnalysisDeskType(move?.type);
      if (!type || !byType.has(type)) return;
      const shape = pressureMoveShape(move);
      const detail = {
        pokemon: member.name,
        shape,
        moveName: move?.name || move?.move_name || move?.move_id || 'Unknown move',
        power: movePowerLabel(move),
        stab: member.types.includes(type),
        note: pressureMoveNote(move)
      };
      byType.get(type).push(detail);
    });
  });

  const types = ANALYSIS_DESK_TYPES.map((type) => {
    const details = byType.get(type) || [];
    const uniquePokemon = [...new Set(details.map((item) => item.pokemon))];
    const strength = uniquePokemon.length >= 2 ? 'COVERED' : uniquePokemon.length === 1 ? 'LIGHT' : 'NONE';
    const contributors = uniquePokemon.map((name) => {
      const shapes = [...new Set(details.filter((item) => item.pokemon === name).map((item) => item.shape).filter(Boolean))];
      return { name, shape: shapes.join('/') || 'single-target' };
    });
    return { type, strength, contributors, details };
  });

  const covered = types.filter((entry) => entry.strength === 'COVERED').map((entry) => entry.type);
  const light = types.filter((entry) => entry.strength === 'LIGHT').map((entry) => entry.type);
  const none = types.filter((entry) => entry.strength === 'NONE').map((entry) => entry.type);
  const strongText = covered.length ? `strong pressure in ${humanList(covered.slice(0, 4))}` : light.length ? `some pressure in ${humanList(light.slice(0, 4))}` : 'very little confirmed offensive pressure';
  const lackingText = none.length ? ` but lacks ${humanList(none.slice(0, 4))} coverage` : ' with no uncovered offensive types';
  return { members, types, summary: `Your team has ${strongText}${lackingText}.` };
}

function renderPressureCoverageTile(entry = {}) {
  const contributors = entry.contributors || [];
  const details = entry.details || [];
  const count = contributors.length;
  const metricClass = count >= 2 ? 'metric-positive' : count === 1 ? 'metric-light' : 'metric-empty';
  const metric = count >= 1 ? '●'.repeat(Math.min(3, count)) : '—';
  const label = count === 1 ? '1 contributor' : `${count} contributors`;
  return `<article class="type-heatmap-tile pressure-coverage-tile pressure-${entry.strength?.toLowerCase() || 'none'} type-${String(entry.type || '').toLowerCase()}" style="--type-color: ${escapeAttr(TYPE_COLORS[entry.type] || '#64748b')}">
    <details class="type-heatmap-details pressure-coverage-details">
      <summary class="type-heatmap-face" aria-label="${escapeAttr(entry.type || 'Type')} offense coverage: ${escapeAttr(label)}">
        <strong>${escapeText(entry.type)}</strong>
        <span class="type-heatmap-metric ${metricClass}">${escapeText(metric)}</span>
      </summary>
      <div class="type-heatmap-detail-panel weakness-coverage-detail-body">
        <p><b>Contributors:</b> ${contributors.length ? escapeText(contributors.map((item) => item.name).join(', ')) : 'None'}</p>
        ${details.length ? details.map((item) => `<p><b>${escapeText(item.pokemon)}:</b> ${escapeText(item.moveName)} — ${escapeText(item.power)}${item.stab ? ', STAB' : ''}${item.note ? `, ${escapeText(item.note)}` : ''}</p>`).join('') : '<p>No selected move currently contributes this attacking type.</p>'}
      </div>
    </details>
  </article>`;
}


function getAnalysisDeskSelectedMoves(slot = {}) {
  const rawMoves = Array.isArray(slot?.moves)
    ? slot.moves
    : [slot?.move1, slot?.move2, slot?.move3, slot?.move4];
  return rawMoves.filter(Boolean);
}

function pressureMoveShape(move = {}) {
  const name = String(move?.name || move?.move_name || '').toLowerCase();
  const category = String(move?.category || '').toLowerCase();
  const priority = Number(move?.priority || 0);
  const spreadNames = ['heat wave','blizzard','dazzling gleam','earthquake','rock slide','surf','muddy water','discharge','icy wind','snarl','hyper voice','eruption','water spout'];
  const disruptionNames = ['fake out','taunt','encore','parting shot','whirlwind','roar','disable','spore','will-o-wisp','will o wisp','thunder wave','nuzzle'];
  const shapes = [];
  if (disruptionNames.some((term) => name.includes(term))) shapes.push('disruption');
  if (priority > 0) shapes.push('priority');
  if (spreadNames.some((term) => name.includes(term))) shapes.push('spread');
  if (!shapes.length && category === 'status') shapes.push('status');
  if (!shapes.length) shapes.push('single-target');
  return shapes.join('/');
}

function movePowerLabel(move = {}) {
  const power = Number(move?.power || move?.basePower || 0);
  return power > 0 ? `${power} BP` : '— BP';
}

function pressureMoveNote(move = {}) {
  const name = String(move?.name || '').toLowerCase();
  if (name.includes('weather ball')) return 'becomes Fire in sun if sun is active';
  if (Number(move?.priority || 0) > 0) return `+${Number(move.priority)} priority`;
  return '';
}
