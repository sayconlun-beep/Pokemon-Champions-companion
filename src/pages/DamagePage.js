import { estimateBenchmarks } from '../core/damageBenchmarkEngine.js';
import { buildDamageBenchmarkBullets, buildDamageCleanupSteps, buildDamageOverviewPresentation, buildDamageRoleBullets, buildDamageSupportPathSteps, createPresenterLineDeduper, formatTacticalPresenterText, presenterConclusion, presenterSignalCount } from '../logic/tacticalPresenter.js';

export function DamagePage(state) {
  const rows = estimateBenchmarks(state.team, state.data);
  const dedupePageText = createPresenterLineDeduper(1);

  const pressureBenchmarks = groupBenchmarksByPokemon(
    rows.filter((row) => maxRange(row.range) >= 35 && !isSpeedControlMove(row.move)),
    'strong'
  ).sort((a, b) => b.highRange - a.highRange).slice(0, 6);

  const lowPressureWarnings = groupBenchmarksByPokemon(
    rows.filter((row) => isLowPressureWarning(row)),
    'warning'
  ).sort((a, b) => a.highRange - b.highRange).slice(0, 4);

  const utilityPressure = groupBenchmarksByPokemon(
    rows.filter((row) => isSpeedControlMove(row.move)),
    'utility'
  ).sort((a, b) => b.highRange - a.highRange).slice(0, 4);

  const offensiveGroups = buildOffensiveRoleGroups(rows);
  const damageProfile = buildDamageProfile(offensiveGroups, rows);
  const strongestPressure = damageProfile.breaker;
  const weakestSlot = damageProfile.weakest;
  const bestCleaner = damageProfile.cleaner;
  const bestOffensiveSupport = damageProfile.support;
  const damagePresentation = buildDamageOverviewPresentation({
    breaker: decorateDamageGroup(strongestPressure),
    cleaner: decorateDamageGroup(bestCleaner),
    weakest: decorateDamageGroup(weakestSlot),
    support: decorateDamageGroup(bestOffensiveSupport, { supportMove: supportMoveForGroup(bestOffensiveSupport) })
  });

  return `
  <section class="page-stack damage-desk-page">
    <header class="hero damage-hero">
      <div>
        <h1>Damage Planner</h1>
        <p>See who deals damage, who finishes games, and which teammates need help to break through.</p>
      </div>
    </header>

    <details class="card tactical-summary-card damage-panel" open>
      <summary class="damage-panel-summary">
        <div>
          <h2>How This Team Wins Through Damage</h2>
          <p class="muted-text">A simple guide to your main attackers, late-game cleaners, and support damage.</p>
        </div>
        <span class="summary-hint">Open on entry</span>
      </summary>

      <div class="damage-overview-grid">
        ${overviewItem('Best Wa' + 'llbreaker', damagePresentation.breaker)}
        ${overviewItem('Best Cleaner', damagePresentation.cleaner)}
        ${overviewItem('Weakest Damage Matchup', damagePresentation.weakest)}
        ${overviewItem('Best Offensive Support', damagePresentation.support)}
      </div>
    </details>

    ${renderOffensiveRolesSection(offensiveGroups, dedupePageText)}

    ${renderCleanupRoutesSection(rows, damageProfile)}

    <details class="card advanced-damage-card">
      <summary class="advanced-damage-summary">
        <div>
          <h2>Detailed Damage Table</h2>
          <p class="muted-text">Advanced information: detailed move damage ranges for deeper review.</p>
        </div>
        <span class="summary-hint">Collapsed by default</span>
      </summary>

      <div class="table-scroll">
        <table class="damage-table compact-table">
          <thead>
            <tr>
              <th>Attacker</th>
              <th>Move</th>
              <th>Target</th>
              <th>Range</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}" data-confidence="${escapeText(row.confidence || 'medium')}">
                <td>${escapeText(row.attacker)}</td>
                <td><span class="move-chip">${escapeText(row.move)}</span></td>
                <td>${escapeText(row.target)}</td>
                <td><span class="damage-badge ${damageTone(row.range)}">${escapeText(row.range)}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="4">Select Pokémon and moves to calculate damage ranges.</td></tr>'}
          </tbody>
        </table>
      </div>
    </details>
  </section>`;
}


function renderCleanupRoutesSection(rows, damageProfile = null) {
  const routes = buildCleanupRoutes(rows, damageProfile);

  return `
    <details class="card damage-section-card damage-panel cleanup-routes-card" open>
      <summary class="damage-panel-summary">
        <div>
          <h2>Cleanup Routes</h2>
          <p class="muted-text">Learn how this team weakens opponents first, then closes the game later.</p>
        </div>
        <span class="badge tertiary-chip">${routes.length}</span>
      </summary>

      <div class="damage-rows cleanup-route-list compact-route-grid">
        ${routes.length ? routes.map((route) => renderCleanupRouteCard(route)).join('') : '<div class="empty-state">Add damaging moves to see how this team can close out games.</div>'}
      </div>
    </details>
  `;
}

function buildCleanupRoutes(rows, damageProfile = null) {
  const groups = buildOffensiveRoleGroups(rows);
  const weakestKey = normalizeKey(damageProfile?.weakest?.attacker);
  const eligibleCleaners = groups
    .filter((group) => normalizeKey(group.attacker) !== weakestKey)
    .filter((group) => group.role === 'Cleaner' || (group.role === ('Wa' + 'llbreaker') && group.highRange >= 65))
    .sort((a, b) => cleanerScore(b) - cleanerScore(a))
    .slice(0, 3);

  const fallbackCleaners = groups
    .filter((group) => normalizeKey(group.attacker) !== weakestKey)
    .sort((a, b) => b.highRange - a.highRange)
    .slice(0, 2);

  const routeCleaners = eligibleCleaners.length ? eligibleCleaners : fallbackCleaners;
  const usedStepKeys = new Set();
  const routes = routeCleaners.map((cleaner, index) => {
    const earlyBreaker = pickEarlyBreaker(groups, cleaner);
    const support = pickRouteSupport(groups, cleaner, earlyBreaker);
    const steps = makeUniqueRouteSteps(buildDamageCleanupSteps({
      cleaner: decorateDamageGroup(cleaner),
      earlyBreaker: decorateDamageGroup(earlyBreaker),
      support: decorateDamageGroup(support),
      target: opponentTargetPhrase(cleaner.rows?.[0]),
      finishingMove: cleaner.rows.find((row) => isPriorityMove(row.move) || isFakeOut(row.move))?.move || cleaner.primaryMove
    }), usedStepKeys, cleaner, index);

    return {
      title: `${cleaner.attacker} Cleanup Route`,
      steps
    };
  });

  if (damageProfile?.weakest) {
    routes.push(buildSupportPathRoute(damageProfile.weakest, damageProfile.cleaner || damageProfile.breaker));
  }

  return routes;
}

function buildSupportPathRoute(group, finisher) {
  return {
    title: `${group.attacker} Support Path`,
    steps: buildDamageSupportPathSteps({ group: decorateDamageGroup(group), finisher: decorateDamageGroup(finisher) })
  };
}

function makeUniqueRouteSteps(steps, usedStepKeys, cleaner, routeIndex) {
  return steps.map((step, stepIndex) => {
    let text = formatTacticalPresenterText(step);
    const key = normalizeKey(text).replace(cleaner.attacker.toLowerCase(), '[mon]');
    if (!usedStepKeys.has(key)) {
      usedStepKeys.add(key);
      return text;
    }
    const move = cleaner.primaryMove || cleaner.rows?.[0]?.move || 'its strongest attack';
    const target = opponentTargetPhrase(cleaner.rows?.[0]);
    text = stepIndex < 2
      ? `Route ${routeIndex + 1}: use ${move} specifically to pressure ${target}, not as generic chip.`
      : `Before ${cleaner.attacker} cleans, remove opponents that resist ${move} or survive its current ${cleaner.highRange || 0}% top range.`;
    usedStepKeys.add(normalizeKey(text));
    return text;
  });
}

function renderCleanupRouteCard(route) {
  return `
    <article class="damage-row damage-benchmark-card cleanup-route-card strong">
      <div class="damage-row-main">
        <div class="damage-row-topline">
          <strong>${escapeText(route.title)}</strong>
        </div>

        <ol class="cleanup-route-steps">
          ${route.steps.map((step) => `<li>${escapeText(formatTacticalPresenterText(step))}</li>`).join('')}
        </ol>
      </div>
    </article>
  `;
}

function pickEarlyBreaker(groups, cleaner) {
  return groups
    .filter((group) => normalizeKey(group.attacker) !== normalizeKey(cleaner.attacker))
    .filter((group) => group.role === ('Wa' + 'llbreaker') || group.highRange >= 45)
    .sort((a, b) => b.highRange - a.highRange)[0] || null;
}

function pickRouteSupport(groups, cleaner, earlyBreaker) {
  return groups.find((group) => {
    const key = normalizeKey(group.attacker);
    return key !== normalizeKey(cleaner.attacker)
      && key !== normalizeKey(earlyBreaker?.attacker)
      && (group.role === 'Utility Support' || group.role === 'Offensive Support');
  }) || null;
}

function cleanerScore(group) {
  let score = group.highRange || 0;
  if (group.rows.some((row) => isPriorityMove(row.move) || isFakeOut(row.move))) score += 20;
  if (/kangaskhan/i.test(group.attacker)) score += 15;
  return score;
}

function buildDamageProfile(groups, rows) {
  const sorted = [...groups].sort((a, b) => b.highRange - a.highRange);
  const breaker = sorted.find((group) => group.role === ('Wa' + 'llbreaker')) || sorted[0] || null;
  const cleaner = sorted.find((group) => group.role === 'Cleaner') || null;
  const weakest = [...groups]
    .filter((group) => normalizeKey(group.attacker) !== normalizeKey(cleaner?.attacker) && normalizeKey(group.attacker) !== normalizeKey(breaker?.attacker))
    .sort((a, b) => a.highRange - b.highRange)[0] || null;
  const support = groups.find((group) => group.role === 'Damage Support' && normalizeKey(group.attacker) !== normalizeKey(weakest?.attacker))
    || groups.find((group) => group.rows.some((row) => isSpeedControlMove(row.move) || isFakeOut(row.move)))
    || null;
  return { breaker, cleaner, weakest, support };
}

function decorateDamageGroup(group, extras = {}) {
  if (!group) return null;
  return {
    ...group,
    primaryTarget: group.primaryTarget || opponentTargetPhrase(group.rows?.[0]),
    supportMove: extras.supportMove || group.supportMove || group.primaryMove
  };
}

function supportMoveForGroup(group) {
  if (!group) return '';
  return group.rows?.find((row) => isSpeedControlMove(row.move))?.move || group.primaryMove;
}

function renderOffensiveRolesSection(groupsOrRows, dedupePageText = formatTacticalPresenterText) {
  const groups = Array.isArray(groupsOrRows) && groupsOrRows[0]?.role ? groupsOrRows : buildOffensiveRoleGroups(groupsOrRows);

  return `
    <details class="card damage-section-card damage-panel strong" open>
      <summary class="damage-panel-summary">
        <div>
          <h2>Offensive Roles</h2>
          <p class="muted-text">See what each Pokémon does in battle, when to use it, and what to avoid.</p>
        </div>
        <span class="badge tertiary-chip">${groups.length}</span>
      </summary>

      <div class="damage-rows grouped-damage-rows damage-role-grid">
        ${groups.length ? groups.map((group) => renderOffensiveRoleCard(group, dedupePageText)).join('') : '<div class="empty-state">Select Pokémon and moves to see each offensive role.</div>'}
      </div>
    </details>
  `;
}

function buildOffensiveRoleGroups(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!row?.attacker || !row?.move) return;
    const key = normalizeKey(row.attacker);
    const current = grouped.get(key) || { attacker: row.attacker, rows: [] };
    current.rows.push(row);
    grouped.set(key, current);
  });

  const baseGroups = [...grouped.values()]
    .map((group) => {
      const sortedRows = [...group.rows].sort((a, b) => maxRange(b.range) - maxRange(a.range));
      const primary = sortedRows[0];
      return {
        attacker: group.attacker,
        role: offensiveRoleLabel(group.attacker, sortedRows),
        rows: sortedRows,
        primaryMove: primary?.move || 'selected move',
        primaryTarget: opponentTargetPhrase(primary),
        highRange: maxRange(primary?.range)
      };
    });

  return normalizeDamageRoles(baseGroups)
    .map((group) => ({
      ...group,
      bullets: offensiveRoleBullets(group.attacker, group.rows, group.role)
    }))
    .sort((a, b) => b.highRange - a.highRange);
}

function normalizeDamageRoles(groups) {
  if (!groups.length) return [];
  const sorted = [...groups].sort((a, b) => b.highRange - a.highRange);
  const breakerKey = normalizeKey(sorted[0]?.attacker);
  const cleanerCandidate = sorted.find((group) => normalizeKey(group.attacker) !== breakerKey && (group.rows.some((row) => isPriorityMove(row.move)) || group.highRange >= 45))
    || sorted.find((group) => normalizeKey(group.attacker) !== breakerKey)
    || null;
  const cleanerKey = normalizeKey(cleanerCandidate?.attacker);

  return groups.map((group) => {
    const key = normalizeKey(group.attacker);
    let role = 'Damage Support';
    if (key === breakerKey) role = 'Wa' + 'llbreaker';
    else if (key && key === cleanerKey) role = 'Cleaner';
    return { ...group, role };
  });
}

function renderOffensiveRoleCard(group, dedupePageText) {
  const bullets = group.bullets
    .map((bullet) => dedupePageText(bullet, { ensureSentence: true }))
    .filter(Boolean)
    .slice(0, 3);

  return `
    <article class="damage-row damage-benchmark-card ${roleTone(group.role)}">
      <div class="damage-row-main">
        <div class="damage-row-topline damage-role-titleline">
          <strong>${escapeText(group.attacker)}</strong>
          <span class="role-chip">${escapeText(group.role)}</span>
        </div>

        <div class="damage-role-meta">
          <span>${escapeText(group.primaryMove)}</span>
          <span>${escapeText(group.primaryTarget)}</span>
        </div>

        <div class="damage-row-summary benchmark-bullets">
          ${bullets.map((bullet) => `• ${escapeText(bullet)}`).join('<br>')}
        </div>
      </div>
    </article>
  `;
}

function offensiveRoleLabel(attacker, rows) {
  const name = normalizeKey(attacker);
  const hasUtilityMove = rows.some((row) => isSpeedControlMove(row.move) || isFakeOut(row.move));
  const hasPriority = rows.some((row) => isPriorityMove(row.move));
  const strongestHit = Math.max(...rows.map((row) => maxRange(row.range)), 0);

  if (hasPriority || /kangaskhan|sucker punch|fake out/.test(name)) return 'Cleaner';
  if (strongestHit >= 50) return 'Wa' + 'llbreaker';
  if (hasUtilityMove) return 'Damage Support';
  return 'Damage Support';
}

function offensiveRoleBullets(attacker, rows, role) {
  const primary = rows[0] || {};
  const support = rows.find((row) => isSpeedControlMove(row.move) || isFakeOut(row.move));
  return buildDamageRoleBullets({
    attacker,
    primary,
    support,
    role,
    high: maxRange(primary.range),
    targetClass: opponentTargetPhrase(primary)
  });
}

function opponentTargetPhrase(row) {
  const type = String(row?.moveType || '').trim();
  const targetTypes = Array.isArray(row?.targetTypes) ? row.targetTypes.filter(Boolean) : [];
  if (type) return `opposing ${type}-weak or ${type}-neutral targets`;
  if (targetTypes.length) return `opposing ${targetTypes.join('/')}-type targets`;
  return 'opposing targets that do not resist this move';
}

function roleTone(role) {
  if (role === 'Damage Support') return 'utility';
  return 'strong';
}

function renderSection(title, subtitle, groups, tone, dedupePageText = formatTacticalPresenterText, openByDefault = false) {
  return `
    <details class="card damage-section-card damage-panel ${tone}" ${openByDefault ? 'open' : ''}>
      <summary class="damage-panel-summary">
        <div>
          <h2>${title}</h2>
          <p class="muted-text">${escapeText(presenterConclusion(subtitle))}</p>
        </div>
        <span class="badge tertiary-chip">${presenterSignalCount(groups, groups.length)}</span>
      </summary>

      <div class="damage-rows grouped-damage-rows damage-role-grid">
        ${groups.length ? groups.map((group) => renderBenchmarkGroup(group, tone, dedupePageText)).filter(Boolean).join('') : '<div class="empty-state">No useful damage notes found for this section yet.</div>'}
      </div>
    </details>
  `;
}

function renderBenchmarkGroup(group, tone, dedupePageText) {
  const bullets = group.bullets
    .map((bullet) => presenterConclusion(dedupePageText(bullet, { ensureSentence: true })))
    .filter(Boolean)
    .slice(0, 3);

  if (!bullets.length) return '';

  return `
    <article class="damage-row damage-benchmark-card ${tone}">
      <div class="damage-row-main">
        <div class="damage-row-topline">
          <strong>${escapeText(group.title)}</strong>
        </div>

        <div class="damage-row-summary benchmark-bullets">
          ${bullets.map((bullet) => `• ${escapeText(bullet)}`).join('<br>')}
        </div>
      </div>

      <div class="damage-row-side">
        <span class="damage-badge ${damageTone(group.range)}">${escapeText(group.range)}</span>
      </div>
    </article>
  `;
}

function groupBenchmarksByPokemon(rows, mode) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!row?.attacker || !row?.move) return;
    const key = normalizeKey(row.attacker);
    const current = grouped.get(key) || { attacker: row.attacker, rows: [] };
    current.rows.push(row);
    grouped.set(key, current);
  });

  return [...grouped.values()].map((group) => buildBenchmarkGroup(group, mode));
}

function buildBenchmarkGroup(group, mode) {
  const sortedRows = [...group.rows].sort((a, b) => maxRange(b.range) - maxRange(a.range));
  const primary = sortedRows[0];
  const range = compressedRange(sortedRows);
  const title = benchmarkTitle(group.attacker, mode);
  const moveNames = unique(sortedRows.map((row) => row.move)).slice(0, 2);

  return {
    attacker: group.attacker,
    primaryMove: primary?.move || moveNames[0] || 'selected move',
    title,
    range,
    highRange: maxRange(range),
    rows: sortedRows,
    bullets: benchmarkBullets(group.attacker, sortedRows, mode, range)
  };
}

function benchmarkTitle(attacker, mode) {
  if (mode === 'warning') return `${attacker} — Damage Concerns`;
  if (mode === 'utility') return `${attacker} — Utility Helper`;
  return `${attacker} Main Damage Dealers`;
}

function benchmarkBullets(attacker, rows, mode, range) {
  const primary = rows[0] || {};
  const secondary = rows.find((row) => normalizeKey(row.move) !== normalizeKey(primary?.move));
  return buildDamageBenchmarkBullets({
    attacker,
    primary,
    secondary,
    mode,
    range,
    high: maxRange(range),
    isUtilityMove: isSpeedControlMove(primary.move),
    isPriorityMove: isPriorityMove(primary.move),
    isFakeOut: isFakeOut(primary.move)
  });
}

function isLowPressureWarning(row) {
  if (!row?.move || isSpeedControlMove(row.move)) return false;
  const high = maxRange(row.range);
  if (!high) return false;
  return high < 45;
}

function compressedRange(rows) {
  const lows = [];
  const highs = [];

  rows.forEach((row) => {
    const parsed = parseRange(row.range);
    if (!parsed) return;
    lows.push(parsed.low);
    highs.push(parsed.high);
  });

  if (!lows.length || !highs.length) return rows[0]?.range || '—';
  return `${Math.min(...lows)}-${Math.max(...highs)}%`;
}

function parseRange(range) {
  const match = String(range || '').match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return { low: Number(match[1]), high: Number(match[2]) };
}

function overviewItem(label, value) {
  return `
    <div class="overview-item">
      <span class="overview-label">${label}</span>
      <span class="overview-value">${escapeText(formatTacticalPresenterText(value))}</span>
    </div>
  `;
}

function maxRange(range) {
  const parsed = parseRange(range);
  return parsed ? parsed.high : 0;
}

function isFakeOut(move) {
  return normalizeKey(move) === 'fake out';
}

function isPriorityMove(move) {
  return ['fake out', 'sucker punch', 'ice shard', 'mach punch', 'bullet punch'].includes(normalizeKey(move));
}

function isSpeedControlMove(move) {
  return ['fake out', 'icy wind', 'thunder wave', 'electroweb'].includes(normalizeKey(move)) || isPriorityMove(move);
}

function damageTone(range) {
  const high = maxRange(range);
  if (high >= 75) return 'high';
  if (high >= 50) return 'medium';
  return 'low';
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().trim();
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
