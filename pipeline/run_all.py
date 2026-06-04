"""
Run NYC ingestion pipelines in dependency order.

Usage (from repo root):
  cd pipeline && pip install -r requirements.txt && python run_all.py
  python run_all.py --only hpd,bedbugs
  python run_all.py --dry-run
  python run_all.py --with-google   # includes paid Google enrichment (avoid by default)

Default steps use free NYC Open Data only (no Google Places / Street View charges).
"""

from __future__ import annotations

import argparse
import importlib
import sys
from typing import Callable

from dotenv import load_dotenv

load_dotenv()
load_dotenv("../.env.local")

# Free NYC open-data ingest (recommended for scheduled runs)
FREE_STEPS: list[tuple[str, str]] = [
    ("pluto", "ingest_pluto"),
    ("hpd", "ingest_hpd"),
    ("bedbugs", "ingest_bedbugs"),
    ("rent_stabilization", "ingest_rent_stabilization"),
    ("hp_actions", "ingest_hp_actions"),
    ("oath", "ingest_oath"),
    ("dob", "ingest_dob_permits"),
    ("landlords", "ingest_landlords"),
]

# Paid Google APIs — run manually only when you accept billing
GOOGLE_STEPS: list[tuple[str, str]] = [
    ("street_view", "enrich_street_view"),
    ("google_places", "enrich_google_places"),
]


def load_main(module_name: str) -> Callable[[], None] | None:
    mod = importlib.import_module(module_name)
    main = getattr(mod, "main", None)
    return main if callable(main) else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SpillTheRent ingest pipelines")
    parser.add_argument(
        "--only",
        help="Comma-separated step names (e.g. hpd,bedbugs)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List steps only, do not execute",
    )
    parser.add_argument(
        "--with-google",
        action="store_true",
        help="Also run street_view + google_places (paid Google APIs)",
    )
    args = parser.parse_args()

    only = {s.strip() for s in args.only.split(",")} if args.only else None
    steps = FREE_STEPS + (GOOGLE_STEPS if args.with_google else [])

    for name, module in steps:
        if only and name not in only:
            continue
        print(f"\n=== {name} ({module}) ===", flush=True)
        if args.dry_run:
            continue
        fn = load_main(module)
        if fn is None:
            print(f"  skip: no main() in {module}", file=sys.stderr)
            continue
        try:
            fn()
            print(f"  done: {name}", flush=True)
        except Exception as e:
            print(f"  failed: {name}: {e}", file=sys.stderr)
            raise

    if not args.with_google and not args.dry_run:
        print(
            "\nSkipped paid Google steps (street_view, google_places). "
            "Pass --with-google to include them.",
            flush=True,
        )

    print("\nAll requested pipelines finished.", flush=True)


if __name__ == "__main__":
    main()
