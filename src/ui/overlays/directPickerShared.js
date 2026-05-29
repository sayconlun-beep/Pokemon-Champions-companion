export function escapeMovePickerText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function normalizeMovePickerText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function setDirectPickerOptionVisible(option, visible) {
  option.hidden = !visible;
  option.toggleAttribute('aria-hidden', !visible);
  // Some of the picker cards have explicit display:grid/flex rules later in the
  // stylesheet. Setting inline display as well makes filtering reliable on both
  // desktop and real mobile browsers, even if cached/legacy CSS is still loaded.
  option.style.display = visible ? '' : 'none';
}

export function closeDirectMovePicker() {
  document.getElementById('direct-move-picker-overlay')?.remove();
  if (!document.getElementById('direct-item-picker-overlay') && !document.getElementById('direct-pokemon-picker-overlay')) {
    document.body.classList.remove('compact-move-picker-open');
  }
}

export function closeDirectItemPicker() {
  document.getElementById('direct-item-picker-overlay')?.remove();
  if (!document.getElementById('direct-move-picker-overlay') && !document.getElementById('direct-pokemon-picker-overlay')) {
    document.body.classList.remove('compact-move-picker-open');
  }
}

export function closeAllDirectPickers() {
  document.getElementById('direct-move-picker-overlay')?.remove();
  document.getElementById('direct-item-picker-overlay')?.remove();
  document.getElementById('direct-pokemon-picker-overlay')?.remove();
  document.body.classList.remove('compact-move-picker-open');
}

export function armDirectPickerOpenGuard(root, duration = 550) {
  if (!root) return;
  root.__ignoreDirectPickerOptionClickUntil = Date.now() + duration;
}

export function shouldIgnoreDirectPickerOptionClick(root) {
  const until = Number(root?.__ignoreDirectPickerOptionClickUntil || 0);
  if (until && Date.now() < until) return true;
  if (root) root.__ignoreDirectPickerOptionClickUntil = 0;
  return false;
}

export function rerenderAppShellRoot(root, state) {
  root?.__appShellRender?.(root, state);
}
