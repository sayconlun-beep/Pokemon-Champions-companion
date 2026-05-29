import { calculateSpeedTierSnapshot } from '../../utils/speedTierCalculator.js';
import { buildTeamCoachingProfile, getSpeedControlSummary } from '../../logic/teamCoachingProfile.js';

export function SpeedControlPanel({ team = [], data = {}, context = 'analysis', coachingProfile = null } = {}) {
  const profile = coachingProfile || buildTeamCoachingProfile(team, { data });
  const snapshot = calculateSpeedTierSnapshot(team, data);
  const naturalFastest = snapshot.naturalOrder[0];
  const tailwindBest = snapshot.tailwindOrder.find((entry) => entry.speed >= 140) || snapshot.tailwindOrder[0];
  const trickRoomBest = snapshot.trickRoomOrder[0];
  const priorityText = snapshot.priorityUsers.length
    ? snapshot.priorityUsers.slice(0, 3).map((entry) => `${entry.pokemon}: ${entry.move} (+${entry.priority})`).join(' · ')
    : 'No selected priority moves found.';
  const profileSpeedRisks = Array.isArray(profile?.speedProfile?.risks) ? profile.speedProfile.risks : [];
  const speedSummaryText = getSpeedControlSummary(profile);
  const speedBullets = dedupeSpeedSnapshotLines([speedSummaryText, ...profileSpeedRisks]);
  const gapText = profileSpeedRisks.length ? dedupeSpeedSnapshotLines(profileSpeedRisks).join(' · ') : speedSummaryText;
  const panelClass = context === 'matchups' ? 'matchups-speed-control-surface optional-reference-surface' : 'speed-control-surface';
  const defaultOpenAttribute = context === 'matchups' ? '' : ' open';
  const kicker = context === 'matchups' ? 'Optional reference' : 'Battle flow';
  const summary = context === 'matchups'
    ? 'Quick speed reference for turn order, Tailwind, Trick Room, and priority.'
    : 'Use this to see who can move first, which Pokémon need help moving first, and what to protect against faster teams.';
  const collapsedPreview = context === 'matchups'
    ? ''
    : 'Turn order, Tailwind value, Trick Room position, priority moves, and speed-control risks.';

  return `
    <section class="analysis-section tactical-section-group ${panelClass}">
      <details class="analysis-cluster speed-control-cluster" data-analysis-section="speed-control-snapshot"${defaultOpenAttribute}>
        <summary class="section-toolbar-header speed-control-accordion-summary" aria-label="Toggle Speed Control Snapshot">
          <div class="section-toolbar-copy speed-control-summary-copy">
            <span class="section-kicker">${kicker}</span>
            <h2>Speed Control Snapshot</h2>
            <p class="section-summary">${summary}</p>
            ${collapsedPreview ? `<p class="section-collapsed-preview">${collapsedPreview}</p>` : ''}
          </div>
          <span class="speed-control-accordion-toggle" aria-hidden="true">⌄</span>
        </summary>
        <div class="analysis-collapse-body">
          <article class="card tactical-analysis-card grouped-card speed-control-card priority-important">
            <div class="speed-snapshot-grid">
              ${metricCard('Fastest without help', formatOrderEntry(naturalFastest))}
              ${metricCard('Best with Tailwind', formatOrderEntry(tailwindBest))}
              ${metricCard('Best in Trick Room', formatOrderEntry(trickRoomBest))}
              ${metricCard('Priority attacks', priorityText)}
              ${metricCard('Things to watch for', gapText, 'wide')}
            </div>
            <ul class="tactical-bullets speed-summary-bullets">${speedBullets.map((bullet) => `<li>${escapeText(bullet)}</li>`).join('')}</ul>
            <details class="analysis-details compact-details speed-order-details">
              <summary>Show detailed speed orders</summary>
              <div class="speed-order-grid">
                ${orderList('Normal speed order', snapshot.naturalOrder)}
                ${orderList('With Tailwind', snapshot.tailwindOrder)}
                ${orderList('Under Trick Room', snapshot.trickRoomOrder)}
                ${orderList('If paralyzed', snapshot.paralysisAdjustedOrder)}
                ${orderList('With likely speed boost', snapshot.speedBoostOrder)}
              </div>
            </details>
          </article>
        </div>
      </details>
    </section>`;
}

function dedupeSpeedSnapshotLines(lines = []) {
  const seen = new Set();
  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function humanizeSpeedCoaching(text) {
  return String(text || '')
    .replace(/is currently your fastest natural mover\./i, 'is your fastest Pokémon before any speed support is used.')
    .replace(/gains the most practical fast-mode value under Tailwind\./i, 'benefits most from Tailwind because it can move before more opponents.')
    .replace(/is best positioned to act early under Trick Room\./i, 'is one of your best Pokémon when Trick Room makes slower Pokémon move first.')
    .replace(/can bypass speed order with/i, 'can ignore normal turn order with')
    .replace(/provides visible speed-control utility\./i, 'helps your team control who moves first.')
    .replace(/Limited fast-mode support if the opponent controls turn order\./i, 'Fast opposing teams may be hard to handle if they control turn order first.')
    .replace(/Several slower Pokémon may struggle if Trick Room is not available or denied\./i, 'Your slower Pokémon may struggle if Trick Room is blocked or unavailable.')
    .replace(/No clear speed-control move is selected yet\./i, 'No clear speed-control move is selected yet, so faster teams may be harder to play against.')
    .replace(/No selected priority moves to bypass normal speed order\./i, 'No selected priority attacks are available to move before faster opponents.')
    .replace(/The fastest natural mover is still only mid-speed, so revenge turns may be difficult\./i, 'Your fastest Pokémon is only mid-speed, so revenge KOs may be harder without support.');
}

function metricCard(label, value, extraClass = '') {
  return `<div class="speed-metric ${extraClass}"><span>${escapeText(label)}</span><strong>${escapeText(humanizeSpeedCoaching(value || 'Not enough data'))}</strong></div>`;
}

function formatOrderEntry(entry) {
  if (!entry) return 'Not enough data';
  return `${entry.pokemon} (${entry.speed})`;
}

function orderList(label, entries = []) {
  const rows = entries.slice(0, 6).map((entry, index) => `<li><span>${index + 1}. ${escapeText(entry.pokemon)}</span><strong>${escapeText(entry.speed)}</strong></li>`).join('');
  return `<div class="speed-order-list"><h4>${escapeText(label)}</h4><ol>${rows || '<li><span>No speed data</span></li>'}</ol></div>`;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
