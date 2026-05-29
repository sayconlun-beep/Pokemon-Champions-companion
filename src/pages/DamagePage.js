import { estimateBenchmarks } from '../core/damageBenchmarkEngine.js';
import { normalizeDisplayText, pageDeduper, coachingConclusion, prioritySignalCount } from '../utils/tacticalTextNormalizer.js';

export function DamagePage(state) {
  const rows = estimateBenchmarks(state.team, state.data);
  const dedupePageText = pageDeduper(1);

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
        ${overviewItem('Best Wa' + 'llbreaker', breakerOverview(strongestPressure))}
        ${overviewItem('Best Cleaner', cleanerOverview(bestCleaner))}
        ${overviewItem('Weakest Damage Matchup', weakestDamageOverview(weakestSlot))}
        ${overviewItem('Best Offensive Support', offensiveSupportOverview(bestOffensiveSupport))}
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
    const steps = makeUniqueRouteSteps([
      earlyDamageStep(earlyBreaker, cleaner),
      midGameStep(cleaner, support),
      lateGameStep(cleaner),
      cleanupThreatReminder(cleaner)
    ], usedStepKeys, cleaner, index);

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
  const move = group.primaryMove || group.rows?.[0]?.move || 'its safest attack';
  const targetClass = opponentTargetPhrase(group.rows?.[0]);
  const finisherText = finisher?.attacker ? ` so ${finisher.attacker} can finish later` : ' so the real cleaners can finish later';
  return {
    title: `${group.attacker} Support Path`,
    steps: [
      `Use ${move} for chip into ${targetClass}${finisherText}.`,
      `Do not treat ${group.attacker} as the closer; preserve your stronger damage pieces for the final knockout turns.`,
      `Pair ${group.attacker} with ${finisher?.attacker || 'a stronger attacker'} when opponents are still healthy, then switch the closer in after chip damage lands.`
    ]
  };
}

function makeUniqueRouteSteps(steps, usedStepKeys, cleaner, routeIndex) {
  return steps.map((step, stepIndex) => {
    let text = normalizeDisplayText(step);
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
          ${route.steps.map((step) => `<li>${escapeText(normalizeDisplayText(step))}</li>`).join('')}
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

function earlyDamageStep(earlyBreaker, cleaner) {
  if (earlyBreaker) return `Use ${earlyBreaker.attacker} early to weaken bulky opponents for ${cleaner.attacker}.`;
  return `Use your strongest attacks early so ${cleaner.attacker} has easier targets later.`;
}

function midGameStep(cleaner, support) {
  const target = opponentTargetPhrase(cleaner.rows?.[0]);
  if (support) return `Use ${support.attacker}'s ${support.primaryMove} in the mid-game to chip or control ${target} for ${cleaner.attacker}.`;
  return `Preserve ${cleaner.attacker} specifically for ${target}; avoid spending it before ${cleaner.primaryMove} can finish those targets.`;
}

function lateGameStep(cleaner) {
  const finishingMove = cleaner.rows.find((row) => isPriorityMove(row.move) || isFakeOut(row.move))?.move || cleaner.primaryMove;
  return `Use ${finishingMove} late-game when weakened opponents are ready to be finished.`;
}

function cleanupThreatReminder(cleaner) {
  const name = normalizeKey(cleaner.attacker);
  if (name.includes('kangaskhan')) return 'Remove Fighting-types before committing to the final cleanup.';
  if (cleaner.rows.some((row) => isPriorityMove(row.move))) return 'Remove bulky resistances before relying on priority to finish.';
  return 'Remove healthy defensive Pokémon and faster revenge killers before the final push.';
}

function pickBestCleaner(pressureBenchmarks, utilityPressure, fallback) {
  const priorityCleaner = utilityPressure.find((group) => group.rows.some((row) => isPriorityMove(row.move)));
  return priorityCleaner || pressureBenchmarks.find((group) => group.highRange >= 50) || fallback || null;
}

function pickBestOffensiveSupport(utilityPressure, rows) {
  const supportGroup = utilityPressure.find((group) => group.rows.some((row) => isSpeedControlMove(row.move)));
  if (supportGroup) return supportGroup;

  const fakeOutRow = rows.find((row) => isFakeOut(row.move));
  if (fakeOutRow) return buildBenchmarkGroup({ attacker: fakeOutRow.attacker, rows: [fakeOutRow] }, 'utility');

  return null;
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

function breakerOverview(group) {
  if (!group) return 'Add Pokémon and moves to see which teammate breaks bulky opponents.';
  return `${group.attacker} is the main breaker because ${group.primaryMove} reaches its best pressure range into ${opponentTargetPhrase(group.rows?.[0])}.`;
}

function cleanerOverview(group) {
  if (!group) return 'Add stronger attacks to see who should finish games.';
  return `${group.attacker} is the cleaner because ${group.primaryMove} can finish chipped ${opponentTargetPhrase(group.rows?.[0])}.`;
}

function weakestDamageOverview(group) {
  if (!group) return 'No major offensive weak spot is showing from the current damage checks.';
  return `${group.attacker} has the weakest damage profile: ${group.primaryMove} may need chip or support before it finishes ${opponentTargetPhrase(group.rows?.[0])}.`;
}

function offensiveSupportOverview(group) {
  if (!group) return 'No clear offensive support move is showing yet.';
  const supportMove = group.rows.find((row) => isSpeedControlMove(row.move))?.move || group.primaryMove;
  return `${group.attacker} provides offensive support with ${supportMove}, helping stronger attackers convert damage into knockouts.`;
}


function renderOffensiveRolesSection(groupsOrRows, dedupePageText = normalizeDisplayText) {
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
  const high = maxRange(primary.range);

  return unique([
    threatSummary(primary, role),
    bestUseSummary(attacker, primary, support, role, high),
    warningSummary(primary, role, high)
  ]);
}

function threatSummary(row, role) {
  if (!row?.move) return 'Use this Pokémon to help teammates find safer attacks.';
  const targetClass = opponentTargetPhrase(row);
  if (role === 'Damage Support') return `${row.move} gives this Pokémon a reliable way to threaten ${targetClass} — for example, use it when those opposing targets need chip before your cleaner enters.`;
  if (role === 'Cleaner') return `${row.move} is useful for finishing weakened ${targetClass}.`;
  if (role === ('Wa' + 'llbreaker')) return `${row.move} threatens bulky ${targetClass} that try to switch in safely.`;
  return `${row.move} pressures ${targetClass}.`;
}

function bestUseSummary(attacker, row, support, role, high) {
  const targetClass = opponentTargetPhrase(row);
  if (role === 'Cleaner') return `Best saved for later, after ${targetClass} have been chipped into ${row?.move || 'its main move'} range.`;
  if (role === 'Damage Support') {
    const move = support?.move || row?.move || 'its support move';
    return `Best used when ${move} changes the damage race against ${targetClass}, rather than when you need an immediate knockout.`;
  }
  if (high >= 75) return `Best used early or mid-game to remove important ${targetClass}.`;
  if (high >= 50) return `Best used to weaken bulky ${targetClass} before your cleaner takes over.`;
  return `Best used after another teammate has already softened ${targetClass}.`;
}

function warningSummary(row, role, high) {
  if (role === 'Damage Support') return 'Do not label this as a main closer unless its damage range improves; it should create openings for stronger attackers.';
  if (role === 'Cleaner') return 'Avoid sending it in too early if the opponent still has healthy defensive Pokémon that resist its finishing move.';
  if (high < 35) return 'It may need chip damage from teammates before it can secure KOs.';
  return 'Avoid reckless switches into faster attackers or super-effective hits.';
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

function renderSection(title, subtitle, groups, tone, dedupePageText = normalizeDisplayText, openByDefault = false) {
  return `
    <details class="card damage-section-card damage-panel ${tone}" ${openByDefault ? 'open' : ''}>
      <summary class="damage-panel-summary">
        <div>
          <h2>${title}</h2>
          <p class="muted-text">${escapeText(coachingConclusion(subtitle))}</p>
        </div>
        <span class="badge tertiary-chip">${prioritySignalCount(groups, groups.length)}</span>
      </summary>

      <div class="damage-rows grouped-damage-rows damage-role-grid">
        ${groups.length ? groups.map((group) => renderBenchmarkGroup(group, tone, dedupePageText)).filter(Boolean).join('') : '<div class="empty-state">No useful damage notes found for this section yet.</div>'}
      </div>
    </details>
  `;
}

function renderBenchmarkGroup(group, tone, dedupePageText) {
  const bullets = group.bullets
    .map((bullet) => coachingConclusion(dedupePageText(bullet, { ensureSentence: true })))
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
  const primary = rows[0];
  const secondary = rows.find((row) => normalizeKey(row.move) !== normalizeKey(primary?.move));

  if (mode === 'warning') {
    return unique([
      lowPressureSummary(primary),
      failedThresholdSummary(primary),
      cleanupSafetySummary(range)
    ]);
  }

  if (mode === 'utility') {
    const utilityLines = rows.map((row) => utilitySummary(row)).filter(Boolean);
    return unique([
      ...utilityLines,
      secondary ? `${secondary.move} gives this Pokémon another way to help the team.` : 'Helps create safer turns for offensive teammates.',
      `Damage range shown here: ${range}.`
    ]);
  }

  return unique([
    pressureSummary(primary),
    secondary ? `${secondary.move} gives ${attacker} another useful attacking option.` : 'Deals reliable neutral damage into common targets.',
    `Damage range shown here: ${range}.`
  ]);
}

function pressureSummary(row) {
  const high = maxRange(row.range);
  if (high >= 75) return `${row.move} can heavily damage or remove key targets.`;
  if (high >= 50) return `${row.move} helps break bulky defensive Pokémon.`;
  return `${row.move} gives steady damage into neutral targets.`;
}

function lowPressureSummary(row) {
  const high = maxRange(row.range);
  if (high < 25) return `${row.move} struggles to deal meaningful damage into bulky targets like ${row.target}.`;
  if (high < 35) return `${row.move} often needs teammate support or chip damage before it can finish ${row.target}.`;
  return `${row.move} can struggle to secure knockouts consistently without support from teammates.`;
}

function failedThresholdSummary(row) {
  const high = maxRange(row.range);
  if (high < 25) return 'Can struggle to finish bulky opponents without teammate support.';
  if (high < 35) return 'Usually works better after teammates have already weakened the opposing team.';
  return 'This matchup may require stronger attackers or extra chip damage support.';
}

function cleanupSafetySummary(range) {
  return `Current damage range: ${range}. Focus more on support or chip damage than direct knockouts.`;
}

function isLowPressureWarning(row) {
  if (!row?.move || isSpeedControlMove(row.move)) return false;
  const high = maxRange(row.range);
  if (!high) return false;
  return high < 45;
}

function utilitySummary(row) {
  const move = String(row.move || '');
  if (isFakeOut(move)) return 'Fake Out buys a safe turn and can help a teammate attack first.';
  if (normalizeKey(move) === 'icy wind') return 'Icy Wind provides reliable speed-control support.';
  if (normalizeKey(move) === 'thunder wave') return 'Thunder Wave slows faster threats so your attackers can move before them.';
  if (normalizeKey(move) === 'electroweb') return 'Electroweb adds chip damage while slowing the opposing side.';
  if (isPriorityMove(move)) return `${move} can finish weakened targets before they move.`;
  return `${move} helps control turn order for the team.`;
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
      <span class="overview-value">${escapeText(normalizeDisplayText(value))}</span>
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
