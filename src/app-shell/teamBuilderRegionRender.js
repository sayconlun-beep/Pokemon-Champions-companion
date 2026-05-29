import {
  renderTeamBuilderDesktopStatusRegion,
  renderTeamBuilderMobileStatusRegion,
  renderTeamBuilderSlotsRegion,
  renderTeamBuilderSnapshotRegion,
  renderTeamBuilderStrategicFiltersRegion
} from '../pages/TeamBuilderPage.js';

const objectIds = new WeakMap();
let nextObjectId = 1;

export function renderTeamBuilderDynamicRegions(root, state) {
  if (!root || state?.route !== 'team-builder') return false;
  const page = root.querySelector('[data-team-builder-page], .team-builder-page');
  const slotsRegion = page?.querySelector('[data-team-builder-slots-region]');
  if (!page || !slotsRegion) return false;

  const nextSlotsRegion = htmlToElement(renderTeamBuilderSlotsRegion(state));
  if (!nextSlotsRegion) return false;

  renderTeamBuilderSlotsTargeted(slotsRegion, nextSlotsRegion);
  updateOptionalRegion(page, '[data-team-builder-mobile-status-region]', renderTeamBuilderMobileStatusRegion(state));
  updateOptionalRegion(page, '[data-team-builder-desktop-status-region]', renderTeamBuilderDesktopStatusRegion(state));
  updateOptionalRegion(page, '[data-team-builder-snapshot-region]', renderTeamBuilderSnapshotRegion(state));
  updateOptionalRegion(page, '[data-team-builder-filters-region]', renderTeamBuilderStrategicFiltersRegion(state));
  return true;
}

function renderTeamBuilderSlotsTargeted(currentRegion, nextRegion) {
  const currentHead = currentRegion.querySelector('.team-slots-head');
  const nextHead = nextRegion.querySelector('.team-slots-head');
  if (currentHead && nextHead) currentHead.replaceWith(nextHead);

  const currentColumn = currentRegion.querySelector('.slot-column');
  const nextColumn = nextRegion.querySelector('.slot-column');
  if (!currentColumn || !nextColumn) {
    currentRegion.innerHTML = nextRegion.innerHTML;
    return;
  }

  const activeElement = currentRegion.ownerDocument?.activeElement;
  const activeSlot = shouldPreserveFocusedSlot(activeElement, currentRegion)
    ? activeElement.closest('[data-slot-card]')
    : null;
  const activeSlotIndex = activeSlot?.getAttribute('data-slot-card') ?? '';
  const seen = new Set();

  nextColumn.querySelectorAll('[data-slot-card]').forEach((nextSlot) => {
    const index = nextSlot.getAttribute('data-slot-card') ?? '';
    seen.add(index);
    const currentSlot = currentColumn.querySelector(`[data-slot-card="${escapeCss(index)}"]`);
    if (!currentSlot) {
      currentColumn.appendChild(nextSlot);
      return;
    }

    // Keep the active editor island mounted instead of replacing it and then
    // reconstructing focus/caret after the fact. Button-only interactions still
    // replace the slot normally so collapse/expand/clear actions update at once.
    if (index === activeSlotIndex && currentSlot.contains(activeElement)) {
      patchFocusedSlotNonDestructively(currentSlot, nextSlot, activeElement);
      return;
    }

    currentSlot.replaceWith(nextSlot);
  });

  currentColumn.querySelectorAll('[data-slot-card]').forEach((currentSlot) => {
    const index = currentSlot.getAttribute('data-slot-card') ?? '';
    if (!seen.has(index)) currentSlot.remove();
  });
}

function patchFocusedSlotNonDestructively(currentSlot, nextSlot, activeElement) {
  patchActiveStatControl(currentSlot, nextSlot, activeElement);
  patchActiveNativeSelect(currentSlot, nextSlot, activeElement);
}

function patchActiveStatControl(currentSlot, nextSlot, activeElement) {
  if (!(activeElement instanceof HTMLInputElement)) return;
  if (!activeElement.matches('[data-stat-slot][data-stat-key]')) return;
  const slot = activeElement.dataset.statSlot || '';
  const key = activeElement.dataset.statKey || '';
  if (!slot || !key) return;
  const selector = `[data-stat-slot="${escapeCss(slot)}"][data-stat-key="${escapeCss(key)}"]`;
  currentSlot.querySelectorAll(selector).forEach((currentControl) => {
    const nextControl = nextSlot.querySelector(`${selector}.${Array.from(currentControl.classList).map(escapeCss).join('.')}`) || nextSlot.querySelector(selector);
    if (nextControl instanceof HTMLInputElement && currentControl instanceof HTMLInputElement && currentControl !== activeElement) {
      currentControl.value = nextControl.value;
      currentControl.setAttribute('value', nextControl.getAttribute('value') || nextControl.value || '');
      currentControl.max = nextControl.max;
      currentControl.disabled = nextControl.disabled;
    }
  });
}

function patchActiveNativeSelect(currentSlot, nextSlot, activeElement) {
  if (!(activeElement instanceof HTMLSelectElement)) return;
  const selector = selectorForNativeSelect(activeElement);
  if (!selector) return;
  const nextSelect = nextSlot.querySelector(selector);
  if (!(nextSelect instanceof HTMLSelectElement)) return;
  Array.from(activeElement.options).forEach((option) => { option.selected = option.value === activeElement.value; });
  activeElement.disabled = nextSelect.disabled;
}

function selectorForNativeSelect(element) {
  const attributes = ['data-nature-slot', 'data-stat-preset-select-slot'];
  const attr = attributes.find((name) => element.hasAttribute(name));
  if (!attr) return '';
  return `[${attr}="${escapeCss(element.getAttribute(attr) || '')}"]`;
}

function shouldPreserveFocusedSlot(activeElement, currentRegion) {
  if (!(activeElement instanceof Element) || !currentRegion.contains(activeElement)) return false;
  if (!activeElement.closest('[data-slot-card]')) return false;
  return activeElement.matches('input, textarea, select, [contenteditable="true"]');
}

function htmlToElement(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = String(html || '').trim();
  return wrapper;
}

function updateOptionalRegion(page, selector, html) {
  const region = page.querySelector(selector);
  if (region) region.innerHTML = html;
}

function escapeCss(value) {
  const raw = String(value ?? '');
  if (globalThis.CSS?.escape) return CSS.escape(raw);
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function teamBuilderSignature(state) {
  const team = Array.isArray(state?.team) ? state.team : [];
  const slotUiState = Array.isArray(state?.slotUiState) ? state.slotUiState : [];
  return [
    objectIdentity(team),
    team.slice(0, 6).map((slot, index) => slotSignature(slot, slotUiState[index])).join('||'),
    (state?.builderFocus || []).join(','),
    state?.suggestedPartnersExpanded ? 'suggested-open' : '',
    state?.activeSavedTeamId || ''
  ].join('::');
}

function slotSignature(slot = null, uiState = {}) {
  if (!slot || !slot.pokemon_id) {
    return ['empty', objectIdentity(slot), uiSignature(uiState)].join('|');
  }
  const moves = Array.isArray(slot.moves)
    ? slot.moves
    : [slot.move1, slot.move2, slot.move3, slot.move4];
  const stats = slot.statAllocation || slot.stats || slot.spread || slot.evs || slot.EVs || slot.skillPoints || slot.sp || {};
  const statSignature = Object.keys(stats)
    .sort()
    .map((key) => `${key}:${stats[key] ?? ''}`)
    .join(',');
  return [
    objectIdentity(slot),
    slot.pokemon_id || '',
    slot.ability_id || '',
    slot.item_id || '',
    slot.nature || '',
    moves.map((move) => move || '').join(','),
    statSignature,
    slot.isCoreAnchor ? 'core' : '',
    uiSignature(uiState)
  ].join('|');
}

function uiSignature(uiState = {}) {
  return [
    uiState?.collapsed ? 'collapsed' : 'expanded',
    uiState?.strategicRoleOpen ? 'role-open' : 'role-closed'
  ].join(',');
}

function objectIdentity(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return '';
  if (!objectIds.has(value)) objectIds.set(value, nextObjectId++);
  return objectIds.get(value);
}
