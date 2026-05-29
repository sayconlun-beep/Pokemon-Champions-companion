import json, re, shutil
from collections import defaultdict
ROOT='/mnt/data/workmech'
DATA=ROOT+'/public/data'

def load(name):
    with open(f'{DATA}/{name}',encoding='utf-8') as f: return json.load(f)

def norm(s): return re.sub(r'[^a-z0-9]+','',str(s).lower())

pokemon=load('pokemon.json')
stats_by_id={r['pokemon_id']:r for r in load('stats.json')}
move_rows=load('pokemon_moves.json')
move_info={m['name']:m for m in load('moves.json')}
abilities=defaultdict(list)
for r in load('pokemon_abilities.json'):
    if str(r.get('is_legal','')).lower()=='yes': abilities[r['pokemon_id']].append(r['ability_name'])
moves_by_id=defaultdict(list)
for r in move_rows:
    if str(r.get('is_legal','')).lower()=='yes': moves_by_id[r['pokemon_id']].append(r['move_name'])

priority_moves=set()
spread_moves=set()
burst_moves=set()
chip_moves=set()
protect_names={'Protect','Detect','Wide Guard','Quick Guard','King\'s Shield','Spiky Shield','Baneful Bunker','Obstruct','Silk Trap','Burning Bulwark'}
redirection_moves={'Follow Me','Rage Powder','Ally Switch'}
speed_control_moves={'Tailwind','Trick Room','Icy Wind','Electroweb','Thunder Wave','Scary Face','Quash','String Shot','Bulldoze','Rock Tomb','Sticky Web'}
spread_names={'Earthquake','Rock Slide','Heat Wave','Dazzling Gleam','Hyper Voice','Blizzard','Icy Wind','Electroweb','Muddy Water','Surf','Discharge','Make It Rain','Eruption','Water Spout','Expanding Force','Snarl','Breaking Swipe','Lava Plume','Air Cutter','Sludge Wave','Petal Blizzard'}
chip_names={'Leech Seed','Will-O-Wisp','Toxic','Poison Powder','Salt Cure','Infestation','Fire Spin','Whirlpool','Sand Tomb','Wrap','Bind','Curse','Knock Off','Fake Out','Snarl','Breaking Swipe'}
burst_names={'Close Combat','Draco Meteor','Leaf Storm','Overheat','Hydro Pump','Giga Impact','Hyper Beam','Meteor Beam','Head Smash','Flare Blitz','Brave Bird','Wild Charge','Wood Hammer','Megahorn','High Jump Kick','Focus Blast','Thunder','Blizzard','Hurricane'}
for n,mi in move_info.items():
    if mi.get('priority',0) and mi.get('priority',0)>0: priority_moves.add(n)
    if n in spread_names: spread_moves.add(n)
    if n in burst_names or (isinstance(mi.get('power'),int) and mi.get('power',0)>=110): burst_moves.add(n)
    if n in chip_names: chip_moves.add(n)

speed_abilities={'Chlorophyll':'Drought/sun doubles Speed and can turn this into a fast attacker.', 'Swift Swim':'Rain doubles Speed and can turn this into a fast attacker.', 'Sand Rush':'Sand doubles Speed and can turn this into a fast attacker.', 'Slush Rush':'Snow doubles Speed and can turn this into a fast attacker.', 'Unburden':'Item consumption can create a sudden Speed swing.', 'Prankster':'Priority status changes its effective speed profile.'}
weather_setters={'Drought':'sun', 'Drizzle':'rain', 'Sand Stream':'sand', 'Snow Warning':'snow'}


def tier(spe):
    if spe >= 110: return 'Very Fast'
    if spe >= 91: return 'Fast'
    if spe >= 70: return 'Mid'
    return 'Slow'

def perf_tailwind(spe):
    if spe >= 91: return 'High'
    if spe >= 60: return 'Good'
    return 'Low'

def perf_tr(spe):
    if spe <= 45: return 'High'
    if spe <= 70: return 'Good'
    return 'Low'

def top_moves(legal, pool):
    return [m for m in legal if m in pool][:6]

def type_list(p):
    return [t for t in [p.get('type_1'),p.get('type_2')] if t and t!='None']

def damage_pattern(stats, types):
    atk,spa=stats.get('atk',0),stats.get('spa',0)
    out=[]
    if spa >= atk+15: out.append('Special STAB pressure')
    elif atk >= spa+15: out.append('Physical STAB pressure')
    else: out.append('Mixed offensive pressure')
    if max(atk,spa) >= 120: out.append('High immediate damage when positioned safely')
    elif max(atk,spa) >= 100: out.append('Reliable neutral damage into common targets')
    else: out.append('Support or chip-led pressure rather than raw burst')
    return out

def primary_targets(types, legal):
    targets=[]
    if 'Fire' in types: targets+=['Grass- and Steel-type targets','Ice-type targets']
    if 'Water' in types: targets+=['Fire-, Rock-, and Ground-type targets']
    if 'Grass' in types: targets+=['Water-, Ground-, and Rock-type targets']
    if 'Electric' in types: targets+=['Water- and Flying-type targets']
    if 'Ice' in types: targets+=['Dragon-, Ground-, Flying-, and Grass-type targets']
    if 'Fairy' in types: targets+=['Dragon-, Dark-, and Fighting-type targets']
    if 'Dragon' in types: targets+=['Dragon-type targets and neutral bulky slots']
    if 'Ground' in types: targets+=['Fire-, Steel-, Rock-, Electric-, and Poison-type targets']
    if 'Fighting' in types: targets+=['Steel-, Dark-, Rock-, Ice-, and Normal-type targets']
    if 'Poison' in types: targets+=['Fairy- and Grass-type targets']
    if not targets: targets=['Targets weak to its STAB coverage','Low-bulk attackers that cannot safely trade into it']
    return targets[:4]

for p in pokemon:
    pid=p['pokemon_id']; st=stats_by_id.get(pid,{})
    spe=int(st.get('spe') or 0); hp=int(st.get('hp') or 0); bulk=int(st.get('bulk_score') or hp+int(st.get('def',0))+int(st.get('spd',0)))
    legal_moves=sorted(set(moves_by_id.get(pid,[])))
    legal_abilities=sorted(set(abilities.get(pid,[])))
    types=type_list(p)
    common_builds=p.get('commonBuilds') or []
    common_items=[]; common_build_moves=[]
    for b in common_builds:
        if b.get('primaryItem'): common_items.append(b['primaryItem'])
        for m in b.get('commonMoves',[]): common_build_moves.append(m)
        for m in b.get('moveVariants',[]): common_build_moves.append(m)
    spread=top_moves(legal_moves, spread_moves)
    burst=top_moves(legal_moves, burst_moves)
    chip=top_moves(legal_moves, chip_moves)
    prio=top_moves(legal_moves, priority_moves)
    speed_moves=top_moves(legal_moves, speed_control_moves)
    protect=top_moves(legal_moves, protect_names)
    redir=top_moves(legal_moves, redirection_moves)
    speed_inter=[]
    for a in legal_abilities:
        if a in speed_abilities: speed_inter.append(speed_abilities[a])
        if a in weather_setters: speed_inter.append(f"Sets {weather_setters[a]} itself, so it can enable partners that rely on that weather.")
    for m in speed_moves: speed_inter.append(f"{m} gives it direct speed-control utility.")
    benchmarks=[]
    if spe >= 103: benchmarks.append('Naturally above Garchomp 102 and Salamence 100 before modifiers.')
    elif spe >= 101: benchmarks.append('Naturally above Salamence 100 but below or tied near Garchomp 102.')
    elif spe >= 92: benchmarks.append('Naturally above Landorus 91 but below the Garchomp/Salamence benchmark.')
    elif spe >= 78: benchmarks.append('Naturally above Heatran 77 but below Landorus 91.')
    elif spe >= 71: benchmarks.append('Sits below Heatran 77 unless invested or speed-controlled.')
    else: benchmarks.append('Naturally slow; usually needs Trick Room, priority, bulk, or board control to move safely.')
    if speed_moves: benchmarks.append('Legal speed-control moves can change this matchup math in-game: '+', '.join(speed_moves[:3])+'.')
    if prio: benchmarks.append('Priority access lets it act before normal Speed order in specific lines: '+', '.join(prio[:3])+'.')
    sig=[]
    if speed_moves: sig.append(' + '.join(speed_moves[:1]+protect[:1]) if protect else speed_moves[0])
    if spread: sig.append(spread[0] + (' + Protect' if 'Protect' in legal_moves else ''))
    if burst: sig.append(burst[0] + (' + speed control support' if spe < 91 else ' + immediate pressure'))
    for b in common_builds[:3]:
        cm=[m for m in b.get('commonMoves',[]) if m in legal_moves]
        if len(cm)>=2: sig.append(' + '.join(cm[:2]))
    sig=list(dict.fromkeys(sig))[:6]
    telling=list(dict.fromkeys(common_items))[:6]
    if not telling: telling=['Item choice determines whether it is being used for damage, bulk, or utility.']
    build_ids=[]
    for b in common_builds[:4]:
        parts=[]
        if b.get('primaryItem'): parts.append(b['primaryItem'])
        if b.get('ability'): parts.append(b['ability'])
        if b.get('name'): parts.append(b['name'])
        build_ids.append(' / '.join(parts))
    if not build_ids: build_ids=['Legal STAB attacks plus Protect identify its baseline doubles role.']
    fast=spe>=91; slow=spe<=70
    best_leads=[]
    if speed_moves: best_leads.append('Partner attackers that immediately exploit its speed control')
    if spread: best_leads.append('Wide Guard-resistant or spread-pressure partners')
    if redir: best_leads.append('Setup attackers that benefit from redirection support')
    if any(a in weather_setters for a in legal_abilities): best_leads.append('Weather abusers that use the weather it sets')
    if not best_leads: best_leads=['Fake Out or redirection partners that buy it safe turns','Partners that cover its defensive weaknesses']
    mechanics={
      'speedBenchmarkData': {
        'baseSpeedTier': tier(spe),
        'commonSpeedBenchmarks': benchmarks,
        'speedControlInteractions': speed_inter or ['No major legal speed-control interaction identified beyond normal Tailwind, Trick Room, paralysis, and switching support.'],
        'tailwindPerformance': perf_tailwind(spe),
        'trickRoomPerformance': perf_tr(spe),
        'priorityInteractions': [f'{m} can bypass normal Speed order.' for m in prio] or ['No notable legal positive-priority attack or priority utility identified.'],
        'confidenceStatus': 'needs_official_review'
      },
      'damageProfile': {
        'preferredDamagePattern': damage_pattern(st, types),
        'spreadDamageAccess': spread,
        'burstDamageAccess': burst,
        'chipPressureTools': chip,
        'endgamePressure': ('High if its main attacking stat is preserved and faster threats are removed.' if max(int(st.get('atk',0)),int(st.get('spa',0)))>=115 else 'Moderate; it usually needs positioning, chip, or partner support to close games.'),
        'snowballPotential': ('High when speed control or setup lets it attack repeatedly.' if fast or speed_inter else 'Low to moderate; it usually converts through steady trades rather than runaway boosts.'),
        'confidenceStatus': 'needs_official_review'
      },
      'boardStateProfiles': {
        'preferredBoards': [x for x in [
            'Tailwind or speed advantage active' if fast or perf_tailwind(spe)!='Low' else None,
            'Trick Room active' if perf_tr(spe)!='Low' else None,
            'Partner has redirected, faked out, or forced Protect from the main threat',
            'Its STAB targets are exposed and cannot safely switch'
        ] if x],
        'uncomfortableBoards': [x for x in [
            'Opponent controls Speed and can double-target it before it moves' if not fast else 'Choice Scarf or priority pressure can still move around its Speed advantage',
            'Strong super-effective pressure is already on board',
            'Redirection blocks its preferred single-target damage' if not spread else 'Wide Guard or resist-heavy boards reduce its spread value',
            'Intimidate-heavy boards' if int(st.get('atk',0))>int(st.get('spa',0))+10 else 'Specially bulky boards that ignore its chip plan'
        ] if x],
        'bestLeadPartners': best_leads[:4],
        'bestBacklinePartners': ['Defensive switch-ins that cover its weaknesses','Late-game cleaners that benefit from its chip damage','Speed-control partners if it lacks its own'],
        'positioningLoops': [x for x in [
            'Protect to scout a double target, then reposition into a partner that resists the hit' if protect else None,
            'Apply chip or spread pressure, then let a partner finish the weakened slot' if chip or spread else None,
            'Use speed control, then attack before the opponent can reset positioning' if speed_moves else None
        ] if x] or ['Use safe switches and Protect turns to create a clean attacking lane.']
      },
      'targetingPressure': {
        'primaryTargets': primary_targets(types, legal_moves),
        'secondaryTargets': ['Neutral targets already chipped into KO range','Support Pokémon that cannot threaten it back immediately','Slots forced to Protect by partner pressure'],
        'redirectionVulnerability': ('Low to moderate because spread moves can still create value through redirection.' if spread else 'High when relying on single-target attacks; Follow Me or Rage Powder can waste its best attack turns.'),
        'spreadVulnerability': ('Moderate; it can pressure with spread moves but must respect opposing spread damage too.' if spread else 'Moderate to high if it lacks Wide Guard, recovery, or strong immediate trades into spread attackers.')
      },
      'aiRecognitionProfiles': {
        'signatureMoveCombos': sig or ['STAB attack + Protect'],
        'tellingItems': telling,
        'buildIdentifiers': build_ids
      },
      'decisionMakingHeuristics': {
        'leadDecisionFactors': ['Lead when its STAB pressure or utility immediately contests the opposing lead.', 'Avoid leading it into obvious faster super-effective pressure unless protected by Fake Out, redirection, or speed control.'],
        'switchDecisionFactors': ['Switch out when the opponent can double-target it before it moves.', 'Preserve it if its typing or ability is still needed for a late-game matchup.'],
        'protectDecisionFactors': ['Protect when it is the obvious double-target or when a partner can punish that focus.', 'Protect to stall opposing speed control, weather, screens, or field effects.'],
        'targetSelectionFactors': ['Prioritize exposed targets weak to its STAB coverage.', 'Target the slot that threatens your speed-control or positioning engine first.', 'Use spread damage when both opposing slots are in range or redirection is likely.']
      }
    }
    for k,v in mechanics.items(): p[k]=v

with open(f'{DATA}/pokemon.json','w',encoding='utf-8') as f: json.dump(pokemon,f,ensure_ascii=False,indent=2)
print('generated mechanics for',len(pokemon),'pokemon')
