# Cleanup notes

This package removes unused / redundant code from the Pokémon Champions
team-building app. Every file currently used by the running app is
preserved, and **`styles.css` is left exactly as it was in your original**
(see "CSS reverted" below). All removals were confirmed dead via static
analysis (import-graph traversal + call-site search) before removal.

## ⚠️ CSS reverted

An earlier version of this cleanup also stripped ~248 "unused" CSS rules
from `styles.css`. That pass was too aggressive — it broke mobile scaling
and the navigation bar — because the app builds many class names
dynamically (conditional `${x ? 'active' : ''}` expressions, `className`
passed as a parameter, and `prefix-${value}` interpolation) that a static
substring scan can't see reliably.

**`styles.css` in this package is now byte-identical to your original.**
The dead CSS rules left behind are harmless: they simply never match any
element. They cost ~44 KB of file size but zero correctness. Trading 44 KB
for a working nav and correct mobile layout is the right call.

If you want to reclaim that space later, it needs a runtime-aware approach
(e.g. PurgeCSS configured with a safelist of the dynamic prefixes, or
coverage analysis from a real browser session) rather than static text
matching.

## Verification

- All 79 reachable JS files pass `node --check` (syntax-valid).
- Import graph: 79 reachable files, 0 unused, 0 unresolved imports.
- Project's own `npm run check:legacy` guard passes.
- Zero remaining references to any deleted symbol.
- `styles.css` byte-for-byte matches the original.

## What was deleted (JS only)

### Source files (10)

No importer anywhere in the reachable graph from `src/main.js`:

| File | Why it was dead |
| --- | --- |
| `src/components/analysis/SpeedControlPanel.jsx` | Byte-identical duplicate of the `.js` sibling. Only the `.js` is imported. |
| `src/components/GuidedTeamCoach.js` | Legacy 7-step wizard UI; replaced by `TeamBuildingGuidePage.js`. |
| `src/components/PokemonSearch.js` | Replaced by `SearchableSelector` + `formGrouping` helpers. |
| `src/components/StrategicCard.js` | `StrategicCard`/`EmptyCard` — neither imported. |
| `src/components/RiskBadge.js` | Replaced by `AnalysisDeskPage`'s local `renderRiskBadges`. |
| `src/components/ConfidenceBadge.js` | Never imported. |
| `src/core/goldStandardAnalysisEngine.js` | Old `analyseTeam(...)`; replaced by `goldStandardStrategyEngine.js`. |
| `src/core/benchmarkValidator.js` | Only used by the dead analysis engine. Live replacement: `damageBenchmarkEngine.js`. |
| `src/utils/tacticalTextHumanizer.js` | Replaced by `tacticalTextNormalizer.js`. |
| `src/app-shell/appShellMobileMenu.js` | Re-export shim; symbols imported directly from `appShellNavigation.js`. |

### `src/ui/AppShell.js` — 2,601 → 2,079 lines (-522, ~20%)

- 7 dead, write-only state fields removed (`coreFitOpen`, `coreBuilderCollapsed`, `guidedCoachStep`, `guidedCoachMetadexContext`, `guidedCoachSelections`, `coreBuilderNotice`, `coreBuilderStyle`).
- 9 dead event handlers removed (4 from the deleted Guided Team Coach; 5 — `explain-core-fit`, `send-core-team-to-analysis`, `edit-core-team`, `restart-core-builder`, `fill-team` — with no DOM emitters at all).
- ~300-line auto "explained team generation" pipeline removed (top-level entry point was never called).
- 13 legacy core-builder helpers collapsed into a single live `resetCoreBuilderDraft`.
- 3 orphan guided-role label helpers removed.
- `selectCoreAnchorPokemon` removed; dead `coreBuilderNotice` writes stripped from `addCandidate`.

### Navigation / routing — behavior preserved

- `appShellRoutesHandlers.js`: removed the dead `data-guided-metadex-step` branch (only emitter was the deleted Guided Team Coach). The live `data-metadex-guide-step` path is untouched.
- `appShellRoutes.js`: removed the matching dead `guidedMetadexStep` fallback.
- **All nav rendering, the mobile "More" menu (`setMobileMoreOpen` / `syncMobileMoreAria`), and route-link delegation were NOT modified.**

### `src/components/MoveSelect.js` — 167 → 120 lines

- Removed the unused `MoveSelect` per-move picker plus `getMoveOptions`, `powerAccuracy`, and its option cache (all replaced by `MoveSelectionList`).
- Kept `clearMoveOptionsCache` as a no-op because `appShellSearch.js` still calls it.

## What was preserved on purpose

- Legacy slot-format migration in `TeamSlotCard.js` (`evs`/`EVs`/`skillPoints`/`sp`) — upgrades old saved teams.
- `teamMigrationEngine.js` — data-shape migration, heavily used.
- 127 named exports that nothing currently imports but whose values ARE used inside their own file — removing the `export` keyword is cosmetic; left alone.
- **All of `styles.css`.**

## Build

`dist/` was removed because it held pre-cleanup artifacts. `scripts/build.mjs`
recreates `dist/` from scratch, so the first `npm run build` after extracting
will produce a fresh, correct build.
