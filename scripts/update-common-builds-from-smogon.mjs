import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');
const distDir = path.join(root, 'dist', 'data');

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');

function readCollection(file, key) {
  const data = read(path.join(dataDir, file));
  const rows = Array.isArray(data) ? data : data?.[key];
  if (!Array.isArray(rows)) throw new Error(`Expected ${file} to contain an array or a "${key}" array.`);
  return rows;
}

function writeCollection(dir, file, key, rows) {
  const target = path.join(dir, file);
  if (fs.existsSync(target)) {
    const existing = read(target);
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      write(target, { ...existing, [key]: rows });
      return;
    }
  }
  write(target, rows);
}

const pokemon = readCollection('pokemon.json', 'pokemon');
const movesRows = readCollection('pokemon_moves.json', 'pokemon_moves');
const abilityRows = readCollection('pokemon_abilities.json', 'pokemon_abilities');
const items = readCollection('items.json', 'items').map(i => i.name).filter(Boolean);
const itemSet = new Set(items.map(s => s.toLowerCase()));

const movesByPid = new Map();
for (const row of movesRows) {
  if (row.is_legal !== 'Yes') continue;
  const arr = movesByPid.get(row.pokemon_id) || [];
  arr.push(row.move_name);
  movesByPid.set(row.pokemon_id, arr);
}
const abilitiesByPid = new Map();
for (const row of abilityRows) {
  if (row.is_legal !== 'Yes') continue;
  const arr = abilitiesByPid.get(row.pokemon_id) || [];
  arr.push(row.ability_name);
  abilitiesByPid.set(row.pokemon_id, arr);
}

const DEFAULT_SMOGON_CONFIG = {
  format: process.env.SMOGON_STATS_FORMAT || 'gen9championsvgc2026regma',
  rating: String(process.env.SMOGON_STATS_RATING || '1760'),
  month: process.env.SMOGON_STATS_MONTH || previousStatsMonth()
};

const args = parseArgs(process.argv.slice(2));
const smogonConfig = buildSmogonConfig(args);
const smogonSource = await loadSmogonSource(args, smogonConfig);
const smogonSets = smogonSource.sets;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') out.input = argv[++i];
    else if (arg.startsWith('--input=')) out.input = arg.slice('--input='.length);
    else if (arg === '--url') out.url = argv[++i];
    else if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    else if (arg === '--month') out.month = argv[++i];
    else if (arg.startsWith('--month=')) out.month = arg.slice('--month='.length);
    else if (arg === '--format') out.format = argv[++i];
    else if (arg.startsWith('--format=')) out.format = arg.slice('--format='.length);
    else if (arg === '--rating') out.rating = argv[++i];
    else if (arg.startsWith('--rating=')) out.rating = arg.slice('--rating='.length);
    else if (arg === '--help' || arg === '-h') {
      const defaults = buildSmogonConfig({});
      console.log(`Usage: node scripts/update-common-builds-from-smogon.mjs [--month YYYY-MM] [--format formatid] [--rating cutoff] [--input path/to/file.json] [--url https://www.smogon.com/stats/.../chaos/format-rating.json]\n\nSources:\n  --input   Read a local Smogon JSON dump for offline/dev testing.\n  --url     Fetch a specific Smogon stats JSON file.\n\nMonthly Smogon defaults:\n  --format  ${DEFAULT_SMOGON_CONFIG.format}\n  --rating  ${DEFAULT_SMOGON_CONFIG.rating}\n  --month   Previous completed UTC month (${defaults.month} today)\n\nDefault fetch URL:\n  ${defaults.url}\n\nEnvironment overrides:\n  SMOGON_STATS_FORMAT, SMOGON_STATS_RATING, SMOGON_STATS_MONTH, SMOGON_STATS_URL`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}. Use --help for usage.`);
    }
  }
  if (out.input && out.url) {
    throw new Error('Use either --input or --url, not both. Local input is for explicit offline/dev runs; CI should use --url or the default Smogon URL.');
  }
  return out;
}

function buildSmogonConfig(args = {}) {
  const config = {
    format: args.format || DEFAULT_SMOGON_CONFIG.format,
    rating: String(args.rating || DEFAULT_SMOGON_CONFIG.rating),
    month: args.month || DEFAULT_SMOGON_CONFIG.month
  };

  if (!/^\d{4}-\d{2}$/.test(config.month)) {
    throw new Error(`Invalid Smogon stats month: ${config.month}. Expected --month YYYY-MM, for example --month 2026-04.`);
  }
  if (!config.format || !/^[a-z0-9]+$/i.test(config.format)) {
    throw new Error(`Invalid Smogon format: ${config.format}. Expected a Showdown format id such as gen9championsvgc2026regma.`);
  }
  if (!/^\d+$/.test(config.rating)) {
    throw new Error(`Invalid Smogon rating cutoff: ${config.rating}. Expected a numeric cutoff such as 1760.`);
  }

  config.url = args.url || process.env.SMOGON_STATS_URL || buildSmogonStatsUrl(config);
  return config;
}

function buildSmogonStatsUrl({ month, format, rating }) {
  return `https://www.smogon.com/stats/${month}/chaos/${format}-${rating}.json`;
}

function previousStatsMonth(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function loadSmogonSource({ input, url }, config) {
  if (input) return readSmogonSourceFromFile(input, config);
  return fetchSmogonSource(url || config.url, config);
}

function buildCommonBuildsMetadata(config, sourceUrl) {
  return {
    source: 'Smogon stats',
    format: config.format,
    ratingCutoff: Number(config.rating),
    month: config.month,
    fetchedAt: new Date().toISOString(),
    sourceUrl
  };
}

function writeCommonBuildsMetadata(metadata) {
  const targets = [
    path.join(root, 'src', 'data', 'generated', 'showdown-common-builds-meta.json')
  ];
  if (fs.existsSync(distDir)) {
    targets.push(path.join(distDir, 'generated', 'showdown-common-builds-meta.json'));
  }

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    write(target, metadata);
  }
}

function readSmogonSourceFromFile(input, config) {
  const resolved = path.resolve(root, input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Smogon input file not found: ${resolved}. Pass --input path/to/file.json or omit --input to fetch from ${config.url}.`);
  }
  const data = read(resolved);
  const sourceUrl = `file://${resolved}`;
  validateSmogonSource(data, path.basename(resolved), config, { strictChaos: false });
  return {
    sets: buildSmogonSetMap(data, path.basename(resolved)),
    metadata: buildCommonBuildsMetadata(config, sourceUrl)
  };
}

async function fetchSmogonSource(sourceUrl, config) {
  if (!sourceUrl) {
    throw new Error('No Smogon source configured. Pass --input path/to/file.json, pass --url https://www.smogon.com/stats/.../chaos/format-rating.json, or set SMOGON_STATS_URL.');
  }
  let res;
  try {
    res = await fetch(sourceUrl, { headers: { accept: 'application/json' } });
  } catch (err) {
    throw new Error(`Could not fetch Smogon stats from ${sourceUrl}. Pass --input local/path/to/file.json for offline/dev testing. Original error: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Smogon stats fetch failed (${res.status} ${res.statusText}) for ${sourceUrl}. Pass --month YYYY-MM for an available monthly archive, --url with a specific Smogon stats JSON, or --input local/path/to/file.json.`);
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`Fetched Smogon data from ${sourceUrl}, but it was not valid JSON: ${err.message}`);
  }
  validateSmogonSource(data, sourceUrl, config, { strictChaos: true });
  try {
    return {
      sets: buildSmogonSetMap(data, sourceUrl),
      metadata: buildCommonBuildsMetadata(config, sourceUrl)
    };
  } catch (err) {
    throw new Error(`Fetched Smogon data from ${sourceUrl}, but it was not usable as common build data: ${err.message}`);
  }
}

function validateSmogonSource(data, sourceLabel, config, { strictChaos }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Smogon source ${sourceLabel} is malformed: expected a non-empty JSON object.`);
  }
  if (!Object.keys(data).length) {
    throw new Error(`Smogon source ${sourceLabel} is empty; refusing to update generated data.`);
  }

  const chaosData = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  if (chaosData) {
    validateChaosMetadata(data, sourceLabel, config);
    validateChaosPokemonData(chaosData, sourceLabel);
    return;
  }

  if (strictChaos) {
    throw new Error(`Smogon source ${sourceLabel} is malformed: expected official chaos JSON with a top-level "data" object for ${config.format}-${config.rating}.`);
  }

  validateLegacySetDump(data, sourceLabel);
}

function validateChaosMetadata(data, sourceLabel, config) {
  const info = data.info && typeof data.info === 'object' ? data.info : {};
  const formatCandidates = [info.format, info.formatid, info.name, data.format, data.formatid].filter(Boolean).map(String);
  if (formatCandidates.length && !formatCandidates.some(value => value.toLowerCase() === config.format.toLowerCase())) {
    throw new Error(`Smogon source ${sourceLabel} appears to be for ${formatCandidates.join(', ')}, not expected format ${config.format}. Refusing to update generated data.`);
  }

  const ratingCandidates = [info.cutoff, info.rating, data.cutoff, data.rating].filter(value => value !== undefined && value !== null).map(String);
  if (ratingCandidates.length && !ratingCandidates.includes(config.rating)) {
    throw new Error(`Smogon source ${sourceLabel} appears to use rating cutoff ${ratingCandidates.join(', ')}, not expected cutoff ${config.rating}. Refusing to update generated data.`);
  }
}

function validateChaosPokemonData(chaosData, sourceLabel) {
  const entries = Object.entries(chaosData).filter(([, stats]) => stats && typeof stats === 'object');
  if (!entries.length) {
    throw new Error(`Smogon source ${sourceLabel} has no Pokémon entries in its chaos data; refusing to update generated data.`);
  }

  const usableEntries = entries.filter(([, stats]) => {
    const moves = stats.Moves || stats.moves;
    const items = stats.Items || stats.items;
    const abilities = stats.Abilities || stats.abilities;
    return moves && items && abilities && Object.keys(moves).length && Object.keys(items).length && Object.keys(abilities).length;
  });

  if (!usableEntries.length) {
    throw new Error(`Smogon source ${sourceLabel} has Pokémon entries, but none include usable Moves, Items, and Abilities sections; refusing to update generated data.`);
  }
}

function validateLegacySetDump(data, sourceLabel) {
  const usable = Object.entries(data).some(([, sets]) => sets && typeof sets === 'object' && Object.keys(sets).length);
  if (!usable) {
    throw new Error(`Smogon input ${sourceLabel} does not contain usable local set dump data.`);
  }
}

function buildSmogonSetMap(data, sourceLabel) {
  if (!data || typeof data !== 'object') {
    throw new Error(`Smogon source ${sourceLabel} did not contain a JSON object.`);
  }

  if (data.data && typeof data.data === 'object') {
    return buildChaosSetMap(data.data, sourceLabel);
  }

  return buildSetDumpMap(data, sourceLabel);
}

function buildSetDumpMap(data, sourceLabel) {
  const out = new Map();
  for (const [species, sets] of Object.entries(data)) {
    if (!sets || typeof sets !== 'object') continue;
    const key = normalizeName(species);
    const bucket = out.get(key) || [];
    for (const [setName, set] of Object.entries(sets)) {
      bucket.push({ source: sourceLabel, species, setName, set });
    }
    out.set(key, bucket);
  }
  if (!out.size) throw new Error(`Smogon source ${sourceLabel} did not contain usable set data.`);
  return out;
}

function buildChaosSetMap(data, sourceLabel) {
  const out = new Map();
  for (const [species, stats] of Object.entries(data)) {
    if (!stats || typeof stats !== 'object') continue;
    const ability = topWeightedKey(stats.Abilities || stats.abilities);
    const item = topWeightedKey(stats.Items || stats.items);
    const moves = topWeightedKeys(stats.Moves || stats.moves, 8);
    if (!ability || !item || moves.length < 3) continue;

    const key = normalizeName(species);
    const bucket = out.get(key) || [];
    bucket.push({
      source: sourceLabel,
      species,
      setName: 'Smogon Chaos Usage',
      set: {
        ability,
        item,
        moves,
        nature: topSpreadNature(stats.Spreads || stats.spreads)
      }
    });
    out.set(key, bucket);
  }
  if (!out.size) throw new Error(`Smogon source ${sourceLabel} did not contain usable chaos usage data.`);
  return out;
}

function topWeightedKeys(obj, limit = 1) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([name]) => name && name !== 'Other')
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([name]) => name);
}

function topWeightedKey(obj) {
  return topWeightedKeys(obj, 1)[0] || '';
}

function topSpreadNature(spreads) {
  const spread = topWeightedKey(spreads);
  return spread ? spread.split(':')[0] : '';
}

function normalizeName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^mega/, '')
    .replace(/alolan/g, 'alola')
    .replace(/galarian/g, 'galar')
    .replace(/hisuian/g, 'hisui')
    .replace(/paldean/g, 'paldea');
}

function smogonKeysFor(entry) {
  const name = entry.name || '';
  const base = entry.base_species || name;
  const form = entry.form_name || '';
  const keys = new Set([normalizeName(name)]);
  if (entry.is_mega && form) {
    const megaSuffix = form.replace(/^Mega\s*/i, '').trim();
    keys.add(normalizeName(`${base}-Mega-${megaSuffix}`));
    keys.add(normalizeName(`Mega ${base} ${megaSuffix}`));
  }
  if (/Alola/i.test(form) || /Alolan/i.test(name)) keys.add(normalizeName(`${base}-Alola`));
  if (/Galar/i.test(form) || /Galarian/i.test(name)) keys.add(normalizeName(`${base}-Galar`));
  if (/Hisui/i.test(form) || /Hisuian/i.test(name)) keys.add(normalizeName(`${base}-Hisui`));
  if (/Paldea/i.test(form) || /Paldean/i.test(name)) keys.add(normalizeName(`${base}-Paldea`));
  keys.add(normalizeName(base));
  return [...keys];
}

function flattenMoves(moves) {
  const primary = [];
  const variants = [];
  for (const slot of Array.isArray(moves) ? moves : []) {
    if (Array.isArray(slot)) {
      if (slot[0]) primary.push(slot[0]);
      variants.push(...slot.slice(1));
    } else if (slot) {
      primary.push(slot);
    }
  }
  return { primary, variants };
}

function legalFilter(list, legalSet) {
  const out = [];
  for (const value of list || []) {
    if (!value) continue;
    const match = [...legalSet].find(x => x.toLowerCase() === String(value).toLowerCase());
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}

function unique(arr) { return [...new Set((arr || []).filter(Boolean))]; }
function snake(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

function roleName(setName, ability, item, moves) {
  const text = `${setName} ${ability} ${item} ${moves.join(' ')}`.toLowerCase();
  if (text.includes('trick room')) return 'Trick Room Utility';
  if (text.includes('tailwind')) return 'Tailwind Support';
  if (text.includes('aurora veil') || text.includes('reflect') || text.includes('light screen')) return 'Screens Support';
  if (text.includes('fake out') || text.includes('parting shot') || text.includes('follow me') || text.includes('rage powder')) return 'Bulky Support';
  if (text.includes('choice scarf')) return 'Choice Scarf Attacker';
  if (text.includes('choice band')) return 'Choice Band Attacker';
  if (text.includes('choice specs')) return 'Choice Specs Attacker';
  if (text.includes('swords dance') || text.includes('dragon dance') || text.includes('nasty plot') || text.includes('calm mind')) return 'Setup Sweeper';
  if (text.includes('life orb') || text.includes('focus sash')) return 'Offensive Pressure';
  if (text.includes('assault vest')) return 'Assault Vest Pivot';
  if (text.includes('leftovers') || text.includes('sitrus berry')) return 'Bulky Board Control';
  return setName || 'Standard Doubles Build';
}

function evStyle(nature, set, moves) {
  const evs = set?.evs || {};
  const textMoves = moves.join(' ').toLowerCase();
  const hasSpeed = (evs.spe || evs.spe === 0) && evs.spe >= 120;
  const offensive = (evs.atk || 0) >= 180 || (evs.spa || 0) >= 180;
  const bulky = (evs.hp || 0) >= 100 || (evs.def || 0) >= 80 || (evs.spd || 0) >= 80;
  if (hasSpeed && offensive) return `Fast offensive spread based on the listed ${nature || 'common'} nature, prioritising immediate pressure and key Speed control turns. Any remaining bulk should be aimed at surviving common neutral doubles hits.`;
  if (bulky && offensive) return `Bulky attacking spread that keeps meaningful damage output while investing enough bulk to stay active across repeated doubles trades. Speed can be tuned to the team’s chosen control mode.`;
  if (bulky) return `Bulk-first spread focused on staying on the field long enough to use its support moves reliably. Speed and offensive investment should be tuned only after the main survival benchmarks are met.`;
  if (textMoves.includes('trick room')) return `Low-Speed support spread that favours bulk and reliable Trick Room turns over raw Speed. Offensive investment is secondary unless this build is also expected to clean late-game.`;
  return `Balanced doubles spread using the listed nature as the main role signal. Tune Speed first, then split the remaining investment between damage and survival benchmarks.`;
}

function analyzerMeaning(name, role, moves, ability, item) {
  const t = `${role} ${moves.join(' ')} ${ability} ${item}`.toLowerCase();
  if (t.includes('aurora veil')) return `${name} usually signals screen-based snow support that makes its partner attacks and setup turns much safer.`;
  if (t.includes('tailwind')) return `${name} usually signals speed-control support that wants to create a short window for faster damage trades.`;
  if (t.includes('trick room')) return `${name} usually signals a slower board-control mode that can reverse Speed order and punish fast teams.`;
  if (t.includes('fake out') || t.includes('parting shot')) return `${name} usually signals positioning support that buys safer turns for a partner to attack or set up.`;
  if (t.includes('choice')) return `${name} usually signals immediate locked-in damage and should be scouted for the move it commits to.`;
  if (t.includes('life orb') || t.includes('focus sash')) return `${name} usually signals aggressive tempo pressure that may trade bulk for immediate impact.`;
  if (t.includes('leftovers') || t.includes('sitrus')) return `${name} usually signals a bulkier board-control role that aims to stay active through several turns.`;
  return `${name} usually signals a standard doubles role built around its most reliable legal pressure and support options.`;
}

const fallbackItems = ['Sitrus Berry', 'Focus Sash', 'Leftovers', 'Lum Berry', 'Mental Herb', 'Choice Scarf'];
function legalItemOptions(primary, oldItems = []) {
  const options = [];
  for (const x of [primary, ...oldItems, ...fallbackItems]) {
    if (x && itemSet.has(String(x).toLowerCase())) {
      const real = items.find(i => i.toLowerCase() === String(x).toLowerCase());
      if (!options.includes(real)) options.push(real);
    }
    if (options.length >= 3) break;
  }
  return options;
}

function oldBuildToNew(entry, old, priority, legalMoves, legalAbilities) {
  const movePool = unique([...(old.commonMoves || old.moves || []), ...(old.coreMoves || []), ...(old.commonFourthMoves || [])]);
  const commonMoves = legalFilter(movePool, legalMoves).slice(0, 4);
  if (commonMoves.length < 4 && legalMoves.has('Protect')) commonMoves.push('Protect');
  const variants = legalFilter([...(old.moveVariants || []), ...(old.commonFourthMoves || [])], legalMoves).filter(m => !commonMoves.includes(m)).slice(0, 4);
  const abilityOptions = legalFilter(old.abilityOptions || (old.ability ? [old.ability] : []), legalAbilities);
  const ability = legalAbilities.has(old.ability) ? old.ability : (abilityOptions[0] || [...legalAbilities][0] || '');
  if (ability && !abilityOptions.includes(ability)) abilityOptions.unshift(ability);
  const itemOptions = legalItemOptions(old.primaryItem || old.item, old.itemOptions || (old.item ? [old.item] : []));
  const primaryItem = itemOptions[0] || '';
  return {
    buildId: old.buildId || `${snake(entry.name)}_${snake(old.name || 'standard')}`,
    name: old.name || roleName('', ability, primaryItem, commonMoves),
    formatContext: ['Doubles', 'Pokemon Champions-style doubles'],
    ability,
    abilityOptions: abilityOptions.slice(0, 2),
    itemOptions,
    primaryItem,
    natureOptions: unique(old.natureOptions || ['Timid', 'Modest']).slice(0, 2),
    evSpreadStyle: old.evSpreadStyle || 'Use a doubles-focused spread that matches the item and role: tune Speed for the team plan first, then invest remaining points into damage and key survival benchmarks.',
    commonMoves: unique(commonMoves).slice(0, 4),
    moveVariants: variants,
    analyzerMeaning: old.analyzerMeaning || analyzerMeaning(entry.name, old.name || '', commonMoves, ability, primaryItem),
    recognitionPriority: priority,
    confidenceStatus: 'needs_official_review'
  };
}

let fromSmogon = 0, converted = 0;
for (const entry of pokemon) {
  const legalMoves = new Set(movesByPid.get(entry.pokemon_id) || []);
  const legalAbilities = new Set(abilitiesByPid.get(entry.pokemon_id) || []);
  const oldBuilds = Array.isArray(entry.commonBuilds) ? entry.commonBuilds : (Array.isArray(entry.commonBuilds?.builds) ? entry.commonBuilds.builds : []);
  const candidates = [];
  for (const key of smogonKeysFor(entry)) candidates.push(...(smogonSets.get(key) || []));

  const builds = [];
  const seenCombos = new Set();
  for (const cand of candidates) {
    if (builds.length >= 4) break;
    const set = cand.set || {};
    const abilityMatches = legalFilter([set.ability], legalAbilities);
    if (!abilityMatches.length) continue;
    const primaryItem = itemSet.has(String(set.item || '').toLowerCase()) ? items.find(i => i.toLowerCase() === String(set.item).toLowerCase()) : '';
    if (!primaryItem) continue;
    const { primary, variants } = flattenMoves(set.moves);
    let commonMoves = legalFilter(primary, legalMoves).slice(0, 4);
    if (commonMoves.length < 3) continue;
    if (commonMoves.length < 4 && legalMoves.has('Protect') && !commonMoves.includes('Protect')) commonMoves.push('Protect');
    commonMoves = unique(commonMoves).slice(0, 4);
    const ability = abilityMatches[0];
    const combo = `${ability}|${primaryItem}`;
    if (seenCombos.has(combo)) continue;
    seenCombos.add(combo);
    const oldRelated = oldBuilds.find(b => (b.itemOptions || []).includes(primaryItem) || (b.abilityOptions || []).includes(ability)) || {};
    const itemOptions = legalItemOptions(primaryItem, oldRelated.itemOptions || oldBuilds.flatMap(b => b.itemOptions || []));
    const abilityOptions = unique([ability, ...legalFilter(oldRelated.abilityOptions || [], legalAbilities), ...[...legalAbilities]]).slice(0, 2);
    const natureOptions = unique([set.nature, ...(oldRelated.natureOptions || [])]).filter(Boolean).slice(0, 2);
    const role = roleName(cand.setName, ability, primaryItem, commonMoves);
    builds.push({
      buildId: `${snake(entry.name)}_${snake(role || cand.setName)}_${snake(primaryItem)}`,
      name: role,
      formatContext: ['Doubles', 'Pokemon Champions-style doubles'],
      ability,
      abilityOptions,
      itemOptions,
      primaryItem,
      natureOptions: natureOptions.length ? natureOptions : ['Timid', 'Modest'],
      evSpreadStyle: evStyle(set.nature, set, commonMoves),
      commonMoves,
      moveVariants: legalFilter(variants, legalMoves).filter(m => !commonMoves.includes(m)).slice(0, 4),
      analyzerMeaning: analyzerMeaning(entry.name, role, commonMoves, ability, primaryItem),
      recognitionPriority: builds.length + 1,
      confidenceStatus: 'needs_official_review'
    });
  }

  for (const old of oldBuilds) {
    if (builds.length >= 4) break;
    const convertedBuild = oldBuildToNew(entry, old, builds.length + 1, legalMoves, legalAbilities);
    const combo = `${convertedBuild.ability}|${convertedBuild.primaryItem}`;
    if (!convertedBuild.ability || !convertedBuild.primaryItem || convertedBuild.commonMoves.length < 2 || seenCombos.has(combo)) continue;
    seenCombos.add(combo);
    builds.push(convertedBuild);
  }

  if (builds.length) {
    entry.commonBuilds = builds.map((b, i) => ({ ...b, recognitionPriority: i + 1 }));
    if (candidates.length) fromSmogon++;
    else converted++;
  }
}

const pokemonUpdated = pokemon.filter(p => Array.isArray(p.commonBuilds) && p.commonBuilds.length).length;
const totalGeneratedBuilds = pokemon.reduce((sum, p) => sum + (Array.isArray(p.commonBuilds) ? p.commonBuilds.length : 0), 0);

if (!pokemonUpdated || !totalGeneratedBuilds) {
  throw new Error('Common-build sync produced no generated builds; refusing to write empty output. Check the Smogon source, local fixture, and legality filters.');
}

writeCollection(dataDir, 'pokemon.json', 'pokemon', pokemon);
if (fs.existsSync(distDir)) writeCollection(distDir, 'pokemon.json', 'pokemon', pokemon);
writeCommonBuildsMetadata(smogonSource.metadata);

console.log(JSON.stringify({
  pokemonUpdated,
  totalGeneratedBuilds,
  fromSmogon,
  converted,
  metadata: smogonSource.metadata
}, null, 2));
