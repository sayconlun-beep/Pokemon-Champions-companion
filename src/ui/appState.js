export function createInitialAppState({ initialRouteId = 'team-builder', slotUiState = [] } = {}) {
  return {
    data: null,
    team: Array.from({ length: 6 }, () => null),
    route: initialRouteId,
    builderFocus: [],
    metadex: { search: '', legality: 'all', field: 'all', selectedId: '', megaOnly: false },
    items: { search: '', category: 'all', use: 'any', sort: 'alphabetical', selectedId: '' },
    slotUiState,
    importExport: { mode: 'champions', draft: '', lastResult: null },
    shareUrlNotice: '',
    shareUrlWarning: '',
    teamBuildingGuideStep: 1,
    suggestedPartnersExpanded: false,
    learningHubExpanded: null,
    proTeamLibraryState: { status: 'idle', teams: [], error: '' },
    importedProTeamState: { status: 'idle', teams: [], lastImportedAt: '' },
    proStudySelectionState: { filter: 'all', selectedId: '', notice: '', activeSandbox: null },
    matchupsScenario: { selectedOpponentId: '' }
  };
}

export function createAppState(initialState = {}) {
  let state = initialState && typeof initialState === 'object' ? initialState : {};
  const subscribers = new Set();

  function notify() {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(state);
      } catch (error) {
        setTimeout(() => { throw error; }, 0);
      }
    });
  }

  return {
    get() {
      return state;
    },

    set(patch = {}) {
      if (!patch || typeof patch !== 'object') return state;
      Object.assign(state, patch);
      notify();
      return state;
    },

    update(updater) {
      if (typeof updater !== 'function') return state;
      const nextState = updater(state);
      if (nextState && nextState !== state && typeof nextState === 'object') {
        Object.keys(state).forEach((key) => delete state[key]);
        Object.assign(state, nextState);
      }
      notify();
      return state;
    },

    subscribe(subscriber) {
      if (typeof subscriber !== 'function') return () => {};
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }
  };
}
