#!/usr/bin/env python3
"""
Post-upstream-merge patches for gamemaster data.

Runs after merging upstream changes and before ranking generation.
Fixes known data issues that would break app deserialization.
"""

import json
import os
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')


def _collapse_scalar_arrays(text):
    """Collapse innermost arrays of scalars onto one line, matching the source
    style (e.g. "buffs": [0, -2]) instead of json's one-element-per-line output."""
    def repl(m):
        items = [tok.strip() for tok in m.group(0)[1:-1].split(',')]
        return '[' + ', '.join(tok for tok in items if tok) + ']'
    # Innermost arrays only: no nested brackets/braces inside.
    return re.sub(r'\[[^\[\]{}]*\]', repl, text)


def write_gamemaster_json(filepath, payload):
    """Write JSON preserving source style: minified for *.min.*, otherwise
    4-space indent with scalar arrays kept inline."""
    is_minified = '.min.' in os.path.basename(filepath)
    with open(filepath, 'w') as f:
        if is_minified:
            json.dump(payload, f, separators=(',', ':'))
        else:
            f.write(_collapse_scalar_arrays(json.dumps(payload, indent=4)))
        f.write('\n')

GAMEMASTER_FILES = [
    os.path.join(DATA_DIR, 'gamemaster', 'pokemon.json'),
    os.path.join(DATA_DIR, 'gamemaster.json'),
    os.path.join(DATA_DIR, 'gamemaster.min.json'),
]

# Competitors Cup (Worlds 2026 format): GL 1500 without Mimikyu. Open leagues track
# upstream as-is (new battle system, Mimikyu released); the cup has its own dedicated
# rankings and overrides. The cup ended on 2026-08-30; retain its metadata for
# saved teams, but no longer feature it or regenerate its rankings.
COMPETITORS_CUP_ACTIVE = False

COMPETITORS_FORMAT = {
    "title": "Competitors Cup",
    "cup": "competitors",
    "cp": 1500,
    "meta": "championshipseries",
    "showCup": True,
    "showFormat": True,
    "showMeta": True,
}

COMPETITORS_CUP_FILE = os.path.join(DATA_DIR, 'gamemaster', 'cups', 'competitors.json')

# Files containing the formats list. gamemaster/formats.json is a plain list
# (tab-indented); the two wrappers nest it under 'formats' (and cups under 'cups').
FORMATS_FILES = [
    os.path.join(DATA_DIR, 'gamemaster', 'formats.json'),
    os.path.join(DATA_DIR, 'gamemaster.json'),
    os.path.join(DATA_DIR, 'gamemaster.min.json'),
]

# Files containing the moves list. The two wrappers nest it under 'moves';
# gamemaster/moves.json is a plain list.
MOVES_FILES = [
    os.path.join(DATA_DIR, 'gamemaster.json'),
    os.path.join(DATA_DIR, 'gamemaster.min.json'),
    os.path.join(DATA_DIR, 'gamemaster', 'moves.json'),
]


def load_pokemon(filepath):
    """Load pokemon list from a gamemaster file (plain list or nested under 'pokemon' key)."""
    with open(filepath) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data, None
    return data['pokemon'], data


def save_pokemon(filepath, pokemon_list, wrapper):
    """Save pokemon list back, preserving original format."""
    if wrapper is not None:
        wrapper['pokemon'] = pokemon_list
        payload = wrapper
    else:
        payload = pokemon_list

    write_gamemaster_json(filepath, payload)


def load_moves(filepath):
    """Load moves list from a gamemaster file (plain list or nested under 'moves' key)."""
    with open(filepath) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data, None
    return data['moves'], data


def save_moves(filepath, moves_list, wrapper):
    """Save moves list back, preserving original format."""
    if wrapper is not None:
        wrapper['moves'] = moves_list
        payload = wrapper
    else:
        payload = moves_list

    write_gamemaster_json(filepath, payload)


def patch_formchange_missing_alternative_form_id(pokemon_list):
    """Ensure all formChange entries have alternativeFormId.

    If missing, infer from another pokemon whose formChange.alternativeFormId
    points to this one, or fall back to originalFormId.
    """
    patched = 0

    # Build reverse lookup: speciesId -> pokemon that transform INTO it
    reverse_map = {}
    for p in pokemon_list:
        fc = p.get('formChange')
        if fc and 'alternativeFormId' in fc:
            reverse_map[fc['alternativeFormId']] = p['speciesId']

    for p in pokemon_list:
        fc = p.get('formChange')
        if fc and 'alternativeFormId' not in fc:
            species_id = p['speciesId']
            # Try reverse lookup first (who transforms into me?)
            if species_id in reverse_map:
                fc['alternativeFormId'] = reverse_map[species_id]
            # Fall back to originalFormId
            elif 'originalFormId' in p:
                fc['alternativeFormId'] = p['originalFormId']
            else:
                print(f"  WARNING: Cannot infer alternativeFormId for {species_id}, skipping")
                continue

            print(f"  Patched {species_id}: alternativeFormId = {fc['alternativeFormId']}")
            patched += 1

    return patched


def dedupe_moves(moves_list):
    """Remove duplicate moveId entries that crash the app's Dictionary(uniqueKeysWithValues:).

    Keeps the richest entry per moveId (most keys); ties keep the first occurrence.
    Preserves original ordering of the kept entries.
    """
    # Pick which index to keep for each moveId
    keep_for_id = {}
    for i, m in enumerate(moves_list):
        mid = m.get('moveId')
        if mid is None:
            continue
        if mid not in keep_for_id or len(m) > len(moves_list[keep_for_id[mid]]):
            keep_for_id[mid] = i

    keep_indices = set(keep_for_id.values())
    removed = 0
    deduped = []
    for i, m in enumerate(moves_list):
        mid = m.get('moveId')
        if mid is None or i in keep_indices:
            deduped.append(m)
        else:
            print(f"  Removed duplicate move {mid} (idx {i}, {len(m)} keys)")
            removed += 1

    moves_list[:] = deduped
    return removed


def sync_competitors_overrides():
    """Derive overrides/competitors/1500.json from overrides/all/1500.json
    (minus Mimikyu) so Competitors movesets/editor scores track upstream's
    ongoing GL editorial changes."""
    if not COMPETITORS_CUP_ACTIVE:
        return 0
    src = os.path.join(DATA_DIR, 'overrides', 'all', '1500.json')
    dst = os.path.join(DATA_DIR, 'overrides', 'competitors', '1500.json')
    if not os.path.exists(src):
        return 0
    with open(src) as f:
        entries = [e for e in json.load(f) if e.get('speciesId') != 'mimikyu']
    payload = json.dumps(entries, separators=(',', ':'), ensure_ascii=False)
    if os.path.exists(dst):
        with open(dst) as f:
            if f.read().strip() == payload:
                return 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w') as f:
        f.write(payload)
    print(f"  Synced overrides/competitors/1500.json ({len(entries)} entries)")
    return 1


def ensure_competitors_format(formats_list):
    """Feature the cup only while active; keep retired metadata for saved teams."""
    if not COMPETITORS_CUP_ACTIVE:
        changed = 0
        for cup_format in formats_list:
            if cup_format.get('cup') == 'competitors':
                for flag in ('showCup', 'showFormat', 'showMeta'):
                    if cup_format.get(flag) is not False:
                        cup_format[flag] = False
                        changed += 1
        if changed:
            print("  Retired Competitors Cup from active formats")
        return changed
    if any(f.get('cup') == 'competitors' for f in formats_list):
        return 0
    formats_list.insert(0, dict(COMPETITORS_FORMAT))
    print("  Re-inserted Competitors Cup format entry")
    return 1


def remove_pip_format(formats_list):
    """Drop upstream's 'P!P Championship Series' format: it aliases open GL
    rankings, so in the app it's a duplicate of Great League — the dedicated
    Competitors Cup covers the tournament format instead. (The championshipseries
    meta GROUP file stays; the Competitors format references it.)"""
    if not COMPETITORS_CUP_ACTIVE:
        return 0
    before = len(formats_list)
    formats_list[:] = [f for f in formats_list if f.get('cup') != 'championshipseries']
    removed = before - len(formats_list)
    if removed:
        print("  Removed P!P Championship Series format (duplicate of Great League)")
    return removed


def ensure_competitors_cup(cups_list):
    """Ensure the compiled gamemaster's cups array contains the competitors cup
    (upstream's compiled gamemaster.json doesn't know about it)."""
    if not COMPETITORS_CUP_ACTIVE:
        return 0
    if any(c.get('name') == 'competitors' for c in cups_list):
        return 0
    with open(COMPETITORS_CUP_FILE) as f:
        cups_list.append(json.load(f))
    print("  Re-inserted competitors cup definition")
    return 1


def write_formats_json(filepath, formats_list):
    """gamemaster/formats.json is tab-indented."""
    with open(filepath, 'w') as f:
        f.write(json.dumps(formats_list, indent='\t', ensure_ascii=False))
        f.write('\n')


PATCHES = [
    ("formChange missing alternativeFormId", patch_formchange_missing_alternative_form_id),
]

MOVES_PATCHES = [
    ("duplicate moveId", dedupe_moves),
]


def main():
    total_patched = 0

    for filepath in GAMEMASTER_FILES:
        if not os.path.exists(filepath):
            continue

        print(f"Checking {os.path.relpath(filepath, DATA_DIR)}...")
        pokemon_list, wrapper = load_pokemon(filepath)

        file_patched = 0
        for name, patch_fn in PATCHES:
            count = patch_fn(pokemon_list)
            if count > 0:
                print(f"  [{name}]: {count} fix(es)")
                file_patched += count

        if file_patched > 0:
            save_pokemon(filepath, pokemon_list, wrapper)
            total_patched += file_patched

    for filepath in MOVES_FILES:
        if not os.path.exists(filepath):
            continue

        print(f"Checking {os.path.relpath(filepath, DATA_DIR)} (moves)...")
        moves_list, wrapper = load_moves(filepath)

        file_patched = 0
        for name, patch_fn in MOVES_PATCHES:
            count = patch_fn(moves_list)
            if count > 0:
                print(f"  [{name}]: {count} fix(es)")
                file_patched += count

        if file_patched > 0:
            save_moves(filepath, moves_list, wrapper)
            total_patched += file_patched

    for filepath in FORMATS_FILES:
        if not os.path.exists(filepath):
            continue

        print(f"Checking {os.path.relpath(filepath, DATA_DIR)} (formats)...")
        with open(filepath) as f:
            data = json.load(f)
        is_wrapper = not isinstance(data, list)
        formats_list = data['formats'] if is_wrapper else data

        file_patched = ensure_competitors_format(formats_list)
        file_patched += remove_pip_format(formats_list)
        if is_wrapper and 'cups' in data:
            file_patched += ensure_competitors_cup(data['cups'])

        if file_patched > 0:
            if is_wrapper:
                write_gamemaster_json(filepath, data)
            else:
                write_formats_json(filepath, formats_list)
            total_patched += file_patched

    total_patched += sync_competitors_overrides()

    if total_patched > 0:
        print(f"\nTotal patches applied: {total_patched}")
    else:
        print("All data OK, no patches needed.")


if __name__ == '__main__':
    main()
