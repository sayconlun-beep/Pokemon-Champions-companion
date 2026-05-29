const SHARE_TEAM_VERSION = 1;
const EMPTY_TEAM = Array.from({ length: 6 }, () => null);

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function normaliseTeam(team = []) {
  const source = Array.isArray(team) ? team : [];
  return Array.from({ length: 6 }, (_, index) => source[index] ? cloneJson(source[index]) : null);
}

function toBase64Url(text) {
  const bytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(text)
    : Buffer.from(text, 'utf8');
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded) {
  const padded = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(encoded || '').length / 4) * 4, '=');
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  return Buffer.from(bytes).toString('utf8');
}

export function encodeTeamForUrl(team = []) {
  const payload = {
    v: SHARE_TEAM_VERSION,
    format: 'pokemon-champions-team-url',
    team: normaliseTeam(team)
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeTeamFromUrl(encoded) {
  try {
    if (!encoded || typeof encoded !== 'string') {
      return { ok: false, team: normaliseTeam(EMPTY_TEAM), warning: 'No shared team code was provided.' };
    }
    const parsed = JSON.parse(fromBase64Url(encoded));
    const team = Array.isArray(parsed?.team) ? parsed.team : Array.isArray(parsed) ? parsed : null;
    if (!team) {
      return { ok: false, team: normaliseTeam(EMPTY_TEAM), warning: 'That shared team link is not in a recognised format.' };
    }
    return { ok: true, team: normaliseTeam(team), warning: '' };
  } catch (_) {
    return { ok: false, team: normaliseTeam(EMPTY_TEAM), warning: 'That shared team link could not be read. The link may be incomplete or outdated.' };
  }
}

export function buildShareTeamUrl(team = [], currentUrl = '') {
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid';
  const fallbackUrl = typeof window !== 'undefined' ? window.location.href : `${fallbackOrigin}/team-builder`;
  const url = new URL(currentUrl || fallbackUrl, fallbackOrigin);
  url.pathname = '/team-builder';
  url.searchParams.set('team', encodeTeamForUrl(team));
  return url.toString();
}

export function replaceTeamUrlState(team = [], route = 'team-builder') {
  if (typeof window === 'undefined' || route !== 'team-builder') return '';
  const url = new URL(window.location.href);
  url.pathname = '/team-builder';
  url.searchParams.set('team', encodeTeamForUrl(team));
  window.history.replaceState({ routeId: 'team-builder' }, '', `${url.pathname}${url.search}${url.hash}`);
  return url.toString();
}
