## v0.3.54 - Windows Playwright launcher compatibility

## v0.3.56 - Team Builder targeted slot render wrapper fix

- Fixed the Team Builder targeted slot renderer so the newly-rendered slots region is parsed as a wrapper containing both the header and slot column, rather than only the first sibling element.
- Restores slot cards after choosing a Pokémon while preserving the deeper targeted-render split from v0.3.55.
- No CSS or data logic changes.


- Fixed `playwright.config.mjs` so mobile UI tests no longer force `/usr/bin/chromium` when running on Windows.
- Kept `PLAYWRIGHT_CHROMIUM_EXECUTABLE` support for CI/Linux overrides, but now lets Playwright use its managed browser install by default.
- Made no CSS pruning changes in this patch; batch 02 CSS remains unchanged.

## v0.3.53 - Phase 4 CSS prune batch 02

- Removed a second tiny, reversible CSS prune batch from `src/styles.css`, limited to old Guided Team Coach panel selectors that remained in the verified v0.3.52 runtime candidate list after transient overlay selectors were hard-kept.
- Avoided global controls, navigation, mobile shell, selector/dropdown, type, stat, item, move, direct picker, MetaDex detail, and mobile More menu styling.
- Added `reports/css-purge/batch-02-css-prune-removals.{json,md}` as the batch revert map before any further CSS pruning.

## v0.3.52 - Phase 4 CSS transient safelist enforcement

- Fixed `scripts/css-runtime-coverage-report.mjs` so transient overlay/watchlist selectors are treated as hard keep rules during candidate generation, not just reported after the fact.
- Protected direct Pokémon, move, and item picker selectors, compact move picker body/portal state selectors, MetaDex detail overlay selectors, and mobile More menu selectors from appearing in `runtime-css-candidates.txt`.
- Kept this as a report-tooling-only patch: no `src/styles.css` rules were removed and no batch-02 prune was attempted.

## v0.3.51 - Phase 4 CSS coverage harness hardening

- Stopped Phase 4 pruning before any additional CSS deletion because the existing runtime coverage candidate list included live direct picker and overlay selectors.
- Extended `scripts/css-runtime-coverage-report.mjs` to exercise desktop and mobile widths, direct Pokémon/move/item pickers, picker searches, MetaDex detail overlay, mobile More menu, expanded Team Builder slot state, and expanded Analysis Desk sections while coverage is recording.
- Added transient watchlist reporting and runtime-used class output to `runtime-css-safelist.json` so overlay/transient selectors can be verified before future prune batches.
- Made no changes to `src/styles.css`; no batch-02 CSS removals were attempted from the unsafe candidate list.

## v0.3.50 - Phase 4 CSS prune batch 01

- Removed the first tiny, reversible batch of runtime-unused CSS rules from `src/styles.css`, limited to isolated legacy selectors confirmed by the existing CSS purge reports.
- Preserved the dynamic safelist and avoided global controls, navigation, mobile shell, selector/dropdown, type, stat, item, and move styling.
- Added `reports/css-purge/batch-01-css-prune-removals.{json,md}` as the batch revert map before any further CSS pruning.

## v0.3.49 - Phase 3b Team Builder targeted slot workbench render

- Added `src/app-shell/teamBuilderRegionRender.js` with `renderTeamBuilderDynamicRegions()` and `teamBuilderSignature()` following the MetaDex and Analysis Desk targeted-region pattern.
- Added stable Team Builder dynamic regions for the slot workbench, mobile/desktop builder status, team snapshot, and recommendation filters while keeping the existing TeamSlotCard render helpers as the single markup source.
- Updated AppShell rendering so Team Builder slot edits can refresh only the Team Builder dynamic regions and fall back to the full shell render if the route or containers are unavailable.
- Preserved direct move/item picker overlays because targeted updates only replace descendants of the Team Builder root and do not clear body-mounted overlay portals.

## v0.3.48 - Phase 3a Analysis Desk targeted region render

- Added a stable `data-analysis-desk-dynamic-region` inside the Analysis Desk page so team/scenario-sensitive analysis output can refresh without rebuilding the surrounding app shell.
- Extracted the Analysis Desk dynamic markup into `renderAnalysisDeskDynamicRegion()` so both the full page render and targeted update path use the same render helpers and strings.
- Added `src/app-shell/analysisDeskRegionRender.js` with `renderAnalysisDeskDynamicRegions()` and `analysisDeskSignature()` following the MetaDex targeted-region pattern.
- Updated AppShell rendering so repeat Analysis Desk updates refresh only the dynamic region when the signature changes, falling back to the full shell render when the route/container is unavailable.

## v0.3.47 - Phase 3 Step 2 MetaDex targeted results render

- Added a stable `data-metadex-results` region for the MetaDex results list while keeping the existing results classes and compatibility attribute.
- Moved MetaDex results and search-option markup into exported page render helpers so the full page render and targeted update path share one source of HTML.
- Updated the targeted MetaDex region renderer to refresh only metrics, search suggestions, and the results container for search/filter signature changes without calling the full AppShell render path.
- Kept the global full-render focus and scroll preservation path intact for all non-converted regions.

## v0.3.46 - Phase 2.5 overlay extraction

- Extracted the MetaDex detail overlay behaviour from `src/ui/AppShell.js` into `src/ui/overlays/metadexDetailOverlay.js` while keeping the existing extracted markup renderer.
- Extracted the direct move picker and direct item picker into focused `src/ui/overlays/` modules, preserving their DOM mount targets, CSS classes, search filtering, close timing, and selection behaviour.
- Added shared direct-picker helpers for escaping, filtering visibility, close-all behaviour, and the open-click guard so picker timing remains consistent.
- Kept AppShell as the thin event-delegation caller for these overlays and reduced `src/ui/AppShell.js` from 2,144 lines to 1,735 lines.

## v0.3.43 - MetaDex targeted search render



## v0.3.45 - Structural build guard

- Replaced the broad legacy phrase build guard with an import-layer architecture check.
- Kept only deleted-system identifiers in the legacy guard so normal guide vocabulary can ship safely.
- Wired the architecture guard into the build before data/build validation.

## v0.3.44 - Runtime-aware CSS purge reporting

- Added optional runtime CSS coverage reporting for safe, browser-driven stylesheet shrink analysis.
- Added dynamic class construction reporting so generated class names can be reviewed before any purge is applied.
- Added an optional purged-dist preview path for mobile sweep validation without modifying `src/styles.css`.
- Added a targeted MetaDex region renderer for the search/filter results area while leaving the existing full-app render path as the default.
- Updated MetaDex search typing to refresh only the result grid, result metrics, and search suggestion panel instead of rebuilding the full shell.
- Kept the existing focus/scroll preservation module in place for pages and controls not yet converted.
- Preserved delegated event handling so newly rendered MetaDex tiles still open the detail overlay without a full re-bind.

## v0.3.42 - App state encapsulation

- Added a small vanilla app state module with `get`, `set`, `update`, and `subscribe` while keeping the existing full re-render model intact.
- Moved Team Builder recommendation memo state out of the shared app state object and into `src/logic/recommendationMemo.js`.
- Moved the MetaDex render cache off the shared state object so cache bags are held in module-local memo storage instead of `state.__*Cache` fields.
- Preserved route rendering, event binding, URL hydration, and existing mutable state behavior.

## v0.3.40 - Team Slot Card launch fix


## v0.3.41 - Team slot card expansion hotfix

- Fixed the Team Builder expanded slot crash caused by missing display-name imports after the TeamSlotCard module split.
- Verified the extracted TeamSlotCard renderer can render an expanded slot again.
- Fixed syntax errors introduced during the Team Slot Card module split.
- Restored the extracted review-card color helper body, removed a duplicated `export`, and removed a duplicate local `normalizeKey` declaration now imported from shared helpers.
- Confirmed `npm run build` passes after the launch fix.

## v0.3.39 - Team Slot Card module split

- Split the monolithic Team Slot Card component into a thin compatibility entry plus focused render/helper modules under `src/components/team-slot-card/`.
- Preserved the existing Team Builder import path while moving review-card rendering, expanded controls, stat rendering, spread analysis, and strategic role/pressure helpers into smaller files.
- Preserved rendered strings, CSS classes, selectors, data attributes, legality checks, item-clause behaviour, stat controls, and collapsed/expanded slot behaviour as an extraction-only refactor.

## v0.3.38 - Team Building Guide module split

- Split the monolithic Team Building Guide page into a thin route controller plus focused render/data/helper modules under `src/pages/team-building-guide/`.
- Updated `src/ui/routes.js` to import the new Team Building Guide controller directly while keeping the old page path as a compatibility re-export.
- Preserved rendered text, CSS classes, state usage, and event-binding behavior; this is an extraction-only refactor.

## v0.3.37 — Analysis Desk module split


- Split the monolithic Analysis Desk page into a thin controller plus focused render/helper modules under `src/pages/analysis-desk/`.
- Updated routing to import the new controller directly while keeping the old page path as a one-line compatibility re-export.
- Preserved Analysis Desk rendered output, coaching profile inputs, coverage calculations, suggested slot links, and Learning Hub links as a move/extract refactor only.

## v0.3.36 — Tactical presenter dead path cleanup

- Removed the legacy tactical semantic deduper and tactical text normalizer utility files after all consuming pages were migrated to presenter-owned display strings.
- Removed dead Analysis Desk grouping/rendering code that only existed to normalize or dedupe old locally generated tactical prose.
- Removed dead Matchups fallback prose builders for old opponent threat handling and primary-risk/battle-tip text paths.
- Kept the core tactical normalization engine in place for non-presenter systems that still use it.

## v0.3.35 — Tactical presenter Analysis Desk coverage wording

- Moved Analysis Desk Pressure Coverage and Weakness Coverage display wording onto the tactical presenter output.
- Kept raw coverage calculations and tile rendering in `AnalysisDeskPage.js`, while selecting summaries, coaching lines, and tile explanations from presenter-owned strings.
- Removed duplicate local weakness wording from the displayed coverage path without deleting the legacy semantic deduper yet.
- Preserved pressure coverage contributors, move details, defensive counts, weak/resist/immune/neutral groups, suggested slot links, and MetaDex answer links.

## v0.3.34 — Tactical presenter Analysis Desk defensive risks

- Moved Analysis Desk Defensive Game Plan and Actionable Risk wording onto canonical tactical presenter strings.
- Kept slot-link rendering in the page while moving risk titles, summaries, current answers, look-for guidance, and suggested-slot wording into presenter output.
- Preserved defensive concern facts, affected Pokémon, safer answers, and Team Builder routing.

## v0.3.33 — Tactical presenter Matchups battle coaching

- Moved Matchups Battle Coaching section metadata and empty-state wording onto the tactical presenter output.
- Kept opponent-reactive battle cards presenter-backed and removed the old unused local battle-tip generator path from the page.
- Preserved best-answer, speed-plan, disruption, and positioning-risk coaching facts.

## v0.3.32 — Tactical presenter Matchups primary risks

- Moved Matchups Primary Matchup Risks onto canonical tactical presenter strings.
- Replaced page-local fallback risk prose with presenter-owned risk title, question, answer, empty-state, and no-risk messages.
- Preserved risk type, exposed Pokémon, safer answers, selected-opponent context, and lead adjustment guidance.

## v0.3.31 — Analysis Desk clean section headers

- Cleaned the Analysis Desk section headers so each major section now has one clear title instead of a small kicker plus a repeated larger heading.
- Renamed repeated headers such as “Team Offense — Pressure Coverage” and “Team Defense — Weakness Coverage” to cleaner single headings: “Pressure Coverage” and “Weakness Coverage”.
- Removed duplicate-looking header labels from Team Archetype, How This Team Plays, Defensive Game Plan, Build Notes, Learning Hub, and expandable analysis sections.
- Kept analysis content, team logic, coverage calculations, coaching profile generation, and Team Builder logic unchanged.

## v0.3.30 — Compact Nature picker mobile fix

- Replaced the long native mobile Nature selector with a compact in-card picker so the nature list no longer fills the whole phone screen.
- Kept the Preset selector unchanged because its short option list already works well on mobile.
- Preserved existing nature state and stat calculation behaviour.

# Pokémon Champions Companion — Changelog

## v0.3.29

- Changed the stat editor Nature selector back to a native mobile select so it opens and behaves like the stat Preset picker on phones.
- Kept Nature and Preset visually aligned with matching labels, width, height, border radius, spacing, and dark styling.
- Left stat logic, preset logic, team logic, and guide logic unchanged.


## v0.3.28 — Team Builder stat dropdown alignment

- Replaced the stat preset native mobile dropdown with the same searchable selector pattern used by Nature.
- Aligned the Nature and Preset controls inside the Team Builder stat panel so they share the same width, styling, menu behaviour, and dark UI treatment.
- Preserved stat allocation logic, preset values, nature logic, legality, import/export, and all Team Building Guide steps.

## v0.3.27 — Step 7 deploy guard fix

- Fixed the Netlify deploy failure caused by the blocked legacy phrase `sweeper` in Team Building Guide Step 7.
- Replaced the wording with approved instructional language while keeping the same Step 7 testing guidance.
- Preserved all guide logic, team analysis logic, stat logic, legality logic, import/export, and other guide steps.

## v0.3.26 — Team Building Guide Step 7 live testing guidance

- Updated **Step 7: Start Testing** so it generates testing advice from the loaded team.
- Added suggested lead pairs with an explanation of what each opener is trying to accomplish.
- Added matchup risks to watch for during testing without turning the guide into a full Matchups page.
- Added post-game review questions and clear rules for when to change a Pokémon, move, item, nature, or stat direction.
- Kept the update instructional and limited to Step 7 only.


## v0.3.18

- Set Spread Analysis panels to collapsed by default inside expanded Team Builder slot cards.
- Preserves the improved responsive two-column slot layout while preventing the stats column from forcing uneven initial heights.
- No changes to calculations, legality, analysis generation, save/export, presets, or database structure.


## v0.3.15 - Slot page information architecture pass

- Reorganized expanded Team Builder slot details into three functional zones: Build Configuration, Performance & Stats, and Team Context.
- Moved Spread Analysis directly beneath the stat allocation system so nature/stat explanations stay attached to the numbers they explain.
- Moved Strategic Role into a dedicated full-width team-context section beneath the build and stat columns.
- Converted Spread Analysis from paragraph stacking into labelled coaching blocks: Nature impact, Why this fits the role, Tradeoffs, and When to adjust.
- Tightened expanded slot spacing, card rhythm, radar/stat alignment, and Strategic Role mini-card consistency without changing calculations, legality, presets, save/export, matchup, or analysis logic.

# Pokémon Champions Companion — Changelog

This changelog reconstructs the recent project work completed during the current build phase. Earlier foundation work existed before this record and can be expanded later.

## v0.3.13 — Matchups Opening Plans relocation

- Moved tactical lead coaching out of the Analysis Desk.
- Added a new Matchups page section: **Opening Plans**.
- Reused the existing lead recommendation data instead of creating a separate system.
- Reframed lead card labels for battle preparation:
  - Best opening → Standard opener
  - Safe setup lead → Safer positioning opener
  - Aggressive lead → Pressure opener
  - Defensive lead → Defensive positioning opener
- Removed duplicate lead coaching from the Battle Scenario Planner so Opening Plans only appears once.
- Kept Analysis Desk focused on static team identity, structure, synergies, win conditions, risks, and role compression.

## v0.3.12 — Team Builder minimised slot radar restoration

- Restored compact radar chart visibility on minimised Team Builder slot cards.
- Preserved the existing wide slot-card layout and completed-slot review styling.
- Kept the radar implementation focused on readability and compact stat identity.

## v0.3.11 — Team Builder slot-card radar/readability pass

- Added compact radar chart support to minimised Team Builder slot cards.
- Improved stat identity visibility on completed Pokémon cards.
- Adjusted text/readability around radar charts so stat labels remain legible.

## v0.3.10 — Desktop expanded slot workbench direction

- Began moving expanded Team Builder slots away from tall stacked forms.
- Reworked the intended desktop layout toward a wider competitive build dashboard.
- Prioritised keeping important Pokémon build information visible at once on wide screens.

## v0.3.9 — Team Builder multi-expand and branch cleanup

- Fixed completed slots closing each other after minimising and expanding multiple cards.
- Restored the newer intended slot-card layout after older layout branches reappeared.
- Removed unnecessary older branches/layout remnants that were causing regressions.

## v0.3.x — Matchups / Analysis content-boundary work

- Established clearer page responsibilities:
  - Analysis Desk: what the team is and how it wins.
  - Matchups: how to pilot the team into opponents.
  - Damage: KO and survival testing.
- Added universal content rules for Analysis Desk, Matchups, and Damage.
- Improved Matchups page coaching so it avoids duplicating Analysis Desk identity text.
- Moved matchup-specific and piloting-oriented content away from structural analysis where possible.

## v0.3.x — Analysis Desk refinement phase

- Reworked archetype explanation so “Why this was detected” cites real team signals such as abilities, moves, and synergy links.
- Reconciled archetype tags with detected gameplans when a team plays like a balance shell around a focused win condition.
- Cleaned duplicated defensive gameplan text.
- Reorganised Risk Callouts into the defensive/weakness context where they belong.
- Deduplicated “Suggested slot to change” content so it appears in the most useful location only.
- Standardised Weakness Coverage cards so no type card is expanded by default.
- Kept one plain-language defensive takeaway instead of showing duplicate “What this means” panels.

## v0.3.x — Strategic detection upgrades

- Added scaling win-condition detection, including Last Respects-style endgame plans.
- Updated Top Gameplan and Team Analysis Summary to surface secondary scaling plans when detected.
- Added inactive ability clarification for condition-dependent abilities such as Sand Force, Swift Swim, Chlorophyll, Solar Power, and Snow Cloak when their required weather is missing.
- Expanded Intentional Synergies so the panel can list all supported synergies rather than only one detected example.
- Added more team-specific Speed Control summaries, referencing actual speed tools such as Icy Wind, Tailwind, Trick Room, Scarf users, or paralysis where present.

## v0.3.x — Pressure and coverage UI upgrades

- Replaced paragraph-style offensive Pressure Coverage with a scannable visual type grid.
- Added offensive type cards showing contributors, move shape, and coverage strength.
- Improved layout consistency between pressure, weakness, and summary panels.

## v0.3.x — Gold Standard rebuild / modern reconstruction notes

- Rebuilt the Pokémon database from scratch during the Gold Standard rebuild.
- Merged the rebuilt database into the older app before later removing legacy remnants.
- Purged old analysis/UI assumptions that were causing incorrect output and difficult maintenance.
- Rebuilt analysis direction around cleaner data, stronger tactical rules, and clearer page boundaries.
