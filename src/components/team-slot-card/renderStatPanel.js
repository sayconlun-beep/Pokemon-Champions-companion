import { NatureSelect } from '../NatureSelect.js';
import { STAT_ALLOCATION_LIMIT, STAT_SINGLE_LIMIT, STAT_DEFINITIONS, STAT_PRESETS, getSlotStatAllocation, getBaseStat, getFinalStat, totalStatAllocation, validateStatAllocation, describeStatInvestment } from '../../core/statAllocationEngine.js';
import { getPokemonTypeColor } from '../../constants/pokemonTypeColors.js';
import { escapeText } from './teamSlotCardCommon.js';
import { NATURE_EFFECTS } from './spreadAnalysisPanel.js';

const MAX_ADJUSTED_STAT = 255;

export function statPanel(slot, index, baseStats, pokemon) {
  const allocation = getSlotStatAllocation(slot);
  const validation = validateStatAllocation(allocation);
  const used = totalStatAllocation(allocation);
  const investmentNotes = describeStatInvestment(slot, pokemon).slice(0, 2);
  const presetLabels = { fastAttacker: 'Fast Attacker', fastSpecialAttacker: 'Fast Sp. Attacker', bulkyAttacker: 'Bulky Attacker', defensive: 'Defensive', balanced: 'Balanced' };
  const matchedPreset = getMatchedStatPreset(allocation);
  const presetValue = matchedPreset || (used ? 'custom' : '');
  const statAccent = getStatAccentColor(pokemon);
  const bst = STAT_DEFINITIONS.reduce((sum, stat) => sum + getBaseStat(baseStats, stat.key), 0);
  const nature = slot?.nature || '';
  const natureEffect = NATURE_EFFECTS[nature] || null;
  const natureCopy = nature ? `${nature}${natureEffect?.up && natureEffect?.down ? ` (+${natureEffect.up}, -${natureEffect.down})` : ' (neutral)'}` : 'Nature not set';

  return `<section class="stat-panel showdown-stat-editor unified-stat-block build-editor-section" aria-label="Stat allocation" style="--stat-max-accent:${escapeText(statAccent)};">
    <div class="unified-stat-header">
      <div class="unified-stat-heading">
        <h4>Stats</h4>
        <p class="unified-stat-summary">BST ${bst} <span aria-hidden="true">•</span> SP ${used} / ${STAT_ALLOCATION_LIMIT} <span aria-hidden="true">•</span> ${escapeText(natureCopy)}</p>
        <p class="muted small-copy">Base shown in grey · coloured fill = EVs applied</p>
      </div>
      <div class="unified-stat-actions">
        <div class="inline-nature-select">${NatureSelect(index, slot)}</div>
        <div class="inline-preset-select">${StatPresetSelect(index, presetValue, presetLabels)}</div>
        <button type="button" class="tiny-button reset-stats-button" data-reset-stats="${index}">Reset Stats</button>
      </div>
    </div>
    ${validation.errors.map((error) => `<p class="warning compact-line">${escapeText(error)}</p>`).join('')}
    <div class="unified-stat-body">
      ${statRadarChart(baseStats, allocation, statAccent)}
      <div class="showdown-stat-table unified-stat-table" role="table" aria-label="Stat points and final stats">
        ${STAT_DEFINITIONS.map((stat) => statControl(index, stat, baseStats, allocation, validation, Math.max(...STAT_DEFINITIONS.map((candidate) => getFinalStat(baseStats, allocation, candidate.key)), 1), statAccent, natureEffect)).join('')}
      </div>
    </div>
    ${investmentNotes.length ? `<details class="stat-details"><summary>Investment notes</summary>${investmentNotes.map((line) => `<p>${escapeText(line)}</p>`).join('')}</details>` : ''}
  </section>`;
}


function StatPresetSelect(slotIndex, presetValue, presetLabels) {
  const options = [
    { value: '', label: 'Preset' },
    ...Object.entries(presetLabels).map(([value, label]) => ({ value, label })),
    { value: 'custom', label: 'Custom' }
  ];
  return `<label class="native-inline-select native-preset-select">
    <span>Preset</span>
    <select data-stat-preset-select-slot="${slotIndex}" aria-label="Stat preset selector">
      ${options.map((option) => `<option value="${escapeText(option.value)}" ${option.value === presetValue ? 'selected' : ''}>${escapeText(option.label)}</option>`).join('')}
    </select>
  </label>`;
}

function getMatchedStatPreset(allocation) {
  return Object.entries(STAT_PRESETS).find(([, preset]) => STAT_DEFINITIONS.every((stat) => Number(allocation?.[stat.key] || 0) === Number(preset?.[stat.key] || 0)))?.[0] || '';
}

export function getSlotActivePokemonForStats(slot, data, fallbackPokemon, megaState = null) {
  const activeMegaId = megaState?.activeMega?.megaPokemonId;
  if (activeMegaId) return data?.indexes?.pokemonById?.[activeMegaId] || fallbackPokemon;
  return fallbackPokemon;
}

export function statRadarChart(baseStats, allocation, statAccent = '#67e8f9', extraClass = '') {
  const finalValues = STAT_DEFINITIONS.map((stat) => getFinalStat(baseStats, allocation, stat.key));
  const minValue = Math.min(...finalValues);
  const maxValue = Math.max(...finalValues);
  const spread = Math.max(1, maxValue - minValue);
  const center = 100;
  const maxRadius = 70;
  const minRadius = 22;
  const points = finalValues.map((value, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const radius = minRadius + ((value - minValue) / spread) * (maxRadius - minRadius);
    return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
  const rings = [0.33, 0.66, 1].map((scale) => STAT_DEFINITIONS.map((_, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const radius = maxRadius * scale;
    return `${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' '));
  const axes = STAT_DEFINITIONS.map((stat, position) => {
    const angle = (-90 + (position * 60)) * (Math.PI / 180);
    const x = (center + Math.cos(angle) * maxRadius).toFixed(1);
    const y = (center + Math.sin(angle) * maxRadius).toFixed(1);
    const labelX = (center + Math.cos(angle) * 84).toFixed(1);
    const labelY = (center + Math.sin(angle) * 84).toFixed(1);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" /><text x="${labelX}" y="${labelY}" dominant-baseline="middle" text-anchor="middle">${escapeText(stat.shortLabel || stat.label)}</text>`;
  }).join('');

  const className = ['stat-radar-wrap', extraClass].filter(Boolean).join(' ');
  return `<div class="${escapeText(className)}" aria-hidden="true" style="--radar-accent:${escapeText(statAccent)};">
    <svg class="stat-radar-chart" viewBox="0 0 200 200" focusable="false">
      <g class="stat-radar-grid">
        ${rings.map((ring) => `<polygon points="${ring}" />`).join('')}
        ${axes}
      </g>
      <polygon class="stat-radar-shape" points="${points}" />
    </svg>
  </div>`;
}

export function getStatAccentColor(pokemon) {
  return getPokemonTypeColor(pokemon?.type_1 || pokemon?.type1 || pokemon?.typing?.split('/')?.[0] || 'Ice') || '#67e8f9';
}

function statControl(index, stat, baseStats, allocation, validation, highestFinalStat = 1, statAccent = '#67e8f9', natureEffect = null) {
  const base = getBaseStat(baseStats, stat.key);
  const value = Number(allocation?.[stat.key] || 0);
  const finalValue = getFinalStat(baseStats, allocation, stat.key);
  const plusDisabled = value >= STAT_SINGLE_LIMIT || validation.remainingPoints <= 0;
  const minusDisabled = value <= 0;
  const sliderMax = Math.min(STAT_SINGLE_LIMIT, value + validation.remainingPoints);
  const status = value >= STAT_SINGLE_LIMIT ? '<span class="showdown-stat-limit"><span aria-hidden="true">❄</span> Max</span>' : '';
  const hasPoints = value > 0 ? 'has-points' : '';
  const barPercent = Math.max(0, Math.min(100, Math.round((finalValue / highestFinalStat) * 100)));
  const barColor = value >= STAT_SINGLE_LIMIT ? statAccent : '#3d91e5';
  const basePercent = Math.max(0, Math.min(100, Math.round((base / highestFinalStat) * 100)));

  const indicator = natureEffect?.up === stat.label
    ? '<span class="nature-indicator boosted" aria-label="Nature boosted">▲</span>'
    : natureEffect?.down === stat.label
      ? '<span class="nature-indicator dropped" aria-label="Nature lowered">▼</span>'
      : '';

  return `<div class="showdown-stat-row ${hasPoints} ${value >= STAT_SINGLE_LIMIT ? 'is-stat-maxed' : ''}" role="row">
    <div class="showdown-stat-name" role="cell"><strong>${escapeText(stat.label)}${indicator}</strong></div>
    <div class="showdown-stat-visual" role="cell" style="--base-pct: ${basePercent}%; --bar-pct: ${barPercent}%; --bar-color: ${barColor};">
      <input class="showdown-stat-range" type="range" min="0" max="${sliderMax}" step="1" value="${value}" data-stat-slot="${index}" data-stat-key="${stat.key}" aria-label="${escapeText(stat.label)} slider" />
      ${status}
    </div>
    <div class="showdown-stat-equation" role="cell"><span class="stat-base-value">${base}</span><span> + </span><input class="showdown-stat-input" type="number" inputmode="numeric" min="0" max="${STAT_SINGLE_LIMIT}" step="1" value="${value}" data-stat-slot="${index}" data-stat-key="${stat.key}" aria-label="${escapeText(stat.label)} invested points" /><span> = </span><strong>${finalValue}</strong></div>
    <button type="button" class="tiny-button stat-button showdown-stat-minus" role="cell" data-stat-dec-slot="${index}" data-stat-key="${stat.key}" ${minusDisabled ? 'disabled' : ''} aria-label="Remove one ${escapeText(stat.label)} point">−</button>
    <button type="button" class="tiny-button stat-button showdown-stat-plus" role="cell" data-stat-inc-slot="${index}" data-stat-key="${stat.key}" ${plusDisabled ? 'disabled' : ''} aria-label="Add one ${escapeText(stat.label)} point">+</button>
  </div>`;
}