import { getDataQualityReport, GOLD_FIELD_NAMES } from '../utils/dataQualityScoring.js';
import { DATA_CONFIDENCE_DISCLOSURE_COPY, getDataConfidenceSummary } from '../logic/dataConfidenceDisclosure.js';

export function DataQualityPage(state) {
  const pokemon = Array.isArray(state.data?.collections?.pokemon) ? state.data.collections.pokemon : [];
  const report = getDataQualityReport(pokemon);
  const total = report.totalPokemon || 1;
  const allFieldsPercentage = percentage(report.pokemonWithAllGoldFields, total);
  const fivePlusPercentage = percentage(report.pokemonWithFivePlusGoldFields, total);
  const belowThreePercentage = percentage(report.pokemonWithBelowThreeGoldFields, total);
  const strategicValidation = getStrategicValidationSummary(pokemon);
  const dataConfidence = getDataConfidenceSummary(pokemon);

  return `<section class="page-stack data-quality-page">
    <header class="hero data-quality-hero">
      <div>
        <p class="eyebrow">Database QA</p>
        <h1>Data Quality Report</h1>
        <p class="muted">Gold-standard tactical coverage across your database.</p>
        <p class="helper-note">Coverage is based on meaningful tactical content, not just field presence.</p>
      </div>
      <div class="badge-row">
        <span class="badge">${report.totalPokemon} Pokémon checked</span>
        <span class="badge ${belowThreePercentage > 25 ? 'risk-high' : belowThreePercentage > 10 ? 'risk-medium' : 'risk-low'}">${belowThreePercentage}% below threshold</span>
      </div>
    </header>

    <section class="card">
      <h2>Overall Coverage</h2>
      <div class="coverage-summary">
        <article class="stat-card">
          <div class="stat-value">${allFieldsPercentage}%</div>
          <div class="stat-label">Pokémon with all 9 gold fields</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${fivePlusPercentage}%</div>
          <div class="stat-label">Pokémon with 5+ gold fields</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${belowThreePercentage}%</div>
          <div class="stat-label">Pokémon with &lt;3 gold fields</div>
        </article>
      </div>
    </section>


    <section class="card data-confidence-team-panel" aria-labelledby="data-confidence-quality-title">
      <div class="section-title-row compact-title-row">
        <h2 id="data-confidence-quality-title">Data Confidence Disclosure</h2>
        <span class="badge data-confidence-badge">${dataConfidence.pendingOfficialConfirmation} pending</span>
      </div>
      <p class="helper-note">${escapeText(DATA_CONFIDENCE_DISCLOSURE_COPY.summary)}.</p>
      <div class="coverage-summary quality-tier-summary">
        <article class="stat-card">
          <div class="stat-value">${dataConfidence.pendingOfficialConfirmation}</div>
          <div class="stat-label">Need official confirmation</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${dataConfidence.confirmed}</div>
          <div class="stat-label">Confirmed / disclosure hidden</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${dataConfidence.strategicLevels.medium || 0}</div>
          <div class="stat-label">Medium strategic inference</div>
        </article>
      </div>
    </section>

    <section class="card">
      <h2>Generated Strategic Data Validation</h2>
      <div class="coverage-summary quality-tier-summary">
        <article class="stat-card">
          <div class="stat-value">${strategicValidation.passingPokemon}</div>
          <div class="stat-label">Pokémon passing generated-data checks</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${strategicValidation.failingPokemon}</div>
          <div class="stat-label">Pokémon with validation warnings</div>
        </article>
        <article class="stat-card">
          <div class="stat-value">${strategicValidation.totalViolations}</div>
          <div class="stat-label">Total warnings</div>
        </article>
      </div>
      <p class="helper-note">Checks cover build move legality, ability legality, item-table references, unsupported signature mechanics, and obvious speed/bulk wording mismatches.</p>
      <div class="pokemon-list data-quality-list">
        ${strategicValidation.examples.map((entry) => `
          <article class="mini-card data-quality-mini-card">
            <div class="section-title-row compact-title-row">
              <h3>${escapeText(entry.name)}</h3>
              <span class="badge risk-medium">${entry.count} warning${entry.count === 1 ? '' : 's'}</span>
            </div>
            <p class="notice">${escapeText(entry.firstIssue)}</p>
            <p class="muted">${escapeText(entry.firstFix)}</p>
          </article>
        `).join('') || '<p class="muted">No generated strategic data warnings found.</p>'}
      </div>
    </section>

    <section class="card">
      <h2>Quality Tiers</h2>
      <div class="coverage-summary quality-tier-summary">
        ${qualityTierCard('Gold Star', report.qualityTiers['Gold Star'], '8–9 meaningful fields')}
        ${qualityTierCard('Strong', report.qualityTiers.Strong, '5–7 meaningful fields')}
        ${qualityTierCard('Needs Work', report.qualityTiers['Needs Work'], '3–4 meaningful fields')}
        ${qualityTierCard('Incomplete', report.qualityTiers.Incomplete, '0–2 meaningful fields')}
      </div>
    </section>

    <section class="card">
      <h2>Field Completion Rate</h2>
      <div class="table-scroll">
        <table class="field-coverage-table">
          ${fieldCoverageTable(report)}
        </table>
      </div>
    </section>

    <section class="card">
      <div class="section-title-row">
        <h2>Incomplete / Weak Pokémon</h2>
        <span class="badge">Showing first ${Math.min(50, report.incompletePokemon.length)}</span>
      </div>
      <div class="pokemon-list data-quality-list">
        ${report.incompletePokemon.slice(0, 50).map((p) => `
          <article class="mini-card data-quality-mini-card">
            <div class="section-title-row compact-title-row">
              <h3>${escapeText(p.name)}</h3>
              <span class="badge">${escapeText(p.qualityTier)}</span>
            </div>
            <p>Complete: ${p.completeFields}/9 (${p.percent}%)</p>
            <p class="notice">Weakest / missing: ${formatMissingFields(p)}</p>
            <p class="muted">${escapeText(firstReason(p))}</p>
          </article>
        `).join('') || '<p class="muted">No Pokémon have weak or incomplete gold-standard tactical coverage.</p>'}
      </div>
    </section>
  </section>`;
}

function qualityTierCard(label, count, description) {
  return `<article class="stat-card quality-tier-card">
    <div class="stat-value">${Number(count) || 0}</div>
    <div class="stat-label">${escapeText(label)}</div>
    <p class="muted">${escapeText(description)}</p>
  </article>`;
}

function fieldCoverageTable(report) {
  const rows = GOLD_FIELD_NAMES.map((field) => {
    const completion = report.fieldCompletion[field] || { completeCount: 0, total: report.totalPokemon, percent: 0 };
    const percent = Number.isFinite(completion.percent) ? completion.percent : 0;
    return `
      <tr>
        <td>${escapeText(field)}</td>
        <td class="coverage-bar"><div class="bar-fill" style="width: ${percent}%"></div></td>
        <td>${percent}%</td>
        <td>${completion.completeCount}/${completion.total}</td>
      </tr>
    `;
  }).join('');

  return `<thead><tr><th>Field</th><th>Meaningful Coverage</th><th>Percent</th><th>Count</th></tr></thead><tbody>${rows}</tbody>`;
}

function formatMissingFields(pokemonScore) {
  const fields = (pokemonScore.missingFieldNames || []).slice(0, 4).map(escapeText);
  const remaining = Math.max(0, (pokemonScore.missingFieldNames || []).length - fields.length);
  return `${fields.join(', ')}${remaining ? ` +${remaining} more` : ''}` || 'None';
}

function firstReason(pokemonScore) {
  const reasons = Object.values(pokemonScore.weakFieldReasons || {}).filter(Boolean);
  return reasons[0] || 'All tracked fields contain meaningful tactical content.';
}

function getStrategicValidationSummary(pokemon) {
  const rows = pokemon.map((p) => ({
    name: p.name,
    validation: p.generatedStrategicDataValidation || { passes: true, violations: [] }
  }));
  const failing = rows.filter((row) => !row.validation.passes);
  const totalViolations = rows.reduce((sum, row) => sum + ((row.validation.violations || []).length), 0);
  return {
    totalPokemon: rows.length,
    passingPokemon: rows.length - failing.length,
    failingPokemon: failing.length,
    totalViolations,
    examples: failing
      .map((row) => ({
        name: row.name,
        count: (row.validation.violations || []).length,
        firstIssue: row.validation.violations?.[0]?.issue || 'Validation warning present.',
        firstFix: row.validation.violations?.[0]?.fix_suggestion || 'Review this Pokémon generated strategic data.'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
  };
}

function percentage(value, total) {
  return Math.round(((Number(value) || 0) / (Number(total) || 1)) * 100);
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
