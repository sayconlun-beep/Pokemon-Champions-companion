const MEGA_ITEM_SUFFIX = 'ite';

export function buildMegaEvolutionIndex(data = {}) {
  const pokemon = data.collections?.pokemon || [];
  const items = data.collections?.items || [];
  const pokemonById = data.indexes?.pokemonById || Object.fromEntries(pokemon.map((row) => [row.pokemon_id, row]));
  const itemsById = data.indexes?.itemsById || Object.fromEntries(items.map((row) => [row.item_id, row]));
  const megaForms = pokemon.filter(isMegaPokemon);
  const baseForms = pokemon.filter((row) => !isMegaPokemon(row));
  const baseBySpecies = new Map(baseForms.map((row) => [normalizeSpecies(row.base_species || row.name), row]));
  const stoneRows = items.filter(isMegaStoneItem);
  const stoneByBase = new Map();

  for (const item of stoneRows) {
    const base = baseSpeciesFromStone(item);
    if (base) stoneByBase.set(normalizeSpecies(base), item);
  }

  const byBaseId = new Map();
  const byMegaId = new Map();
  const megaStoneIds = new Set(stoneRows.map((item) => item.item_id));

  for (const mega of megaForms) {
    const baseSpecies = mega.base_species || inferBaseSpeciesFromMegaName(mega.name);
    const base = baseBySpecies.get(normalizeSpecies(baseSpecies));
    const stone = resolveStoneForMega(mega, stoneByBase, stoneRows);
    const record = {
      basePokemonId: base?.pokemon_id || '',
      baseName: base?.name || baseSpecies || 'Unknown base',
      megaPokemonId: mega.pokemon_id,
      megaName: mega.name,
      requiredItemId: stone?.item_id || '',
      requiredItemName: stone?.name || '',
      dataComplete: Boolean(base?.pokemon_id && stone?.item_id)
    };
    if (base?.pokemon_id) {
      if (!byBaseId.has(base.pokemon_id)) byBaseId.set(base.pokemon_id, []);
      byBaseId.get(base.pokemon_id).push(record);
    }
    byMegaId.set(mega.pokemon_id, record);
  }

  return { byBaseId, byMegaId, megaStoneIds, itemsById, pokemonById };
}

export function isMegaPokemon(pokemon) {
  return String(pokemon?.is_mega || '').toLowerCase() === 'yes' || /^mega\s/i.test(String(pokemon?.name || ''));
}

export function isMegaStoneItem(item) {
  const name = String(item?.name || '');
  const effect = String(item?.effect || '');
  return Boolean(item?.item_id) && (/mega evolve/i.test(effect) || /ite$/i.test(name)) && !/white herb/i.test(name);
}

export function getMegaOptions(pokemonId, data) {
  return buildMegaEvolutionIndex(data).byBaseId.get(pokemonId) || [];
}

export function getMegaRequirement(pokemonId, data) {
  return buildMegaEvolutionIndex(data).byMegaId.get(pokemonId) || null;
}

export function getSlotMegaState(slot, data) {
  if (!slot?.pokemon_id) return { status: 'none', options: [], warnings: [] };
  const index = buildMegaEvolutionIndex(data);
  const pokemon = index.pokemonById[slot.pokemon_id];
  const itemId = slot.item_id || '';
  const options = index.byBaseId.get(slot.pokemon_id) || [];
  const megaRequirement = index.byMegaId.get(slot.pokemon_id) || null;
  const heldStone = itemId ? index.itemsById[itemId] : null;
  const warnings = [];

  if (megaRequirement) {
    if (!megaRequirement.dataComplete) warnings.push('Mega data incomplete for this form.');
    if (megaRequirement.requiredItemId && itemId !== megaRequirement.requiredItemId) warnings.push(`${megaRequirement.megaName} requires ${megaRequirement.requiredItemName}.`);
    return { status: itemId === megaRequirement.requiredItemId ? 'mega-form-legal' : 'mega-form-illegal', pokemon, activeMega: megaRequirement, options: [], warnings };
  }

  const matchingOption = options.find((option) => option.requiredItemId && option.requiredItemId === itemId);
  if (matchingOption) return { status: 'preview-active', pokemon, activeMega: matchingOption, options, warnings };

  if (index.megaStoneIds.has(itemId)) {
    const itemName = heldStone?.name || itemId;
    warnings.push(`${pokemon?.name || 'This Pokémon'} cannot use ${itemName}.`);
    return { status: 'wrong-stone', pokemon, options, warnings };
  }

  if (options.length) return { status: 'eligible', pokemon, options, warnings };
  return { status: 'none', pokemon, options: [], warnings };
}

export function analyseTeamMegaState(team = [], data = {}) {
  const states = team.map((slot, index) => ({ index, slot, ...getSlotMegaState(slot, data) }));
  const claimed = states.filter((state) => state.activeMega || state.status === 'wrong-stone');
  const active = states.filter((state) => state.activeMega && ['preview-active', 'mega-form-legal', 'mega-form-illegal'].includes(state.status));
  const warnings = [];
  if (active.length > 1) warnings.push(`Only one Mega Evolution is allowed per team; ${active.length} Mega slots are currently claimed.`);
  for (const state of states) warnings.push(...(state.warnings || []).map((warning) => `Slot ${state.index + 1}: ${warning}`));
  return { states, active, claimed, warnings, hasMega: active.length > 0, primaryMega: active[0]?.activeMega || null, conflict: active.length > 1 };
}

export function candidateConflictsWithTeamMega(candidate, team, data) {
  const teamMega = analyseTeamMegaState(team, data);
  const isMega = Boolean(getMegaRequirement(candidate?.pokemon_id, data));
  const canMega = getMegaOptions(candidate?.pokemon_id, data).length > 0;
  return teamMega.hasMega && (isMega || canMega);
}

function resolveStoneForMega(mega, stoneByBase, stoneRows) {
  const name = String(mega.name || '');
  const base = normalizeSpecies(mega.base_species || inferBaseSpeciesFromMegaName(name));
  if (/Charizard X/i.test(name)) return findStone(stoneRows, 'Charizardite X') || stoneByBase.get(base);
  if (/Charizard Y/i.test(name)) return findStone(stoneRows, 'Charizardite Y') || stoneByBase.get(base);
  if (/Mewtwo X/i.test(name)) return findStone(stoneRows, 'Mewtwonite X') || stoneByBase.get(base);
  if (/Mewtwo Y/i.test(name)) return findStone(stoneRows, 'Mewtwonite Y') || stoneByBase.get(base);
  return stoneByBase.get(base) || null;
}

function findStone(stones, name) { return stones.find((item) => normalizeSpecies(item.name) === normalizeSpecies(name)); }
function inferBaseSpeciesFromMegaName(name) { return String(name || '').replace(/^Mega\s+/i, '').replace(/\s+[XY]$/i, '').trim(); }
function baseSpeciesFromStone(item) { const effect = String(item?.effect || ''); const match = effect.match(/Allows\s+(.+?)\s+to\s+Mega\s+Evolve/i); if (match) return match[1].trim(); return String(item?.name || '').replace(/ite$/i, '').replace(/nite$/i, 'n').trim(); }
function normalizeSpecies(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
