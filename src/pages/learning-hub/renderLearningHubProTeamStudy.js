import { buildTeamCoachingProfile } from '../../logic/teamCoachingProfile.js';
import { buildProTeamStudyPresentation } from '../../logic/tacticalPresenter.js';
import { getPokemonSpriteById } from '../../utils/pokemonSprites.js';
import { PRO_TEAM_SOURCES } from '../../core/proTeamDataSource.js';
import { buildProTeamFilters, proTeamMatchesFilter } from './renderLearningHubFilters.js';
import { escapeText, escapeAttr, getReadablePokemonIdName } from './learningHubHelpers.js';

export function mergeProTeamStateCollections(...collections) {
  const seen = new Set();
  return collections
    .flatMap((collection) => Array.isArray(collection) ? collection : [])
    .filter((team) => {
      const id = team?.id || '';
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function renderProTeamLearningHub(state) {
  const requestedFilter = state.proStudySelectionState?.filter || 'all';
  const libraryTeams = Array.isArray(state.proTeamLibraryState?.teams) ? state.proTeamLibraryState.teams : [];
  const importedTeams = Array.isArray(state.importedProTeamState?.teams) ? state.importedProTeamState.teams : [];
  const teams = mergeProTeamStateCollections(libraryTeams, importedTeams);
  const filters = buildProTeamFilters(teams);
  const validFilterValues = new Set(filters.map(([value]) => value));
  const filter = validFilterValues.has(requestedFilter) ? requestedFilter : 'all';
  const selectedId = state.proStudySelectionState?.selectedId || teams[0]?.id || '';
  const selected = teams.find((team) => team.id === selectedId) || teams[0] || null;
  const visibleTeams = teams.filter((team) => proTeamMatchesFilter(team, filter));
  const selectedTeam = visibleTeams.find((team) => team.id === selected?.id) || visibleTeams[0] || (filter === 'all' ? selected : null);
  const analysis = selectedTeam ? buildProTeamStudy(selectedTeam, state.data) : null;

  return `
    <section class="learning-section-panel pro-team-learning-hub" aria-labelledby="pro-team-learning-title">
      <div class="pro-team-hero">
        <div>
          <span class="section-kicker">Coaching library</span>
          <h2 id="pro-team-learning-title">Learn From Pro Teams</h2>
          <p>Study real tournament teams in a separate sandbox. Your own team and saved teams are not used here.</p>
        </div>
        <div class="pro-team-source-chips" aria-label="Supported sources">
          ${PRO_TEAM_SOURCES.map((source) => `<span>${escapeText(source.label)}</span>`).join('')}
        </div>
      </div>

      ${filters.length ? `
      <div class="pro-team-filter-row" aria-label="Browse pro teams">
        ${filters.map(([value, label]) => `<button class="pill-button ${filter === value ? 'active' : ''}" type="button" data-action="set-pro-team-filter" data-pro-team-filter="${escapeText(value)}">${escapeText(label)}</button>`).join('')}
      </div>` : ''}

      <div class="pro-team-library-layout">
        <div class="pro-team-list" aria-label="Pro team list">
          ${visibleTeams.map((team) => renderProTeamListCard(team, selectedTeam?.id === team.id)).join('') || renderNoProTeamsState(teams.length > 0)}
        </div>
        ${analysis ? renderProTeamStudyPanel(analysis, state) : renderProTeamImportFallback(teams.length > 0)}
      </div>
    </section>
  `;
}

export function renderProTeamListCard(team, active) {
  const tags = normalizeProTeamTags(team).slice(0, 4);
  return `
    <button class="pro-team-list-card pro-team-learning-card ${active ? 'active' : ''}" type="button" data-action="select-pro-team" data-pro-team-id="${escapeText(team.id)}">
      <span class="pro-team-card-topline">
        <span class="pro-team-source">${escapeText(team.source)}</span>
        <span class="pro-team-placement">${escapeText(team.placement)}</span>
      </span>
      <span class="pro-team-player-name">${escapeText(team.playerName || team.player)}</span>
      <span class="pro-team-event-name">${escapeText(team.tournament)}</span>
      <span class="pro-team-style-label">${escapeText(team.styleLabel)}</span>
      ${renderProTeamPreviewSprites(team)}
      <span class="pro-team-short-explanation">${escapeText(team.shortExplanation || explainProTeamCard(team))}</span>
      <span class="pro-team-card-tags" aria-label="Team tags">
        ${tags.map((tag) => `<em>${escapeText(tag)}</em>`).join('')}
      </span>
    </button>
  `;
}

export function renderProTeamPreviewSprites(team) {
  return `
    <span class="pro-team-preview-sprites" aria-label="Team preview">
      ${(team.pokemon || []).slice(0, 6).map((pokemonId) => renderProTeamSprite(pokemonId)).join('')}
    </span>
  `;
}

export function renderProTeamSprite(pokemonId) {
  const sprite = getPokemonSpriteById(pokemonId, { name: getReadablePokemonIdName(pokemonId) });
  return `<span class="pro-team-sprite-frame"><img class="pokemon-sprite pro-team-preview-sprite" src="${escapeText(sprite.src)}" alt="${escapeText(sprite.alt)}" loading="lazy" decoding="async" fetchpriority="low" width="42" height="42" data-pokemon-sprite data-pokemon-id="${escapeText(pokemonId)}" data-sprite-stage="home" /></span>`;
}

export function normalizeProTeamTags(team) {
  const tags = Array.isArray(team.tags) ? [...team.tags] : [];
  if (team.beginnerFriendly && !tags.some((tag) => /beginner/i.test(tag))) tags.unshift('Beginner Friendly');
  if (/speed|tailwind/i.test(team.styleLabel || '') && !tags.includes('Fast Pace')) tags.push('Fast Pace');
  return Array.from(new Set(tags));
}

export function explainProTeamCard(team) {
  if (/bulky|defensive/i.test(team.styleLabel || '')) return 'Uses safe switching and bulk to create a controlled late-game plan.';
  if (/speed|tailwind/i.test(team.styleLabel || '')) return 'Controls speed first so attackers can take safer knockout turns.';
  if (/offense|setup/i.test(team.styleLabel || '')) return 'Builds momentum quickly and turns support into attacking pressure.';
  return 'Shows a clear tournament game plan that newer players can study step by step.';
}

export function renderProTeamStudyPanel(study, state) {
  const sandbox = state.proStudySelectionState?.activeSandbox;
  const isActiveSandboxTeam = sandbox?.teamId === study.team.id;
  return `
    <article class="pro-team-study-panel pro-team-study-mode-panel" aria-labelledby="study-this-team-title">
      <div class="pro-team-study-header">
        <div>
          <span class="section-kicker">Guided study mode</span>
          <h3 id="study-this-team-title">Study This Team</h3>
          <p>${escapeText(study.team.playerName || study.team.player)} · ${escapeText(study.team.tournament)} · ${escapeText(study.team.placement)}</p>
        </div>
        <button class="primary-button" type="button" data-action="load-pro-team" data-pro-team-id="${escapeText(study.team.id)}">${isActiveSandboxTeam ? 'Reload Sandbox Study' : 'Study in Analysis'}</button>
      </div>

      <div class="pro-team-study-intro">
        <div>
          <strong>${escapeText(study.primaryStyle)}</strong>
          <p>${escapeText(study.beginnerSummary)}</p>
        </div>
        <span>Beginner mode</span>
      </div>

      <div class="pro-team-pokemon-row" aria-label="Pokémon list">
        ${study.members.map((member) => `<span>${escapeText(member)}</span>`).join('')}
      </div>

      <div class="pro-team-study-sections">
        ${renderProTeamStudySection('Team ' + 'Arch' + 'etype', study.primaryStyle, [study.styleExplanation || study.tacticalIdentity])}
        ${renderProTeamStudySection('How This Team Wins', 'The main game plan', study.winPlan)}
        ${renderProTeamStudySection('Key Pokémon Roles', 'What each important Pokémon does', study.keyPokemon)}
        ${renderProTeamStudySection('Common Opening Plans', 'Safe ways to start games', study.openingPlans)}
        ${renderProTeamStudySection('Common Mistakes To Avoid', 'Beginner traps to watch for', study.commonMistakes)}
        ${renderProTeamStudySection('Dangerous Matchups', 'What can make this team uncomfortable', study.dangerousMatchups)}
      </div>
    </article>
  `;
}

export function renderProTeamStudySection(title, label, items = []) {
  const safeItems = (Array.isArray(items) ? items : [items]).map(simplifyStudyText).filter(Boolean).slice(0, 5);
  return `
    <details class="pro-team-study-section" open>
      <summary>
        <span>${escapeText(title)}</span>
        <strong>${escapeText(label || 'Study focus')}</strong>
      </summary>
      <ul>${safeItems.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>
    </details>
  `;
}

export function renderProTeamInfoBlock(title, label, text) {
  return `
    <section class="pro-team-study-block">
      <span>${escapeText(title)}</span>
      <h4>${escapeText(label || 'Balanced Team')}</h4>
      <p>${escapeText(simplifyStudyText(text || 'Use the existing analysis systems to study this team in more detail.'))}</p>
    </section>
  `;
}

export function renderProTeamBulletBlock(title, items = []) {
  const safeItems = (Array.isArray(items) ? items : [items]).map(simplifyStudyText).filter(Boolean).slice(0, 4);
  return `
    <section class="pro-team-study-block">
      <span>${escapeText(title)}</span>
      <ul>${safeItems.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>
    </section>
  `;
}

export function buildProTeamStudy(team, data) {
  const slots = (team.roster?.length ? team.roster : team.pokemon.map((pokemonId) => ({ pokemon_id: pokemonId }))).map((slot) => ({ pokemon_id: slot.pokemon_id, moves: slot.moves || [], item_id: slot.item_id || '', ability_id: slot.ability_id || '', nature: slot.nature || '' }));
  const coachingProfile = buildTeamCoachingProfile(slots, { data });
  const members = slots.map((slot) => data?.indexes?.pokemonById?.[slot.pokemon_id]?.name).filter(Boolean);
  const studyPresentation = buildProTeamStudyPresentation(coachingProfile, { team, members });

  return {
    team,
    members,
    ...studyPresentation
  };
}

export function inferProTeamKeyPokemon(members, coachingProfile) {
  const names = new Set();
  (coachingProfile?.winConditions || []).forEach((condition) => {
    (condition?.pieces || []).forEach((name) => { if (name && names.size < 3) names.add(name); });
  });
  members.slice(0, 3).forEach((name) => names.add(name));
  return Array.from(names).slice(0, 4).map((name) => `${name} is worth studying because it shapes the team's safest game plan.`);
}

export function inferProTeamSpeedPlan(team, members) {
  const hasWhimsicott = members.some((name) => /whimsicott/i.test(name));
  const hasRaichu = members.some((name) => /raichu/i.test(name));
  const plan = [];
  if (hasWhimsicott) plan.push('Use Whimsicott to set up Tailwind before your main attackers commit.');
  if (hasRaichu) plan.push('Use Raichu to support safer turns and protect important attackers.');
  if (!plan.length) plan.push('Identify which Pokémon helps the team move first before taking big attacks.');
  plan.push('Once speed is controlled, focus on clean damage instead of unnecessary switching.');
  return plan.slice(0, 4);
}

export function buildProTeamBeginnerSummary(team, primaryStyle) {
  if (/bulky|defensive/i.test(primaryStyle || team.styleLabel || '')) {
    return 'This team tries to stay safe early, protect its important Pokémon, and win once the opponent has fewer good switches.';
  }
  if (/speed|tailwind/i.test(primaryStyle || team.styleLabel || '')) {
    return 'This team wants to control turn order first, then let its attackers move before the opponent can respond.';
  }
  if (/offense|setup/i.test(primaryStyle || team.styleLabel || '')) {
    return 'This team wants to start quickly, create safe attacking turns, and finish before the opponent stabilizes.';
  }
  return 'This team has a clear tournament plan: make safe early turns, protect key Pokémon, and choose the right moment to attack.';
}

export function inferProTeamOpeningPlans(team) {
  const leads = Array.isArray(team.commonLeads) ? team.commonLeads : [];
  const plans = leads.slice(0, 3).map((lead) => `${lead}: use this opening when you want a safer first turn and a clear path into your main attacker.`);
  if (!plans.length) plans.push('Lead with one support Pokémon and one attacker so you can either protect your attacker or start dealing damage.');
  plans.push('Before attacking hard, ask what your opponent can threaten on turn one.');
  return plans.slice(0, 4);
}

export function inferProTeamCommonMistakes(team, members) {
  const mistakes = [];
  if (members.some((name) => /whimsicott|raichu/i.test(name))) {
    mistakes.push('Do not let your speed-control Pokémon take too much damage early, or your attackers may move second later.');
  }
  if (members.some((name) => /kangaskhan/i.test(name))) {
    mistakes.push('Do not send your main cleaner into danger before the opponent has been weakened.');
  }
  if (/bulky|defensive/i.test(team.styleLabel || '')) {
    mistakes.push('Do not trade Pokémon too quickly; bulky teams usually get stronger when the game slows down.');
  }
  if (/offense|setup/i.test(team.styleLabel || '')) {
    mistakes.push('Do not switch too often once your attacking plan is ready, or you may lose momentum.');
  }
  mistakes.push('Avoid clicking strong attacks without checking whether the opponent has a safe switch or speed advantage.');
  return Array.from(new Set(mistakes)).slice(0, 4);
}

export function simplifyStudyText(text = '') {
  return String(text || '')
    .replace(/speed-control sequencing/gi, 'keeping your speed-control Pokémon healthy')
    .replace(/preserve speed control/gi, 'keep your speed-control Pokémon healthy')
    .replace(/tactical identity/gi, 'game plan')
    .replace(/pressure routing/gi, 'safe attacking plan')
    .replace(/conversion route/gi, 'path to winning')
    .replace(/conversion/gi, 'turning an advantage into a win')
    .replace(/positioning advantage/gi, 'safer board position')
    .replace(/pressure/gi, 'threat')
    .replace(/sequencing/gi, 'timing')
    .replace(/preserve/gi, 'keep')
    .trim();
}

export function normalizeStudyBullets(primary = [], fallback = []) {
  const combined = [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(combined)).slice(0, 4);
}

export function renderNoProTeamsState(hasTeamsForOtherFilters = false) {
  const message = hasTeamsForOtherFilters
    ? 'No pro teams match this filter yet.'
    : 'No pro teams available right now.';
  return `<article class="mini-card pro-team-empty-state"><p class="muted">${escapeText(message)}</p></article>`;
}

export function renderProTeamImportFallback(hasTeamsForOtherFilters = false) {
  const title = hasTeamsForOtherFilters ? 'No pro teams match this filter yet.' : 'No pro teams available right now.';
  const message = hasTeamsForOtherFilters
    ? 'Choose All teams or another available filter to open Study This Team.'
    : 'No bundled or imported pro teams were found. Add normalized pro team data to public/data/pro_teams.json or public/data/pro-sources/ to study real players and events here.';
  return `
    <article class="pro-team-study-panel pro-team-empty-panel">
      <div class="pro-team-study-header">
        <div>
          <span class="section-kicker">Real tournament sources</span>
          <h3>${escapeText(title)}</h3>
          <p>${escapeText(message)}</p>
        </div>
      </div>
    </article>
  `;
}
