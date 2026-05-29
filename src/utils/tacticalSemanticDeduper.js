const FALLBACK_TEXT = 'Limited tactical data available.';

const CONCEPT_GROUPS = [
  {
    key: 'pressure-flow',
    patterns: [
      /pressure\s+sequencing/i,
      /offensive\s+momentum/i,
      /pressure\s+flow/i,
      /maintains?\s+pressure\s+sequencing/i,
      /maintains?\s+momentum/i
    ]
  },
  {
    key: 'positioning-control',
    patterns: [
      /positioning\s+control/i,
      /board[-\s]?state\s+control/i,
      /tempo\s+positioning/i,
      /controls?\s+board\s+positioning/i,
      /establishes?\s+early\s+control/i,
      /creates?\s+positioning\s+control/i,
      /early\s+positioning/i
    ]
  },
  {
    key: 'recovery-stability',
    patterns: [
      /sustain\s+routing/i,
      /recovery\s+sequencing/i,
      /recovery\s+stability/i,
      /rebuilds?\s+after\s+pressure/i,
      /sustain\s+loops?/i
    ]
  }
];

const CANONICAL_PHRASES = [
  [/\bestablishes\s+early\s+control\b/gi, 'establishes early safe positioning'],
  [/\bcreates\s+positioning\s+control\b/gi, 'establishes early safe positioning'],
  [/\bcontrols\s+board\s+positioning\b/gi, 'establishes early safe positioning'],
  [/\bmaintains\s+pressure\s+sequencing\b/gi, 'maintains offensive momentum'],
  [/\bcreates\s+pressure\s+flow\b/gi, 'maintains offensive momentum'],
  [/\bsustain\s+routing\b/gi, 'recovery stability'],
  [/\brecovery\s+sequencing\b/gi, 'recovery stability']
];

export function normalizeSemanticTacticalText(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  for (const [pattern, replacement] of CANONICAL_PHRASES) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim();
}

export function dedupeTacticalLines(values = [], options = {}) {
  const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : Infinity;
  const candidates = (values || [])
    .map((value, index) => ({ index, text: normalizeSemanticTacticalText(value) }))
    .filter((entry) => entry.text && entry.text !== FALLBACK_TEXT);

  const bestByKey = new Map();
  for (const entry of candidates) {
    const key = semanticMeaningKey(entry.text);
    const current = bestByKey.get(key);
    if (!current || compareLineStrength(entry.text, current.text) < 0) bestByKey.set(key, entry);
  }

  return [...bestByKey.values()]
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.text)
    .slice(0, maxItems);
}

export function semanticMeaningKey(value) {
  const text = normalizeSemanticTacticalText(value).toLowerCase();
  const subject = extractSubject(text);
  const concepts = CONCEPT_GROUPS.filter((group) => group.patterns.some((pattern) => pattern.test(text))).map((group) => group.key);
  if (concepts.length) return `${subject || 'team'}::${concepts.sort().join('+')}`;
  return `${subject || 'team'}::${text
    .replace(/\b(the|a|an|this|team|currently|strong|strongest|reliable|reliably|major|key|primary|current)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ')}`;
}

function extractSubject(text) {
  const cleaned = String(text || '').trim();
  const possessive = cleaned.match(/^([a-z0-9' -]{2,30})\s+(?:establishes|creates|maintains|controls|provides|forces|pressures|converts|stabilizes|builds|rebuilds)\b/i);
  if (possessive) return possessive[1].trim().replace(/[^a-z0-9]+/gi, '-');
  const lead = cleaned.split(/\s+/).slice(0, 2).join(' ');
  return lead.replace(/[^a-z0-9]+/gi, '-');
}

function compareLineStrength(a, b) {
  const scoreA = lineScore(a);
  const scoreB = lineScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  if (a.length !== b.length) return a.length - b.length;
  return 0;
}

function lineScore(value) {
  const text = String(value || '').toLowerCase();
  let score = 0;
  if (/safe positioning|offensive momentum|recovery stability/.test(text)) score += 4;
  if (/establishes|maintains|stabilizes|converts|pressures/.test(text)) score += 2;
  if (/limited tactical data|missing|undefined|null/.test(text)) score -= 10;
  if (text.length <= 90) score += 1;
  return score;
}
