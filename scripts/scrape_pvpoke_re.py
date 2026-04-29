#!/usr/bin/env python3
"""
scripts/scrape_pvpoke_re.py — Fetch pvpoke-re multilingual gamemasters and emit
flat localized JSON maps for the pogo_teambuilder app.

For each of the 6 supported locales (DE/ES/FR/IT/PT-BR/JA), pulls
`<lang>.pvpoke-re.com/data/gamemaster.min.json`, projects into three flat
`{key: localized_string}` maps (pokemon names, move names, cup titles) and
writes them to `src/data/i18n/`. GitHub Pages picks them up on push to `master`.

These published JSONs are consumed by the app as a *remote overlay* on top of
bundled JSONs that ship with the build. Manual overrides (e.g. open-league
labels `great/ultra/master → Superliga/Hyperliga/Meisterliga`) live in the
private pogo_teambuilder repo's `tools/name_overrides.json` and are baked into
the bundled JSONs by `tools/scrape_names.py` at app-build time. Provider
lookup chain (`overlay → bundled → gamemaster`) preserves bundled override
keys that are absent from the overlay, so this CI pipeline only needs raw
pvpoke-re data.

Output layout:
  src/data/i18n/pokemon_names_<lang>.json
  src/data/i18n/move_names_<lang>.json
  src/data/i18n/cup_titles_<lang>.json
(18 files total; <lang> ∈ {de, es, fr, it, pt_br, ja}).

Usage:
  python3 scripts/scrape_pvpoke_re.py             # full fetch, default output
  python3 scripts/scrape_pvpoke_re.py --no-fetch  # rebuild from on-disk cache
  python3 scripts/scrape_pvpoke_re.py --output-dir /tmp/i18n
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "scripts/.cache/pvpoke-re"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "src/data/i18n"

# Internal locale → pvpoke-re host. Japanese is served from the apex domain
# (no language subdomain). PT-BR is at `pt-br.`. Empty string = apex.
PVPOKE_RE_LOCALES = {
    "de": "de",
    "es": "es",
    "fr": "fr",
    "it": "it",
    "pt_br": "pt-br",
    "ja": "",
}

USER_AGENT = "Mozilla/5.0 (PogoTeamBuilder/scraper)"
THROTTLE_SEC = 0.2


def fetch_locale(subdomain: str, no_fetch: bool) -> dict:
    """Fetch one locale's gamemaster.min.json, with persistent on-disk cache."""
    cache_key = subdomain if subdomain else "apex"
    cache_path = CACHE_DIR / f"{cache_key}.raw.json"
    if cache_path.exists():
        with cache_path.open(encoding="utf-8-sig") as f:
            return json.load(f)
    if no_fetch:
        raise RuntimeError(
            f"No cache for '{cache_key}' and --no-fetch was set. "
            f"Re-run without --no-fetch to populate."
        )

    host = f"{subdomain}.pvpoke-re.com" if subdomain else "pvpoke-re.com"
    url = f"https://{host}/data/gamemaster.min.json"
    print(f"[{cache_key}] GET {url}")
    time.sleep(THROTTLE_SEC)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
    except urllib.error.URLError as e:
        raise RuntimeError(f"Fetch failed for {url}: {e}") from e

    text = raw.decode("utf-8-sig")
    data = json.loads(text)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    return data


def extract_locale_maps(data: dict, locale: str) -> dict:
    """Validate schema and project into pokemon/moves/cups flat maps."""
    for key in ("pokemon", "moves", "formats"):
        if key not in data:
            raise RuntimeError(
                f"[{locale}] schema drift: top-level '{key}' missing. "
                f"Got keys: {sorted(data.keys())[:10]}..."
            )

    pokemon = {}
    for p in data["pokemon"]:
        sid = p.get("speciesId")
        name = p.get("speciesName")
        if sid and name:
            pokemon[sid] = name

    moves = {}
    for m in data["moves"]:
        mid = m.get("moveId")
        name = m.get("name")
        if mid and name:
            moves[mid] = name

    # Cup titles: emit "{cup}_{cp}" + bare "{cup}" keys; skip "custom" (app L10n).
    cups = {}
    for fmt in data["formats"]:
        cup = fmt.get("cup")
        title = fmt.get("title")
        if not cup or not title or cup == "custom":
            continue
        cp = fmt.get("cp", 0)
        cups[f"{cup}_{cp}"] = title
        cups[cup] = title

    return {"pokemon": pokemon, "moves": moves, "cups": cups}


def write_locale_outputs(maps: dict, locale: str, output_dir: Path) -> None:
    """Write three JSON files for one locale into output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for kind, key in (
        ("pokemon_names", "pokemon"),
        ("move_names", "moves"),
        ("cup_titles", "cups"),
    ):
        path = output_dir / f"{kind}_{locale}.json"
        path.write_text(
            json.dumps(maps[key], ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-fetch", action="store_true",
                        help="Use on-disk cache only; never hit the network.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help=f"Override output directory (default: {DEFAULT_OUTPUT_DIR}).")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    for locale, subdomain in PVPOKE_RE_LOCALES.items():
        data = fetch_locale(subdomain, args.no_fetch)
        maps = extract_locale_maps(data, locale)
        write_locale_outputs(maps, locale, args.output_dir)
        print(
            f"[{locale}] wrote: {len(maps['pokemon'])} pokemon, "
            f"{len(maps['moves'])} moves, {len(maps['cups'])} cup keys"
        )

    print(f"\nOutput: {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
