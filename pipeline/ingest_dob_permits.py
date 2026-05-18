"""
Ingest active DOB permits (Manhattan) into dob_permits.

Uses DOB NOW Approved Permits (rbx6-tga4). The legacy dataset ipu4-2q9a has
no rows with expiration_date in the future, so it cannot surface active work.

Filters mirror A1/A2/DM intent via major construction work types.

Usage:
  python ingest_dob_permits.py [--limit 10000]
  python ingest_dob_permits.py --signals-only   # after a partial run
"""

from __future__ import annotations

import argparse
from datetime import date
from typing import Any

from address_utils import ComplexAddressIndex
from borough_config import add_borough_cli_args, get_borough
from nyc_ingest_common import (
    dob_now_address,
    fetch_socrata,
    insert_rows,
    parse_date,
    parse_date_only,
)
from supabase_batch import recompute_dob_permit_signals
from supabase_client import fetch_all_complexes, get_supabase_client

# DOB NOW: Build – Approved Permits
DOB_NOW_API = "https://data.cityofnewyork.us/resource/rbx6-tga4.json"

CONSTRUCTION_WORK_TYPES = (
    "General Construction",
    "Structural",
    "Foundation",
    "Full Demolition",
    "Earth Work",
    "Support of Excavation",
)


def build_where(today: date, dob_borough: str) -> str:
    types_sql = ", ".join(f"'{t}'" for t in CONSTRUCTION_WORK_TYPES)
    return (
        f"borough='{dob_borough}' "
        f"AND expired_date > '{today.isoformat()}' "
        f"AND permit_status='Permit Issued' "
        f"AND work_type in ({types_sql})"
    )


def row_to_permit(row: dict[str, Any], today: date, dob_borough: str) -> dict[str, Any] | None:
    if (row.get("borough") or "").strip().upper() != dob_borough:
        return None
    if (row.get("permit_status") or "").strip() != "Permit Issued":
        return None

    work_type = (row.get("work_type") or "").strip()
    if work_type not in CONSTRUCTION_WORK_TYPES:
        return None

    exp = parse_date_only(row.get("expired_date"))
    if not exp or exp <= today:
        return None

    address = dob_now_address(row)
    if not address:
        return None

    return {
        "address": address,
        "permit_type": work_type[:50],
        "permit_status": "ISSUED",
        "filing_date": parse_date(row.get("approved_date") or row.get("issued_date")),
        "expiration_date": parse_date(row.get("expired_date")),
        "job_description": (row.get("job_description") or "")[:500] or None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_borough_cli_args(parser, default="MN")
    parser.add_argument("--limit", type=int, default=10_000)
    parser.add_argument(
        "--signals-only",
        action="store_true",
        help="Recompute construction signals from dob_permits (skip fetch/insert)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Rows per Supabase insert batch (default 50)",
    )
    args = parser.parse_args()

    today = date.today()
    client = get_supabase_client()
    borough = get_borough(args.borough)

    if args.signals_only:
        recompute_dob_permit_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw = fetch_socrata(
        DOB_NOW_API,
        where=build_where(today, borough.dob_borough),
        limit=args.limit * 2,
        desc="Fetching DOB permits",
    )

    permits: list[dict[str, Any]] = []

    for row in raw:
        rec = row_to_permit(row, today, borough.dob_borough)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        permits.append({**rec, "complex_id": cid})
        if len(permits) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "dob_permits", permits, batch_size=args.batch_size
    )

    recompute_dob_permit_signals(client)
    print(
        f"Done. Inserted: {inserted}, skipped: {skipped}. "
        "Run --signals-only anytime to refresh building counts."
    )


if __name__ == "__main__":
    main()
