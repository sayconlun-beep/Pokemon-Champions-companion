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
