#!/usr/bin/env python3
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
db = json.loads((ROOT / 'public' / 'db.json').read_text())
TYPE_NAMES = {'normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'}
COMMON_WORD_MOVES = {'protect','helping hand','follow me','rage powder','tailwind','trick room','wide guard','quick guard','fake out'}
SIGNATURE_MECHANICS = {'drought','drizzle','snow warning','sand stream','chlorophyll','swift swim','sand rush','slush rush','protosynthesis','quark drive','surge surfer','huge power','pure power','parental bond','shadow tag','arena trap','magnet pull','levitate','lightning rod','storm drain','flash fire','water absorb','dry skin','motor drive','sap sipper','friend guard','neutralizing gas'}
FREE_TEXT_FIELDS = ['strategicStrengths','speedBenchmarkData','damageProfile','boardStateProfiles','targetingPressure','aiRecognitionProfiles','decisionMakingHeuristics','competitiveInsights','goldStandardProfileSummary','preferredBoardStates','tempoProfile']
VALIDATOR_LEGAL_STATUSES = {'yes', 'needs review'}

def norm(value):
    return re.sub(r'[^a-z0-9]+', ' ', str(value or '').lower()).strip()

def flatten(value, path=''):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from flatten(child, f'{path}.{index}' if path else str(index))
    elif isinstance(value, dict):
        for key, child in value.items():
            yield from flatten(child, f'{path}.{key}' if path else key)

def boundary_contains(text_l, name_l):
    index = text_l.find(name_l)
    while index != -1:
        before = index == 0 or not text_l[index - 1].isalnum()
        end = index + len(name_l)
        after = end == len(text_l) or not text_l[end].isalnum()
        if before and after:
            return True
        index = text_l.find(name_l, index + 1)
    return False

def mention(text_l, pairs):
    hits = []
    occupied = []
    for original, lower, normalised in pairs:
        start = 0
        while True:
            index = text_l.find(lower, start)
            if index == -1:
                break
            end = index + len(lower)
            if boundary_contains(text_l, lower) and not any(index < b and end > a for a, b in occupied):
                hits.append((original, normalised))
                occupied.append((index, end))
                break
            start = index + 1
    return hits

move_names = sorted([m.get('name', '') for m in db.get('moves', []) if m.get('name')], key=len, reverse=True)
ability_names = sorted([a.get('name', '') for a in db.get('abilities', []) if a.get('name')], key=len, reverse=True)
item_names = sorted([i.get('name', '') for i in db.get('items', []) if i.get('name')], key=len, reverse=True)
move_pairs = [(name, name.lower(), norm(name)) for name in move_names]
ability_pairs = [(name, name.lower(), norm(name)) for name in ability_names]
item_set = {norm(name) for name in item_names}
legal_moves = {}
legal_abilities = {}
for row in db.get('pokemon_moves', []):
    if str(row.get('is_legal') or '').strip().lower() in VALIDATOR_LEGAL_STATUSES:
        legal_moves.setdefault(row.get('pokemon_id'), set()).add(norm(row.get('move_name')))
for row in db.get('pokemon_abilities', []):
    if str(row.get('is_legal') or '').strip().lower() in VALIDATOR_LEGAL_STATUSES:
        legal_abilities.setdefault(row.get('pokemon_id'), set()).add(norm(row.get('ability_name')))
stats = {row.get('pokemon_id'): row for row in db.get('stats', [])}

def add(violations, field, issue, fix):
    violations.append({'field': field, 'issue': issue, 'fix_suggestion': fix})

def validate(mon):
    pid = mon.get('pokemon_id')
    name = mon.get('name')
    lm = legal_moves.get(pid, set())
    la = legal_abilities.get(pid, set())
    stat_row = stats.get(pid, {})
    speed = int(float(stat_row.get('spe') or mon.get('spe') or 0))
    bulk = int(float(stat_row.get('bulk_score') or ((stat_row.get('hp') or 0) + (stat_row.get('def') or 0) + (stat_row.get('spd') or 0))))
    violations = []

    raw_builds = mon.get('commonBuilds') or []
    if isinstance(raw_builds, dict):
        raw_builds = raw_builds.get('builds') or []
    if not isinstance(raw_builds, list):
        raw_builds = []
    for bi, build in enumerate(raw_builds):
        if not isinstance(build, dict):
            continue
        for key in ['commonMoves', 'moveVariants', 'coreMoves', 'commonFourthMoves']:
            for mi, move in enumerate(build.get(key) or []):
                if norm(move) not in lm:
                    add(violations, f'commonBuilds.{bi}.{key}.{mi}', f'Move "{move}" is not in this Pokémon\'s legal moves list.', f'Replace "{move}" with a legal move for {name}, or remove it from this build.')
        for key in ['ability', 'abilityOptions']:
            values = build.get(key) if isinstance(build.get(key), list) else ([build.get(key)] if build.get(key) else [])
            for ai, ability in enumerate(values):
                if norm(ability) not in la:
                    add(violations, f'commonBuilds.{bi}.{key}.{ai}', f'Ability "{ability}" is not in this Pokémon\'s legal abilities list.', f'Replace "{ability}" with one of {name}\'s legal abilities.')
        for key in ['primaryItem', 'itemOptions']:
            values = build.get(key) if isinstance(build.get(key), list) else ([build.get(key)] if build.get(key) else [])
            for ii, item in enumerate(values):
                if norm(item) not in item_set:
                    add(violations, f'commonBuilds.{bi}.{key}.{ii}', f'Item "{item}" is not present in the items table.', f'Remove "{item}" or add it to the Champions items table if valid.')

    for field in FREE_TEXT_FIELDS:
        if field not in mon:
            continue
        for path, text in flatten(mon[field], field):
            text_l = text.lower()
            if speed < 80 and re.search(r'\b(naturally fast|very fast|fast attacker|fast sweeper|fast offensive|speedy)\b', text_l):
                add(violations, path, f'Stats claim natural speed/fastness but base Speed is {speed}, below the <80 threshold.', 'Rewrite as slow, mid-speed, speed-control dependent, or conditional speed rather than naturally fast.')
            if bulk > 250 and re.search(r'\b(frail|fragile|glass cannon)\b', text_l):
                add(violations, path, f'Stats claim frailty but total bulk score is {bulk}, above the >250 threshold.', 'Rewrite as bulky, moderately durable, or vulnerable to specific super-effective/burst damage instead of generally frail.')
            for ability, ability_norm in mention(text_l, ability_pairs):
                if ability_norm in SIGNATURE_MECHANICS and ability_norm not in la:
                    add(violations, path, f'Mentions signature ability/mechanic "{ability}" but it is not in this Pokémon\'s legal abilities list.', f'Remove the "{ability}" claim or rewrite it as external team support rather than this Pokémon\'s own mechanic.')
            for move, move_norm in mention(text_l, move_pairs):
                if move_norm in TYPE_NAMES:
                    continue
                if move_norm in COMMON_WORD_MOVES and move_norm not in lm:
                    continue
                move_claim = re.search(r'\b(uses?|clicks?|sets?|spams?|with|via|through|access to|move|combo|signature)\b.{0,24}\b' + re.escape(move.lower()) + r'\b|\b' + re.escape(move.lower()) + r'\b.{0,24}\b(pressure|damage|combo|loop|access|coverage)\b', text_l)
                if move_norm not in lm and move_claim:
                    add(violations, path, f'Mentions move "{move}" as part of this Pokémon\'s kit but it is not legal for this Pokémon.', f'Remove "{move}" from this strategic claim or replace it with a legal move for {name}.')
    deduped = []
    seen = set()
    for violation in violations:
        key = (violation['field'], violation['issue'])
        if key not in seen:
            seen.add(key)
            deduped.append(violation)
    return {'passes': not deduped, 'violations': deduped}

ninetales = next((mon for mon in db.get('pokemon', []) if mon.get('pokemon_id') == 'PKMN_0038_ALOLA'), None)
if not ninetales:
    print('Alolan Ninetales regression failed: PKMN_0038_ALOLA not found', file=sys.stderr)
    sys.exit(1)

result = validate(ninetales)
if not result['passes']:
    print(json.dumps(result, indent=2), file=sys.stderr)
    sys.exit(1)

print('Alolan Ninetales strategic-data regression passed.')
