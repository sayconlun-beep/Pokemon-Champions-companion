export function bindAppShellEvents(root, state, handlers) {
  const {
    bindMobileMoreDocumentGuards,
    handleDelegatedPointerDown,
    handleDelegatedRouteClick,
    handleMetadexSelectCapture,
    handleDelegatedClick,
    handleDelegatedChange,
    handleDelegatedInput,
    handleDelegatedKeydown,
    handleDelegatedFocusIn,
    handleDelegatedBlur,
    handleDelegatedToggle,
    handleSpriteError,
    handleDropdownPortalPointerDown,
    handleDropdownPortalClick,
    handleDropdownPortalInput
  } = handlers;


  root.__goldStandardState = state;
  bindMobileMoreDocumentGuards(root);
  if (root.__goldStandardDelegatedEventsBound) return;

  // MetaDex tiles are card-like buttons rather than route links. Select them on
  // pointerdown in the capture phase so the detail pane opens even if a nested
  // sprite/card layer, focus handling, or later route delegation swallows the
  // normal click.
  root.addEventListener('pointerdown', (event) => {
    if (handleMetadexSelectCapture?.(root, event)) return;
  }, true);
  root.addEventListener('pointerdown', (event) => handleDelegatedPointerDown(root, event));
  // MetaDex tiles are card-like buttons rather than route links. Handle them in
  // capture before route delegation so a tile click always opens the detail panel,
  // even after layout/CSS changes add nested elements inside the card.
  root.addEventListener('click', (event) => {
    if (handleMetadexSelectCapture?.(root, event)) return;
  }, true);
  // Capture route clicks before page-level controls can swallow them. This keeps the
  // side nav, mobile nav, and guide quick-action buttons in sync even after re-renders.
  root.addEventListener('click', (event) => handleDelegatedRouteClick(root, event), true);
  root.addEventListener('click', (event) => handleDelegatedClick(root, event));
  root.addEventListener('change', (event) => handleDelegatedChange(root, event));
  root.addEventListener('input', (event) => handleDelegatedInput(root, event));
  root.addEventListener('keydown', (event) => handleDelegatedKeydown(root, event));
  root.addEventListener('focusin', (event) => handleDelegatedFocusIn(root, event));
  root.addEventListener('blur', (event) => handleDelegatedBlur(root, event), true);
  root.addEventListener('toggle', (event) => handleDelegatedToggle(root, event), true);
  root.addEventListener('error', (event) => handleSpriteError(event), true);

  if (!root.__dropdownPortalDelegatedEventsBound) {
    document.addEventListener('pointerdown', (event) => handleDropdownPortalPointerDown(root, event), true);
    document.addEventListener('click', (event) => handleDropdownPortalClick(root, event), true);
    document.addEventListener('input', (event) => handleDropdownPortalInput(root, event), true);
    root.__dropdownPortalDelegatedEventsBound = true;
  }

  root.__goldStandardDelegatedEventsBound = true;

}
