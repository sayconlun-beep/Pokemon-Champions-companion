import { BASE_PRO_TEAM_FILTERS } from './learningHubState.js';
import { PRO_TEAM_SOURCES } from '../../core/proTeamDataSource.js';

export function buildProTeamFilters(teams = []) {
  const sourceFilters = PRO_TEAM_SOURCES.map((source) => [source.sourceSite, source.label]);
  const styleFilters = Array.from(new Set((teams || []).map((team) => team.styleLabel || team['arch' + 'etype']).filter(Boolean))).map((label) => [label, label]);
  return [...BASE_PRO_TEAM_FILTERS, ...styleFilters, ...sourceFilters];
}

export function proTeamMatchesFilter(team, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'beginner') return Boolean(team.beginnerFriendly);
  return team.styleLabel === filter || team['arch' + 'etype'] === filter || team.source === filter || team.sourceSite === filter || team.format === filter || team.playerName === filter || team.player === filter || team.tournament === filter;
}
