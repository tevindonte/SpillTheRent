"""
Ingest OATH short-term / illegal hotel violations (Manhattan).

Dataset: jz4z-kudi (OATH Hearings Division Case Status)

Short-term rental text lives in violation_details, not charge descriptions.

Usage:
  python ingest_oath.py [--limit 20000]
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from typing import Any

from address_utils import ComplexAddressIndex
from nyc_ingest_common import (
    fetch_socrata,
    insert_rows,
    log_unmatched,
    oath_address,
    oath_description,
    oath_fetch_where,
    oath_is_short_term,
    parse_date,
    batch_update_complex_signals,
)
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

OATH_API = "https://data.cityofnewyork.us/resource/jz4z-kudi.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "oath_unmatched.csv"


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    borough = (row.get("violation_location_borough") or "").strip().upper()
    if borough != "MANHATTAN":
        return None
    if not oath_is_short_term(row):
        return None

    address = oath_address(row)
    if not address:
        return None

    penalty = row.get("penalty_imposed") or row.get("total_violation_amount")
    try:
        penalty_amount = float(penalty) if penalty not in (None, "") else None
    except (TypeError, ValueError):
        penalty_amount = None

    return {
        "address": address,
        "violation_description": oath_description(row),
        "issue_date": parse_date(row.get("violation_date")),
        "penalty_amount": penalty_amount,
        "status": row.get("hearing_result") or row.get("hearing_status") or "unknown",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20_000)
    args = parser.parse_args()

    client = get_supabase_client()
    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw = fetch_socrata(
        OATH_API,
        where=oath_fetch_where(),
        limit=args.limit * 2,
        desc="Fetching OATH violations",
    )

    violations: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    by_complex: dict[str, int] = defaultdict(int)

    for row in raw:
        rec = row_to_violation(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append({"address": rec["address"]})
        payload = {**rec, "complex_id": cid}
        violations.append(payload)
        if cid:
            by_complex[cid] += 1
        if len(violations) >= args.limit:
            break

    inserted, skipped = insert_rows(client, "oath_violations", violations)
    log_unmatched(UNMATCHED_CSV, unmatched, ["address"])

    updates = {
        cid: {"oath_violation_count": count} for cid, count in by_complex.items() if count > 0
    }
    if updates:
        print(f"Updating {len(updates)} complexes with OATH signals…")
        batch_update_complex_signals(updates)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}, buildings: {len(updates)}")


if __name__ == "__main__":
    main()
