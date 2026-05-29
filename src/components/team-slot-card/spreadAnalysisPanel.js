import { getSlotStatAllocation } from '../../core/statAllocationEngine.js';
import { getPokemonDisplayName } from '../../utils/formGrouping.js';
import { escapeText, normalizeKey } from './teamSlotCardCommon.js';

export const NATURE_EFFECTS = {
  Adamant: { up: 'Attack', down: 'Sp. Attack' }, Modest: { up: 'Sp. Attack', down: 'Attack' }, Jolly: { up: 'Speed', down: 'Sp. Attack' }, Timid: { up: 'Speed', down: 'Attack' },
  Bold: { up: 'Defense', down: 'Attack' }, Calm: { up: 'Sp. Defense', down: 'Attack' }, Impish: { up: 'Defense', down: 'Sp. Attack' }, Careful: { up: 'Sp. Defense', down: 'Sp. Attack' },
  Brave: { up: 'Attack', down: 'Speed' }, Quiet: { up: 'Sp. Attack', down: 'Speed' }, Relaxed: { up: 'Defense', down: 'Speed' }, Sassy: { up: 'Sp. Defense', down: 'Speed' },
  Naive: { up: 'Speed', down: 'Sp. Defense' }, Hasty: { up: 'Speed', down: 'Defense' }, Mild: { up: 'Sp. Attack', down: 'Defense' }, Rash: { up: 'Sp. Attack', down: 'Sp. Defense' },
  Lonely: { up: 'Attack', down: 'Defense' }, Naughty: { up: 'Attack', down: 'Sp. Defense' }, Lax: { up: 'Defense', down: 'Sp. Defense' }, Gentle: { up: 'Sp. Defense', down: 'Defense' },
  Hardy: null, Docile: null, Serious: null, Bashful: null, Quirky: null
};

const STANDARD_NATURE_HINTS = {
  scizor: { nature: 'Adamant', reason: 'most Technician Scizor sets care more about stronger Bullet Punch damage than trying to win Speed races' },
  milotic: { nature: 'Timid', reason: 'many offensive support Milotic sets like moving before opposing mid-speed threats for Icy Wind, Scald, or Recover timing' }
};

export function spreadAnalysisPanel(slot, index, data, pokemon, team = []) {
  if (!pokemon) return '';
  const nature = slot?.nature || '';
  const allocation = getSlotStatAllocation(slot);
  const item = slot?.item_id ? data.indexes.itemsById?.[slot.item_id] : null;
  const standard = getStandardSpreadHint(pokemon);
  const role = inferSlotRole(slot, data, pokemon, allocation);
  const paragraphs = buildSpreadAnalysisCopy({ slot, data, pokemon, team, nature, allocation, item, standard, role });
  const chips = [
    role ? `Role: ${role}` : '',
    standard?.nature ? `Common nature: ${standard.nature}` : '',
    nature ? `Chosen: ${nature}` : 'Nature not selected'
  ].filter(Boolean);
  const labels = ['Nature impact', 'Why this fits the role', 'Tradeoffs', 'When to adjust'];
  return `<details class="spread-analysis-panel build-editor-section segmented-spread-analysis" data-spread-analysis-slot="${index}">
    <summary class="spread-analysis-summary"><span><i aria-hidden="true">◌</i><strong>Spread Analysis</strong><em>Plain-English nature and stat tradeoffs</em></span><span class="strategic-role-toggle" aria-hidden="true"></span></summary>
    <div class="spread-analysis-chips">${chips.map((chip) => `<span>${escapeText(chip)}</span>`).join('')}</div>
    <div class="spread-analysis-blocks">
      ${paragraphs.map((line, blockIndex) => `<section class="spread-analysis-block"><h5>${escapeText(labels[blockIndex] || 'Coaching note')}</h5><p>${escapeText(line)}</p></section>`).join('')}
    </div>
  </details>`;
}

function buildSpreadAnalysisCopy({ slot, data, pokemon, team, nature, allocation, item, standard, role }) {
  const name = getPokemonDisplayName(pokemon);
  const effect = NATURE_EFFECTS[nature] || null;
  const lines = [];
  if (!nature) {
    lines.push(`${name} does not have a nature selected yet. Pick the nature that supports its job: Speed natures for moving first, Attack or Sp. Attack natures for damage, and defensive natures for staying on the field longer.`);
  } else if (effect) {
    lines.push(`${nature} nature boosts ${effect.up} and lowers ${effect.down}. For this slot, that means ${natureFitText(effect, role, allocation, slot, data)}.`);
  } else {
    lines.push(`${nature} is a neutral nature, so it does not push ${name} toward damage, bulk, or Speed. That is legal, but usually weaker than choosing a nature that supports this Pokémon's role.`);
  }

  if (standard?.nature && nature && standard.nature !== nature) {
    lines.push(`${nature} is a discussion point rather than an error: the more common competitive direction is ${standard.nature}. ${standard.reason || `That standard choice usually supports ${name}'s most common role more directly.`} The tradeoff is that your version gains ${effect?.up || 'a different focus'} but gives up some of what the standard spread is trying to maximise.`);
  } else if (standard?.nature && nature === standard.nature) {
    lines.push(`${nature} lines up with the common competitive direction for ${name}. ${standard.reason || 'That makes the spread easy to understand and consistent with the role most players expect.'}`);
  } else if (standard?.summary) {
    lines.push(`The database describes the standard spread as: ${standard.summary}`);
  } else {
    lines.push(`No exact standard spread is stored for ${name}, so treat this as a role check: the chosen nature should match the attacks, item, and stat points you are actually using.`);
  }

  const speedLine = speedTradeoffLine({ nature, standard, allocation, team, data, pokemon });
  if (speedLine) lines.push(speedLine);
  const itemLine = itemSpreadLine(item, pokemon, nature, standard);
  if (itemLine) lines.push(itemLine);
  return lines;
}

function natureFitText(effect, role, allocation, slot, data) {
  const moves = (slot?.moves || []).map((id) => data?.indexes?.movesById?.[id]).filter(Boolean);
  const damaging = moves.filter((move) => String(move.category || '').toLowerCase() !== 'status');
  const hasPhysical = damaging.some((move) => /physical/i.test(move.category || ''));
  const hasSpecial = damaging.some((move) => /special/i.test(move.category || ''));
  if (effect.up === 'Speed') return 'it is trying to move earlier, which fits fast attackers, disruption leads, and Pokémon that need to land support before taking a hit';
  if (effect.up === 'Attack') return hasPhysical ? 'its physical moves hit harder, so priority and contact attacks become more threatening' : 'it boosts physical damage, but this set does not currently show many physical attacks to use that boost';
  if (effect.up === 'Sp. Attack') return hasSpecial ? 'its special attacks hit harder, so moves like spread damage, Water/Ice pressure, or special coverage become more punishing' : 'it boosts special damage, but this set does not currently show many special attacks to use that boost';
  if (effect.up === 'Defense' || effect.up === 'Sp. Defense') return `it leans into staying power, which fits ${role && /support|bulky|defensive/i.test(role) ? role.toLowerCase() : 'bulkier board-control roles'}`;
  return `it pushes the build toward ${role || 'a specific role'}`;
}

function getStandardSpreadHint(pokemon) {
  const key = normalizeKey(pokemon?.name || pokemon?.base_species || '');
  if (STANDARD_NATURE_HINTS[key]) return STANDARD_NATURE_HINTS[key];
  const common = pokemon?.commonBuilds;
  const builds = Array.isArray(common) ? common : Array.isArray(common?.builds) ? common.builds : [];
  const build = builds.find((entry) => Array.isArray(entry.natureOptions) && entry.natureOptions.length) || builds[0] || null;
  if (!build) return null;
  const nature = build.primaryNature || build.nature || (Array.isArray(build.natureOptions) ? build.natureOptions[0] : '');
  const summary = build.evSpreadStyle || build.spreadStyle || build.strategicIdentity || build.name || '';
  const reason = build.strategicIdentity || build.analyzerMeaning || build.analyserMeaning || '';
  return { nature, summary, reason };
}

function inferSlotRole(slot, data, pokemon, allocation) {
  const moves = (slot?.moves || []).map((id) => data?.indexes?.movesById?.[id]).filter(Boolean);
  const names = moves.map((move) => String(move.name || '').toLowerCase()).join(' ');
  const categories = moves.map((move) => String(move.category || '').toLowerCase());
  const hasSupport = /protect|tailwind|icy wind|aurora veil|reflect|light screen|taunt|haze|recover|parting shot|fake out|follow me|rage powder|wide guard/.test(names) || categories.filter((cat) => cat === 'status').length >= 2;
  const physical = categories.filter((cat) => cat === 'physical').length + ((allocation.attack || 0) >= 20 ? 1 : 0);
  const special = categories.filter((cat) => cat === 'special').length + ((allocation.specialAttack || 0) >= 20 ? 1 : 0);
  const bulky = (allocation.hp || 0) + (allocation.defense || 0) + (allocation.specialDefense || 0) >= 32;
  const fast = (allocation.speed || 0) >= 20;
  if (hasSupport && fast) return 'fast support';
  if (hasSupport && bulky) return 'bulky support';
  if (physical > special && fast) return 'fast Attack pressure';
  if (special > physical && fast) return 'fast Sp. Attack pressure';
  if (physical > special) return 'Attack pressure';
  if (special > physical) return 'Sp. Attack pressure';
  if (bulky) return 'defensive pivot';
  return 'flex role';
}

function speedTradeoffLine({ nature, standard, allocation, team, data, pokemon }) {
  const speedInvested = (allocation.speed || 0) >= 20;
  const chosenSpeed = ['Jolly','Timid','Naive','Hasty'].includes(nature);
  const standardSpeed = ['Jolly','Timid','Naive','Hasty'].includes(standard?.nature || '');
  const teamSpeedControl = (team || []).some((slot) => (slot?.moves || []).some((id) => /tailwind|icy wind|trick room|electroweb|thunder wave|aurora veil/i.test(data?.indexes?.movesById?.[id]?.name || '')));
  if (standardSpeed && !chosenSpeed) {
    return `The main cost is Speed. Compared with ${standard.nature}, this build may let some opposing mid-speed Pokémon move first. That can be fine when the team already has speed control${teamSpeedControl ? ', which this team appears to have' : ''}, but it is worth watching in practice.`;
  }
  if (chosenSpeed && !standardSpeed) {
    return `The upside is earlier movement. The cost is usually damage or bulk, so this is best when moving first matters more than squeezing out maximum damage.`;
  }
  if (speedInvested && !chosenSpeed) {
    return `You have invested in Speed without a Speed-boosting nature. That is not wrong, but it means the build is partly fast rather than fully committed to winning Speed checks.`;
  }
  return '';
}

function itemSpreadLine(item, pokemon, nature, standard) {
  const itemName = item?.name || '';
  const mon = normalizeKey(pokemon?.name || '');
  if (/king'?s rock/i.test(itemName)) {
    return `${itemName} points the build toward flinch pressure rather than pure consistency. On multi-hit or priority users this can be defensible, but a damage item or safer utility item is usually the more standard competitive choice.`;
  }
  if (/sitrus berry|leftovers/i.test(itemName)) {
    return `${itemName} supports staying on the board longer, so slower or bulkier natures become easier to justify if this Pokémon is meant to stabilise rather than sweep immediately.`;
  }
  if (/life orb|choice specs|choice band|expert belt|muscle band|wise glasses/i.test(itemName)) {
    return `${itemName} reinforces the damage plan, so a damage-boosting nature is easier to justify than a purely defensive one.`;
  }
  return '';
}
