export function isDeveloperMode(state = {}) {
  if (state?.settings?.developerMode === true || state?.debugMode === true || state?.importExport?.showDeveloperAudit === true) {
    return true;
  }

  try {
    return window.localStorage.getItem('championsDeveloperMode') === 'true';
  } catch (_) {
    return false;
  }
}
