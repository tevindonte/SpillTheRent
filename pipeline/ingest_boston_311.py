"""
Ingest Boston 311 housing-related complaints.

Source: Analyze Boston 311 Service Requests (yearly resources use type/subject/reason).
Filters bed bugs, pests, heat, and building-related reasons.

Usage:
  python ingest_boston_311.py [--limit 30000]
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any

from address_utils import ComplexAddressIndex, normalize_address
from boston_ckan import datastore_search_sql, parse_float
from nyc_ingest_common import insert_rows, log_unmatched, parse_date, year_from_date
from supabase_batch import recompute_simple_count_signal
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

# 2025 yearly resource (legacy schema with type/subject/reason). Brief ID was a typo.
RESOURCE_311 = "9d7c2214-4709-478a-a2e8-fb2020a5bb94"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "boston_311_unmatched.csv"


def recompute_boston_311_signals(client=None) -> None:
    recompute_simple_count_signal(
        client,
        table="boston_311_complaints",
        count_column="boston_311_count",
        label="Boston 311 signals",
    )


def row_to_complaint(row: dict[str, Any]) -> dict[str, Any] | None:
    sid = str(
        row.get("case_enquiry_id")
        or row.get("service_request_id")
        or row.get("case_id")
        or ""
    ).strip()
    if not sid:
        return None

    address = normalize_address(
        row.get("location_street_name") or row.get("location") or row.get("full_address")
    )
    # Strip trailing ZIP so fuzzy match aligns with complexes.address
    if address:
        parts = address.rsplit(" ", 1)
        if len(parts) == 2 and parts[1][:5].isdigit():
            address = parts[0]
    if not address:
        return None

    return {
        "address": address,
        "service_request_id": sid,
        "type": (str(row.get("type") or row.get("service_name") or "").strip() or None),
        "subject": (str(row.get("subject") or row.get("case_topic") or "").strip() or None),
        "reason": (str(row.get("reason") or "").strip() or None),
        "neighborhood": (str(row.get("neighborhood") or "").strip() or None),
        "latitude": parse_float(row.get("latitude")),
        "longitude": parse_float(row.get("longitude")),
        "created_dt": parse_date(row.get("open_dt") or row.get("created_dt") or row.get("open_date")),
        "closed_dt": parse_date(row.get("closed_dt") or row.get("close_date")),
    }


def is_bedbug(rec: dict[str, Any]) -> bool:
    blob = f"{rec.get('type') or ''} {rec.get('subject') or ''} {rec.get('reason') or ''}".upper()
    return "BED BUG" in blob or "BEDBUG" in blob


def apply_bedbug_flags(client, updates: list[tuple[str, int | None]]) -> None:
    """Set has_bedbug_history + bedbug_last_reported_year on matched complexes."""
    by_id: dict[str, int] = {}
    for cid, year in updates:
        if year is None:
            by_id.setdefault(cid, datetime.now(timezone.utc).year)
            continue
        prev = by_id.get(cid)
        by_id[cid] = year if prev is None else max(prev, year)

    for cid, year in by_id.items():
        client.table("complexes").update(
            {
                "has_bedbug_history": True,
                "bedbug_last_reported_year": year,
            }
        ).eq("id", cid).execute()
    print(f"Bedbug flags updated for {len(by_id)} complexes.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--signals-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_boston_311_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    sql = f"""
      SELECT * FROM "{RESOURCE_311}"
      WHERE type ILIKE '%Bed Bug%'
         OR type ILIKE '%Pest%'
         OR type ILIKE '%Heat%'
         OR reason ILIKE '%Building%'
    """
    raw = datastore_search_sql(sql, limit=args.limit, desc="Fetching Boston 311")

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    bedbug_updates: list[tuple[str, int | None]] = []

    for row in raw:
        rec = row_to_complaint(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append(
                {
                    "address": rec["address"],
                    "service_request_id": rec["service_request_id"],
                }
            )
        else:
            if is_bedbug(rec):
                bedbug_updates.append((cid, year_from_date(rec.get("created_dt"))))
        records.append({**rec, "complex_id": cid})
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "boston_311_complaints", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "service_request_id"])
    if bedbug_updates:
        apply_bedbug_flags(client, bedbug_updates)
    recompute_boston_311_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
