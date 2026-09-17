"""
Ingest FDNY fire-code violations into fdny_violations.

Primary source: jz4z-kudi (OATH Hearings) filtered to FIRE DEPARTMENT OF NYC.
The dedicated avgm-ztsb FDNY feed frequently times out on Socrata.

Usage:
  python ingest_fdny.py [--limit 20000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, build_address_from_parts
from nyc_ingest_common import fetch_socrata, insert_rows, log_unmatched, parse_date
from supabase_batch import recompute_fdny_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

# OATH hearings — reliable; avgm-ztsb is the FDNY-labeled twin but often unusable
FDNY_API = "https://data.cityofnewyork.us/resource/jz4z-kudi.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "fdny_unmatched.csv"
BOROUGHS = ("MANHATTAN", "BROOKLYN", "QUEENS")


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    agency = str(row.get("issuing_agency") or "").upper()
    if "FIRE" not in agency and "FDNY" not in agency:
        return None

    boro = str(row.get("violation_location_borough") or "").strip().upper()
    if boro not in BOROUGHS:
        return None

    address = build_address_from_parts(
        row.get("violation_location_house"),
        row.get("violation_location_street_name"),
        row.get("violation_location_zip_code"),
    )
    if not address:
        return None

    vtype = (
        row.get("charge_1_code_description")
        or row.get("violation_description")
        or row.get("charge_1_code")
        or "FDNY Violation"
    )
    description = (
        row.get("violation_details")
        or row.get("violation_description")
        or row.get("charge_1_code_description")
    )

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
        recompute_fdny_signals(client)
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw: list[dict[str, Any]] = []
    for boro in BOROUGHS:
        if len(raw) >= args.limit:
            break
        need = args.limit - len(raw)
        where = (
            f"violation_location_borough='{boro}' "
            "AND upper(issuing_agency) like '%FIRE%' "
            "AND violation_location_house IS NOT NULL "
            "AND violation_location_street_name IS NOT NULL"
        )
        chunk = fetch_socrata(
            FDNY_API,
            where=where,
            limit=need,
            desc=f"Fetching FDNY ({boro.title()})",
            page_size=5_000,
            timeout=120,
        )
        raw.extend(chunk)

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for row in raw:
        rec = row_to_violation(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=80)
        if not cid:
            unmatched.append({"address": rec["address"]})
        records.append({**rec, "complex_id": cid})
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "fdny_violations", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address"])
    recompute_fdny_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
