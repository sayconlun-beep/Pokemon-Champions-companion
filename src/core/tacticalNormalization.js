const TOKEN_TRANSLATIONS = new Map([
  ['positioningLost', 'Losing safe switches after disruption'],
  ['forcedSacrifice', 'Being forced to sacrifice a teammate'],
  ['trigger', 'disruption'],
  ['cascade', 'game plan becomes harder to use'],
  ['supportDependencyExposed', 'Support becomes easier to punish'],
  ['reducedPressureOutput', 'Reduced damage output']
]);

const PHRASE_TRANSLATIONS = [
  [/positioning-loss collapse positioning-loss collapse cascade/gi, 'Losing safe switches after disruption'],
  [/positioning-loss collapse cascade/gi, 'Losing safe switches after disruption'],
  [/threat collapse cascade/gi, 'The main attacker becomes easier to stop'],
  [/disruption trigger windows/gi, 'disruption'],
  [/disruption trigger window/gi, 'disruption'],
  [/Collapse cue/gi, 'risk point'],
  [/speed State/gi, 'speed-control sequencing'],
  [/\bpositioningLost\b/g, 'Losing safe switches after disruption'],
  [/\bforcedSacrifice\b/g, 'Being forced to sacrifice a teammate'],
  [/\bsupportDependencyExposed\b/g, 'Support becomes easier to punish'],
  [/\breducedPressureOutput\b/g, 'Reduced damage output'],
  [/\bcascade\b(?! chain)/gi, 'game plan becomes harder to use'],
  [/\btrigger\b(?! window)/gi, 'disruption']
];

function suppressRawTokenLeaks(value) {
  let text = String(value || '');
  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) text = text.replace(pattern, replacement);
  return text;
}


const FINAL_GRAMMAR_REPLACEMENTS = [
  [/\bcontinues threat through pressure sequencing\b/gi, 'helps the team handle aggressive play'],
  [/\bcreates Win Opportunities through\b/g, 'creates safe attacking chances with'],
  [/\bcreates win opportunities through\b/gi, 'creates safe attacking chances with']
];

export function normalizeFinalGrammar(value) {
  let text = String(value || '');
  for (const [pattern, replacement] of FINAL_GRAMMAR_REPLACEMENTS) text = text.replace(pattern, replacement);
  return text;
}

const OVERUSED_REPLACEMENTS = [
  [/\btempo\b/gi, 'momentum'],
  [/\bstabilizes\b/gi, 'helps'],
  [/\bstabilize\b/gi, 'help'],
  [/\bpositioning\b/gi, 'safe switching'],
  [/\bturning pressure into damage\b/gi, 'creating safe attacks'],
  [/\bpressure\b/gi, 'attacking threat'],
  [/\bconversion\b/gi, 'finishing power'],
  [/\bsequencing\b/gi, 'turn planning']
];

export function normalizeTacticalText(value, options = {}) {
  let text = String(value || '');
  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) text = text.replace(pattern, replacement);
  text = text.replace(/\b[a-z]+[A-Z][A-Za-z]*\b/g, (token) => TOKEN_TRANSLATIONS.get(token) || splitCamelToken(token));
  if (options.diversify !== false) {
    for (const [pattern, replacement] of OVERUSED_REPLACEMENTS) text = text.replace(pattern, replacement);
  }
  text = suppressRawTokenLeaks(text);
  return normalizeFinalGrammar(dedupeMalformedPhrases(text))
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCollapseRisk(value) {
  const text = normalizeTacticalText(value).replace(/^Collapse cue:\s*/i, '').trim();
  const lower = text.toLowerCase();
  if (lower.includes('recovery') && lower.includes('taunt')) return 'Recovery turns become unsafe under taunt pressure.';
  if (lower.includes('speed') && (lower.includes('control') || lower.includes('sequencing'))) return 'Losing speed control makes it harder to finish the game.';
  if (lower.includes('forced') || lower.includes('sacrifice') || lower.includes('pivot')) return 'Forced switches make it harder to keep attacking safely.';
  if (lower.includes('support') && lower.includes('dependency')) return 'Support Pokémon become easier to punish if they are used too early.';
  if (lower.includes('reduced') && lower.includes('conversion')) return 'The team loses damage if its first safe attacking chance fails.';
  return ensureSentence(text || 'Defensive turns become easier for the opponent to punish.');
}

export function ensureSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function splitCamelToken(token) {
  return token.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}

function dedupeMalformedPhrases(value) {
  let text = String(value || '');
  text = text.replace(/\b(\w+(?:[- ]\w+){0,3})\s+\1\b/gi, '$1');
  text = text.replace(/\b(Pressure collapse cascade|game plan becomes harder to use|The main attacker becomes easier to stop)(?:\s+\1)+\b/gi, '$1');
  text = text.replace(/\b(losing safe switch opportunities after disruption|Losing safe switches after disruption)(?:\s+\1)+\b/gi, '$1');
  return text;
}
