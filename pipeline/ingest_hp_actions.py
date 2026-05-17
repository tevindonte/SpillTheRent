"""
Ingest housing court tenant actions (Manhattan) into hp_actions.

Dataset: 59kj-x8nc (Housing Litigation)
Tenant Action cases are HP-style proceedings in this feed.

Usage:
  python ingest_hp_actions.py [--limit 20000]
  python ingest_hp_actions.py --signals-only   # after a partial run
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex
from nyc_ingest_common import (
    hp_address,
    fetch_socrata,
    insert_rows,
    log_unmatched,
    parse_date,
)
from supabase_batch import recompute_hp_action_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

HP_API = "https://data.cityofnewyork.us/resource/59kj-x8nc.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "hp_unmatched.csv"

# Tenant Action ≈ HP proceedings in NYC housing court open data
HP_CASE_TYPES = ("Tenant Action", "Tenant Action/Harrassment")


def is_hp_case(row: dict[str, Any]) -> bool:
    ct = (row.get("casetype") or "").strip()
    if ct in HP_CASE_TYPES:
        return True
    return "HP" in ct.upper()


def row_to_action(row: dict[str, Any]) -> dict[str, Any] | None:
    boro = str(row.get("boroid") or row.get("borough") or "").strip().upper()
    if boro not in ("1", "MANHATTAN", "MN"):
        return None
    if not is_hp_case(row):
        return None

    address = hp_address(row)
    if not address:
        return None

    case_number = str(row.get("litigationid") or row.get("caseid") or "")
    if not case_number:
        return None

    return {
        "address": address,
        "case_number": case_number,
        "filing_date": parse_date(row.get("caseopendate")),
        "case_status": row.get("casestatus") or row.get("casestatuscode"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20_000)
    parser.add_argument(
        "--signals-only",
        action="store_true",
        help="Recompute complex HP counts from hp_actions (skip fetch/insert)",
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
        recompute_hp_action_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw = fetch_socrata(
        HP_API,
        where="boroid='1'",
        limit=args.limit * 2,
        desc="Fetching housing court cases",
    )

    actions: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []

    for row in raw:
        rec = row_to_action(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append({"address": rec["address"], "case_number": rec["case_number"]})
        actions.append({**rec, "complex_id": cid})
        if len(actions) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "hp_actions", actions, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "case_number"])

    recompute_hp_action_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
