const STAT_KEYS = [
  ['hp', 'HP'],
  ['atk', 'ATK'],
  ['def', 'DEF'],
  ['spa', 'SPA'],
  ['spd', 'SPD'],
  ['spe', 'SPE']
];
const MAX_BASE_STAT = 255;

export function CompactStatBars(stats, options = {}) {
  if (!stats || typeof stats !== 'object') return '';
  const rows = STAT_KEYS.map(([key, label]) => {
    const value = Number(stats[key]);
    if (!Number.isFinite(value)) return '';
    const width = Math.max(6, Math.min(100, Math.round((value / MAX_BASE_STAT) * 100)));
    return `<span class="compact-stat-row"><span class="compact-stat-label">${label}</span><span class="compact-stat-track" aria-hidden="true"><span class="compact-stat-fill" style="width:${width}%"></span></span><span class="compact-stat-value">${value}</span></span>`;
  }).filter(Boolean).join('');
  if (!rows) return '';
  const bst = Number(stats.bst);
  const bstLine = options.showBst && Number.isFinite(bst) ? `<span class="compact-stat-bst">BST ${bst}</span>` : '';
  return `<span class="compact-stat-bars ${options.className || ''}" aria-label="Base stats">${rows}${bstLine}</span>`;
}
