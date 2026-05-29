import { getPokemonSprite } from '../../utils/pokemonSprites.js';
import { TypeBadges } from '../../utils/typeBadges.js';
import { CompactStatBars } from '../../utils/compactStats.js';
import { formatTacticalPresenterLabel, formatTacticalPresenterText } from '../../logic/tacticalPresenter.js';
import { scorePokemonGoldCoverage, hasMeaningfulValue } from '../../utils/dataQualityScoring.js';
import { getGroupedPokemonOptions, getPokemonSearchAliases, resolveGroupedPokemonId, getPokemonDisplayName, getPokemonFormLabel } from '../../utils/formGrouping.js';
import { getReadableAbilityName } from '../../utils/displayNames.js';
import { ATTACKING_TYPES, TYPE_EFFECTIVENESS, calculateDefensiveMultiplier, calculateWeaknessCoverageProfile } from '../../core/weaknessCoverageProfile.js';
import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { metadexCache, pokemonCacheKey } from './metadexCache.js';
import { MOVE_PRIORITY_TERMS, QUALITY_LABELS, TACTICAL_IDENTITY_CACHE } from './metadexConstants.js';

export function flattenText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(flattenText).join(' ').toLowerCase();
  if (typeof value === 'object') return Object.values(value).map(flattenText).join(' ').toLowerCase();
  return String(value).toLowerCase();
}

export function tacticalIdentity(pokemon) {
  if (pokemon && typeof pokemon === 'object' && TACTICAL_IDENTITY_CACHE.has(pokemon)) return TACTICAL_IDENTITY_CACHE.get(pokemon);
  const pressure = firstFrom(pokemon.strategicStrengths?.pressureTypes || pokemon.pressureFlow || pokemon.damageProfile?.preferredDamagePattern);
  const state = firstFrom(pokemon.preferredBoardStates || pokemon.strategicStrengths?.preferredBoardStates || pokemon.boardStateProfiles?.preferredBoards);
  const conversion = firstFrom(pokemon.strategicStrengths?.conversionPatterns || pokemon.strategicStrengths?.endgamePatterns || pokemon.damageProfile?.endgamePressure);
  const core = firstFrom(pokemon.strategicStrengths?.coreStrengths || pokemon.notes || pokemon.confidenceReason);
  const identity = {
    identity: identityPhrase(core || pressure || conversion || 'Tactical role not fully documented'),
    primaryPressure: compactPreview(pressure || core || 'Primary pressure route not documented'),
    preferredState: compactPreview(state || 'Preferred current matchup not documented'),
    conversionPattern: compactPreview(conversion || 'Conversion pattern not documented')
  };
  if (pokemon && typeof pokemon === 'object') TACTICAL_IDENTITY_CACHE.set(pokemon, identity);
  return identity;
}

export function identityPhrase(value) {
  const text = compactPreview(value).replace(/\.$/, '');
  if (!text) return 'Tactical role not fully documented';
  return text.length > 74 ? `${text.slice(0, 71).trim()}…` : text;
}

export function shortNoun(value) {
  return String(value || '').replace(/^(creates|create|establishes|establish|provides|provide|forces|force|uses|use|enables|enable)\s+/i, '').slice(0, 78).trim();
}

export function spriteImage(sprite, pokemon, className) {
  return `<img class="pokemon-sprite ${className}" src="${escapeAttr(sprite.src)}" alt="${escapeAttr(sprite.alt)}" loading="${escapeAttr(sprite.loading)}" decoding="async" fetchpriority="low" width="64" height="64" data-pokemon-sprite data-pokemon-id="${escapeAttr(pokemon.ndex || pokemon.pokemon_id || '')}" data-sprite-stage="home" />`;
}

export function section(title, content, options = {}) {
  const displayTitle = formatTacticalPresenterLabel(title, title);
  const lines = prepareSectionLines(content, options);
  const primary = lines.slice(0, options.primary || 4);
  const additional = lines.slice(primary.length, options.max || 5);

  if (!primary.length) return '';

  return `<article class="mini-card metadex-info-card"><h3>${escapeText(displayTitle)}</h3><ul class="metadex-signal-list">${primary.map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>${additional.length ? `<details class="metadex-additional-notes"><summary>Additional tactical notes</summary><ul>${additional.map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul></details>` : ''}</article>`;
}

export function prepareSectionLines(content, options = {}) {
  const seen = options.dedupe || new Set();
  const max = Math.max(options.max || 5, options.primary || 4);
  const raw = flattenContent(content).map(cleanTacticalLine).filter(Boolean);
  const ranked = raw.sort((a, b) => signalScore(b) - signalScore(a));
  const local = [];
  for (const line of ranked) {
    const key = semanticKey(line);
    if (!key || seen.has(key) || local.some((entry) => semanticKey(entry) === key)) continue;
    seen.add(key);
    local.push(line);
    if (local.length >= max) break;
  }
  return local;
}

export function cleanTacticalLine(value) {
  let text = formatTacticalPresenterText(value, { ensureSentence: true });
  text = compressTacticalPhrase(text);
  if (isUnclearGeneratedLine(text)) return '';
  return text;
}

export function isUnclearGeneratedLine(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/limited tactical data available|not documented|applicable true|applicable false/i.test(text)) return true;
  if (/no tactical note recorded yet|no benchmark analysis recorded yet|no advanced item interactions documented/i.test(text)) return true;
  if (/conversion pattern|protected positioning|pressure window|resource endgame|forced defensive targeting|tactical threat|opponent constraints|preferred board state|recovery route/i.test(text)) return true;
  if (/\b[A-Za-z]+(?:Active|Pressure|Positioning|Dependency|Route|Window):/i.test(text)) return true;
  if (/\b(converts|establishes|forces board progress)\b/i.test(text) && !/fake out|tailwind|trick room|protect|recover|roost|attack|damage/i.test(text)) return true;
  if (text.split(/\s+/).length < 4 && /pressure|position|tempo|resource|conversion/i.test(text)) return true;
  return false;
}

export function compressTacticalPhrase(value) {
  return String(value || '')
    .replace(/spread damage escalation/gi, 'spread escalation')
    .replace(/forcing switches on entry/gi, 'entry positioning')
    .replace(/pressure sequencing/gi, 'momentum sequencing')
    .replace(/priority pressure/gi, 'priority cleanup pressure')
    .replace(/neutral positioning with partner protection/gi, 'protected positioning')
    .replace(/\bpressure pressure\b/gi, 'pressure')
    .replace(/\bpositioning positioning\b/gi, 'positioning')
    .replace(/\s+/g, ' ')
    .trim();
}

export function legalOptions(title, rows, limit, overflowTemplate = '+{count} more in the database') {
  const uniqueRows = dedupeLines(rows.map((row) => compactChip(row)).filter(Boolean));
  const visible = uniqueRows.slice(0, limit);
  const overflow = uniqueRows.length - visible.length;

  if (!visible.length) return '';

  return `<article class="mini-card metadex-info-card metadex-legal-card"><h3>${escapeText(title)}</h3><div class="metadex-chip-row">${visible.map((row) => `<span class="score-pill">${escapeText(row)}</span>`).join('')}</div>${overflow > 0 ? `<details class="metadex-additional-notes"><summary>${escapeText(overflowTemplate.replace('{count}', overflow))}</summary><div class="metadex-chip-row metadex-chip-row-muted">${uniqueRows.slice(limit).map((row) => `<span class="score-pill">${escapeText(row)}</span>`).join('')}</div></details>` : ''}</article>`;
}

export function legalMoves(pokemon, state) {
  const cache = metadexCache(state).legalMoves;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const moves = (state.data.indexes.movesByPokemon[pokemon.pokemon_id] || [])
    .filter((row) => yesNo(row.is_legal) !== 'no')
    .map((row) => row.move_name || state.data.indexes.movesById[row.move_id]?.name || row.move_id)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  cache.set(key, moves);
  return moves;
}

export function prioritizeLegalMoves(moves, pokemon) {
  const types = [pokemon.type1, pokemon.type2].map(normalize).filter(Boolean);
  return moves.map((name) => ({ name, score: moveRelevanceScore(name, types) }))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
}

export function moveRelevanceScore(name, types) {
  const lower = normalize(name);
  let score = 0;
  MOVE_PRIORITY_TERMS.forEach((term, index) => { if (lower.includes(term)) score += 120 - index; });
  if (types.some((type) => lower.includes(type))) score += 20;
  if (/beam|blast|punch|kick|storm|crash|edge|quake|gleam|wave|pulse|slam|blade|bomb|ball/i.test(name)) score += 6;
  return score;
}

export function legalAbilities(pokemon, state) {
  const cache = metadexCache(state).legalAbilities;
  const key = pokemonCacheKey(pokemon);
  if (cache.has(key)) return cache.get(key);
  const abilities = (state.data.indexes.abilitiesByPokemon[pokemon.pokemon_id] || [])
    .filter((row) => yesNo(row.is_legal) !== 'no')
    .map((row) => getReadableAbilityName(state.data.indexes.abilitiesById[row.ability_id] || row, 'Unknown Ability'))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  cache.set(key, abilities);
  return abilities;
}

export function itemCompatibility(pokemon) {
  const items = new Set();
  for (const build of listFrom(pokemon.commonBuilds)) {
    for (const item of listFrom(build?.itemOptions)) items.add(item);
  }
  return Array.from(items).sort((a, b) => String(a).localeCompare(String(b)));
}

export function pressureWindowLines(windows = {}) {
  return [
    ...listFrom(windows.earlyGamePressure).map((item) => `Early: ${item}`),
    ...listFrom(windows.midGamePressure).map((item) => `Mid: ${item}`),
    ...listFrom(windows.lateGamePressure).map((item) => `Late: ${item}`),
    ...listFrom(windows.peakThreatTiming).map((item) => `Peak: ${item}`),
    ...listFrom(windows.decliningValueConditions).map((item) => `Declines when: ${item}`)
  ];
}

export function flattenContent(content) {
  if (!content) return [];
  if (Array.isArray(content)) return content.flatMap(flattenContent).filter(Boolean);
  if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') return [String(content)];
  if (typeof content === 'object') {
    if (Array.isArray(content.items)) return flattenContent(content.items);
    return Object.entries(content).flatMap(([key, value]) => {
      if (key === 'confidenceStatus' || key === 'confidenceReason') return [];
      return flattenContent(value).map((line) => `${labelFromKey(key)}: ${line}`);
    });
  }
  return [];
}

export function firstFrom(value) {
  return flattenContent(value).map(cleanTacticalLine).filter(Boolean)[0] || '';
}

export function signalScore(value) {
  const text = String(value || '').toLowerCase();
  let score = Math.min(60, text.length / 3);
  if (/convert|endgame|win|cleanup|position|tempo|speed|recover|pivot|support|risk|collapse|trade|disrupt|fake out|tailwind|trick room/.test(text)) score += 35;
  if (/generic|available|limited|unknown|not documented|thin evidence/.test(text)) score -= 80;
  if (text.length < 28) score -= 20;
  return score;
}

export function semanticKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(pressure|positioning|tactical|strategic|reliable|strong|primary|secondary|creates|enables|supports|through|with|and|the|a|an)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

export function dedupeLines(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = semanticKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function compactPreview(value) {
  const text = compressTacticalPhrase(formatTacticalPresenterText(value, { ensureSentence: true }))
    .replace(/^Core strengths:\s*/i, '')
    .replace(/^Pressure types:\s*/i, '')
    .replace(/^win patterns:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (isUnclearGeneratedLine(text)) return '';
  return text.length > 118 ? `${text.slice(0, 115).trim()}…` : text;
}

export function compactChip(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function qualityTier(completeFields) {
  if (completeFields >= 8) return { key: 'gold', label: QUALITY_LABELS.gold };
  if (completeFields >= 5) return { key: 'strong', label: QUALITY_LABELS.strong };
  if (completeFields >= 3) return { key: 'needs', label: QUALITY_LABELS.needs };
  return { key: 'incomplete', label: QUALITY_LABELS.incomplete };
}

export function isEliteEntry(pokemon, coverage) {
  return coverage.completeFields >= 8
    && hasMeaningfulValue(pokemon.strategicStrengths?.conversionPatterns)
    && (flattenContent(pokemon.interactionProfiles).length >= 2 || flattenContent(pokemon.strategicTriggers).length >= 2);
}

export function listFrom(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function selectOptions(options, selected) {
  return options.map(([value, label]) => option(value, label, selected)).join('');
}

export function teamNeedOptions(selected) {
  return selectOptions([
    ['all','All needs'],['main','Main Pokémon'],['partner','Core Partner'],['damage','Damage Pressure'],['defensive','Defensive Switch-in'],['speed','Speed Control'],['disruption','Fake Out / Disruption'],['redirection','Redirection / Protection'],['weather','Weather Support'],['screens','Screens / Aurora Veil'],['setup','Setup Support'],['pivot','Pivot / Positioning'],['cleaner','Late-game Cleaner'],['weakness','Weakness Answer'],['secondary','Secondary Mode'],['glue','Utility Glue']
  ], selected);
}

export function guideStepOptions(selected) {
  return selectOptions([
    ['any','Any guide step'],['step2','Step 2: Have an idea'],['step3','Step 3: The Core'],['step4','Step 4: Fill out the Core'],['step5','Step 5: Consider Weaknesses and Expand'],['step6','Step 6: Find the Details'],['step7','Step 7: Playtest and Adjust']
  ], selected);
}

export function teamFitOptions(selected) {
  return selectOptions([
    ['any','Any fit'],['good','Fits current team well'],['weakness','Covers current weakness'],['role','Adds missing role'],['speed','Adds speed control'],['backbone','Adds defensive backbone'],['pressure','Adds offensive pressure'],['utility','Adds support utility'],['worsen','May worsen current weakness']
  ], selected);
}

export function archetypeFitOptions(selected) {
  return selectOptions([
    ['any','Any archetype'],['balanced','Balanced Offense'],['hyper','Hyper Offense'],['bulkyoffense','Bulky Offense'],['balance','Balance'],['trickroom','Trick Room'],['tailwind','Tailwind Offense'],['weather','Weather'],['setup','Setup Offense'],['snow','Snow'],['rain','Rain'],['sun','Sun'],['sand','Sand'],['momentum','Momentum Balance']
  ], selected);
}

export function roleConfidenceOptions(selected) {
  return selectOptions([
    ['primary-only','Primary role only'],['strong-secondary','Primary + strong secondary roles'],['flexible','Include flexible/tech roles'],['hide-low','Hide low-confidence role matches']
  ], selected);
}

export function sortOptions(selected) {
  return selectOptions([
    ['team-fit','Best team fit'],['guide-step','Best guide-step fit'],['role-confidence','Highest role confidence'],['offense','Strongest offensive pressure'],['defensive','Best defensive fit'],['speed-control','Best speed control fit'],['weakness-answer','Best weakness answer'],['alphabetical','Alphabetical']
  ], selected);
}

export function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeText(label)}</option>`;
}

export function emptyState() {
  return '<article class="mini-card"><h3>No Pokémon found</h3><p class="muted">Adjust the search or filters to show more entries.</p></article>';
}

export function availabilityText(pokemon) {
  if (yesNo(pokemon.champions_legal) === 'yes') return 'Champions legal';
  if (pokemon.requiresOfficialReview) return 'Needs review';
  return 'Availability unclear';
}

export function labelFromKey(key) {
  return String(key || '').replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

export function yesNo(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'legal', 'champions legal'].includes(normalized)) return 'yes';
  if (['false', '0', 'illegal', 'not legal'].includes(normalized)) return 'no';
  return normalized;
}

export function normalize(value) { return String(value || '').trim().toLowerCase(); }

export function num(value) { return Number.isFinite(Number(value)) ? Number(value) : '—'; }

export function escapeText(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

export function escapeAttr(value) { return escapeText(value); }
