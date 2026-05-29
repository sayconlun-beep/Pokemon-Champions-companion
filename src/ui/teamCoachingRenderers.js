function escapeText(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeOptions(options = {}, fallbackLimit = undefined) {
  if (typeof options === 'number') return { limit: options };
  return { ...(options || {}), ...(fallbackLimit !== undefined && !options?.limit ? { limit: fallbackLimit } : {}) };
}

function firstSentence(value = '', maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trim()}…` : sentence;
}


function pilotTipDisplayTitle(tip = {}, fallback = 'Pilot tip') {
  const existing = String(tip?.title || tip?.label || '').trim();
  if (existing && !/^pilot\s+tip\s*\d*$/i.test(existing)) return existing;

  const text = String(tip?.body || tip?.description || tip?.detail || tip?.text || tip || '').toLowerCase();
  if (!text.trim()) return fallback;
  if (/snow|aurora\s+veil|veil/.test(text)) return 'Use Snow and Veil safely';
  if (/protect|wide\s+guard|detect/.test(text)) return 'Use Protect to stall danger turns';
  if (/switch|pivot|swap|bring .* in|come in/.test(text)) return 'Avoid unsafe switches';
  if (/preserv|keep .* healthy|save .* for|key pok[eé]mon|win condition/.test(text)) return 'Preserve key Pokémon';
  if (/speed control|tailwind|trick room|icy wind|electroweb|thunder wave|priority|outspeed/.test(text)) return 'Set speed control early';
  if (/spread damage|blizzard|earthquake|rock slide|heat wave|dazzling gleam|muddy water|hyper voice/.test(text)) return 'Use spread damage pressure';
  return fallback;
}

function list(items, cls = '') {
  const valid = asArray(items).map((item) => String(item || '').trim()).filter(Boolean);
  return valid.length ? `<ul class="${escapeText(cls)}">${valid.map((x) => `<li>${escapeText(x)}</li>`).join('')}</ul>` : '';
}

function limited(items, options = {}, defaultLimit = 3) {
  const opts = normalizeOptions(options);
  const limit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : defaultLimit;
  return asArray(items).slice(0, Math.max(0, limit));
}

function shouldShowArchetypeConfidence(confidence = '', profile = {}, opts = {}) {
  if (opts.showConfidence === false) return false;
  const value = String(confidence || '').trim();
  if (!value) return false;
  if (opts.showLowConfidence === true) return true;
  const filledSlots = Number(profile?.completeness?.filledSlots || 0);
  const hasPlan = asArray(profile?.gameplans).length > 0;
  // Avoid noisy legacy-style "Medium confidence" badges on developing teams.
  // Low/Medium confidence is still available to callers that explicitly opt in.
  return /^high$/i.test(value) || (filledSlots >= 6 && hasPlan && !/^low$/i.test(value));
}

// SHARED PROFILE DISPLAY: renders profile.archetype only; no detection or scoring here.
export function renderArchetypeBadge(profile = {}, options = {}) {
  const opts = normalizeOptions(options);
  const archetype = profile?.archetype || {};
  const primary = String(archetype.primary || '').trim();
  if (!primary) return opts.compact ? '<span class="muted">Archetype still forming</span>' : '<p class="muted">Start with a Pokémon or small core to build around.</p>';
  const showConfidence = shouldShowArchetypeConfidence(archetype.confidence, profile, opts);
  return `<div class="team-coaching-archetype">
    <span class="badge tertiary-chip">${escapeText(primary)}</span>
    ${showConfidence ? `<span class="badge">${escapeText(archetype.confidence)} confidence</span>` : ''}
    ${archetype.secondary ? `<span class="badge">Secondary: ${escapeText(archetype.secondary)}</span>` : ''}
  </div>`;
}

// SHARED PROFILE DISPLAY: renders profile.gameplans only; no gameplan generation here.
export function renderGameplanCards(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 2);
  const plans = limited(profile?.gameplans, opts, 2).filter((plan) => String(plan?.label || '').trim());
  if (!plans.length) return opts.compact ? '' : '<p class="muted">Choose moves and abilities to help the app understand how this team wants to play.</p>';
  return `<div class="learning-grid team-coaching-gameplans ${opts.compact ? 'compact' : ''}">${plans.map((plan) => {
    const advice = firstSentence(plan.advice || plan.beginnerTip || '', opts.compact ? 120 : 220);
    const enablers = asArray(plan.enablers).join(', ');
    const abusers = asArray(plan.abusers).join(', ');
    const priority = plan.priority || (opts.compact ? '' : (plans.indexOf(plan) === 0 ? 'Primary' : 'Secondary'));
    return `<article class="mini-card team-coaching-gameplan-card"><h4>${priority ? `<span class="badge tertiary-chip">${escapeText(priority)}</span> ` : ''}${escapeText(plan.label)}</h4>
      ${advice ? `<p>${escapeText(advice)}</p>` : ''}
      ${!opts.compact && enablers ? `<p class="muted small-copy"><strong>Enablers:</strong> ${escapeText(enablers)}</p>` : ''}
      ${!opts.compact && abusers ? `<p class="muted small-copy"><strong>Abusers:</strong> ${escapeText(abusers)}</p>` : ''}
    </article>`;
  }).join('')}</div>`;
}

// SHARED PROFILE DISPLAY: renders profile.risks only; no risk detection here.
export function renderRiskSummary(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 2);
  const risks = limited(profile?.risks, opts, 2).filter((risk) => String(risk?.type || risk?.reason || risk?.beginnerAdvice || '').trim());
  if (!risks.length) return opts.compact ? '' : '<p class="muted">No major defensive pressure stands out yet.</p>';
  return `<div class="warning-stack team-coaching-risks ${opts.compact ? 'compact' : ''}">${risks.map((risk) => {
    const severity = risk.severity || 'Low';
    const label = risk.type ? `${opts.showSeverity === false ? '' : `${severity} `}${risk.type} risk` : 'Team risk';
    const text = firstSentence(risk.beginnerAdvice || risk.reason || 'Keep this matchup pressure in mind while positioning.', opts.compact ? 110 : 180);
    return `<p class="${severity === 'High' ? 'warning' : 'notice'}"><strong>${escapeText(label)}:</strong> ${escapeText(text)}</p>`;
  }).join('')}</div>`;
}

// UI RENDERER: derives a display title for already-generated pilot tips.
export function getPilotTipDisplayTitle(tip = {}, fallback = 'Pilot tip') {
  return pilotTipDisplayTitle(tip, fallback);
}

// SHARED PROFILE DISPLAY: renders profile.coaching.pilotTips only.
export function renderPilotTips(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 6);
  const tips = limited(profile?.coaching?.pilotTips, opts, 6)
    .map((tip) => {
      const normalized = typeof tip === 'string'
        ? { body: tip }
        : { title: tip?.title, label: tip?.label, body: tip?.body || tip?.description || tip?.detail || tip?.text };
      return { title: pilotTipDisplayTitle(normalized), body: normalized.body };
    })
    .filter((tip) => String(tip.title || '').trim() && String(tip.body || '').trim());
  if (!tips.length) return opts.compact ? '' : '<p class="muted battle-tip-empty">More battle tips will appear as your team takes shape.</p>';
  return `<div class="battle-tip-grid team-coaching-pilot-tips ${opts.compact ? 'compact' : ''}">${tips.map((tip) => `<article class="battle-tip-card"><h3>${escapeText(tip.title)}</h3><p>${escapeText(tip.body)}</p></article>`).join('')}</div>`;
}

// SHARED PROFILE DISPLAY: renders profile.coaching.recommendedLeads only.
export function renderRecommendedLeads(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 3);
  const leads = limited(profile?.coaching?.recommendedLeads, opts, 3)
    .filter((lead) => asArray(lead?.members).length || String(lead?.reason || '').trim());
  if (!leads.length) return opts.compact ? '' : '<p class="muted">Finish a few more sets before lead suggestions appear.</p>';
  return list(leads.map((lead) => `${asArray(lead.members).join(' + ') || 'Safe opening option'} — ${firstSentence(lead.reason || 'This opening helps your team establish its early plan safely.', opts.compact ? 110 : 180)}`), 'tactical-identity-list compact-chain-list team-coaching-leads');
}



// SHARED PROFILE DISPLAY: renders profile.coaching.recommendedLeads as detailed opening-pair coaching.
export function renderLeadAnalysis(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 4);
  const leads = limited(profile?.coaching?.recommendedLeads, opts, 4)
    .filter((lead) => asArray(lead?.members).length || String(lead?.turnOne || lead?.reason || '').trim());
  if (!leads.length) return opts.compact ? '' : '<p class="muted">Finish a few more sets before lead analysis appears.</p>';
  const cards = leads.map((lead, index) => {
    const rawTitle = String(lead.title || (index === 0 ? 'Best opening' : 'Alternative opening')).trim();
    const title = opts.labelMode === 'openingPlans' ? mapOpeningPlanTitle(rawTitle, index) : rawTitle;
    const members = asArray(lead.members).join(' + ') || 'Opening pair';
    const turnOne = lead.turnOne || lead.reason || 'This opening helps your team establish its early plan safely.';
    const watchOut = lead.watchOut || 'Watch for disruption, Protect, or heavy double-target pressure into the Pokémon that needs to act first.';
    const backHalf = lead.backHalf || buildUniqueBackHalfText(lead, index);
    return `<article class="lead-analysis-card">
      <div class="lead-analysis-card-head"><h4>${escapeText(title)}: ${escapeText(members)}</h4></div>
      <p><strong>Turn 1:</strong> ${escapeText(turnOne)}</p>
      <p><strong>Watch out for:</strong> ${escapeText(watchOut)}</p>
      <p><strong>Your back half:</strong> ${escapeText(backHalf)}</p>
    </article>`;
  }).join('');
  return `<section class="team-lead-analysis ${opts.compact ? 'compact' : ''}">
    ${opts.showHeading === false ? '' : '<div class="team-lead-analysis-head"><h3>Lead Analysis</h3><p class="muted small-copy">Best opening pairs based on the current team plan.</p></div>'}
    <div class="team-lead-analysis-grid">${cards}</div>
  </section>`;
}


function mapOpeningPlanTitle(title = '', index = 0) {
  const normalized = String(title || '').trim().toLowerCase();
  if (normalized === 'best opening' || (index === 0 && normalized === 'alternative opening')) return 'Standard opener';
  if (normalized === 'safe setup lead') return 'Safer positioning opener';
  if (normalized === 'aggressive lead') return 'Pressure opener';
  if (normalized === 'defensive lead') return 'Defensive positioning opener';
  if (normalized === 'secondary lead') return 'Secondary opener';
  if (normalized === 'flexible mode lead') return 'Flexible mode opener';
  return title || 'Opening plan';
}

// SHARED PROFILE DISPLAY: renders profile.coaching.nextTeammateSuggestions only.
export function renderNextTeammateSuggestions(profile = {}, options = {}) {
  const opts = normalizeOptions(options, 4);
  const completeness = profile?.completeness || {};
  const filledSlots = Number(completeness.filledSlots || 0);
  const missingSlots = Number(completeness.missingSlots || 0);

  // Next teammate advice is only useful while the team still has open slots.
  // Full teams should move to matchup/damage testing instead of showing add-a-member fallback copy.
  if (completeness.isFullTeam || missingSlots <= 0 || filledSlots <= 0) return '';

  const suggestions = limited(profile?.coaching?.nextTeammateSuggestions, opts, 4).map((item) => String(item || '').trim()).filter(Boolean);
  if (!suggestions.length) return opts.compact ? '<p class="muted">Look for a teammate that supports your current gameplan.</p>' : '';
  const heading = opts.compact ? '' : '<h4>Next teammate ideas</h4>';
  return `<div class="team-coaching-next">${heading}${list(suggestions, 'tactical-identity-list compact-chain-list')}</div>`;
}

// SHARED PROFILE DISPLAY: shared summary renderer for pages that need the whole coaching profile.
export function renderCoachingSummary(profile = {}, options = {}) {
  const opts = normalizeOptions(options);
  const summary = profile?.coaching?.beginnerSummary || 'Start with a Pokémon or small core to build around.';
  return `<section class="card compact-card tactical-secondary-panel team-coaching-summary ${opts.compact ? 'compact' : ''}">
    <div class="card-head"><h2>Team overview</h2>${renderArchetypeBadge(profile, { compact: opts.compact })}</div>
    <p>${escapeText(summary)}</p>
    ${renderGameplanCards(profile, { limit: opts.gameplanLimit || 2, compact: opts.compact })}
    ${renderLeadAnalysis(profile, { limit: opts.leadLimit || 4, compact: opts.compact })}
    ${renderRiskSummary(profile, { limit: opts.riskLimit || 2, compact: opts.compact })}
    ${renderNextTeammateSuggestions(profile, { limit: opts.suggestionLimit || 4, compact: opts.compact })}
    ${renderBeginnerTeamSummary(profile, { compact: opts.compact })}
  </section>`;
}



function explainTerm(text = '') {
  return String(text || '')
    .replace(/speed control/gi, 'speed control (ways to make your team move first)')
    .replace(/scaling damage/gi, 'scaling damage (damage that becomes stronger as the battle continues)')
    .replace(/pivot/gi, 'pivot (switching safely while keeping pressure)');
}

export function renderBeginnerTeamSummary(profile = {}, options = {}) {
  const opts = normalizeOptions(options);

  const archetype = profile?.archetype?.primary || 'balanced';
  const plans = asArray(profile?.gameplans).map((p) => p.label).filter(Boolean);
  const risks = asArray(profile?.risks);
  const leads = asArray(profile?.coaching?.recommendedLeads);
  const pilotTips = asArray(profile?.coaching?.pilotTips);

  const mainPlan = plans.length
    ? `This is a ${archetype.toLowerCase()} team built around ${plans.slice(0, 2).join(' and ')}.`
    : `This is a ${archetype.toLowerCase()} team that tries to control the pace of the game and create safe late-game win conditions.`;

  const winLine = leads.length
    ? `Your usual opening is ${asArray(leads[0]?.members).join(' + ')}. ${firstSentence(leads[0]?.turnOne || leads[0]?.reason || 'Establish your board position early and protect your main damage dealer while weakening the opponent.', 260)}`
    : 'Use your supportive Pokémon early to create safe positions, then bring in your strongest attacker once the opponent has been weakened.';

  const struggleText = risks.length
    ? risks.slice(0, 3).map((risk) => firstSentence(risk.beginnerAdvice || risk.reason || risk.type || '', 180)).join(' ')
    : 'This team can struggle if it loses momentum early or if its main win condition is removed too soon.';

  const focusTips = pilotTips.length
    ? pilotTips.slice(0, 3).map((tip) => {
        const body = typeof tip === 'string'
          ? tip
          : (tip.body || tip.description || tip.detail || tip.text || '');
        return `<li>${escapeText(explainTerm(body))}</li>`;
      }).join('')
    : `
      <li>Protect your main damage dealer until the opponent's strongest answers are weakened.</li>
      <li>Use your support Pokémon early instead of saving them for the end game.</li>
      <li>Set up your speed control (ways to make your team move first) before committing to attacks.</li>
    `;

  return `
    <section class="card compact-card tactical-secondary-panel beginner-team-summary">
      <div class="card-head">
        <h2>Beginner Team Summary</h2>
      </div>

      <div class="team-summary-section">
        <h3>What this team does</h3>
        <p>${escapeText(explainTerm(mainPlan))}</p>
      </div>

      <div class="team-summary-section">
        <h3>How you win</h3>
        <p>${escapeText(explainTerm(winLine))}</p>
      </div>

      <div class="team-summary-section">
        <h3>What you struggle with</h3>
        <p>${escapeText(explainTerm(struggleText))}</p>
      </div>

      <div class="team-summary-section">
        <h3>What to focus on as a pilot</h3>
        <ul class="tactical-identity-list compact-chain-list">
          ${focusTips}
        </ul>
      </div>
    </section>
  `;
}


export function generateAbilityStatusLine(pokemon, teamContext = {}) {
  const ability = String(pokemon?.ability || '');
  const weather = teamContext?.weather || [];

  const mappings = [
    {
      key: 'Sand Force',
      needs: 'sand',
      explanation: "Sand Force boosts Ground, Rock, and Steel moves in sand. This team has no sand setter, so the ability will usually be inactive in battle."
    },
    {
      key: 'Snow Cloak',
      needs: 'snow',
      explanation: "Snow Cloak only activates in snow. Without snow support, the evasion boost never turns on."
    },
    {
      key: 'Chlorophyll',
      needs: 'sun',
      explanation: "Chlorophyll doubles Speed in sun. This Pokémon relies on sun support to function at full power."
    },
    {
      key: 'Swift Swim',
      needs: 'rain',
      explanation: "Swift Swim doubles Speed in rain. Without rain support, this Pokémon plays much slower."
    },
    {
      key: 'Solar Power',
      needs: 'sun',
      explanation: "Solar Power only boosts damage in sun and also causes chip damage every turn."
    }
  ];

  const found = mappings.find(m => ability.includes(m.key));
  if (!found) return null;

  if (!weather.includes(found.needs)) {
    return found.explanation;
  }

  return null;
}

export function buildIntentionalSynergyList(team = []) {
  const synergies = [];

  const has = (text) =>
    team.some(mon =>
      JSON.stringify(mon).toLowerCase().includes(String(text).toLowerCase())
    );

  if (has('Drought') && has('Chlorophyll')) {
    synergies.push('Drought enables Chlorophyll — sun activates the Speed boost immediately.');
  }

  if (has('Fake Out') && has('Tailwind')) {
    synergies.push('Fake Out protects Tailwind setup turns by denying the opponent an action.');
  }

  if (has('White Herb') && has('Unburden')) {
    synergies.push('White Herb activates Unburden after being consumed, giving a massive Speed boost.');
  }

  if (has('Competitive') && has('Intimidate')) {
    synergies.push('Competitive punishes Intimidate users by turning their stat drop into a Special Attack boost.');
  }

  if (has('Tailwind') && has('Garchomp')) {
    synergies.push('Tailwind helps Mega Garchomp overcome its mediocre Speed and fully leverage its stat boost.');
  }

  return synergies;
}

export function generateVariedThrivesWhen(slot, team = []) {
  const name = slot?.name || 'This Pokémon';

  const variants = [
    `${name} is strongest in early-game positions where its partner creates immediate pressure or setup opportunities.`,
    `${name} performs best once faster threats have been slowed down or forced into defensive turns.`,
    `${name} thrives when brought in mid-game after teammates have weakened shared defensive answers.`,
    `${name} is most effective beside supportive teammates that create safe attack turns through disruption or positioning.`,
    `${name} becomes much harder to stop once the opponent has lost speed control or defensive momentum.`
  ];

  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return variants[seed % variants.length];
}

function buildUniqueBackHalfText(lead = {}, index = 0) {
  const members = asArray(lead.members);
  const anchor = members.join(' + ') || 'This opening';
  const variants = [
    `${anchor} usually creates early speed or positioning control, so pivot your mid-game around maintaining initiative instead of forcing immediate knockouts.`,
    `${anchor} tends to trade resources early to open safer switch windows for your damage core, so sequence your back half around preserving tempo after Turn 1.`,
    `${anchor} pressures Protects and defensive positioning early, which lets your remaining slots enter the field with less risk and cleaner targeting patterns.`,
    `${anchor} is designed to force awkward reactions from the opponent immediately, so use the resulting board state to rotate your late-game attacker into a protected position.`
  ];
  return variants[index % variants.length];
}
