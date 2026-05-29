import json, collections, re, pathlib
ROOT=pathlib.Path('/mnt/data/appwork/public/data')
DIST=pathlib.Path('/mnt/data/appwork/dist/data')
pokemon=json.load(open(ROOT/'pokemon.json'))
legal_moves=collections.defaultdict(list)
for r in json.load(open(ROOT/'pokemon_moves.json')):
    if r.get('is_legal')=='Yes' and r['move_name'] not in legal_moves[r['pokemon_id']]: legal_moves[r['pokemon_id']].append(r['move_name'])
legal_abilities=collections.defaultdict(list)
for r in json.load(open(ROOT/'pokemon_abilities.json')):
    if r.get('is_legal')=='Yes' and r['ability_name'] not in legal_abilities[r['pokemon_id']]: legal_abilities[r['pokemon_id']].append(r['ability_name'])
items=[i['name'] for i in json.load(open(ROOT/'items.json')) if i.get('name')]
item_lower={i.lower():i for i in items}
REQ=['buildId','name','formatContext','ability','abilityOptions','itemOptions','primaryItem','natureOptions','evSpreadStyle','commonMoves','moveVariants','analyzerMeaning','recognitionPriority','confidenceStatus']
FALLBACK_ITEMS=['Sitrus Berry','Focus Sash','Leftovers','Lum Berry','Mental Herb','Choice Scarf','Shell Bell','Charcoal','Mystic Water','Miracle Seed','Never-Melt Ice','Poison Barb','Dragon Fang']
MOVE_PREF=['Protect','Fake Out','Follow Me','Rage Powder','Tailwind','Trick Room','Icy Wind','Thunder Wave','Will-O-Wisp','Helping Hand','Taunt','Encore','Nasty Plot','Swords Dance','Dragon Dance','Calm Mind','Heat Wave','Blizzard','Dazzling Gleam','Moonblast','Thunderbolt','Psychic','Shadow Ball','Flamethrower','Giga Drain','Energy Ball','Sludge Bomb','Earth Power','Rock Slide','Close Combat','Waterfall','Hydro Pump','Ice Beam','Earthquake','Dragon Pulse','Air Slash','Brave Bird','Crunch','Dark Pulse','Iron Head','Body Press']
def snake(s): return re.sub(r'_+','_',re.sub(r'[^a-z0-9]+','_',str(s or '').lower())).strip('_') or 'build'
def as_list(x):
    if not x: return []
    if isinstance(x,list): return x
    return [x]
def legal_name(name, pool):
    for v in pool:
        if str(v).lower()==str(name).lower(): return v
    return None
def legal_moves_from(pid, raw):
    pool=legal_moves[pid]
    out=[]
    def add(x):
        if isinstance(x,list):
            for y in x: add(y)
        else:
            m=legal_name(x, pool)
            if m and m not in out: out.append(m)
    add(raw)
    return out
def legal_items_from(raw):
    out=[]
    for x in as_list(raw):
        real=item_lower.get(str(x).lower())
        if real and real not in out: out.append(real)
    for x in FALLBACK_ITEMS:
        if x in items and x not in out: out.append(x)
        if len(out)>=3: break
    return out[:3]
def fill_moves(pid, current):
    out=list(dict.fromkeys(current))
    pool=legal_moves[pid]
    for pref in MOVE_PREF:
        m=legal_name(pref,pool)
        if m and m not in out: out.append(m)
        if len(out)>=4: break
    for m in pool:
        if m not in out: out.append(m)
        if len(out)>=4: break
    return out[:4]
def coerce(p,b,idx):
    pid=p['pokemon_id']; abilities=legal_abilities[pid]
    old_id=b.get('buildId') or b.get('id') or f"{snake(p.get('name'))}_{idx}"
    ability=legal_name(b.get('ability'), abilities) or (legal_name((b.get('abilityOptions') or [''])[0], abilities) if b.get('abilityOptions') else None) or (abilities[0] if abilities else '')
    ability_opts=[]
    for a in [ability]+as_list(b.get('abilityOptions')):
        real=legal_name(a,abilities)
        if real and real not in ability_opts: ability_opts.append(real)
    for a in abilities:
        if a not in ability_opts: ability_opts.append(a)
        if len(ability_opts)>=2: break
    item_opts=legal_items_from([b.get('primaryItem'), b.get('item'), *as_list(b.get('itemOptions'))])
    primary=item_opts[0] if item_opts else ''
    raw_moves=[]
    for key in ('commonMoves','coreMoves','moves'):
        raw_moves += as_list(b.get(key))
    common=fill_moves(pid, legal_moves_from(pid, raw_moves))
    variant_raw=[]
    for key in ('moveVariants','commonFourthMoves'):
        variant_raw += as_list(b.get(key))
    variants=[m for m in legal_moves_from(pid, variant_raw) if m not in common][:4]
    if not variants:
        variants=[m for m in legal_moves[pid] if m not in common][:2]
    natures=[n for n in as_list(b.get('natureOptions')) if isinstance(n,str)] or ['Timid','Modest']
    return {
        'buildId': old_id if old_id else f"{snake(p.get('name'))}_{idx}",
        'name': b.get('name') or 'Standard Doubles Build',
        'formatContext': ['Doubles','Pokemon Champions-style doubles'],
        'ability': ability,
        'abilityOptions': ability_opts[:2],
        'itemOptions': item_opts,
        'primaryItem': primary,
        'natureOptions': natures[:2],
        'evSpreadStyle': b.get('evSpreadStyle') or 'Use a doubles-focused spread that matches the item and role: tune Speed for the team plan first, then invest remaining points into damage and key survival benchmarks.',
        'commonMoves': common,
        'moveVariants': variants,
        'analyzerMeaning': b.get('analyzerMeaning') or b.get('strategicIdentity') or f"{p.get('name')} usually signals a Champions-legal doubles role based on its selected item, ability, and revealed moves.",
        'recognitionPriority': idx,
        'confidenceStatus': 'needs_official_review'
    }
changed=0
for p in pokemon:
    cb=p.get('commonBuilds')
    if not cb: continue
    builds=cb.get('builds') if isinstance(cb,dict) else cb
    if not isinstance(builds,list): continue
    needs=False
    cleaned=[]; seen=set()
    for b in builds:
        if not isinstance(b,dict): needs=True; continue
        if set(b.keys())==set(REQ):
            nb=coerce(p,b,len(cleaned)+1) # still re-coerce to validate legality
        else:
            needs=True; nb=coerce(p,b,len(cleaned)+1)
        combo=(nb['ability'],nb['primaryItem'],tuple(nb['commonMoves']))
        if combo in seen: continue
        seen.add(combo); cleaned.append(nb)
        if len(cleaned)>=4: break
    if cleaned:
        p['commonBuilds']=cleaned
        changed+=1
with open(ROOT/'pokemon.json','w') as f: json.dump(pokemon,f,indent=2); f.write('\n')
if (DIST/'pokemon.json').exists():
    with open(DIST/'pokemon.json','w') as f: json.dump(pokemon,f,indent=2); f.write('\n')
print({'changed':changed})
