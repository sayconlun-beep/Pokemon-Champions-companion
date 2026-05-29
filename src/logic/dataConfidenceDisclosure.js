export const DATA_CONFIDENCE_DISCLOSURE_COPY = Object.freeze({
  badge: 'Community-inferred data',
  summary: 'Community-inferred data, pending official Pokémon Champions confirmation',
  officialReview: 'Legality, seasonal clauses, banlists, and build guidance are based on the current community-maintained dataset and still need official Pokémon Champions confirmation.',
  strategicPrefix: 'Strategic guidance inference confidence:',
  noEligibleEntries: 'No entries in this view currently need an official confirmation disclosure.'
});

const CONFIRMED_STATUS_PATTERN = /\b(confirmed|verified|official|approved)\b/i;
const UNCONFIRMED_STATUS_PATTERN = /needs?\s+champions?\s+confirmation|pending|review|unconfirmed|needs?\s+official/i;
const LEVEL_ORDER = ['low', 'medium', 'high'];

export function getPokemonConfidenceState(pokemon = {}) {
  const confidenceStatus = String(pokemon?.confidenceStatus || '').trim();
  const statusIsConfirmed = CONFIRMED_STATUS_PATTERN.test(confidenceStatus) && !UNCONFIRMED_STATUS_PATTERN.test(confidenceStatus);
  const explicitlyNeedsConfirmation = UNCONFIRMED_STATUS_PATTERN.test(confidenceStatus);
  const requiresOfficialReview = pokemon?.requiresOfficialReview === true;
  const strictModeEligible = pokemon?.strictModeEligible === true;
  const needsOfficialConfirmation = statusIsConfirmed
    ? false
    : Boolean(explicitlyNeedsConfirmation || requiresOfficialReview || strictModeEligible === false);
  const strategicInferenceLevel = getStrategicInferenceLevel(pokemon);

  return {
    confidenceState: needsOfficialConfirmation ? 'needs official confirmation' : 'confirmed',
    needsOfficialConfirmation,
    strategicInferenceLevel,
    hasStrategicInference: Boolean(strategicInferenceLevel),
    confidenceStatus,
    requiresOfficialReview,
    strictModeEligible
  };
}

export function shouldShowDataConfidenceDisclosure(pokemon = {}) {
  return getPokemonConfidenceState(pokemon).needsOfficialConfirmation;
}

export function getStrategicInferenceLevel(pokemon = {}) {
  const source = pokemon?.inferenceConfidence;
  const values = [];
  if (typeof source === 'string') values.push(source);
  else if (source && typeof source === 'object') values.push(...Object.values(source));
  const normalized = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => LEVEL_ORDER.includes(value));
  if (!normalized.length) return '';
  return normalized.sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))[0];
}

export function getDataConfidenceDisclosureText(pokemon = {}) {
  const state = getPokemonConfidenceState(pokemon);
  if (!state.needsOfficialConfirmation) return null;
  return {
    badge: DATA_CONFIDENCE_DISCLOSURE_COPY.badge,
    summary: DATA_CONFIDENCE_DISCLOSURE_COPY.summary,
    officialReview: DATA_CONFIDENCE_DISCLOSURE_COPY.officialReview,
    strategicNote: state.strategicInferenceLevel
      ? `${DATA_CONFIDENCE_DISCLOSURE_COPY.strategicPrefix} ${state.strategicInferenceLevel}.`
      : ''
  };
}

export function renderDataConfidenceDisclosure(pokemon = {}, options = {}) {
  const disclosure = getDataConfidenceDisclosureText(pokemon);
  if (!disclosure) return '';
  const idSuffix = sanitizeId(options.id || pokemon?.pokemon_id || pokemon?.name || 'entry');
  const labelId = `data-confidence-${idSuffix}-label`;
  const compactClass = options.compact ? ' compact' : '';
  const strategicNote = options.includeStrategicNote !== false && disclosure.strategicNote
    ? `<p class="data-confidence-note">${escapeHtml(disclosure.strategicNote)}</p>`
    : '';
  return `<details class="data-confidence-disclosure${compactClass}" data-confidence-disclosure>
    <summary id="${labelId}" class="data-confidence-summary" aria-label="${escapeHtml(disclosure.summary)}">
      <span class="badge data-confidence-badge">${escapeHtml(disclosure.badge)}</span>
      <span class="data-confidence-summary-text">${escapeHtml(disclosure.summary)}</span>
    </summary>
    <div class="data-confidence-body" role="note" aria-labelledby="${labelId}">
      <p>${escapeHtml(disclosure.officialReview)}</p>
      ${strategicNote}
    </div>
  </details>`;
}

export function renderTeamDataConfidenceDisclosure(team = [], data = {}, options = {}) {
  const entries = getTeamConfidenceEntries(team, data);
  if (!entries.length) return '';
  const title = options.title || 'Data confidence notice';
  const idSuffix = sanitizeId(options.id || title);
  return `<section class="card data-confidence-team-panel${options.compact ? ' compact' : ''}" aria-labelledby="data-confidence-team-${idSuffix}">
    <div class="section-title-row compact-title-row">
      <h2 id="data-confidence-team-${idSuffix}">${escapeHtml(title)}</h2>
      <span class="badge data-confidence-badge">${entries.length} pending</span>
    </div>
    <p class="muted small-copy">${escapeHtml(DATA_CONFIDENCE_DISCLOSURE_COPY.summary)}.</p>
    <div class="data-confidence-chip-list">
      ${entries.map(({ pokemon, state, name }) => `<details class="data-confidence-disclosure compact" data-confidence-disclosure>
        <summary class="data-confidence-summary" aria-label="${escapeHtml(`${name}: ${DATA_CONFIDENCE_DISCLOSURE_COPY.summary}`)}">
          <span class="badge data-confidence-badge">${escapeHtml(name)}</span>
          ${state.strategicInferenceLevel ? `<span class="data-confidence-level">Strategic confidence: ${escapeHtml(state.strategicInferenceLevel)}</span>` : ''}
        </summary>
        <div class="data-confidence-body" role="note">
          <p>${escapeHtml(DATA_CONFIDENCE_DISCLOSURE_COPY.officialReview)}</p>
          ${state.strategicInferenceLevel ? `<p class="data-confidence-note">${escapeHtml(DATA_CONFIDENCE_DISCLOSURE_COPY.strategicPrefix)} ${escapeHtml(state.strategicInferenceLevel)}.</p>` : ''}
        </div>
      </details>`).join('')}
    </div>
  </section>`;
}

export function getTeamConfidenceEntries(team = [], data = {}) {
  const seen = new Set();
  return (team || [])
    .map((slot) => slot?.pokemon_id ? data?.indexes?.pokemonById?.[slot.pokemon_id] : null)
    .filter(Boolean)
    .filter((pokemon) => {
      const key = pokemon.pokemon_id || pokemon.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return shouldShowDataConfidenceDisclosure(pokemon);
    })
    .map((pokemon) => ({
      pokemon,
      name: getPokemonDisclosureName(pokemon),
      state: getPokemonConfidenceState(pokemon)
    }));
}

export function getDataConfidenceSummary(pokemonRows = []) {
  const rows = Array.isArray(pokemonRows) ? pokemonRows : [];
  const states = rows.map((pokemon) => getPokemonConfidenceState(pokemon));
  const pending = states.filter((state) => state.needsOfficialConfirmation).length;
  const strategicLevels = states.reduce((acc, state) => {
    const level = state.strategicInferenceLevel || 'unknown';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  return {
    total: rows.length,
    pendingOfficialConfirmation: pending,
    confirmed: rows.length - pending,
    strategicLevels
  };
}

function getPokemonDisclosureName(pokemon = {}) {
  return String(pokemon.display_name || pokemon.full_name || pokemon.name || pokemon.pokemon_id || 'Pokémon').trim();
}

function sanitizeId(value) {
  return String(value || 'entry').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'entry';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
