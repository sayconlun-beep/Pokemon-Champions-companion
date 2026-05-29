#!/usr/bin/env python3
import argparse, json, re, pathlib, datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
db_path=ROOT/'public'/'db.json'
db=json.loads(db_path.read_text())
parser=argparse.ArgumentParser(description='Validate generated strategic data against Champions legality data.')
parser.add_argument('--strict', action='store_true', help='Only treat is_legal == Yes as legal; Needs Review is reported as a strict confirmation gap.')
args=parser.parse_args()
VALIDATION_MODE='strict' if args.strict else 'default'
TYPE_NAMES={'normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'}
COMMON_WORD_MOVES={'protect','helping hand','follow me','rage powder','tailwind','trick room','wide guard','quick guard','fake out'}
COMMON_WORD_ABILITIES={'pressure','competitive','immunity','anticipation','inner focus','unaware','sturdy','overcoat','prankster','intimidate'}
SIGNATURE_MECHANICS={'drought','drizzle','snow warning','sand stream','chlorophyll','swift swim','sand rush','slush rush','protosynthesis','quark drive','surge surfer','huge power','pure power','parental bond','shadow tag','arena trap','magnet pull','levitate','lightning rod','storm drain','flash fire','water absorb','dry skin','motor drive','sap sipper','friend guard','neutralizing gas'}
FREE_TEXT_FIELDS=['strategicStrengths','speedBenchmarkData','damageProfile','boardStateProfiles','targetingPressure','aiRecognitionProfiles','decisionMakingHeuristics','competitiveInsights','goldStandardProfileSummary','preferredBoardStates','tempoProfile']

def norm(v): return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def flatten(v,path=''):
    if isinstance(v,str): yield path,v
    elif isinstance(v,list):
        for i,x in enumerate(v): yield from flatten(x,f'{path}.{i}' if path else str(i))
    elif isinstance(v,dict):
        for k,x in v.items(): yield from flatten(x,f'{path}.{k}' if path else k)

def boundary_contains(text_l, name_l):
    idx=text_l.find(name_l)
    while idx!=-1:
        before=idx==0 or not text_l[idx-1].isalnum()
        end=idx+len(name_l)
        after=end==len(text_l) or not text_l[end].isalnum()
        if before and after: return True
        idx=text_l.find(name_l,idx+1)
    return False

move_names=sorted([m.get('name','') for m in db.get('moves',[]) if m.get('name')], key=len, reverse=True)
ability_names=sorted([a.get('name','') for a in db.get('abilities',[]) if a.get('name')], key=len, reverse=True)
item_names=sorted([i.get('name','') for i in db.get('items',[]) if i.get('name')], key=len, reverse=True)
move_pairs=[(n,n.lower(),norm(n)) for n in move_names]
ability_pairs=[(n,n.lower(),norm(n)) for n in ability_names]
item_pairs=[(n,n.lower(),norm(n)) for n in item_names]
item_set={norm(n) for n in item_names}
legal_moves={}; legal_abilities={}
DEFAULT_VALIDATOR_LEGAL_STATUSES={'yes','needs review'}
STRICT_VALIDATOR_LEGAL_STATUSES={'yes'}
VALIDATOR_LEGAL_STATUSES=STRICT_VALIDATOR_LEGAL_STATUSES if args.strict else DEFAULT_VALIDATOR_LEGAL_STATUSES
def is_candidate_legal_status(value):
    # Default mode mirrors app-facing validation: confirmed Yes rows and
    # reviewer-pending Needs Review rows are checked so forms cannot pass
    # vacuously. Strict mode is official-confirmation only.
    return str(value or '').strip().lower() in VALIDATOR_LEGAL_STATUSES
for r in db.get('pokemon_moves',[]):
    if is_candidate_legal_status(r.get('is_legal')):
        legal_moves.setdefault(r.get('pokemon_id'),set()).add(norm(r.get('move_name')))
for r in db.get('pokemon_abilities',[]):
    if is_candidate_legal_status(r.get('is_legal')):
        legal_abilities.setdefault(r.get('pokemon_id'),set()).add(norm(r.get('ability_name')))
stats={s.get('pokemon_id'):s for s in db.get('stats',[])}

def legal_status(value):
    return str(value or '').strip().lower()

def get_strict_mode_eligible(mon, move_rows):
    if 'strictModeEligible' in mon:
        return mon.get('strictModeEligible')
    row_values=[r.get('strictModeEligible') for r in move_rows if 'strictModeEligible' in r]
    if row_values:
        return all(bool(v) for v in row_values)
    return None

def slug(value):
    return re.sub(r'[^a-z0-9]+','_',str(value or '').lower()).strip('_')

def review_alias(mon):
    base=slug(mon.get('base_species') or mon.get('name'))
    form=slug(mon.get('form_name'))
    if 'alolan' in form or form == 'alola' or 'alola' in slug(mon.get('pokemon_id')):
        return f'{base}_alola'
    if 'galarian' in form or 'galar' in form or 'galar' in slug(mon.get('pokemon_id')):
        return f'{base}_galar'
    if 'hisuian' in form or 'hisui' in form or 'hisui' in slug(mon.get('pokemon_id')):
        return f'{base}_hisui'
    if 'paldean' in form or 'paldea' in form or 'paldea' in slug(mon.get('pokemon_id')):
        return f'{base}_paldea' if not form else f'{base}_{form}'
    return slug(mon.get('pokemon_id'))

def build_champions_confirmation_status():
    rows_by_pid={}
    for r in db.get('pokemon_moves',[]):
        rows_by_pid.setdefault(r.get('pokemon_id'),[]).append(r)
    status_report={}
    flagged=[]
    strict_confirmation_gaps=[]
    for mon in db.get('pokemon',[]):
        pid=mon.get('pokemon_id')
        rows=rows_by_pid.get(pid,[])
        confirmed=sum(1 for r in rows if legal_status(r.get('is_legal'))=='yes')
        needs_review=sum(1 for r in rows if legal_status(r.get('is_legal'))=='needs review')
        illegal=sum(1 for r in rows if legal_status(r.get('is_legal'))=='no')
        strict_gap=confirmed==0 and needs_review>0
        entry={
            'name':mon.get('name'),
            'form_name':mon.get('form_name'),
            'review_alias':review_alias(mon),
            'confirmed_legal_move_count':confirmed,
            'candidate_needs_review_move_count':needs_review,
            'illegal_move_count':illegal,
            'has_only_needs_review_moves':strict_gap,
            'strictModeEligible':get_strict_mode_eligible(mon,rows),
            'defaultValidationTreatment':'Yes and Needs Review are candidate-legal for validator coverage.',
            'strictValidationTreatment':'Only Yes is legal; Needs Review remains a confirmation gap.',
        }
        if mon.get('base_species') and mon.get('base_species') != mon.get('name'):
            entry['base_species']=mon.get('base_species')
        if mon.get('is_regional_or_alt') is not None:
            entry['is_regional_or_alt']=mon.get('is_regional_or_alt')
        if strict_gap:
            entry['review_flag']='No confirmed legal moves; candidate Needs Review moves are validated in default mode but require official Champions confirmation.'
            flagged.append(pid)
            strict_confirmation_gaps.append({
                'pokemon_id':pid,
                'name':mon.get('name'),
                'form_name':mon.get('form_name'),
                'review_alias':entry['review_alias'],
                'candidate_needs_review_move_count':needs_review,
                'strictModeEligible':entry['strictModeEligible'],
                'reason':'Strict mode has zero confirmed legal moves for this Pokémon/form; Needs Review moves are not treated as fully confirmed.'
            })
        status_report[pid]=entry
    return {
        'sectionTitle':'Champions Confirmation Status',
        'validationMode':VALIDATION_MODE,
        'ruleSummary':[
            'Default mode: Yes and Needs Review count as candidate-legal for validator coverage.',
            'Strict mode: only Yes counts as legal.',
            'Needs Review is always reported separately and is never treated as fully confirmed.',
            'No remains illegal in all modes.',
            'Rows with zero confirmed legal moves and one or more Needs Review moves are flagged for official confirmation.'
        ],
        'flaggedPokemon':flagged,
        'totalFlaggedPokemon':len(flagged),
        'strictModeConfirmationGaps':strict_confirmation_gaps,
        'totalStrictModeConfirmationGaps':len(strict_confirmation_gaps),
        'report':status_report
    }

def mention(text_l, pairs):
    # Longest-match, non-overlapping scan. This prevents false positives such as
    # "Thunder" inside "Thunder Wave" or "Trick" inside "Trick Room".
    hits=[]; occupied=[]
    for orig,low,n in pairs:
        start=0
        while True:
            idx=text_l.find(low,start)
            if idx==-1: break
            end=idx+len(low)
            if boundary_contains(text_l,low) and not any(idx < b and end > a for a,b in occupied):
                hits.append(orig); occupied.append((idx,end))
                break
            start=idx+1
    return hits

def add(vs, field, issue, fix): vs.append({'field':field,'issue':issue,'fix_suggestion':fix})

def validate(mon):
    pid=mon.get('pokemon_id'); name=mon.get('name')
    lm=legal_moves.get(pid,set()); la=legal_abilities.get(pid,set()); s=stats.get(pid,{})
    spe=int(float(s.get('spe') or mon.get('spe') or 0)); bulk=int(float(s.get('bulk_score') or ((s.get('hp') or 0)+(s.get('def') or 0)+(s.get('spd') or 0))))
    violations=[]
    raw_builds=mon.get('commonBuilds') or []
    if isinstance(raw_builds,dict): raw_builds=raw_builds.get('builds') or []
    if not isinstance(raw_builds,list): raw_builds=[]
    for bi,b in enumerate(raw_builds):
        if not isinstance(b,dict): continue
        for key in ['commonMoves','moveVariants','coreMoves','commonFourthMoves']:
            for mi,mv in enumerate(b.get(key) or []):
                if norm(mv) not in lm: add(violations,f'commonBuilds.{bi}.{key}.{mi}',f'Move "{mv}" is not in this Pokémon\'s legal moves list.',f'Replace "{mv}" with a legal move for {name}, or remove it from this build.')
        for key in ['ability','abilityOptions']:
            vals=b.get(key) if isinstance(b.get(key),list) else ([b.get(key)] if b.get(key) else [])
            for ai,ab in enumerate(vals):
                if norm(ab) not in la: add(violations,f'commonBuilds.{bi}.{key}.{ai}',f'Ability "{ab}" is not in this Pokémon\'s legal abilities list.',f'Replace "{ab}" with one of {name}\'s legal abilities.')
        for key in ['primaryItem','itemOptions']:
            vals=b.get(key) if isinstance(b.get(key),list) else ([b.get(key)] if b.get(key) else [])
            for ii,it in enumerate(vals):
                if norm(it) not in item_set: add(violations,f'commonBuilds.{bi}.{key}.{ii}',f'Item "{it}" is not present in the items table.',f'Remove "{it}" or add it to the Champions items table if valid.')
    for field in FREE_TEXT_FIELDS:
        if field not in mon: continue
        for path,text in flatten(mon[field],field):
            tl=text.lower()
            # Strict stats language check in all generated text.
            if spe < 80 and re.search(r'\b(naturally fast|very fast|fast attacker|fast sweeper|fast offensive|speedy)\b',tl):
                add(violations,path,f'Stats claim natural speed/fastness but base Speed is {spe}, below the <80 threshold.','Rewrite as slow, mid-speed, speed-control dependent, or conditional speed rather than naturally fast.')
            if bulk > 250 and re.search(r'\b(frail|fragile|glass cannon)\b',tl):
                add(violations,path,f'Stats claim frailty but total bulk score is {bulk}, above the >250 threshold.','Rewrite as bulky, moderately durable, or vulnerable to specific super-effective/burst damage instead of generally frail.')
            # Free text only flags specific signature mechanics, not generic words like Pressure.
            for ab in mention(tl, ability_pairs):
                nab=norm(ab)
                if nab in SIGNATURE_MECHANICS and nab not in la:
                    add(violations,path,f'Mentions signature ability/mechanic "{ab}" but it is not in this Pokémon\'s legal abilities list.',f'Remove the "{ab}" claim or rewrite it as external team support rather than this Pokémon\'s own mechanic.')
            # Move mentions in free text skip type names and generic team-control words unless the mon itself has them.
            for mv in mention(tl, move_pairs):
                nm=norm(mv)
                if nm in TYPE_NAMES: continue
                if nm in COMMON_WORD_MOVES and nm not in lm: continue
                if nm not in lm and re.search(r'\b(uses?|clicks?|sets?|spams?|with|via|through|access to|move|combo|signature)\b.{0,24}\b'+re.escape(mv.lower())+r'\b|\b'+re.escape(mv.lower())+r'\b.{0,24}\b(pressure|damage|combo|loop|access|coverage)\b',tl):
                    add(violations,path,f'Mentions move "{mv}" as part of this Pokémon\'s kit but it is not legal for this Pokémon.',f'Remove "{mv}" from this strategic claim or replace it with a legal move for {name}.')
            for it in mention(tl,item_pairs):
                if norm(it) not in item_set:
                    add(violations,path,f'Mentions item "{it}" but it is not present in the items table.',f'Remove "{it}" or add it to the Champions items table if valid.')
    seen=set(); out=[]
    for v in violations:
        k=(v['field'],v['issue'])
        if k not in seen: seen.add(k); out.append(v)
    return {'passes':not out,'violations':out}

report={}; failing=0; total=0
for mon in db.get('pokemon',[]):
    res=validate(mon); mon['generatedStrategicDataValidation']=res
    report[mon.get('pokemon_id')]={'name':mon.get('name'),**res}
    failing += not res['passes']; total += len(res['violations'])
champions_confirmation_status=build_champions_confirmation_status()
db.setdefault('validationReports',{})['generatedStrategicDataValidation']={
 'generatedAt':datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat().replace('+00:00','Z'),
 'validationMode':VALIDATION_MODE,
 'strict':args.strict,
 'legalStatusPolicy':('strict: only is_legal == Yes is accepted as legal' if args.strict else 'default: is_legal == Yes and Needs Review are accepted as candidate-legal for validation'),
 'checkedFields':['commonBuilds']+FREE_TEXT_FIELDS,
 'ruleSummary':['Build move fields must use only legal moves for that Pokémon.','Build ability fields must use only legal abilities for that Pokémon.','Build item fields must exist in the Champions items table.','Free-text strategy sections flag unsupported signature mechanics and likely kit-move claims.','Fast/speed claims are flagged when base Speed is below 80; frail claims are flagged when bulk score is above 250.'],
 'totalPokemon':len(db.get('pokemon',[])),
 'defaultValidationFailures':({'failingPokemon':failing,'totalViolations':total} if not args.strict else None),
 'strictValidationFailures':({'failingPokemon':failing,'totalViolations':total} if args.strict else None),
 'strictModeConfirmationGaps':champions_confirmation_status['strictModeConfirmationGaps'],
 'failingPokemon':failing, 'totalViolations':total, 'report':report,
 'championsConfirmationStatus':champions_confirmation_status}
db_path.write_text(json.dumps(db,indent=2))
report_filename='generated-strategic-data-validation-report.strict.json' if args.strict else 'generated-strategic-data-validation-report.json'
confirmation_filename='champions-confirmation-status-report.strict.json' if args.strict else 'champions-confirmation-status-report.json'
(ROOT/report_filename).write_text(json.dumps(db['validationReports']['generatedStrategicDataValidation'],indent=2))
(ROOT/confirmation_filename).write_text(json.dumps(champions_confirmation_status,indent=2))
print(json.dumps({'validationMode':VALIDATION_MODE,'totalPokemon':len(db.get('pokemon',[])),'failingPokemon':failing,'totalViolations':total,'defaultValidationFailures':({'failingPokemon':failing,'totalViolations':total} if not args.strict else None),'strictValidationFailures':({'failingPokemon':failing,'totalViolations':total} if args.strict else None),'championsConfirmationStatus':{'totalFlaggedPokemon':champions_confirmation_status['totalFlaggedPokemon'],'flaggedPokemon':champions_confirmation_status['flaggedPokemon'],'totalStrictModeConfirmationGaps':champions_confirmation_status['totalStrictModeConfirmationGaps']}},indent=2))
