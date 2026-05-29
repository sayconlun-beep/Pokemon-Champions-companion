import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { getReadableAbilityName, getReadableItemName, getReadableMoveName, getReadablePokemonName } from '../../utils/displayNames.js';
import { buildTeamGuideContext } from '../../logic/teamGuideContext.js';
import { escapeText, learningTerm, listBlock, speedControlGuideLink } from './teamBuildingGuideUtils.js';
import { renderDetailWeaknessPatchSection } from './renderGuideWeaknessSteps.js';

export function renderRoundOutTeamStep(state) {
  const guideContext = state.__teamGuideContext || {};
  const guide = state.__teamGuideTacticalPresentation?.guide || guideContext.tacticalPresentation?.guide || {};
  const roundOut = guide.roundOut || {};
  const gaps = Array.isArray(roundOut.gaps) ? roundOut.gaps : [];
  const gapText = roundOut.gapText || (gaps.length ? gaps.join(', ') : 'no major role gaps detected');
  return `<section class="team-guide-section"><h3>Fill out the Core</h3><p>This step now focuses on what your current team is still missing.</p><p><strong>Current gaps:</strong> ${escapeText(gapText)}.</p></section>
  <section class="team-guide-section"><h3>Recommended additions</h3><ul class="team-guide-question-list">
  ${gaps.includes('speed control')?'<li>Add a speed control piece that supports the existing gameplan rather than replacing it.</li>':''}
  ${gaps.includes('support/disruption')?'<li>Add disruption, pivoting, screens, Intimidate, redirection, or other support that helps your main attackers function.</li>':''}
  ${gaps.includes('secondary pressure')?'<li>Add a secondary attacker or cleaner so the team is not reliant on one threat.</li>':''}
  ${gaps.includes('cohesion support')?'<li>Look for a glue Pokémon that connects disconnected pieces and improves positioning.</li>':''}
  ${!gaps.length?'<li>Your core looks structurally complete. Focus on matchup coverage and refinement.</li>':''}
  </ul></section>
  <section class="team-guide-section"><h3>Do not break the plan</h3><p>Every addition should reinforce the main plan shown above. Prefer roles that solve multiple problems at once instead of adding isolated matchup patches.</p></section>`;
}

export function renderFinishDetailsStep(state) {
  const moves = learningTerm('moves', 'learning-movesets');
  const items = learningTerm('items', 'learning-items');
  const abilities = learningTerm('abilities', 'learning-abilities');
  const natures = learningTerm('natures', 'learning-natures');
  const statPoints = learningTerm('stat points', 'learning-stat-points');
  const benchmarks = learningTerm('benchmarks', 'learning-benchmarks');
  const roles = learningTerm('roles', 'learning-pokemon-roles');
  const protect = learningTerm('Protect', 'learning-protect-positioning');
  const firstDraft = learningTerm('first draft', 'learning-first-drafts');
  const detailAudit = buildStep6DetailAudit(state);
  return `<section class="team-guide-section">
    <p>At this point, you should know the six Pokémon that are going to be on your team.</p>
    <p>You should also have imagined some ways you want to battle with them: common leads, backup plans, support partners, and win conditions.</p>
    <p>Now it is time to fill in the details you skipped earlier: ${moves}, ${items}, ${abilities}, ${natures}, ${statPoints}, final ${roles}, and important damage or survival ${benchmarks}.</p>
    <p class="muted team-guide-context-link">${speedControlGuideLink('Read the Speed Control guide')}</p>
    <p>Once this step is complete, the ${firstDraft} of your team is ready to test.</p>
  </section>

  ${renderStep6LiveChecklist(detailAudit)}

  ${renderDetailWeaknessPatchSection(state)}

  <section class="team-guide-section"><h3>What details need finishing?</h3><div class="learning-grid">
    <article class="mini-card"><h4>Moves</h4><p>Choose moves that match each Pokémon’s job on the team.</p><ul><li>damage moves for pressure</li><li>${protect} for positioning</li><li>speed control moves</li><li>support or disruption moves</li><li>coverage moves for specific threats</li></ul></article>
    <article class="mini-card"><h4>Items</h4><p>Choose items that help the Pokémon perform its role.</p><ul><li>damage items for attackers</li><li>defensive items for bulky Pokémon</li><li>recovery or sustain items</li><li>utility items for support Pokémon</li><li>matchup-specific items if needed</li></ul></article>
    <article class="mini-card"><h4>Abilities</h4><p>Choose the ability that best supports the team’s plan.</p><ul><li>weather abilities</li><li>defensive abilities</li><li>offensive abilities</li><li>speed-related abilities</li><li>utility abilities</li></ul></article>
    <article class="mini-card"><h4>Natures and stat points</h4><p>Choose stat investments that help the Pokémon do its job.</p><ul><li>enough Speed for important targets</li><li>enough bulk to survive key attacks</li><li>enough damage to secure important KOs</li><li>simple role-based spreads if exact benchmarks are not known yet</li></ul></article>
    <article class="mini-card"><h4>Final role clarity</h4><p>Make sure every Pokémon has a clear job.</p><ul><li>main attacker</li><li>secondary attacker</li><li>support</li><li>speed control</li><li>defensive pivot</li><li>setup option</li><li>cleaner</li><li>matchup answer</li></ul></article>
  </div></section>

  <section class="team-guide-section"><h3>How to read the live checklist</h3><p>Pass rows mean the choice is complete or clearly aligned with the current role read. Warning rows are coaching prompts, not legality errors. They tell you where to confirm a move, item, ability, nature, or stat direction before testing.</p></section>

  <section class="team-guide-section"><h3>Do not over-perfect yet</h3><p>This is still only the first draft.</p><p>You do not need perfect stat spreads or exact matchup benchmarks before testing.</p><p>Start with sensible choices that match the Pokémon’s role, then improve them after real games.</p><p>If you spend too long trying to perfect the team before testing, you may optimise for problems that never actually happen.</p></section>

  <section class="team-guide-section"><h3>Simple priority order</h3><ol class="team-guide-question-list"><li>Choose the Pokémon’s role.</li><li>Choose the moves it needs to do that role.</li><li>Choose the ability that best supports that role.</li><li>Choose the item that helps it perform that role.</li><li>Choose nature and stat points last.</li><li>Only add advanced benchmarks once you know what matters.</li></ol></section>

  <section class="team-guide-section"><h3>Example</h3><article class="mini-card"><p>You added a Pokémon because your team needed speed control.</p><ul><li>give it a speed control move</li><li>give it Protect or useful support if needed</li><li>choose an item that helps it survive long enough to use its support</li><li>choose a nature and stat spread that let it perform that job consistently</li></ul><p class="muted">The exact numbers can be improved later after testing.</p></article></section>

  ${listBlock('What to do now', ['Open Team Builder.','Fill in moves, items, abilities, natures, and stat points for each Pokémon.','Use the Metadex to check common role, move, ability, and item ideas.','Use Damage to test important attacks or survival benchmarks.','Use Analysis to check whether the final draft still has enough roles, speed control, pressure, and defensive value.','Once every Pokémon has complete details, move to playtesting.'])}

  <section class="team-guide-section"><h3>How to use the Metadex here</h3><p>Use the Metadex to understand what each Pokémon usually wants to do, what moves and abilities support that role, and what items make sense for the job you gave it.</p></section>`;
}


function buildStep6DetailAudit(state = {}) {
  const data = state.data || {};
  const indexes = data.indexes || data || {};
  const pokemonById = indexes.pokemonById || {};
  const abilitiesById = indexes.abilitiesById || {};
  const itemsById = indexes.itemsById || {};
  const movesById = indexes.movesById || {};
  const context = state.__teamGuideContext || buildTeamGuideContext(state.team, { data, profile: state.__teamGuideCoachingProfile });
  const piecesByName = new Map((context.corePieces || []).map((piece) => [String(piece.name || '').toLowerCase(), piece]));
  const inactiveWarnings = context.inactiveAbilityWarnings || [];
  const slots = (Array.isArray(state.team) ? state.team : []).filter((slot) => slot && (slot.pokemon_id || slot.pokemon));

  const rows = slots.map((slot, index) => {
    const pokemon = pokemonById[slot.pokemon_id] || slot.pokemon || slot;
    const name = getPokemonDisplayName(pokemon) || getReadablePokemonName(pokemon, `Slot ${index + 1}`);
    const rolePiece = piecesByName.get(String(name).toLowerCase()) || {};
    const role = rolePiece.roles?.length ? rolePiece.roles.join(', ') : 'Needs clearer job';
    const moveIds = (Array.isArray(slot.moves) ? slot.moves : [slot.move1, slot.move2, slot.move3, slot.move4]).filter(Boolean);
    const moveNames = moveIds.map((id) => getReadableMoveName(movesById[id] || id, String(id))).filter(Boolean);
    const abilityName = slot.ability_id || slot.ability ? getReadableAbilityName(abilitiesById[slot.ability_id] || abilitiesById[slot.ability] || slot.ability || slot.ability_id, '') : '';
    const itemName = slot.item_id || slot.item ? getReadableItemName(itemsById[slot.item_id] || itemsById[slot.item] || slot.item || slot.item_id, '') : '';
    const nature = String(slot.nature || '').trim();
    const statDirection = describeStatInvestmentDirection(slot);
    const lowered = [name, abilityName].join(' ').toLowerCase();
    const inactive = inactiveWarnings.find((warning) => String(warning).toLowerCase().includes(String(name).toLowerCase()) || (abilityName && String(warning).toLowerCase().includes(abilityName.toLowerCase())));
    const roleText = String(role).toLowerCase();
    const moveText = moveNames.join(' ').toLowerCase();
    const itemText = String(itemName || '').toLowerCase();
    const natureText = nature.toLowerCase();
    const statText = statDirection.toLowerCase();

    const checks = [
      detailCheck(Boolean(abilityName), 'Ability selected', abilityName ? `${abilityName} is selected.` : 'Choose an ability so this Pokémon has a defined battle function.'),
      detailCheck(Boolean(itemName), 'Item selected', itemName ? `${itemName} supports or modifies this slot.` : 'Choose an item that supports this Pokémon’s job.'),
      detailCheck(Boolean(nature), 'Nature selected', nature ? `${nature} nature is selected.` : 'Pick a nature that matches damage, Speed, or bulk needs.'),
      detailCheck(moveNames.length >= 4, 'Moves complete', moveNames.length >= 4 ? `Moves: ${moveNames.slice(0, 4).join(', ')}.` : `${moveNames.length}/4 moves selected.`),
      detailCheck(Boolean(statDirection), 'Stat investment direction', statDirection || 'No visible Champions stat point direction yet.'),
      detailCheck(!inactive, 'Ability is active in this team', inactive || 'No inactive ability warning detected.'),
      detailCheck(roleFitsDetails({ roleText, moveText, itemText, natureText, statText }), 'Choices match role', roleFitDetail({ role, moveNames, itemName, nature, statDirection }))
    ];
    return { name, role, checks, warningCount: checks.filter((c) => !c.ok).length };
  });

  const allRows = rows.flatMap((row) => row.checks);
  return {
    rows,
    passCount: allRows.filter((row) => row.ok).length,
    warningCount: allRows.filter((row) => !row.ok).length,
    filledSlots: slots.length
  };
}

function detailCheck(ok, label, detail) {
  return { ok: Boolean(ok), label, detail };
}

function describeStatInvestmentDirection(slot = {}) {
  const allocation = slot.statAllocation || slot.stat_allocation || slot.skillPoints || slot.skill_points || slot.sp || {};
  const labels = { hp: 'HP', atk: 'Attack', attack: 'Attack', def: 'Defense', defense: 'Defense', spa: 'Sp. Attack', sp_atk: 'Sp. Attack', special_attack: 'Sp. Attack', spd: 'Sp. Defense', sp_def: 'Sp. Defense', special_defense: 'Sp. Defense', spe: 'Speed', speed: 'Speed' };
  const entries = Object.entries(allocation || {})
    .map(([key, value]) => ({ key, label: labels[key] || key, value: Number(value || 0) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!entries.length) return '';
  const top = entries.slice(0, 3).map((entry) => `${entry.label} +${entry.value}`).join(' / ');
  return `Current direction: ${top}`;
}

function roleFitsDetails({ roleText = '', moveText = '', itemText = '', natureText = '', statText = '' }) {
  if (/needs clearer job/i.test(roleText)) return false;
  if (/speed control/.test(roleText)) return /tailwind|icy wind|trick room|thunder wave|electroweb|glare|nuzzle|scary face|speed/.test(moveText + ' ' + statText + ' ' + natureText);
  if (/weather setter/.test(roleText)) return /drought|drizzle|snow warning|sand stream|aurora veil|heat rock|icy rock|smooth rock|weather/.test(moveText + ' ' + itemText);
  if (/support|disruption|pivot|stability/.test(roleText)) return /protect|fake out|parting shot|taunt|encore|snarl|will o wisp|aurora veil|reflect|light screen|leftovers|sitrus|focus sash|bulk|hp|defense|sp\. defense/.test(moveText + ' ' + itemText + ' ' + statText);
  if (/attacker|abuser/.test(roleText)) return /attack|sp\. attack|speed|life orb|choice|expert belt|focus sash|last respects|bullet punch|blizzard|heat wave|dazzling gleam|liquidation|flare blitz/.test(moveText + ' ' + itemText + ' ' + statText + ' ' + natureText);
  return true;
}

function roleFitDetail({ role, moveNames, itemName, nature, statDirection }) {
  if (/needs clearer job/i.test(role || '')) return 'This Pokémon is selected, but the current team read does not yet see a clear role connection.';
  const visible = [moveNames.length ? `${moveNames.length} moves` : '', itemName ? itemName : '', nature ? `${nature} nature` : '', statDirection].filter(Boolean).join(' • ');
  return visible ? `Role read: ${role}. Details visible: ${visible}.` : `Role read: ${role}, but the detailed choices are still unfinished.`;
}

function renderStep6LiveChecklist(audit = {}) {
  if (!audit.filledSlots) {
    return `<section class="team-guide-section tactical-secondary-panel"><p class="eyebrow">Live detail check</p><h3>No team details to inspect yet</h3><p class="muted">Add Pokémon in Team Builder, then Step 6 will inspect abilities, items, natures, moves, stat direction, inactive abilities, and role fit.</p></section>`;
  }
  const verdict = audit.warningCount
    ? `${audit.warningCount} detail warning${audit.warningCount === 1 ? '' : 's'} to review before testing.`
    : 'All visible details pass the first-draft check.';
  return `<section class="team-guide-section tactical-secondary-panel">
    <p class="eyebrow">Live detail check</p>
    <h3>Step 6 checklist verdict</h3>
    <p><strong>${escapeText(verdict)}</strong></p>
    <p class="muted">This checks the loaded team’s current abilities, items, natures, moves, stat investment direction, inactive ability warnings, and whether each Pokémon’s choices match its detected role.</p>
    <div class="learning-grid">
      ${audit.rows.map((row) => `<article class="mini-card"><h4>${escapeText(row.name)}</h4><p class="muted"><strong>Role read:</strong> ${escapeText(row.role)}</p><ul>${row.checks.map((check) => `<li>${check.ok ? '✅' : '⚠️'} <strong>${escapeText(check.label)}</strong> — ${escapeText(check.detail)}</li>`).join('')}</ul></article>`).join('')}
    </div>
  </section>`;
}

export function renderStartTestingStep(guideContext = {}) {
  const guide = guideContext?.tacticalPresentation?.guide || {};
  const leadPairs = Array.isArray(guide.testing?.leads) ? guide.testing.leads : [];
  const testing = learningTerm('testing', 'learning-testing-teams');
  const firstDraft = learningTerm('first draft', 'learning-first-drafts');
  const matchup = learningTerm('matchup', 'learning-matchups');
  const speedControl = learningTerm('speed control', 'speed-control');
  const safeTurns = learningTerm('safe turns', 'safe-turns');
  const sixth = learningTerm('Sixth Pokémon Syndrome', 'learning-sixth-pokemon-syndrome');
  const iteration = learningTerm('iteration', 'learning-team-iteration');
  const winCondition = learningTerm('win condition', 'learning-win-conditions');
  const testingLog = learningTerm('testing log', 'learning-testing-log');
  const leadSection = leadPairs.length ? `<section class="team-guide-section"><h3>Suggested lead pairs</h3><div class="learning-grid">${leadPairs.map((lead)=>`<article class="mini-card"><h4>${escapeText(lead.title)}</h4><p>${escapeText(lead.detail)}</p></article>`).join('')}</div></section>` : '';
  return `<section class="team-guide-section">
    <p>The ${firstDraft} of your team is unlikely to be the final draft.</p>
    <p>Up to this point, you have made educated guesses. You have imagined leads, matchups, support plans, damage pressure, ${speedControl}, and ${winCondition}s.</p>
    <p>${testing} is how you find out which guesses were right. You may discover that some Pokémon are excellent, some moves never get clicked, some items do not help, or one ${matchup} is much harder than expected.</p>
    <p>That is normal. Team building is an ${iteration} process.</p>
  </section>

  ${leadSection}

  <section class="team-guide-section"><h3>Matchups to watch for</h3><ul class="team-guide-question-list"><li>Teams that deny your preferred opening.</li><li>Faster speed-control archetypes.</li><li>Bulky defensive cores that stall your pressure.</li><li>Setup attackers that punish passive turns.</li><li>Weather, Trick Room, or other field-control strategies.</li></ul></section>

  <section class="team-guide-section"><h3>Questions to answer after games</h3><ul class="team-guide-question-list"><li>Which lead pair felt strongest and why?</li><li>Did the team create the board state it was designed to create?</li><li>Which Pokémon overperformed or underperformed?</li><li>Were there moves, items, or abilities that never mattered?</li><li>What matchup exposed the biggest weakness?</li></ul></section>

  <section class="team-guide-section"><h3>When changes are justified</h3><ul class="team-guide-question-list"><li>Change a move if it is repeatedly unused or fails its intended job.</li><li>Change an item if it rarely influences games.</li><li>Change a nature or investment if key speed or damage benchmarks are consistently missed.</li><li>Replace a Pokémon only after repeated evidence that it cannot perform its intended role.</li></ul></section>

  <section class="team-guide-section"><h3>What testing is for</h3><div class="learning-grid">
    <article class="mini-card"><h4>Check your main idea</h4><p>Does the team actually do what you built it to do?</p><ul><li>Can your core get onto the field safely?</li><li>Can your main attacker apply pressure?</li><li>Can your support Pokémon create useful turns?</li></ul></article>
    <article class="mini-card"><h4>Check your matchups</h4><p>Find which opposing Pokémon, cores, or archetypes give you trouble.</p><ul><li>fast offense</li><li>bulky balance</li><li>Trick Room</li><li>weather</li><li>setup teams</li><li>strong priority</li><li>defensive switching</li></ul></article>
    <article class="mini-card"><h4>Check your details</h4><p>See whether your moves, items, abilities, natures, and stat points are actually helping.</p><ul><li>moves you never click</li><li>items that never matter</li><li>abilities that do not support the plan</li><li>Pokémon that faint before doing their job</li><li>stat spreads that feel too slow, too weak, or too frail</li></ul></article>
    <article class="mini-card"><h4>Check your usage</h4><p>Notice which Pokémon you bring often and which Pokémon stay on the bench.</p><ul><li>a Pokémon you never bring may not fit</li><li>a Pokémon you always bring may need more support</li><li>a Pokémon that only works in one matchup may need to justify its slot</li></ul></article>
  </div></section>

  ${listBlock('Questions after each game', ['What four Pokémon did I bring?','Which two Pokémon did I leave behind?','Did my lead make sense?','Did my main idea work?','Did I have enough damage pressure?','Did I have enough speed control?','Did I create safe turns?','Did any Pokémon feel useless?','Did any move, item, or ability fail to matter?','What opposing Pokémon or strategy caused the biggest problem?','Was the loss caused by the team, the matchup, or my play?'])}

  <section class="team-guide-section"><h3>What to change first</h3><p>Do not rebuild the whole team after one bad game. Start with the smallest useful change.</p><ol class="team-guide-question-list"><li>Change how you lead or play the matchup.</li><li>Change a move that is not being used.</li><li>Change an item that is not helping.</li><li>Adjust nature or stat points if the Pokémon is too slow, weak, or frail.</li><li>Replace one Pokémon if it repeatedly fails its role.</li><li>Revisit the core only if the main idea itself is not working.</li></ol></section>

  <section class="team-guide-section"><h3>${sixth}</h3><p>Sometimes the team feels mostly right, but the final slot never seems to fit. This is common.</p><ul class="team-guide-question-list"><li>the core needs a different kind of support</li><li>the team lacks a clear backup plan</li><li>the team is trying to answer too many matchups at once</li><li>one earlier Pokémon is not doing enough</li><li>the team needs a different mode</li><li>the final slot needs to support the whole team, not just patch one weakness</li></ul><p>If the sixth Pokémon never gets brought or never helps, use the Metadex and Analysis tools to rethink what the team actually needs.</p></section>

  <section class="team-guide-section"><h3>When to move on</h3><div class="learning-grid"><article class="mini-card"><h4>Keep working on the team if</h4><ul><li>the main idea is fun or promising</li><li>the core works in some games</li><li>the problems seem fixable</li><li>you understand what needs changing</li><li>you are learning from the games</li></ul></article><article class="mini-card"><h4>Consider starting over if</h4><ul><li>the main idea almost never works</li><li>every fix creates a new problem</li><li>the team has no clear win condition</li><li>you dislike using the team</li><li>you cannot explain what the team is trying to do anymore</li></ul></article></div></section>

  <section class="team-guide-section"><h3>Simple ${testingLog}</h3><p>After a few games, write down:</p><div class="team-guide-chip-row">${['What I brought most often','What I rarely brought','What beat me most often','What worked well','What felt awkward','What I want to change next'].map((item)=>`<span class="score-pill">${escapeText(item)}</span>`).join('')}</div><p class="muted">This helps you adjust based on patterns instead of emotions after one loss.</p></section>

  ${listBlock('What to do now', ['Play games with the team.','Use Team Builder to make small changes.','Use Analysis to check whether changes create new weaknesses.','Use Matchups to review difficult opposing archetypes.','Use Damage to test important KOs or survival benchmarks.','Use the Metadex to find replacements if a Pokémon repeatedly fails its role.','Return to earlier guide steps if the main idea or core needs rebuilding.'])}

  <section class="team-guide-section"><h3>How to use the Metadex here</h3><p>If testing shows that a Pokémon is not doing its job, use the Metadex to find alternatives with a similar role, better synergy, better matchup value, or a clearer reason to be on the team.</p></section>`;
}
