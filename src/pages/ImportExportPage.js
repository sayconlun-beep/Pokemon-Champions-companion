import { exportTeam, getSavedTeamEntries } from '../core/teamMigrationEngine.js';
import { analyseItemClause } from '../core/itemClauseEngine.js';
import { exportTeamToShowdown } from '../core/showdownFormatEngine.js';
import { getStatConversionAuditReport } from '../core/statConversionAudit.js';

export function ImportExportPage(state) {
  const savedEntries = getSavedTeamEntries();
  const activeSavedEntry = savedEntries.find((entry) => entry.id === state.activeSavedTeamId || entry.storageKey === state.activeSavedTeamId);
  const itemClause = analyseItemClause(state.team, state.data);
  const mode = state.importExport?.mode || 'champions';
  const showdown = exportTeamToShowdown(state.team, { mode, database: state.data, itemClause: true });
  const json = exportTeam(state.team, state.data);
  const exportText = mode === 'json' ? json : showdown.text;
  const result = state.importExport?.lastResult;
  const statAudit = getStatConversionAuditReport(state.team, state.data);
  const showDeveloperAudit = isDeveloperAuditVisible(state);

  return `<section class="page-stack import-export-page">
    <header class="hero">
      <p class="eyebrow">Team data tools</p>
      <h1>Import/Export</h1>
      <p>Export official Pokémon Showdown text, Champions-compatible Showdown text, or full app JSON without breaking saved teams.</p>
    </header>
    <section class="import-export-layout">
      <article class="card compact-card">
        <div class="card-head"><h2>Export current team</h2><span class="badge">${state.team.filter(Boolean).length}/6 selected</span></div>
        <label class="field-label" for="export-mode">Export mode</label>
        <select id="export-mode" data-export-mode>
          <option value="standard" ${mode === 'standard' ? 'selected' : ''}>Pokémon Showdown Standard</option>
          <option value="champions" ${mode === 'champions' ? 'selected' : ''}>Pokémon Champions Showdown Text</option>
          <option value="json" ${mode === 'json' ? 'selected' : ''}>App JSON</option>
        </select>
        <textarea id="team-export" rows="14" readonly>${escapeText(exportText)}</textarea>
        <label class="field-label" for="save-team-name">Team name</label>
        ${activeSavedEntry ? `<p class="muted small-copy save-team-context">Editing saved team: <strong>${escapeText(activeSavedEntry.teamName || activeSavedEntry.title || activeSavedEntry.storageKey || 'Saved team')}</strong></p>` : ''}
        <div class="save-team-row">
          <input id="save-team-name" type="text" maxlength="60" aria-label="Team name" autocomplete="off">
          <button type="button" data-action="save-team">${activeSavedEntry ? 'Save changes' : 'Save team'}</button>
          ${activeSavedEntry ? '<button class="secondary-button" type="button" data-action="save-team-copy">Save as copy</button>' : ''}
        </div>
        ${state.importExport?.saveNotice ? `<p class="muted small-copy save-team-context">${escapeText(state.importExport.saveNotice)}</p>` : ''}
        <div class="actions"><button type="button" data-action="copy-export">Copy export</button></div>
        ${renderWarnings('Export warnings', showdown.warnings)}
        ${itemClause.legal ? '<p class="muted">Export legality summary: Item Clause legal.</p>' : `<div class="item-clause-panel"><strong>Export legality summary: Item Clause illegal</strong>${itemClause.duplicates.map((entry) => `<p class="warning">${escapeText(entry.itemName)}: ${entry.pokemonNames.map(escapeText).join(' + ')}</p>`).join('')}</div>`}
      </article>
      <article class="card compact-card">
        <div class="card-head"><h2>Import</h2><span class="badge">Showdown or JSON</span></div>
        <p class="muted small-copy">Paste Pokémon Champions Showdown-style text or app JSON. In Champions mode, EVs lines using 0–32 values are treated as Stat Points. Standard Showdown EV spreads are preserved separately.</p>
        <textarea id="team-import" rows="14" aria-label="Paste Showdown team text or App JSON">${escapeText(state.importExport?.draft || '')}</textarea>
        <div class="actions"><button type="button" data-action="import-showdown-team">Import into builder</button><button type="button" data-action="clear-import-box">Clear</button></div>
        ${renderImportResult(result)}
      </article>
      <article class="card compact-card">
        <div class="card-head"><h2>Saved teams</h2><span class="badge">${savedEntries.length}</span></div>
        <div class="saved-team-grid">${savedEntries.map((entry) => renderSavedTeamEntry(entry, state)).join('') || '<p class="muted">No saved teams found on this device.</p>'}</div>
      </article>
      ${renderCompatibilityConfirmation()}
      ${showDeveloperAudit ? renderStatAudit(statAudit) : ''}
    </section>
  </section>`;
}


function isDeveloperAuditVisible(state) {
  if (state?.importExport?.showDeveloperAudit === true || state?.settings?.developerMode === true || state?.debugMode === true) {
    return true;
  }
  try {
    return window.localStorage.getItem('championsDeveloperMode') === 'true' || window.localStorage.getItem('showImportExportAudit') === 'true';
  } catch (_) {
    return false;
  }
}

function renderCompatibilityConfirmation() {
  return `<article class="card compact-card import-export-compatibility-note">
    <p class="muted small-copy">Teams are automatically converted and validated for Pokémon Champions compatibility.</p>
  </article>`;
}

function renderSavedTeamEntry(entry, state) {
  const id = entry?.id || entry?.storageKey || entry?.teamName || '';
  const name = entry?.teamName || entry?.title || entry?.storageKey || 'Saved team';
  const teamSlots = Array.isArray(entry?.team) ? entry.team.filter(Boolean).length : 0;
  const savedAt = formatSavedTeamDate(entry?.savedAt || entry?.createdAt || entry?.updatedAt || entry?.storageKey || '');
  const meta = [savedAt, teamSlots ? `${teamSlots}/6 Pokémon` : 'No Pokémon'].filter(Boolean).join(' • ');
  const isRenaming = state.importExport?.renamingTeamId === id;
  const isDeleting = state.importExport?.deletingTeamId === id;
  if (isRenaming) {
    return `<div class="saved-team-entry is-renaming">
      <div class="saved-team-main">
        <label class="field-label" for="rename-${escapeText(id)}">Rename team</label>
        <input id="rename-${escapeText(id)}" class="saved-team-rename-input" type="text" maxlength="60" value="${escapeText(name)}" aria-label="Rename saved team">
        ${meta ? `<span class="saved-team-meta">${escapeText(meta)}</span>` : ''}
      </div>
      <div class="saved-team-actions">
        <button type="button" data-action="confirm-rename-team" data-rename-team-id="${escapeText(id)}">Save</button>
        <button type="button" data-action="cancel-rename-team">Cancel</button>
      </div>
    </div>`;
  }
  if (isDeleting) {
    return `<div class="saved-team-entry is-deleting">
      <div class="saved-team-main saved-team-delete-copy">
        <strong class="saved-team-name">${escapeText(name)}</strong>
        ${meta ? `<span class="saved-team-meta">${escapeText(meta)}</span>` : ''}
        <span class="muted small-copy">Delete this saved team? This will not change your current builder slots.</span>
      </div>
      <div class="saved-team-actions">
        <button class="danger-button" type="button" data-action="confirm-delete-team" data-delete-team-id="${escapeText(id)}">Delete</button>
        <button type="button" data-action="cancel-delete-team">Cancel</button>
      </div>
    </div>`;
  }
  return `<div class="saved-team-entry">
    <div class="saved-team-main">
      <strong class="saved-team-name" title="${escapeText(name)}">${escapeText(name)}</strong>
      ${meta ? `<span class="saved-team-meta">${escapeText(meta)}</span>` : ''}
    </div>
    <div class="saved-team-actions saved-team-row-actions">
      <button class="saved-team-load" type="button" data-load-team-id="${escapeText(id)}">Load</button>
      <button class="saved-team-edit" type="button" data-action="start-rename-team" data-rename-team-id="${escapeText(id)}" aria-label="Rename ${escapeText(name)}">Rename</button>
      <button class="saved-team-delete" type="button" data-action="start-delete-team" data-delete-team-id="${escapeText(id)}" aria-label="Delete ${escapeText(name)}">Delete</button>
    </div>
  </div>`;
}

function formatSavedTeamDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  const timestampMatch = String(value).match(/(\d{1,2}\/\d{1,2}\/\d{4}[^)]*)/);
  return timestampMatch ? timestampMatch[1].trim() : '';
}

function renderStatAudit(audit) {
  if (!audit) return '';
  return `<article class="card compact-card stat-conversion-audit">
    <div class="card-head"><h2>${escapeText(audit.title)}</h2><span class="badge">Audit only</span></div>
    <p class="muted small-copy">${escapeText(audit.summary)}</p>
    <div class="audit-summary-grid">
      <p><strong>Canonical storage:</strong> ${escapeText(audit.canonicalFormat)}</p>
      <p><strong>Base stats:</strong> ${escapeText(audit.baseStatsSource)}</p>
      <p><strong>Formats currently seen:</strong> ${audit.storedFormats.length ? audit.storedFormats.map(escapeText).join(', ') : 'No stat fields found on current team.'}</p>
    </div>
    ${audit.possibleEVMisreads.length ? `<details class="warning-panel" open><summary>Places EVs may be mistaken for final/stat points (${audit.possibleEVMisreads.length})</summary>${audit.possibleEVMisreads.map((warning) => `<p class="warning">${escapeText(warning)}</p>`).join('')}</details>` : '<p class="muted small-copy">No mixed EV/stat-point fields detected on the current team.</p>'}
    <details class="warning-panel"><summary>Data flow findings (${audit.rows.length})</summary>
      <div class="audit-finding-list">${audit.rows.map(renderAuditRow).join('')}</div>
    </details>
  </article>`;
}

function renderAuditRow(row) {
  return `<section class="audit-finding">
    <h3>${escapeText(row.area)}</h3>
    <p class="muted small-copy"><strong>File:</strong> ${escapeText(row.file)}</p>
    <p><strong>Handles:</strong> ${row.handles.map(escapeText).join(', ')}</p>
    <p><strong>Stored format:</strong> ${escapeText(row.storedFormat)}</p>
    <p><strong>Risk:</strong> ${escapeText(row.risk)}</p>
  </section>`;
}

function renderImportResult(result) {
  if (!result) return '';
  return `<div class="import-result">
    <p class="success"><strong>${escapeText(result.summary || 'Import complete')}</strong>${result.filledSlots?.length ? ` — slots filled: ${result.filledSlots.join(', ')}` : ''}</p>
    ${renderWarnings('Import warnings', result.warnings)}
    ${renderWarnings('Unsupported lines ignored', result.ignoredLines)}
  </div>`;
}

function renderWarnings(title, warnings = []) {
  const cleanWarnings = (warnings || []).filter(Boolean);
  if (!cleanWarnings.length) return '';
  return `<details class="warning-panel" open><summary>${escapeText(title)} (${cleanWarnings.length})</summary>${cleanWarnings.map((warning) => `<p class="warning">${escapeText(warning)}</p>`).join('')}</details>`;
}

function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
