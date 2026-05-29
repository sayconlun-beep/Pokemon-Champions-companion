import { dedupeTacticalLines, normalizeSemanticTacticalText, semanticMeaningKey } from './tacticalSemanticDeduper.js';

const FALLBACK_TEXT = 'Limited tactical data available.';

const RAW_LEAK_PATTERNS = [
  /strategicStrengths\./i,
  /\brecoveryRoutes\b/i,
  /\bsafe switchingCollapse\b/i,
  /\bpressureFlowState\b/i,
  /\bundefined\b/i,
  /\bnull\b/i
];


const LABEL_REPLACEMENTS = [
  [/\bCOMPETITIVE[-\s]+SEQUENCING[-\s]+PATTERNS\b/gi, 'offensive pressure'],
  [/\bCompetitive\s+turn planning\s+patterns\b/gi, 'offensive pressure'],
  [/\bPOSITIONING[-\s]+TRANSITIONS\b/gi, 'safe safe switching'],
  [/\bSafe Switching\s+transitions\b/gi, 'safe safe switching'],
  [/\bRECOVERY[-\s]+SEQUENCING\b/gi, 'Recovery Stability'],
  [/\bRecovery\s+turn planning\b/gi, 'Recovery Stability'],
  [/\bRECOVERY[-\s]+ROUTES\b/gi, 'Recovery Stability'],
  [/\bRecovery\s+routes\b/gi, 'Recovery Stability'],
  [/\bSPEED[-\s]+CONTROL[-\s]+SEQUENCING\b/gi, 'Speed Control'],
  [/\bSpeed[-\s]+control\s+turn planning\b/gi, 'Speed Control'],
  [/\bENDGAME[-\s]+ROUTING\b/gi, 'Endgame Plan'],
  [/\bEndgame\s+routing\b/gi, 'Endgame Plan'],
  [/\bENDGAME[-\s]+ROUTES\b/gi, 'Endgame Plan'],
  [/\bEndgame\s+routes\b/gi, 'Endgame Plan'],
  [/\bPRESSURE[-\s]+FLOW\b/gi, 'Offensive Momentum'],
  [/\bPressure\s+flow\b/gi, 'Offensive Momentum'],
  [/\bINTERACTION[-\s]+CHAINS\b/gi, 'Team Coordination'],
  [/\bInteraction\s+chains\b/gi, 'Team Coordination'],
  [/\bFAILURE[-\s]+PRESSURE[-\s]+CHAINS\b/gi, 'bad positions'],
  [/\bFailure\s+pressure\s+chains\b/gi, 'bad positions'],
  [/\bCONVERSION[-\s]+WINDOWS\b/gi, 'Win Opportunities'],
  [/\bConversion\s+windows\b/gi, 'Win Opportunities']
];


const FINAL_RAW_TOKEN_REPLACEMENTS = [
  [/threat collapse cascade/gi, 'Threat-chain collapse'],
  [/\bsafe switchingLost\b/g, 'Safe Switching loss after disruption'],
  [/\bforcedSacrifice\b/g, 'Forced-sacrifice instability'],
  [/\bsupportDependencyExposed\b/g, 'Support dependency exposed'],
  [/\breducedPressureOutput\b/g, 'Reduced offensive output'],
  [/\bcascade\b(?! chain)/gi, 'gameplan collapse'],
  [/\btrigger\b(?! window)/gi, 'Disruption trigger window']
];

export function suppressRawTokenLeaks(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of FINAL_RAW_TOKEN_REPLACEMENTS) text = text.replace(pattern, replacement);
  return text;
}

const MISSING_DATA_FIELD_LABELS = [
  [/strategic\s*Strengths\.\s*Recovery\s*Stability/gi, 'Recovery Stability'],
  [/strategicStrengths\.\s*recoveryRoutes/gi, 'Recovery Stability'],
  [/strategicStrengths\.\s*sustainLoops/gi, 'Recovery Stability'],
  [/strategicStrengths\.\s*coreStrengths/gi, 'Core Strengths'],
  [/strategicStrengths\.\s*pressureTypes/gi, 'offensive pressure'],
  [/strategicStrengths\.\s*opponentConstraints/gi, 'safe safe switching'],
  [/strategicStrengths\.\s*conversionPatterns/gi, 'Win Opportunities'],
  [/strategicStrengths\.\s*failureConditions/gi, 'bad positions'],
  [/strategicStrengths\.\s*preferredBoardStates/gi, 'safe safe switching'],
  [/strategicStrengths\.\s*endgamePatterns/gi, 'Endgame Plan'],
  [/strategicStrengths\.\s*supportRequirements/gi, 'Team Coordination']
];

export function normalizeThinEvidenceText(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';

  const thinMatch = text.match(/^(?:Missing or thin data|Missing data|Thin data)\s*:\s*(.+)$/i);
  if (!thinMatch) return text;

  let field = thinMatch[1].trim();
  for (const [pattern, replacement] of MISSING_DATA_FIELD_LABELS) field = field.replace(pattern, replacement);

  field = field
    .replace(/^strategic\s*Strengths\.?\s*/i, '')
    .replace(/^strategicStrengths\.?/i, '')
    .replace(/^[.\s]+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  field = normalizeDisplayLabel(field || 'Gold-standard evidence', 'Gold-standard evidence');
  return `Thin evidence: ${field}`;
}




const MOVE_CONCEPT_REPLACEMENTS = [
  [/\bProtect\s*\/\s*Wish\b/gi, 'Protect/Wish safe recovery planning'],
  [/\bProtect\s*\+\s*Wish\b/gi, 'Protect/Wish safe recovery planning'],
  [/\bFake Out\s*\+\s*Speed Control\b/gi, 'tempo control support'],
  [/\bTailwind\b/gi, 'speed control support'],
  [/\bVolt Switch\b/gi, 'pivot safe switching'],
  [/\bRecover\b/gi, 'long-game stabilization'],
  [/\bSnarl\b/gi, 'special damage suppression'],
  [/\bFake Out\b/gi, 'tempo pressure'],
  [/\bProtect\b(?!\/Wish)/gi, 'Protect scouting'],
  [/\bWish\b/gi, 'sustain support']
];

const RAW_MOVE_SENTENCE_START = /^(Protect|Fake Out|Recover|Tailwind|Snarl|Wish|Volt Switch)\b/i;

function normalizeMoveContext(text = '') {
  let normalized = String(text);

  for (const [pattern, replacement] of MOVE_CONCEPT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\bProtect scouting\s+creates scouting/gi, 'Protect scouting creates safer switching')
    .replace(/\btempo pressure\s+creates pressure support/gi, 'creates tempo pressure and safer switching')
    .replace(/\blong-game stabilization\s+stall into cleanup/gi, 'stabilizes long games before late-game win conditions')
    .replace(/\bProtect scouting\s+revealed because\s+Protect scouting\s+creates/gi, 'Protect scouting creates')
    .replace(/\btempo pressure rather than finishing power/gi, 'supports safe switching more than direct finishing pressure');

  normalized = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const trimmed = sentence.trim();

      if (RAW_MOVE_SENTENCE_START.test(trimmed)) {
        if (/Umbreon/i.test(trimmed)) {
          return trimmed.replace(/^Protect scouting\s+Umbreon/gi, 'Umbreon');
        }

        return trimmed
          .replace(/^Protect scouting\s+/gi, '')
          .replace(/^tempo pressure\s+/gi, '')
          .replace(/^long-game stabilization\s+/gi, '');
      }

      return trimmed;
    })
    .join(' ');

  return normalized;
}



function repairDanglingTacticalClauses(value = '') {
  let text = String(value || '');

  text = text
    .replace(/\b([A-Z][A-Za-z0-9'’ -]+?) needs bulky partners to keep during recovery turns\.\s*stable\.?/gi, '$1 relies on bulky teammates to stabilize recovery safe switching.')
    .replace(/\b([A-Z][A-Za-z0-9'’ -]+?) needs speed[-\s]?control to keep during recovery turns\.\s*stable\.?/gi, '$1 relies on speed-control support to maintain safe safe switching.')
    .replace(/\b([A-Z][A-Za-z0-9'’ -]+?) needs ([^.]+?) to keep during recovery turns\.\s*stable\.?/gi, '$1 relies on $2 to keep safe switching stable.')
    .replace(/\b([A-Z][A-Za-z0-9'’ -]+?) needs ([^.]+?) to keep during recovery turns\.?/gi, '$1 relies on $2 to keep safe switching stable.')
    .replace(/\bto keep during recovery turns\b/gi, 'to stay stable during recovery turns')
    .replace(/\brecovery routes stable\b/gi, 'recovery safe switching stable')
    .replace(/\.(?:\s+)(stable|vulnerable|unsafe|pressured|passive)\.?\s*$/i, '.')
    .replace(/\b(stable|vulnerable|unsafe|pressured|passive)\.\s+(stable|vulnerable|unsafe|pressured|passive)\.?$/i, '$1.');

  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

const FINAL_GRAMMAR_REPLACEMENTS = [
  [/\bopens by establishes\b/gi, 'opens by establishing'],
  [/\bturns wins through\b/gi, 'converts wins through'],
  [/\bcontinues threat through pressure turn planning\b/gi, 'slows aggressive teams through careful defensive play'],
  [/\bcreates Win Opportunities through\b/g, 'creates win opportunities through'],
  [/\bcreates win opportunities through\b/gi, 'creates win opportunities through'],
  [/\bsafe safe switching because opponents trying\b/gi, 'board control when opponents try']
];



function dedupeRecursiveTacticalPhrasing(value = '') {
  let text = String(value || '');

  const RECURSIVE_PATTERNS = [
    [/\bopens by establishing early safe safe switching can win by claiming early safe safe switching\b/gi,
      'establishes safer safe switching before transitioning into sustained pressure'],
    [/\bcan win by claiming early safe safe switching\b/gi,
      'can convert stabilized safe switching into offensive pressure'],
    [/\bopens by establishing\b/gi, 'establishes'],
    [/\bclaiming safe safe switching\b/gi, 'stabilizing safe switching'],
    [/\bearly safe safe switching\b/gi, 'early safe switching'],
    [/\bsafe safe switching\b(?=.*\bsafe safe switching\b)/gi, 'safe switching']
  ];

  for (const [pattern, replacement] of RECURSIVE_PATTERNS) {
    text = text.replace(pattern, replacement);
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const normalizedKeys = new Set();
  const deduped = [];

  for (const sentence of sentences) {
    const key = sentence
      .toLowerCase()
      .replace(/\b(can win by|opens by|claiming|establishing|creates|through|into|before|after)\b/g, '')
      .replace(/\b(safe switching|safe safe switching|board control|tempo|initiative|field control)\b/g, 'safe switching')
      .replace(/\b(pressure|offensive pressure|momentum|tempo pressure)\b/g, 'pressure')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedKeys.has(key) && key.length > 8) {
      normalizedKeys.add(key);
      deduped.push(sentence);
    }
  }

  text = deduped.join(' ');

  text = text
    .replace(/\b(safe switching(?:\s+safe switching)+)\b/gi, 'safe switching')
    .replace(/\b(pressure(?:\s+pressure)+)\b/gi, 'pressure')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}


export function normalizeFinalGrammar(value) {
  let text = dedupeRecursiveTacticalPhrasing(repairDanglingTacticalClauses(String(value ?? '')));
  text = normalizeProceduralTacticalText(text);
  for (const [pattern, replacement] of FINAL_GRAMMAR_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = normalizeProceduralTacticalText(text);
  return dedupeRecursiveTacticalPhrasing(repairDanglingTacticalClauses(text));
}

const DISPLAY_REPLACEMENTS = [
  [/board-state control threat on entry/gi, 'establishes early control'],
  [/disruption turn planning/gi, 'pressure turn planning'],
  [/win path/gi, 'win path'],
  [/turning pressure into damage/gi, 'offensive pressure'],
  [/threat propagation/gi, 'pressure spread'],
  [/reliably pressures defensive pivots/gi, 'pressures defensive pivots'],
  [/lacks strong neutral finishing pressure/gi, 'limited neutral finishing pressure'],
  [/needs matchup prep for/gi, 'must prepare for'],
  [/creates one-turn turn planning denial/gi, 'disrupts safe switching'],
  [/entry threat/gi, 'early pressure'],
  [/board-state control/gi, 'safe safe switching']
];


const CONTEXTUAL_ROTATIONS = [
  {
    pattern: /\bpressure\b/gi,
    replacements: ['force', 'threat', 'offensive presence', 'disruption', 'momentum']
  },
  {
    pattern: /\bturn planning\b/gi,
    replacements: ['timing', 'coordination', 'setup flow', 'turn flow']
  },
  {
    pattern: /\bconversion\b/gi,
    replacements: ['win path', 'closing route', 'payoff', 'advantage']
  },
  {
    pattern: /\bsafe switching\b/gi,
    replacements: ['board control', 'tempo', 'initiative', 'field control']
  }
];

function contextualRotate(text = '') {
  let normalized = String(text);

  CONTEXTUAL_ROTATIONS.forEach(({ pattern, replacements }) => {
    let index = 0;

    normalized = normalized.replace(pattern, (match) => {
      const replacement = replacements[index % replacements.length];
      index += 1;

      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }

      return replacement;
    });
  });

  return normalized;
}


const SHORTENING_REPLACEMENTS = [
  [/Explains how the team converts safe switching into escalating offensive momentum while identifying disruption points that can break turn planning\.?/gi, 'Shows how the team builds and maintains offensive momentum.'],
  [/Highlights coordinated move timing, pivot turn planning, and support windows that stabilize pressure turns\.?/gi, 'Highlights coordinated timing and support windows.'],
  [/Identifies safe switching traps, disruption vulnerabilities, and turn planning failures that can destabilize board control\.?/gi, 'Identifies disruption points that can break safe switching.'],
  [/Condenses major matchup threats into practical preparation priorities and turn planning cautions\.?/gi, 'Turns matchup threats into practical prep priorities.'],
  [/Provides actionable competitive guidance focused on preserving tempo, safe switching, and key pressure pieces\.?/gi, 'Focuses guidance on preserving key pressure pieces.'],
  [/Checks Item Clause, Mega Stone requirements, and practical item preparation without expanding into a large rules dashboard\.?/gi, 'Checks Item Clause, Mega requirements, and item prep.'],
  [/Reviews stat allocation legality and highlights the clearest investment signal for each selected Pokémon\.?/gi, 'Reviews stat legality and key investment signals.']
];


export function normalizeDisplayLabel(value, fallback = 'offensive pressure') {
  let text = String(value ?? '').trim();
  if (!text || RAW_LEAK_PATTERNS.some((pattern) => pattern.test(text))) return fallback;
  for (const [pattern, replacement] of LABEL_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = suppressRawTokenLeaks(text);
  text = text
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeFinalGrammar(text) || fallback;
}




const PROCEDURAL_CONNECTOR_PATTERNS = [
  /\binto\b/gi,
  /\bactive because\b/gi,
  /\bif available into\b/gi,
  /\bshould be reduced\b/gi,
  /\bopens by establishing\b/gi,
  /\brevealed because\b/gi,
  /\bsupport into cleanup\b/gi,
  /\bturns uses\b/gi
];

function normalizeProceduralTacticalText(value = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return text;

  PROCEDURAL_CONNECTOR_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern, ' ');
  });

  const sentenceFixes = [
    [
      /\bProtect scouting recovery safe safe switching\b/gi,
      'Protect scouting slows aggressive safe switching and stabilizes recovery turns'
    ],
    [
      /\b([A-Z][A-Za-z0-9'’ -]+)\s+turns uses\s+(.+?)\s+to support turn planning\b/gi,
      '$1 uses $2 to stabilize safe switching'
    ],
    [
      /\bMilotic uses Icy Wind\/Haze to stabilize safe switching\b/gi,
      'Milotic supports board control through Icy Wind speed management and Haze resets'
    ],
    [
      /\bProtect scouting\s+support turn planning\b/gi,
      'Protect scouting stabilizes safe switching'
    ],
    [
      /\brecovery safe safe switching\b/gi,
      'recovery safe switching'
    ]
  ];

  sentenceFixes.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  const repaired = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      let s = sentence.trim();

      if (!s) return '';

      s = s
        .replace(/\s+/g, ' ')
        .replace(/\b(board control|safe switching|pressure|tempo)\s+\1\b/gi, '$1');

      const hasVerb = /\b(is|are|creates|supports|stabilizes|forces|reveals|maintains|slows|wins|pressures|converts|disrupts|helps|relies|uses)\b/i.test(s);

      if (!hasVerb) {
        if (/Protect scouting/i.test(s)) {
          s = 'Protect scouting slows aggressive safe switching and reveals safe switching.';
        } else if (/Milotic/i.test(s) && /Icy Wind|Haze/i.test(s)) {
          s = 'Milotic supports board control through Icy Wind speed management and Haze resets.';
        }
      }

      if (!/[.!?]$/.test(s)) s += '.';

      return s;
    })
    .filter(Boolean)
    .join(' ');

  return repaired.replace(/\s+/g, ' ').trim();
}


const ACTIVE_RENDERER_BLOCKED_PATTERNS = [
  /must prepare for/i,
  /active because/i,
  /revealed because/i,
  /support into cleanup/i,
  /windows\/TR management/i,
  /assumptions should be reduced/i,
  /creates safer safe switching,\s*turn-stalling/i,
  /keep during recovery turns/i,
  /must prepare for\s+.+?\s+creates/i,
  /because\s+lower-speed safe switching/i
];

function reconstructTacticalReasoningSentence(value = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return text;

  const lower = text.toLowerCase();

  if (/trick room active|lower-speed safe switching|fast-mode assumptions/.test(lower)) {
    return 'Trick Room teams can be difficult because they reverse speed order and let slower attackers move first.';
  }

  if (/protect scouting/.test(lower) && (/must prepare for|creates safer safe switching|turn-stalling|weather\/speed-control|tr management|double-target denial/.test(lower))) {
    return 'Protect Careful switching and scouting help the team avoid dangerous attacks from aggressive opponents.';
  }

  if (/needs bulky partners.*keep.*recovery turns|bulky partners.*recovery turns.*stable/.test(lower)) {
    const name = text.match(/^([A-Z][A-Za-z0-9'’ -]+)/)?.[1] || 'This Pokémon';
    return `${name} relies on bulky teammates to stabilize recovery safe switching.`;
  }

  if (/needs speed[-\s]?control.*keep.*recovery turns|speed[-\s]?control.*recovery turns.*stable/.test(lower)) {
    const name = text.match(/^([A-Z][A-Za-z0-9'’ -]+)/)?.[1] || 'This Pokémon';
    return `${name} relies on speed-control support to maintain safe safe switching.`;
  }

  if (/opens by establishing early safe safe switching/.test(lower)) {
    const name = text.match(/^([A-Z][A-Za-z0-9'’ -]+)/)?.[1] || 'This team';
    return `${name} can win by claiming early safe safe switching.`;
  }

  if (/support around mega kangaskhan|unrelated extra pokémon/.test(lower)) {
    return 'Support Mega Kangaskhan carefully before trying to finish the game with it later.';
  }

  if (!ACTIVE_RENDERER_BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return text;

  text = text
    .replace(/^(.+?) must prepare for trick room active because .+$/i, 'Trick Room teams can be difficult because they reverse speed order and let slower attackers move first.')
    .replace(/^(.+?) must prepare for Protect scouting creates .+$/i, 'Protect Careful switching and scouting help the team avoid dangerous attacks from aggressive opponents.')
    .replace(/\bwindows\/TR management\b/gi, 'speed-control and Trick Room management')
    .replace(/\bfast-mode assumptions should be reduced\b/gi, 'fast-tempo plans become less reliable')
    .replace(/\bactive because\b/gi, 'changes the matchup because')
    .replace(/\brevealed because\b/gi, 'matters because')
    .replace(/\bmust prepare for\b/gi, 'must respect')
    .replace(/\bcreates safer safe switching,\s*turn-stalling,\s*/gi, 'creates safer safe switching and ')
    .replace(/\bkeep during recovery turns\b/gi, 'stay stable during recovery turns')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

export function normalizeDisplayText(value, options = {}) {
  let text = normalizeThinEvidenceText(String(value ?? '').trim());
  if (!text) return FALLBACK_TEXT;
  if (RAW_LEAK_PATTERNS.some((pattern) => pattern.test(text))) return FALLBACK_TEXT;
  for (const [pattern, replacement] of LABEL_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = suppressRawTokenLeaks(text);
  text = normalizeMoveContext(normalizeFinalGrammar(text));
  for (const [pattern, replacement] of DISPLAY_REPLACEMENTS) text = text.replace(pattern, replacement);
  for (const [pattern, replacement] of SHORTENING_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = repairDanglingTacticalClauses(normalizeFinalGrammar(suppressRawTokenLeaks(normalizeSemanticTacticalText(dedupeRepeatedChains(text)))))
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  text = reconstructTacticalReasoningSentence(text);
  if (options.ensureSentence && text && !/[.!?]$/.test(text)) text += '.';
  return text || FALLBACK_TEXT;
}

export function normalizeDisplayList(values, options = {}) {
  const seen = new Set();
  const normalized = (values || [])
    .map((value) => normalizeDisplayText(value, options))
    .filter(Boolean);
  return dedupeTacticalLines(normalized).filter((value) => {
    const key = rootMeaningKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pageDeduper(maxRepeats = 2) {
  const counts = new Map();
  return (value, options = {}) => {
    const text = normalizeDisplayText(value, options);
    const key = semanticMeaningKey(text) || rootMeaningKey(text);
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return count >= maxRepeats ? '' : text;
  };
}


const COACHING_ACTION_REPLACEMENTS = [
  [/^(.+?) establishes early safe safe switching/i, 'Use $1 to claim early safe switching.'],
  [/^(.+?) maintains offensive momentum/i, 'Keep $1 active while pressure is converting.'],
  [/^(.+?) recovery stability/i, '$1 relies on bulky teammates to stabilize recovery safe switching.'],
  [/^(.+?) limited neutral finishing pressure/i, 'Pair $1 with stronger closing pressure.'],
  [/applies reliable pressure into defensive cores/i, 'Press defensive cores with this route.'],
  [/supports stable neutral damage routing/i, 'Use this for chip and neutral routing.'],
  [/contributes support damage more than direct cleanup potential/i, 'Use this to soften targets for teammates.']
];

export function coachingConclusion(value, fallback = 'Avoid exposing key pressure pieces before cleanup windows and avoid exposing key support pieces early.') {
  let text = normalizeDisplayText(value, { ensureSentence: true });
  if (!text || text === FALLBACK_TEXT) return fallback;
  for (const [pattern, replacement] of COACHING_ACTION_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = text
    .replace(/\bcurrently\b/gi, '')
    .replace(/\bstrongest current route\b/gi, 'best route')
    .replace(/\.\s+(stable|vulnerable|unsafe|pressured|passive)\.?$/i, '')
    .replace(/\bto keep during\b/gi, 'to stay stable during')
    .replace(/\s+/g, ' ')
    .trim();
  text = repairDanglingTacticalClauses(text);
  return text || fallback;
}

export function compressCoachingList(values = [], options = {}) {
  const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : 3;
  const seen = new Set();
  return normalizeDisplayList(values, { ensureSentence: true })
    .map((value) => coachingConclusion(value))
    .filter((value) => {
      const key = rootMeaningKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

export function prioritySignalCount(items = [], visibleCount = 0) {
  const total = Array.isArray(items) ? items.length : 0;
  const hidden = Math.max(0, total - visibleCount);
  if (!total) return 'No notes yet';
  return hidden ? `${hidden} supporting notes` : 'Focused notes';
}

function rootMeaningKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(the|a|an|this|team|currently|strong|strongest|reliable|reliably|major|key)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 9)
    .join(' ');
}

function dedupeRepeatedChains(value) {
  let text = String(value || '');
  text = text.replace(/\b(.{8,80}?)(?:\s+\1){1,}\b/gi, '$1');
  text = text.replace(/\b(Taunt pressure)\b.*\b(can struggle against taunt|taunt disrupts recovery)\b/gi, 'Taunt disruption breaks recovery stability');
  return text;
}



