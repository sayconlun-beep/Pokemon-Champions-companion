#!/usr/bin/env python3
"""Gate stock strategic-profile move/ability phrases behind per-Pokémon legality.

This is a generator/data-maintenance safety pass. It does not edit legal move
lists, abilities, items, or stats. It only rewrites generic generated prose that
names a move or own ability/mechanic when that Pokémon does not legally learn the named move/ability.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'

TARGET_FIELDS = [
    'strategicStrengths', 'speedBenchmarkData', 'damageProfile', 'boardStateProfiles',
    'targetingPressure', 'aiRecognitionProfiles', 'decisionMakingHeuristics',
    'competitiveInsights', 'goldStandardProfileSummary', 'preferredBoardStates',
    'tempoProfile',
]

REWRITES = (
    ('Reversal', re.compile(r'\bReversal-style priority\b', re.I), 'priority pressure'),
    ('Reversal', re.compile(r'\bpunishes setup with Reversal(?:-style priority)?\b', re.I), 'punishes setup with anti-setup pressure'),
    ('Reversal', re.compile(r'\bSpeed-control reversal\b', re.I), 'Speed-control disruption'),
    ('Detect', re.compile(r'\bProtect/Detect-style protection\b', re.I), 'protection effects'),
    ('Detect', re.compile(r'\bProtect/Detect-style effects\b', re.I), 'protection effects'),
    ('Detect', re.compile(r'\bProtect/Detect pressure\b', re.I), 'protection pressure'),
    ('Detect', re.compile(r'\bProtect/Detect turns\b', re.I), 'protection turns'),
    ('Snarl', re.compile(r'\bSnarl-style drops\b', re.I), 'stat-drop pressure'),
    ('Snarl', re.compile(r'\bSnarl pressure\b', re.I), 'special damage suppression'),
    ('Snarl', re.compile(r'\bSnarl chip endgames\b', re.I), 'chip-damage endgames'),
    ('Snarl', re.compile(r'\bSnarl chip\b', re.I), 'special-attack control'),
    ('Snarl', re.compile(r'\bSnarl damage control\b', re.I), 'special damage control'),
    ('Knock Off', re.compile(r'\bItem disruption with Knock Off\b', re.I), 'item disruption pressure'),
    ('Aurora Veil', re.compile(r'\bSet snow into Aurora Veil\b', re.I), 'set snow into screen-supported pressure'),
    ('Aurora Veil', re.compile(r'\bUse Aurora Veil to enable setup sweepers or bulky attackers\b', re.I), 'use screen support to enable setup sweepers or bulky attackers'),
    ('Aurora Veil', re.compile(r'\bwith Aurora Veil support utility\b', re.I), 'with screen-support utility'),
    ('Aurora Veil', re.compile(r'\bset Aurora Veil before being KO’d\b', re.I), 'enable screen support before being KO’d'),
    ('Extreme Speed', re.compile(r'\bExtreme speed pressure\b', re.I), 'priority pressure'),
    ('Sucker Punch', re.compile(r'\bFake Out/Sucker Punch-style lines\b', re.I), 'priority-disruption lines'),
)

def norm(value):
    return re.sub(r'[^a-z0-9]+', ' ', str(value or '').lower()).strip()

def canMentionMove(pid, move_name, legal_moves_by_pid):
    return norm(move_name) in legal_moves_by_pid.get(pid, set())

def gate_value(pid, value, legal_moves_by_pid, counts):
    if isinstance(value, str):
        out = value
        for move_name, pattern, replacement in REWRITES:
            if not canMentionMove(pid, move_name, legal_moves_by_pid):
                out, n = pattern.subn(replacement, out)
                counts[move_name] = counts.get(move_name, 0) + n
        return out
    if isinstance(value, list):
        return [gate_value(pid, item, legal_moves_by_pid, counts) for item in value]
    if isinstance(value, dict):
        return {key: gate_value(pid, item, legal_moves_by_pid, counts) for key, item in value.items()}
    return value

ABILITY_REWRITES = (
    ('Drought', re.compile(r'\bSun active with Drought partner\b', re.I), 'sun active with a weather-setting partner'),
    ('Drought', re.compile(r'\bDrought doubles effective speed through Chlorophyll\b', re.I), 'sun support enables weather-based speed pressure'),
    ('Drought', re.compile(r'\bDrought users\b', re.I), 'sun setters'),
    ('Drought', re.compile(r'\bLead with Drought support\b', re.I), 'lead with sun support'),
    ('Drought', re.compile(r'\bDrought partner\b', re.I), 'sun-setting partner'),
    ('Drought', re.compile(r'\bDrought support\b', re.I), 'sun support'),
    ('Chlorophyll', re.compile(r'\bFast under Chlorophyll sun\b', re.I), 'fast only with external speed support'),
    ('Chlorophyll', re.compile(r'\bChlorophyll sleep offense\b', re.I), 'sun-supported sleep offense'),
    ('Chlorophyll', re.compile(r'\bSleep Powder/Chlorophyll are ignored\b', re.I), 'Sleep Powder and weather-speed support are ignored'),
    ('Chlorophyll', re.compile(r'\bEnables Chlorophyll partners\b', re.I), 'enables sun-abusing partners'),
    ('Chlorophyll', re.compile(r'\bChlorophyll partners\b', re.I), 'sun-abusing partners'),
    ('Chlorophyll', re.compile(r'\bChlorophyll cleanup pressure\b', re.I), 'sun-speed cleanup pressure'),
    ('Chlorophyll', re.compile(r'\bChlorophyll sun\b', re.I), 'sun-speed support'),
    ('Swift Swim', re.compile(r'\bSets rain for Swift Swim/Water attackers\b', re.I), 'sets rain for Water attackers and rain abusers'),
    ('Swift Swim', re.compile(r'\bSwift Swim/electric-water cores\b', re.I), 'rain-speed and Electric/Water cores'),
    ('Swift Swim', re.compile(r'\bSwift Swim or Water attackers\b', re.I), 'Water attackers and rain abusers'),
    ('Swift Swim', re.compile(r'\bSwift Swim or rain abusers\b', re.I), 'rain abusers'),
    ('Swift Swim', re.compile(r'\bSwift Swim pressure\b', re.I), 'rain-speed pressure'),
    ('Snow Warning', re.compile(r'\bSnow Warning or Snow Cloak\b', re.I), 'snow-setting or snow-evasion ability'),
    ('Levitate', re.compile(r'\bFlying/Levitate partners for Earthquake\b', re.I), 'Flying-type or Ground-immune partners for Earthquake'),
    ('Levitate', re.compile(r'\bLevitate partners\b', re.I), 'Ground-immune partners'),
    ('Friend Guard', re.compile(r'\bFriend Guard/Magic Guard-style durability patterns\b', re.I), 'team damage-reduction or Magic Guard-style durability patterns'),
    ('Friend Guard', re.compile(r'\bFriend Guard\b', re.I), 'damage-reduction support'),
    ('Intimidate', re.compile(r'\bIntimidate-heavy boards\b', re.I), 'physical-attack-control boards'),
    ('Intimidate', re.compile(r'\bIntimidate/bulk control\b', re.I), 'physical-pressure and bulk control'),
    ('Intimidate', re.compile(r'\bIntimidate cycling\b', re.I), 'attack-lowering pivot cycling'),
    ('Intimidate', re.compile(r'\bIntimidate-style effects\b', re.I), 'attack-lowering effects'),
)

def canMentionAbility(pid, ability_name, legal_abilities_by_pid):
    return norm(ability_name) in legal_abilities_by_pid.get(pid, set())

def gate_ability_value(pid, value, legal_abilities_by_pid, counts):
    if isinstance(value, str):
        out = value
        for ability_name, pattern, replacement in ABILITY_REWRITES:
            if not canMentionAbility(pid, ability_name, legal_abilities_by_pid):
                out, n = pattern.subn(replacement, out)
                counts[ability_name] = counts.get(ability_name, 0) + n
        return out
    if isinstance(value, list):
        return [gate_ability_value(pid, item, legal_abilities_by_pid, counts) for item in value]
    if isinstance(value, dict):
        return {key: gate_ability_value(pid, item, legal_abilities_by_pid, counts) for key, item in value.items()}
    return value

def load_json(path):
    return json.loads(path.read_text())

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

def main():
    db_path = ROOT / 'public' / 'db.json'
    db = load_json(db_path)
    legal_moves_by_pid = {}
    for row in db.get('pokemon_moves', []):
        if str(row.get('is_legal', '')).lower() == 'yes':
            legal_moves_by_pid.setdefault(row.get('pokemon_id'), set()).add(norm(row.get('move_name')))

    counts = {"moves": {}, "abilities": {}}
    legal_abilities_by_pid = {}
    for row in db.get('pokemon_abilities', []):
        if str(row.get('is_legal', '')).lower() == 'yes':
            legal_abilities_by_pid.setdefault(row.get('pokemon_id'), set()).add(norm(row.get('ability_name')))
    for mon in db.get('pokemon', []):
        pid = mon.get('pokemon_id')
        for field in TARGET_FIELDS:
            if field in mon:
                mon[field] = gate_value(pid, mon[field], legal_moves_by_pid, counts["moves"])
                mon[field] = gate_ability_value(pid, mon[field], legal_abilities_by_pid, counts["abilities"])

    save_json(db_path, db)

    pokemon_path = DATA / 'pokemon.json'
    pokemon_doc = load_json(pokemon_path)
    for mon in pokemon_doc.get('pokemon', []):
        pid = mon.get('pokemon_id')
        for field in TARGET_FIELDS:
            if field in mon:
                mon[field] = gate_value(pid, mon[field], legal_moves_by_pid, counts["moves"])
                mon[field] = gate_ability_value(pid, mon[field], legal_abilities_by_pid, counts["abilities"])
    save_json(pokemon_path, pokemon_doc)

    print(json.dumps({'rewrites': counts}, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
