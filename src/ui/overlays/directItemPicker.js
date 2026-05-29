import { getRecommendedItemsForPokemon, normaliseItemOption } from '../../core/itemEffectEngine.js';
import { markTeamBuilderDerivedWorkDirty } from '../teamBuilderDerivedState.js';
import {
  armDirectPickerOpenGuard,
  closeDirectItemPicker,
  escapeMovePickerText,
  normalizeMovePickerText,
  rerenderAppShellRoot,
  setDirectPickerOptionVisible,
  shouldIgnoreDirectPickerOptionClick
} from './directPickerShared.js';

function getDirectItemPickerItems(slotIndex, state) {
  const data = state?.data || {};
  const slot = state?.team?.[slotIndex] || null;
  const pokemon = slot?.pokemon_id ? data.indexes?.pokemonById?.[slot.pokemon_id] : null;
  const allItems = (data.collections?.items || [])
    .filter((item) => String(item.is_legal ?? item.legal ?? 'Yes').toLowerCase() !== 'no')
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  let recommended = [];
  if (pokemon) {
    try {
      recommended = getRecommendedItemsForPokemon(pokemon, state.team || [], allItems, { ...data, currentSlotIndex: slotIndex })
        .map((item) => ({ ...item, currentSlotIndex: slotIndex }));
    } catch (error) {
      console.warn('Item recommendations unavailable:', error);
    }
  }
  const recommendedIds = new Set(recommended.map((item) => item.itemId || item.item_id || item.id || item.name));
  const normalized = allItems.map((item) => {
    try { return normaliseItemOption(item, pokemon, state.team || [], slotIndex, data); }
    catch { return item; }
  });
  const combined = [
    ...recommended,
    ...normalized.filter((item) => !recommendedIds.has(item.itemId || item.item_id || item.id || item.name))
  ];
  return { allItems: combined, recommended, recommendedIds };
}

function renderDirectItemCard(item, slotIndex, selectedId, recommendedIds) {
  const id = item.itemId || item.item_id || item.id || item.name || '';
  const name = item.name || id;
  const effect = item.shortEffect || item.effectText || itemPickerEffect(item) || 'No effect text available.';
  const category = item.category || itemPickerCategory(item);
  const duplicate = !!item.isDuplicate;
  const selected = id === selectedId;
  const isMega = !!item.isMegaStone || /mega stone/i.test(`${category} ${effect}`) || /ite$/i.test(name);
  const recommended = recommendedIds.has(id);
  const fit = item.fitReason || '';
  const searchable = normalizeMovePickerText([name, id, category, effect, fit, ...(item.strategicTags || item.strategic_tags || [])].join(' '));
  return `<button type="button" class="direct-move-picker-option direct-item-picker-option ${selected ? 'selected' : ''} ${duplicate ? 'restricted' : ''} ${recommended ? 'recommended' : ''}" data-item-id="${escapeMovePickerText(id)}" data-search="${escapeMovePickerText(searchable)}">
      <span class="direct-move-picker-title">${escapeMovePickerText(name)}</span>
      <span class="direct-item-picker-badges">
        ${selected ? '<span class="badge mini-badge selected-badge">Selected</span>' : ''}
        ${recommended ? '<span class="badge mini-badge recommended-badge">Recommended</span>' : ''}
        ${isMega ? '<span class="badge mini-badge mega-badge">Mega Stone</span>' : ''}
        ${duplicate ? '<span class="badge mini-badge warning-badge">Duplicate</span>' : '<span class="badge mini-badge legal-badge">Legal</span>'}
      </span>
      <span class="direct-move-picker-detail">${escapeMovePickerText(effect)}</span>
      ${fit ? `<span class="direct-item-picker-fit">${escapeMovePickerText(fit)}</span>` : ''}
      <span class="direct-move-picker-meta">${escapeMovePickerText(category)}</span>
    </button>`;
}

function itemPickerEffect(item) {
  return String(item?.effect || item?.effect_text || item?.description || item?.short_effect || item?.shortEffect || item?.desc || '').replace(/\s+/g, ' ').trim();
}

function itemPickerCategory(item) {
  const raw = item?.category || item?.item_category || item?.type || item?.strategic_role || '';
  if (raw) return String(raw);
  if (/mega stone|ite$/i.test(`${item?.name || ''} ${item?.item_id || ''}`)) return 'Mega Stone';
  return 'Item';
}

function renderDirectItemPicker(slotIndex, state, root) {
  closeDirectItemPicker();
  const slot = state?.team?.[slotIndex];
  const selectedId = slot?.item_id || '';
  const { allItems: items, recommended, recommendedIds } = getDirectItemPickerItems(slotIndex, state);

  const overlay = document.createElement('div');
  overlay.id = 'direct-item-picker-overlay';
  overlay.className = 'direct-move-picker-overlay direct-item-picker-overlay';
  overlay.innerHTML = `<div class="direct-move-picker-panel direct-item-picker-panel" role="dialog" aria-modal="true" aria-label="Select Item">
    <div class="direct-move-picker-head"><strong>Select Item <span class="muted">— recommendations + all legal items</span></strong><button type="button" class="tiny-button direct-item-picker-close" aria-label="Close item selector">×</button></div>
    <input class="direct-move-picker-search direct-item-picker-search" type="search" aria-label="Search items" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="direct-item-picker-sections">
      <section class="direct-item-recommendations" ${recommended.length ? '' : 'hidden'}>
        <div class="direct-item-section-title"><strong>Recommended for this Pokémon</strong><span>Top ${Math.min(recommended.length, 8)}</span></div>
        <div class="direct-item-recommended-list">${recommended.slice(0, 8).map((item) => renderDirectItemCard(item, slotIndex, selectedId, recommendedIds)).join('')}</div>
      </section>
      <section class="direct-item-all-section">
        <div class="direct-item-section-title"><strong>All legal items</strong><span>${items.length}</span></div>
        <div class="direct-move-picker-list direct-item-picker-list"></div>
      </section>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('compact-move-picker-open');
  armDirectPickerOpenGuard(root);

  const list = overlay.querySelector('.direct-item-picker-list');
  const sections = overlay.querySelector('.direct-item-picker-sections');
  const search = overlay.querySelector('.direct-item-picker-search');
  const close = () => closeDirectItemPicker();
  overlay.querySelector('.direct-item-picker-close')?.addEventListener('click', close);
  overlay.querySelector('.direct-item-picker-panel')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  if (!slot) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">Choose a Pokémon before picking an item.</p>';
    search.disabled = true;
    return;
  }
  if (!items.length) {
    list.innerHTML = '<p class="muted small-copy dropdown-empty">No legal item data found.</p>';
    return;
  }

  list.innerHTML = items.map((item) => renderDirectItemCard(item, slotIndex, selectedId, recommendedIds)).join('');

  sections.addEventListener('click', (event) => {
    const option = event.target.closest('[data-item-id]');
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();
    if (shouldIgnoreDirectPickerOptionClick(root)) return;
    state.team[slotIndex].item_id = option.dataset.itemId || '';
    closeDirectItemPicker();
    markTeamBuilderDerivedWorkDirty(state);
    rerenderAppShellRoot(root, state);
  });

  search.addEventListener('input', () => {
    const term = normalizeMovePickerText(search.value);
    let visible = 0;
    sections.querySelectorAll('[data-item-id]').forEach((option) => {
      const haystack = normalizeMovePickerText(option.dataset.search || option.textContent || '');
      const match = !term || haystack.includes(term) || term.split(' ').every((token) => haystack.includes(token));
      setDirectPickerOptionVisible(option, match);
      if (match) visible += 1;
    });
    let empty = sections.querySelector('[data-direct-item-empty]');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'muted small-copy dropdown-empty';
        empty.dataset.directItemEmpty = 'true';
        empty.textContent = 'No item matches that search.';
        sections.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  });

  window.requestAnimationFrame(() => {
    try {
      overlay.scrollTop = 0;
      overlay.querySelector('.direct-move-picker-panel, .direct-pokemon-picker-panel, .direct-item-picker-panel')?.scrollIntoView({ block: 'start', inline: 'nearest' });
      search.focus({ preventScroll: true });
    } catch {}
  });
}

export function openDirectItemPicker(slotIndex, state, root) {
  if (!state?.data) return;
  renderDirectItemPicker(slotIndex, state, root);
}
