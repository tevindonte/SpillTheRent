"""
Ingest HPD Bedbug Registry (Manhattan) into bedbug_reports.

Dataset: wz6d-d3jb (Bedbug Reporting) — not wz6d-ycwk (deprecated).

Usage:
  python ingest_bedbugs.py [--limit 50000]
  python ingest_bedbugs.py --signals-only   # after a partial run
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import build_address_from_parts, ComplexAddressIndex
from borough_config import add_borough_cli_args, get_borough
from nyc_ingest_common import (
    fetch_socrata,
    insert_rows,
    log_unmatched,
    year_from_date,
)
from supabase_batch import recompute_bedbug_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

BEDBUG_API = "https://data.cityofnewyork.us/resource/wz6d-d3jb.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "bedbug_unmatched.csv"


def row_to_report(row: dict[str, Any], bedbug_borough: str) -> dict[str, Any] | None:
    borough = (row.get("borough") or "").strip().upper()
    if borough != bedbug_borough:
        return None

    address = build_address_from_parts(
        row.get("house_number"),
        row.get("street_name"),
        row.get("postcode"),
    )
    if not address:
        return None

    filing_year = year_from_date(row.get("filing_date")) or year_from_date(
        row.get("filling_period_end_date")
    )
    if not filing_year:
        return None

    return {
        "address": address,
        "building_id": str(row.get("building_id") or "")[:50] or None,
        "infested_unit_count": int(row.get("infested_dwelling_unit_count") or 0),
        "eradicated_unit_count": int(row.get("eradicated_unit_count") or 0),
        "filing_year": filing_year,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_borough_cli_args(parser, default="MN")
    parser.add_argument("--limit", type=int, default=50_000)
    parser.add_argument(
        "--signals-only",
        action="store_true",
        help="Recompute complex bedbug columns from bedbug_reports (skip fetch/insert)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Rows per Supabase insert batch (default 50)",
    )
    args = parser.parse_args()

    client = get_supabase_client()

    if args.signals_only:
        recompute_bedbug_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    borough = get_borough(args.borough)
    raw = fetch_socrata(
        BEDBUG_API,
        where=f"borough='{borough.bedbug_borough}'",
        limit=args.limit,
        desc="Fetching bedbug reports",
    )

    reports: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []

    from tqdm import tqdm

    for row in tqdm(raw, desc="Matching addresses"):
        rec = row_to_report(row, borough.bedbug_borough)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append({"address": rec["address"], "filing_year": str(rec["filing_year"])})
        reports.append({**rec, "complex_id": cid})

    inserted, skipped = insert_rows(
        client, "bedbug_reports", reports, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "filing_year"])

    recompute_bedbug_signals(client)
    print(f"Done. Inserted: {inserted}, skipped duplicates: {skipped}")


if __name__ == "__main__":
    main()
