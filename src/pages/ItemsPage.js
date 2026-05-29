const CATEGORY_OPTIONS = [
  ['all', 'All items'],
  ['damage', 'Damage'],
  ['safety', 'Safety'],
  ['recovery', 'Recovery'],
  ['utility', 'Utility'],
  ['speed', 'Speed'],
  ['defensive', 'Defensive'],
  ['status', 'Status'],
  ['setup', 'Setup'],
  ['type-boosting', 'Type-boosting'],
  ['choice', 'Choice items'],
  ['weather-terrain', 'Weather / Terrain'],
  ['berries', 'Berries'],
  ['other', 'Other']
];

const USE_OPTIONS = [
  ['any', 'Any use'],
  ['main-attacker', 'Main attacker'],
  ['setup-win-condition', 'Setup win condition'],
  ['bulky-support', 'Bulky support'],
  ['speed-control', 'Speed control user'],
  ['defensive-pivot', 'Defensive pivot'],
  ['late-game-cleaner', 'Late-game cleaner'],
  ['weakness-patch', 'Weakness patch'],
  ['utility-support', 'Utility support']
];

const SORT_OPTIONS = [
  ['alphabetical', 'Alphabetical'],
  ['category', 'Category'],
  ['useful', 'Most generally useful'],
  ['attackers', 'Best for attackers'],
  ['support', 'Best for support'],
  ['defensive', 'Best for defensive Pokémon']
];

const USE_LABELS = Object.fromEntries(USE_OPTIONS);
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS);

function renderItemsFilterSelect(id, label, options, value) {
  const selected = options.find(([optionValue]) => optionValue === value) || options[0];
  const menuId = `items-filter-${id}-menu`;
  return `
    <div class="field items-filter-select" data-items-filter="${escapeAttr(id)}">
      <span>${escapeText(label)}</span>
      <button
        type="button"
        class="items-filter-trigger selector-card-button"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="${escapeAttr(menuId)}"
        data-items-filter-trigger="${escapeAttr(id)}"
      >
        <span>${escapeText(selected?.[1] || label)}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="selector-dropdown items-filter-menu force-closed" role="listbox" id="${escapeAttr(menuId)}" aria-label="${escapeAttr(label)}">
        ${options.map(([optionValue, optionLabel]) => `
          <button
            type="button"
            class="selector-option items-filter-option ${optionValue === value ? 'selected' : ''}"
            role="option"
            aria-selected="${optionValue === value ? 'true' : 'false'}"
            data-items-filter-option="${escapeAttr(id)}"
            data-items-filter-value="${escapeAttr(optionValue)}"
          >
            <span class="selector-option-copy"><span class="selector-option-title">${escapeText(optionLabel)}</span></span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}


export function ItemsPage(state) {
  const view = normaliseItemsView(state.items || {});
  state.items = view;
  const items = (state.data?.collections?.items || []).filter((item) => !isMegaStoneItem(item)).map(enrichItem);
  const filtered = sortItems(filterItems(items, view), view.sort);
  const selected = view.selectedId ? items.find((item) => item.id === view.selectedId) : null;

  return `
    <section class="page-stack items-page">
      <header class="hero items-hero">
        <div>
          <span class="section-kicker">Held item database</span>
          <h1>Items</h1>
          <p>Browse held items, effects, and common team-building uses.</p>
          <p class="muted small-copy">Use this page to compare item effects before choosing builds in Team Builder or MetaDex.</p>
        </div>
      </header>

      <section class="card items-filter-card" aria-label="Item filters">
        <div class="filter-grid items-filter-grid">
          <label class="field search-field">
            <span>Search</span>
            <input type="search" value="${escapeAttr(view.search)}" aria-label="Search item, effect, or tag" data-items-search />
          </label>
          ${renderItemsFilterSelect('category', 'Category', CATEGORY_OPTIONS, view.category)}
          ${renderItemsFilterSelect('use', 'Team-building use', USE_OPTIONS, view.use)}
          ${renderItemsFilterSelect('sort', 'Sort', SORT_OPTIONS, view.sort)}
        </div>
        <p class="muted small-copy">Showing ${filtered.length} of ${items.length} held item${items.length === 1 ? '' : 's'}. These filters only browse information and never apply items to a Pokémon.</p>
      </section>

      ${selected ? renderItemDetail(selected) : ''}

      <section class="items-grid" aria-label="Held item list">
        ${filtered.map((item) => renderItemCard(item, view.selectedId)).join('') || '<article class="card"><h2>No items found</h2><p class="muted">Try clearing search or filters.</p></article>'}
      </section>
    </section>
  `;
}

function normaliseItemsView(view = {}) {
  return {
    search: String(view.search || ''),
    category: CATEGORY_OPTIONS.some(([value]) => value === view.category) ? view.category : 'all',
    use: USE_OPTIONS.some(([value]) => value === view.use) ? view.use : 'any',
    sort: SORT_OPTIONS.some(([value]) => value === view.sort) ? view.sort : 'alphabetical',
    selectedId: String(view.selectedId || '')
  };
}

function isMegaStoneItem(item = {}) {
  const name = String(item.name || item.item_id || '').trim();
  const id = String(item.item_id || '').trim();
  const effect = String(item.effect || item.effect_text || item.description || '');
  const text = `${name} ${id} ${effect}`.toLowerCase();
  return /mega stone|mega evolution/.test(text) || /ite$/i.test(name);
}

function enrichItem(item = {}) {
  const name = String(item.name || item.item_id || 'Unknown item');
  const effect = String(item.effect || item.effect_text || item.description || 'No effect text available.');
  const id = String(item.item_id || name);
  const text = `${name} ${effect}`.toLowerCase();
  const category = inferCategory(name, effect);
  const tags = inferTags(name, effect, category);
  const uses = inferUses(name, effect, category, tags);
  const practicalUse = practicalUseNote(name, effect, category, uses, tags);
  const score = usefulnessScore(name, effect, category, uses, tags);
  return { raw: item, id, name, effect, category, tags, uses, practicalUse, score, searchText: `${name} ${effect} ${category} ${tags.join(' ')} ${uses.join(' ')}`.toLowerCase() };
}

function inferCategory(name, effect) {
  const text = `${name} ${effect}`.toLowerCase();
  if (/choice\s+(band|specs|scarf)|holder can only use one move|selected move/.test(text)) return 'choice';
  if (/berry|berries|sitrus|figy|iapapa|mago|wiki|aguav|lum|chesto|resist.*super-effective|weakens.*super-effective/.test(text)) return 'berries';
  if (/weather|terrain|sun|rain|snow|sand|hail|light clay|heat rock|damp rock|icy rock|smooth rock/.test(text)) return 'weather-terrain';
  if (/boosts the power of the holder's .*type moves|plate|incense|black belt|black glasses|charcoal|magnet|miracle seed|mystic water|never-melt ice|poison barb|sharp beak|silk scarf|silver powder|soft sand|spell tag|twisted spoon/.test(text)) return 'type-boosting';
  if (/focus sash|survives with 1 hp|protective pads|air balloon|eject button|red card/.test(text)) return 'safety';
  if (/leftovers|shell bell|heal|restores hp|recovers hp|drain|black sludge/.test(text)) return 'recovery';
  if (/defense|special defense|assault vest|eviolite|rocky helmet|resist|reduces damage|weakness policy/.test(text)) return 'defensive';
  if (/speed|quick claw|choice scarf|tailwind|trick room|lagging tail|iron ball/.test(text)) return 'speed';
  if (/status|burn|poison|paralysis|sleep|freeze|confusion|flame orb|toxic orb|lum berry|safety goggles/.test(text)) return 'status';
  if (/setup|boosts.*attack|boosts.*special attack|boosts.*speed|life orb|muscle band|wise glasses|expert belt|scope lens|razor claw|metronome/.test(text)) return 'damage';
  if (/mental herb|white herb|clear amulet|covert cloak|room service|utility|accuracy|evasion|priority|protects from/.test(text)) return 'utility';
  return 'other';
}

function inferTags(name, effect, category) {
  const text = `${name} ${effect}`.toLowerCase();
  const tags = new Set();
  tags.add(CATEGORY_LABELS[category] || 'Other');
  if (/focus sash|survives with 1 hp/.test(text)) ['frail attacker','support','setup','speed control'].forEach((tag) => tags.add(tag));
  if (/choice band|life orb|expert belt|muscle band|wise glasses|boosts the power/.test(text)) ['attacker','damage pressure'].forEach((tag) => tags.add(tag));
  if (/choice specs/.test(text)) ['special damage user','damage pressure'].forEach((tag) => tags.add(tag));
  if (/choice scarf|speed/.test(text)) ['speed','late-game cleaner'].forEach((tag) => tags.add(tag));
  if (/leftovers|black sludge|recover|restores hp/.test(text)) ['bulky support','defensive pivot','long game'].forEach((tag) => tags.add(tag));
  if (/assault vest|eviolite|rocky helmet|resist|reduces damage/.test(text)) ['defensive pivot','bulk','weakness patch'].forEach((tag) => tags.add(tag));
  if (/light clay|screen|aurora veil/.test(text)) ['screens','support','team protection'].forEach((tag) => tags.add(tag));
  if (/heat rock|damp rock|icy rock|smooth rock|weather/.test(text)) ['weather support','team mode'].forEach((tag) => tags.add(tag));
  if (/lum berry|chesto berry|mental herb|status|taunt/.test(text)) ['utility support','status safety'].forEach((tag) => tags.add(tag));
  if (/weakness policy/.test(text)) ['setup win condition','bulky attacker','punish damage'].forEach((tag) => tags.add(tag));
  if (/protective pads|covert cloak|safety goggles|clear amulet/.test(text)) ['utility support','matchup tech'].forEach((tag) => tags.add(tag));
  return Array.from(tags).slice(0, 8);
}

function inferUses(name, effect, category, tags) {
  const text = `${name} ${effect} ${tags.join(' ')}`.toLowerCase();
  const uses = new Set();
  if (/attacker|damage|choice band|choice specs|life orb|expert belt|boosts the power/.test(text)) uses.add('main-attacker');
  if (/setup|weakness policy|focus sash|survives with 1 hp/.test(text)) uses.add('setup-win-condition');
  if (/support|leftovers|black sludge|light clay|mental herb|safety goggles|covert cloak/.test(text)) uses.add('bulky-support');
  if (/speed control|choice scarf|quick claw|speed/.test(text)) uses.add('speed-control');
  if (/defensive|pivot|leftovers|rocky helmet|assault vest|eviolite|resist/.test(text)) uses.add('defensive-pivot');
  if (/late-game cleaner|choice scarf|priority|damage pressure/.test(text)) uses.add('late-game-cleaner');
  if (/weakness patch|resist|berry|air balloon|water|fire|electric|ground/.test(text)) uses.add('weakness-patch');
  if (/utility|status|mental herb|clear amulet|covert cloak|red card|eject button/.test(text)) uses.add('utility-support');
  if (!uses.size) {
    if (category === 'damage' || category === 'choice' || category === 'type-boosting') uses.add('main-attacker');
    else if (category === 'defensive' || category === 'recovery') uses.add('defensive-pivot');
    else if (category === 'safety' || category === 'utility') uses.add('utility-support');
  }
  return Array.from(uses);
}

function practicalUseNote(name, effect, category, uses, tags) {
  const text = `${name} ${effect}`.toLowerCase();
  if (/focus sash|survives with 1 hp/.test(text)) return 'Useful on Pokémon that need to survive one hit to attack, set speed control, use setup, or land an important support move.';
  if (/choice band|choice specs/.test(text)) return 'Best on attackers that can repeatedly click one strong move and do not need flexible support turns.';
  if (/choice scarf/.test(text)) return 'Useful when an attacker or cleaner needs extra Speed more than move flexibility.';
  if (/leftovers|black sludge/.test(text)) return 'Fits bulky Pokémon that expect to stay on the field or switch in across a longer game.';
  if (/light clay/.test(text)) return 'Useful when screens or Aurora Veil are central to helping teammates survive and set up.';
  if (/weakness policy/.test(text)) return 'Works best on bulky attackers that can survive a super-effective hit and immediately punish the opponent.';
  if (/berry|weakens.*super-effective|resist/.test(text)) return 'Can patch a specific matchup or let a key Pokémon survive one dangerous hit.';
  if (category === 'type-boosting') return 'A straightforward damage boost when the Pokémon mainly attacks with that type and wants to keep move flexibility.';
  if (category === 'weather-terrain') return 'Useful only when the whole team gains enough value from extending or protecting that field condition.';
  if (category === 'damage') return 'Useful when the Pokémon’s job is to create immediate damage pressure or force knockouts.';
  if (category === 'defensive') return 'Useful when the Pokémon needs to switch in, absorb pressure, or stay useful over several turns.';
  if (category === 'utility') return 'Useful as a matchup or consistency tool when the Pokémon’s role depends on one key turn.';
  return 'Choose this when the effect directly supports the Pokémon’s job and the team does not need a more specialised item.';
}

function usefulnessScore(name, effect, category, uses, tags) {
  const text = `${name} ${effect} ${tags.join(' ')}`.toLowerCase();
  let score = 20;
  if (/focus sash|leftovers|sitrus berry|choice scarf|life orb|assault vest|safety goggles|clear amulet|covert cloak/.test(text)) score += 50;
  if (/choice band|choice specs|weakness policy|light clay|eviolite|rocky helmet/.test(text)) score += 38;
  if (['safety','recovery','damage','defensive','choice','utility'].includes(category)) score += 15;
  score += uses.length * 4;
  return score;
}

function filterItems(items, view) {
  const query = view.search.trim().toLowerCase();
  return items.filter((item) => {
    if (query && !item.searchText.includes(query)) return false;
    if (view.category !== 'all' && item.category !== view.category) return false;
    if (view.use !== 'any' && !item.uses.includes(view.use)) return false;
    return true;
  });
}

function sortItems(items, sort) {
  const copy = items.slice();
  const alpha = (a, b) => a.name.localeCompare(b.name);
  if (sort === 'category') return copy.sort((a, b) => (CATEGORY_LABELS[a.category] || '').localeCompare(CATEGORY_LABELS[b.category] || '') || alpha(a, b));
  if (sort === 'useful') return copy.sort((a, b) => b.score - a.score || alpha(a, b));
  if (sort === 'attackers') return copy.sort((a, b) => scoreUse(b, 'main-attacker') - scoreUse(a, 'main-attacker') || b.score - a.score || alpha(a, b));
  if (sort === 'support') return copy.sort((a, b) => scoreUse(b, 'utility-support') + scoreUse(b, 'bulky-support') - scoreUse(a, 'utility-support') - scoreUse(a, 'bulky-support') || b.score - a.score || alpha(a, b));
  if (sort === 'defensive') return copy.sort((a, b) => scoreUse(b, 'defensive-pivot') + scoreUse(b, 'weakness-patch') - scoreUse(a, 'defensive-pivot') - scoreUse(a, 'weakness-patch') || b.score - a.score || alpha(a, b));
  return copy.sort(alpha);
}

function scoreUse(item, use) {
  return item.uses.includes(use) ? 100 : 0;
}

function renderItemCard(item, selectedId) {
  const active = item.id === selectedId;
  return `
    <article class="card item-card ${active ? 'active' : ''}">
      <div class="item-card-head">
        <div>
          <span class="section-kicker">Item</span>
          <h2>${escapeText(item.name)}</h2>
        </div>
        <span class="badge">${escapeText(CATEGORY_LABELS[item.category] || 'Other')}</span>
      </div>
      <p><strong>Effect:</strong> ${escapeText(item.effect)}</p>
      <p class="muted small-copy"><strong>Practical use:</strong> ${escapeText(item.practicalUse)}</p>
      <div class="tag-row">${item.tags.slice(0, 5).map((tag) => `<span class="mini-tag">${escapeText(tag)}</span>`).join('')}</div>
      <button type="button" class="secondary-button" data-item-detail="${escapeAttr(item.id)}">${active ? 'Hide details' : 'Details'}</button>
    </article>
  `;
}

function renderItemDetail(item) {
  const alternatives = relatedAlternatives(item).map((name) => `<span class="mini-tag">${escapeText(name)}</span>`).join('');
  return `
    <section class="card item-detail-view" aria-label="Item detail">
      <div class="item-card-head">
        <div>
          <span class="section-kicker">Item detail</span>
          <h2>${escapeText(item.name)}</h2>
        </div>
        <button type="button" class="secondary-button" data-item-detail="">Close</button>
      </div>
      <p><strong>Full effect:</strong> ${escapeText(item.effect)}</p>
      <p><strong>Category:</strong> ${escapeText(CATEGORY_LABELS[item.category] || 'Other')}</p>
      <div class="detail-grid">
        <section>
          <h3>Good users</h3>
          <ul>${goodUsers(item).map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>
        </section>
        <section>
          <h3>Choose this item when</h3>
          <ul>${chooseWhen(item).map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>
        </section>
        <section>
          <h3>Be careful using this item when</h3>
          <ul>${carefulWhen(item).map((line) => `<li>${escapeText(line)}</li>`).join('')}</ul>
        </section>
        <section>
          <h3>Team Builder usage note</h3>
          <p class="muted">Use this as reference while choosing an item. This page never applies items automatically.</p>
          <h3>MetaDex usage note</h3>
          <p class="muted">When MetaDex suggests this item category, check whether the effect supports the exact role you are building.</p>
        </section>
      </div>
      <section>
        <h3>Related item alternatives</h3>
        <div class="tag-row">${alternatives || '<span class="muted small-copy">No close alternatives inferred from the current item database.</span>'}</div>
      </section>
    </section>
  `;
}

function goodUsers(item) {
  const out = [];
  if (item.uses.includes('main-attacker')) out.push('Pokémon whose main job is to apply damage pressure.');
  if (item.uses.includes('setup-win-condition')) out.push('Pokémon that need one safe turn to boost or become a win condition.');
  if (item.uses.includes('speed-control')) out.push('Pokémon that need to act before the opponent or enable Speed control.');
  if (item.uses.includes('defensive-pivot')) out.push('Pokémon that expect to switch in or stay useful across several turns.');
  if (item.uses.includes('utility-support')) out.push('Support Pokémon that need consistency more than raw damage.');
  return out.length ? out : ['Pokémon whose role directly benefits from this item effect.'];
}

function chooseWhen(item) {
  const lines = [item.practicalUse];
  if (item.category === 'safety') lines.push('The Pokémon is frail but has an important job to complete.');
  if (item.category === 'damage' || item.category === 'type-boosting') lines.push('The Pokémon already has reliable attacks and wants stronger pressure.');
  if (item.category === 'recovery' || item.category === 'defensive') lines.push('The Pokémon needs to absorb pressure, pivot, or survive multiple turns.');
  if (item.category === 'utility') lines.push('A specific matchup or disruption pattern would otherwise stop the Pokémon doing its job.');
  if (item.category === 'weather-terrain') lines.push('Your whole team gains enough value from the field condition to justify the item slot.');
  return unique(lines).slice(0, 4);
}

function carefulWhen(item) {
  const lines = [];
  if (item.category === 'choice') lines.push('The Pokémon needs to switch moves often or use Protect/support moves.');
  if (item.category === 'safety') lines.push('The Pokémon often takes chip damage before the important hit.');
  if (item.category === 'damage' || item.category === 'type-boosting') lines.push('The Pokémon’s main job is support, switching, or survival rather than attacking.');
  if (item.category === 'recovery') lines.push('The Pokémon is usually knocked out before passive recovery matters.');
  if (item.category === 'weather-terrain') lines.push('Only one or two teammates benefit from the field condition.');
  lines.push('Another item would make the Pokémon perform its chosen role more consistently.');
  return unique(lines).slice(0, 4);
}

function relatedAlternatives(item) {
  const byCategory = {
    safety: ['Focus Sash', 'Sitrus Berry', 'Resist berry'],
    damage: ['Life Orb', 'Expert Belt', 'Choice Band', 'Choice Specs'],
    recovery: ['Leftovers', 'Sitrus Berry', 'Black Sludge'],
    defensive: ['Assault Vest', 'Eviolite', 'Rocky Helmet', 'Resist berry'],
    choice: ['Choice Band', 'Choice Specs', 'Choice Scarf'],
    utility: ['Clear Amulet', 'Covert Cloak', 'Safety Goggles', 'Mental Herb'],
    'weather-terrain': ['Light Clay', 'Heat Rock', 'Damp Rock', 'Icy Rock', 'Smooth Rock'],
    'type-boosting': ['Life Orb', 'Expert Belt', 'type-boosting item']
  };
  return (byCategory[item.category] || []).filter((name) => name.toLowerCase() !== item.name.toLowerCase());
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeAttr(value) {
  return escapeText(value).replace(/'/g, '&#39;');
}
