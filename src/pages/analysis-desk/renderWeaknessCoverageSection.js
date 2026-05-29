import { TYPE_COLORS, escapeAttr, escapeText } from './analysisDeskHelpers.js';
import { getSuggestedSlotForTypeWeakness, renderSuggestedSlotLine } from './analysisDeskSlotSuggestions.js';

export function renderWeaknessCoverageSection(presentation = {}, profile = [], team = [], data = {}, coachingProfile = null) {
  try {
    const indexedData = ensureAnalysisDeskPokemonIndex(data);
    const selectedTeam = getAnalysisDeskSelectedTeam(team);
    const coverageDisplay = presentation?.analysis?.weaknessCoverage || {};
    const suppliedEntries = Array.isArray(profile) ? profile : [];
    const entries = hasUsableWeaknessCoverageEntries(suppliedEntries, selectedTeam)
      ? suppliedEntries
      : (coachingProfile?.defensiveProfile?.rawWeaknessCoverage || []);

    if (!selectedTeam.length || !Array.isArray(entries) || entries.length < 18) {
      return renderWeaknessCoverageFallbackSection();
    }

    return `
    <section class="analysis-section tactical-section-group weakness-coverage-section">
      <details class="analysis-cluster weakness-coverage-cluster" data-analysis-section="weakness-coverage" open>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>${escapeText(coverageDisplay.title || 'Weakness Coverage')}</h2>
            <p class="section-summary">${escapeText(coverageDisplay.summary || 'A quick view of which attacking types your team handles well and which ones may need safer answers.')}</p>
            <p class="section-collapsed-preview">${escapeText(coverageDisplay.collapsedPreview || 'Type weakness coverage tiles available.')}</p>
          </div>
        </summary>
        <div class="analysis-collapse-body">
          ${renderWeaknessCoverageCoachingSummary(coverageDisplay)}
          <div class="weakness-coverage-grid">
            ${sortWeaknessCoverageTiles(entries).map((entry) => renderWeaknessCoverageTile(entry, team, coverageDisplay?.byType?.[entry.attackingType])).join('')}
          </div>
        </div>
      </details>
    </section>`;
  } catch (error) {
    return renderWeaknessCoverageFallbackSection();
  }
}

function renderWeaknessCoverageFallbackSection() {
  return `
    <section class="analysis-section tactical-section-group weakness-coverage-section">
      <details class="analysis-cluster weakness-coverage-cluster" data-analysis-section="weakness-coverage" open>
        <summary class="section-toolbar-header">
          <div class="section-toolbar-copy">
            <h2>Weakness Coverage</h2>
            <p class="section-summary">A simple coverage overview will show here once this team has complete typing data.</p>
            <p class="section-collapsed-preview">Typing data needed for coverage tiles.</p>
          </div>
        </summary>
        <div class="analysis-collapse-body">
          <div class="weakness-coverage-fallback" role="status">
            <p>Type coverage will appear once this team has complete typing data.</p>
          </div>
        </div>
      </details>
    </section>`;
}

// RAW CALCULATION INPUT: extracts selected slots for coverage calculations.
function getAnalysisDeskSelectedTeam(team = []) {
  return (Array.isArray(team) ? team : []).filter((slot) => slot && slot.pokemon_id);
}

// RAW CALCULATION GUARD: validates supplied weakness coverage entries before rendering.
function hasUsableWeaknessCoverageEntries(entries = [], selectedTeam = []) {
  return Array.isArray(entries)
    && entries.length >= 18
    && entries.every((entry) => entry?.attackingType && Array.isArray(entry.memberResults))
    && entries.some((entry) => (entry.memberResults || []).length >= selectedTeam.length);
}

// RAW CALCULATION GUARD: checks whether coverage data is complete enough to trust.
function hasCompleteWeaknessCoverageData(entries = [], team = [], data = {}) {
  const selectedTeam = getAnalysisDeskSelectedTeam(team);
  if (!selectedTeam.length) return false;
  if (!Array.isArray(entries) || entries.length < 18) return false;
  if (entries.some((entry) => !entry?.attackingType || !Array.isArray(entry.memberResults))) return false;

  return selectedTeam.every((slot) => getAnalysisDeskPokemonTypes(slot, data).length > 0);
}

// RAW CALCULATION INPUT: prepares a Pokémon lookup for weakness coverage calculation fallback.
function ensureAnalysisDeskPokemonIndex(data = {}) {
  const existing = data?.indexes?.pokemonById || {};
  if (Object.keys(existing).length) return data;
  const rows = data?.collections?.pokemon || data?.pokemon || data?.pokemonRows || [];
  const pokemonById = Object.fromEntries((Array.isArray(rows) ? rows : []).filter((row) => row?.pokemon_id).map((row) => [row.pokemon_id, row]));
  return { ...data, indexes: { ...(data?.indexes || {}), pokemonById } };
}

// RAW CALCULATION INPUT: reads display/form typing for coverage validation.
function getAnalysisDeskPokemonTypes(slot = {}, data = {}) {
  const indexedData = ensureAnalysisDeskPokemonIndex(data);
  const pokemonById = indexedData?.indexes?.pokemonById || {};
  const pokemon = pokemonById[slot?.pokemon_id] || slot?.pokemon || slot || {};
  const rawTypes = [
    slot?.typeOverride,
    slot?.type_1,
    slot?.type_2,
    slot?.type1,
    slot?.type2,
    pokemon?.type_1,
    pokemon?.type_2,
    pokemon?.type1,
    pokemon?.type2
  ];

  return [...new Set(rawTypes.flatMap(splitAnalysisDeskTypes).map(normalizeAnalysisDeskType).filter(Boolean))];
}

// RAW CALCULATION INPUT: normalizes stored type strings.
function splitAnalysisDeskTypes(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\/,&|]+/).map((entry) => entry.trim());
}

// RAW CALCULATION INPUT: maps type text to canonical Pokémon type names.
function normalizeAnalysisDeskType(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  const validTypes = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
  return validTypes.find((type) => type.toLowerCase() === clean) || '';
}

// PRESENTER DISPLAY: keeps the scan-friendly Weakness Coverage explanation tied to canonical presenter strings.
function renderWeaknessCoverageCoachingSummary(coverageDisplay = {}) {
  return coverageDisplay?.coachingSummary
    ? `<p class="section-summary weakness-coverage-coaching-summary">${escapeText(coverageDisplay.coachingSummary)}</p>`
    : '';
}

// RAW CALCULATION SORTING: chooses the highest-severity raw coverage entry for display.
function getTopWeaknessCoverageConcern(entries = []) {
  const candidates = entries
    .filter((entry) => Number(entry?.weakCount || 0) > 0)
    .map((entry) => ({
      ...entry,
      defensiveAnswers: Number(entry?.resistCount || 0) + Number(entry?.immuneCount || 0),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .sort((a, b) => {
      const exposedDelta = Number(normalizeWeaknessCoverageStatus(b.classification) === 'Exposed') - Number(normalizeWeaknessCoverageStatus(a.classification) === 'Exposed');
      if (exposedDelta) return exposedDelta;
      const weakDelta = b.weakScore - a.weakScore;
      if (weakDelta) return weakDelta;
      const answerDelta = a.defensiveAnswers - b.defensiveAnswers;
      if (answerDelta) return answerDelta;
      return b.priority - a.priority;
    });

  return candidates[0] || null;
}

// RAW CALCULATION SORTING: chooses the strongest raw coverage entry for display.
function getTopWeaknessCoverageStrength(entries = [], excludedType = '') {
  return entries
    .filter((entry) => entry?.attackingType !== excludedType)
    .map((entry) => ({
      ...entry,
      defensiveAnswers: Number(entry?.resistCount || 0) + Number(entry?.immuneCount || 0),
      weakScore: Number(entry?.weakCount || 0),
      priority: competitiveTypePriority(entry?.attackingType)
    }))
    .filter((entry) => normalizeWeaknessCoverageStatus(entry.classification) === 'Covered' && entry.defensiveAnswers >= 2)
    .sort((a, b) => {
      const answerDelta = b.defensiveAnswers - a.defensiveAnswers;
      if (answerDelta) return answerDelta;
      const weakDelta = a.weakScore - b.weakScore;
      if (weakDelta) return weakDelta;
      return b.priority - a.priority;
    })[0] || null;
}

// UI RENDERER: formats raw coverage counts for compact tile copy.
function formatWeaknessCoverageSummaryLine(entry = {}) {
  const typeName = entry.attackingType || 'This type';
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  if (status === 'Exposed') {
    return `${typeName} has limited safe switch-ins. Add a resist, immunity, or faster offensive pressure if ${typeName}-type attackers become common problems.`;
  }
  if (status === 'Covered') {
    return `${typeName} is reasonably covered. You have resistances, immunities, or practical answers available.`;
  }
  return `${typeName} pressure needs attention. Some teammates can help, but avoid switching affected Pokémon directly into ${typeName}-type attacks.`;
}

// SHARED PROFILE DISPLAY: page-local wording for raw Weakness Coverage tile details only, not team identity scoring.
function describeWeaknessCoverageConcern(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);

  if (answers === 0 && weak >= 2) return 'several Pokémon are weak to it and the team has limited safe switch-ins';
  if (answers === 0) return 'the team has limited safe switch-ins for this attacking type';
  if (answers === 1 && weak >= 2) return 'several Pokémon are weak to it and the team leans heavily on one defensive answer';
  if (answers === 1) return 'the team leans on one resist or immunity, so keep that answer healthy';
  return 'it can still pressure multiple teammates if your main answers are weakened early';
}

// UI RENDERER: explains a raw covered tile without altering risk logic.
function describeWeaknessCoverageStrength(entry = {}) {
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);
  if (answers >= 3) return 'you have several resistances, immunities, or practical answers available';
  return 'you have multiple resistances, immunities, or practical answers available';
}

function competitiveTypePriority(typeName = '') {
  const priorityTypes = ['Ground', 'Fighting', 'Water', 'Fire', 'Electric', 'Ice', 'Fairy', 'Dragon', 'Dark', 'Rock'];
  const index = priorityTypes.indexOf(typeName);
  return index === -1 ? 0 : priorityTypes.length - index;
}

// UI RENDERER: displays one raw weakness coverage tile.
function renderWeaknessCoverageTile(entry = {}, team = [], display = {}) {
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  const typeName = entry.attackingType || 'Unknown';
  const detailGroups = weaknessCoverageDetailGroups(entry);
  const hoverText = `${typeName}:\nWeak: ${detailGroups.weak}\nResists: ${detailGroups.resist}\nImmune: ${detailGroups.immune}\nNeutral: ${detailGroups.neutral}`;
  const score = defensiveNetResistanceScore(entry);
  const metricClass = score > 0 ? 'metric-positive' : score < 0 ? 'metric-negative' : 'metric-neutral';
  const metric = score > 0 ? `+${score}` : `${score}`;
  const isActionable = status !== 'Covered';
  const detailMarkup = isActionable ? renderWeaknessCoverageActionDetails(entry, detailGroups, team, display) : renderCoveredWeaknessCoverageDetails(entry, detailGroups, display);

  return `
    <article class="type-heatmap-tile weakness-coverage-tile ${weaknessCoverageToneClass(status)} ${isActionable ? 'coverage-actionable' : 'coverage-safe'}" style="--type-color: ${escapeAttr(TYPE_COLORS[typeName] || '#64748b')}" title="${escapeText(hoverText)}">
      <details class="type-heatmap-details weakness-coverage-details">
        <summary class="type-heatmap-face" aria-label="${escapeAttr(typeName)} defense score ${escapeAttr(metric)}">
          <strong>${escapeText(typeName)}</strong>
          <span class="type-heatmap-metric ${metricClass}">${escapeText(metric)}</span>
        </summary>
        ${detailMarkup}
      </details>
    </article>`;
}

function defensiveNetResistanceScore(entry = {}) {
  return (Array.isArray(entry.memberResults) ? entry.memberResults : []).reduce((score, member) => {
    const multiplier = Number(member?.multiplier);
    if (multiplier === 0) return score + 2;
    if (multiplier <= 0.25) return score + 2;
    if (multiplier < 1) return score + 1;
    if (multiplier >= 4) return score - 2;
    if (multiplier > 1) return score - 1;
    return score;
  }, 0);
}


function renderWeaknessCoverageInlineGroups(detailGroups = {}) {
  const noResists = String(detailGroups.resist || '').toLowerCase() === 'none' && String(detailGroups.immune || '').toLowerCase() === 'none';
  return `<div class="weakness-inline-groups">
    <p><b>Resists:</b> ${escapeText(detailGroups.resist)}</p>
    ${String(detailGroups.immune || '').toLowerCase() !== 'none' ? `<p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>` : ''}
    <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
    <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
    ${noResists ? '<p class="muted">No resists on this team</p>' : ''}
  </div>`;
}


// UI RENDERER: expands one raw weakness coverage tile with practical detail.
function renderWeaknessCoverageActionDetails(entry = {}, detailGroups = {}, team = [], display = {}) {
  const typeName = entry.attackingType || 'this type';
  const status = normalizeWeaknessCoverageStatus(entry.classification);
  const suggestion = getSuggestedSlotForTypeWeakness(typeName, [entry], team, entry);

  return `
        <div class="type-heatmap-detail-panel weakness-coverage-detail-body" aria-label="${escapeText(typeName)} coverage details">
          <p><b>Why:</b> ${escapeText(display?.why || `${status === 'Exposed' ? `${typeName} has limited safe switch-ins` : `${typeName} pressure needs attention`}.`)}</p>
          <p><b>Current defensive profile:</b> ${escapeText(display?.currentProfile || `${Number(entry.resistCount || 0)} resist, ${Number(entry.immuneCount || 0)} immune, ${Number(entry.weakCount || 0)} weak.`)}</p>
          <p><b>Look for:</b> ${escapeText(display?.lookFor || `a safer switch-in, offensive pressure into ${typeName}-types, or support that helps your team avoid taking clean hits.`)}</p>
          ${display?.softAnswersText ? `<p><b>Soft answers already present:</b> ${escapeText(display.softAnswersText)}</p>` : ''}
          <p><b>Useful support:</b> ${escapeText(display?.usefulSupport || 'Protect, speed control, Fake Out, redirection, Intimidate, or status can buy safer turns while you look for a better answer.')}</p>
          ${renderSuggestedSlotLine(suggestion)}
          <a class="secondary-button compact weakness-answer-link" href="/metadex?answerType=${escapeAttr(typeName)}" data-route="metadex" data-metadex-answer-type="${escapeAttr(typeName)}">Find answers in MetaDex</a>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Resist:</b> ${escapeText(detailGroups.resist)}</p>
          <p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
        </div>`;
}

// UI RENDERER: expands one covered weakness coverage tile.
function renderCoveredWeaknessCoverageDetails(entry = {}, detailGroups = {}, display = {}) {
  return `
        <div class="type-heatmap-detail-panel weakness-coverage-detail-body">
          <p>${escapeText(display?.coveredSummary || `${entry.attackingType || 'This type'} is reasonably covered.`)}</p>
          <p><b>Resist:</b> ${escapeText(detailGroups.resist)}</p>
          <p><b>Immune:</b> ${escapeText(detailGroups.immune)}</p>
          <p><b>Weak:</b> ${escapeText(detailGroups.weak)}</p>
          <p><b>Neutral:</b> ${escapeText(detailGroups.neutral)}</p>
        </div>`;
}

// UI RENDERER: describes why a raw Needs Attention tile matters.
function describeNeedsAttentionWeaknessCoverage(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const answers = Number(entry.resistCount || 0) + Number(entry.immuneCount || 0);
  if (answers === 1 && weak >= 2) return 'you have one answer, but several teammates are weak to it';
  if (answers === 1) return 'you have one answer, so the matchup can become risky if that Pokémon is weakened';
  if (weak > 0) return 'it can pressure part of the team and your answers may not be completely safe';
  return 'there are limited safe switch-ins even though no teammate is directly weak to it';
}

const DEFENSIVE_TYPE_ANSWERS = {
  Normal: ['Rock-types resist Normal', 'Steel-types resist Normal', 'Ghost-types are immune to Normal'],
  Fire: ['Water-types resist Fire', 'Rock-types resist Fire', 'Dragon-types resist Fire'],
  Water: ['Grass-types resist Water', 'Dragon-types resist Water', 'Water-types resist Water'],
  Electric: ['Ground-types are immune to Electric', 'Grass-types resist Electric', 'Dragon-types resist Electric'],
  Grass: ['Fire-types resist Grass', 'Flying-types resist Grass', 'Steel-types resist Grass'],
  Ice: ['Fire-types resist Ice', 'Water-types resist Ice', 'Steel-types resist Ice'],
  Fighting: ['Flying-types resist Fighting', 'Psychic-types resist Fighting', 'Ghost-types are immune to Fighting'],
  Poison: ['Steel-types are immune to Poison', 'Ground-types threaten Poison offensively', 'Psychic-types threaten Poison offensively'],
  Ground: ['Flying-types are immune to Ground', 'Grass-types resist Ground', 'Bug-types resist Ground'],
  Flying: ['Electric-types resist Flying', 'Rock-types resist Flying', 'Steel-types resist Flying'],
  Psychic: ['Dark-types are immune to Psychic', 'Steel-types resist Psychic', 'Bug- or Ghost-type pressure can threaten Psychic-types'],
  Bug: ['Fire-types resist Bug', 'Flying-types resist Bug', 'Steel-types resist Bug'],
  Rock: ['Fighting-types resist Rock', 'Ground-types resist Rock', 'Steel-types resist Rock'],
  Ghost: ['Normal-types are immune to Ghost', 'Dark-types resist Ghost', 'Dark-type pressure threatens Ghost-types'],
  Dragon: ['Fairy-types are immune to Dragon', 'Steel-types resist Dragon', 'Ice or Fairy pressure threatens Dragon-types'],
  Dark: ['Fighting-types resist Dark', 'Fairy-types resist Dark', 'Dark-types resist Dark'],
  Steel: ['Fire-types resist Steel', 'Water-types resist Steel', 'Electric-types resist Steel'],
  Fairy: ['Steel-types resist Fairy', 'Poison-types resist Fairy', 'Fire-types resist Fairy']
};

// UI RENDERER: suggests defensive answer categories for a raw attacking type tile.
function weaknessCoverageAnswerAdvice(typeName = '') {
  const answers = DEFENSIVE_TYPE_ANSWERS[typeName] || [];
  return answers.length ? `${answers.join(', ')}, or a teammate that can safely switch into common ${typeName}-type attacks` : '';
}

// RAW CALCULATION: detects selected-team support tools used only to annotate weakness coverage display.
function detectWeaknessCoverageSoftAnswers(team = []) {
  const movesText = (Array.isArray(team) ? team : []).flatMap((slot) => [slot?.move1, slot?.move2, slot?.move3, slot?.move4, ...(Array.isArray(slot?.moves) ? slot.moves : [])]).map((move) => String(move?.name || move || '').toLowerCase());
  const abilityText = (Array.isArray(team) ? team : []).map((slot) => String(slot?.ability || slot?.selectedAbility || '').toLowerCase());
  const has = (terms) => movesText.some((move) => terms.some((term) => move.includes(term)));
  const answers = [];
  if (has(['tailwind', 'icy wind', 'electroweb', 'nuzzle', 'thunder wave', 'trick room'])) answers.push('speed control');
  if (has(['fake out'])) answers.push('Fake Out');
  if (abilityText.some((ability) => ability.includes('intimidate'))) answers.push('Intimidate');
  if (has(['snarl'])) answers.push('Snarl');
  if (has(['will-o-wisp', 'will o wisp'])) answers.push('Will-O-Wisp');
  if (has(['taunt'])) answers.push('Taunt');
  if (has(['encore'])) answers.push('Encore');
  if (has(['follow me', 'rage powder'])) answers.push('redirection');
  if (has(['reflect', 'light screen', 'aurora veil'])) answers.push('screens or Aurora Veil');
  if (has(['recover', 'wish', 'roost', 'moonlight', 'synthesis', 'protect'])) answers.push('recovery or stalling turns');
  if (has(['volt switch', 'u-turn', 'u turn', 'parting shot', 'flip turn'])) answers.push('pivoting');
  return [...new Set(answers)];
}

function formatSoftAnswerSummary(answers = []) {
  if (!answers.length) return '';
  if (answers.length === 1) return answers[0];
  return `${answers.slice(0, -1).join(', ')} and ${answers[answers.length - 1]}`;
}

// UI RENDERER: formats missing support categories for weakness coverage details.
function weaknessCoverageSupportAdvice(softAnswers = []) {
  const base = ['speed control', 'Fake Out', 'Taunt', 'Snarl', 'Intimidate', 'screens, Aurora Veil, redirection, recovery, or strong offensive pressure'];
  const missing = base.filter((item) => !softAnswers.some((answer) => item.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(item.toLowerCase())));
  return `consider ${missing.slice(0, 4).join(', ')} if you do not want to add another hard resist.`;
}

// RAW CALCULATION SORTING: groups raw member coverage relations for display.
function weaknessCoverageDetailGroups(entry = {}) {
  const members = Array.isArray(entry.memberResults) ? entry.memberResults : [];
  return {
    weak: formatWeaknessCoverageNames(members, 'weak'),
    resist: formatWeaknessCoverageNames(members, 'resist'),
    immune: formatWeaknessCoverageNames(members, 'immune'),
    neutral: formatWeaknessCoverageNames(members, 'neutral')
  };
}

function formatWeaknessCoverageNames(members = [], relation = '') {
  const names = members
    .filter((member) => member?.relation === relation)
    .map((member) => member?.pokemonName || 'Unknown Pokémon')
    .filter(Boolean);

  return names.length ? names.join(', ') : 'none';
}

function normalizeWeaknessCoverageStatus(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'exposed') return 'Exposed';
  if (text === 'covered') return 'Covered';
  return 'Needs Attention';
}

// RAW CALCULATION SORTING: orders raw coverage tiles for scanning.
function sortWeaknessCoverageTiles(entries = []) {
  const severityRank = {
    Exposed: 0,
    'Needs Attention': 1,
    Covered: 2
  };

  return [...entries].sort((a, b) => {
    const statusDelta = severityRank[normalizeWeaknessCoverageStatus(a.classification)] - severityRank[normalizeWeaknessCoverageStatus(b.classification)];
    if (statusDelta) return statusDelta;

    const weakDelta = Number(b?.weakCount || 0) - Number(a?.weakCount || 0);
    if (weakDelta) return weakDelta;

    return 0;
  });
}

function weaknessCoverageToneClass(status = '') {
  if (status === 'Exposed') return 'coverage-exposed';
  if (status === 'Covered') return 'coverage-covered';
  return 'coverage-needs-attention';
}

function weaknessCoverageCountSummary(entry = {}) {
  const weak = Number(entry.weakCount || 0);
  const resists = Number(entry.resistCount || 0);
  const immunes = Number(entry.immuneCount || 0);
  const answers = resists + immunes;
  const parts = [];

  if (answers > 0) parts.push(`${answers} ${answers === 1 ? 'resist' : 'resists'}`);
  if (weak > 0) parts.push(`${weak} weak`);
  if (!parts.length) return '0 weak / 0 resists';
  return parts.join(' / ');
}

// SHARED PROFILE DISPLAY: renders canonical team identity from the tactical presenter.
