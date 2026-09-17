"""
Ingest NYC housing court / HPD litigation cases into housing_court_cases.

Dataset: 59kj-x8nc (Housing Litigation). Broader than HP-only ingest_hp_actions.
User-requested id kwe3-k5aw is not a housing-court feed.

Usage:
  python ingest_housing_court.py [--limit 30000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex
from nyc_ingest_common import (
    fetch_socrata,
    hp_address,
    insert_rows,
    log_unmatched,
    parse_date,
)
from supabase_batch import recompute_housing_court_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

COURT_API = "https://data.cityofnewyork.us/resource/59kj-x8nc.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "housing_court_unmatched.csv"
BOROIDS = {"1", "3", "4", "MANHATTAN", "BROOKLYN", "QUEENS"}


def row_to_case(row: dict[str, Any]) -> dict[str, Any] | None:
    boro = str(row.get("boroid") or row.get("borough") or "").strip().upper()
    if boro not in BOROIDS:
        return None

    address = hp_address(row)
    if not address:
        return None

    return {
        "address": address,
        "case_type": row.get("casetype"),
        "filing_date": parse_date(row.get("caseopendate") or row.get("filingdate")),
        "case_status": row.get("casestatus"),
        "respondent": row.get("respondent") or row.get("respondentname"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--signals-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_housing_court_signals(client)
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    where = "boroid in ('1','3','4')"
    raw = fetch_socrata(
        COURT_API, where=where, limit=args.limit, desc="Fetching housing court cases"
    )

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for row in raw:
        rec = row_to_case(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=80)
        if not cid:
            unmatched.append({"address": rec["address"], "case_type": rec.get("case_type") or ""})
        records.append({**rec, "complex_id": cid})

    inserted, skipped = insert_rows(
        client, "housing_court_cases", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "case_type"])
    recompute_housing_court_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
