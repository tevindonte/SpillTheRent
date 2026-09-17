"""
Ingest DEP ECB / environmental violations into dep_violations.

Dataset: skr7-cxt3 (DEP ECB Violations).
User-requested id 3qem-6v3v is a different (shelter) dataset.

Usage:
  python ingest_dep.py [--limit 20000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, build_address_from_parts
from nyc_ingest_common import fetch_socrata, insert_rows, log_unmatched, parse_date
from supabase_batch import recompute_dep_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

DEP_API = "https://data.cityofnewyork.us/resource/skr7-cxt3.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "dep_unmatched.csv"
BOROUGHS = ("MANHATTAN", "BROOKLYN", "QUEENS")


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    boro = str(
        row.get("violation_location_borough") or row.get("respondent_address_borough") or ""
    ).strip().upper()
    if boro not in BOROUGHS:
        return None

    address = build_address_from_parts(
        row.get("violation_location_house") or row.get("respondent_address_house"),
        row.get("violation_location_street_name")
        or row.get("violation_location_street")
        or row.get("respondent_address_street_name"),
        row.get("violation_location_zip_code") or row.get("respondent_address_zip_code"),
    )
    if not address:
        return None

    vtype = (
        row.get("charge_1_code_description")
        or row.get("issuing_agency")
        or "DEP Violation"
    )
    description = row.get("violation_details") or row.get("charge_1_code_description")

    return {
        "address": address,
        "violation_type": str(vtype)[:500],
        "description": (str(description)[:2000] if description else None),
        "issue_date": parse_date(row.get("violation_date") or row.get("hearing_date")),
        "status": row.get("compliance_status") or row.get("hearing_status"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--signals-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_dep_signals(client)
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    where = (
        "violation_location_borough in ('MANHATTAN','BROOKLYN','QUEENS') "
        "AND violation_location_house IS NOT NULL"
    )
    raw = fetch_socrata(DEP_API, where=where, limit=args.limit, desc="Fetching DEP violations")

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for row in raw:
        rec = row_to_violation(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append({"address": rec["address"]})
        records.append({**rec, "complex_id": cid})

    inserted, skipped = insert_rows(
        client, "dep_violations", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address"])
    recompute_dep_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
