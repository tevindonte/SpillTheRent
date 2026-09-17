"""
Ingest DOB complaints (Manhattan / Brooklyn / Queens) into dob_complaints.

Dataset: eabe-havv (DOB Complaints Received)
Note: complaint_category is a DOB code; we map residential-relevant codes and
filter community boards for MN/BK/QN (user-requested boroughs).

Usage:
  python ingest_dob_complaints.py [--limit 50000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, build_address_from_parts
from nyc_ingest_common import fetch_socrata, insert_rows, log_unmatched, parse_date
from supabase_batch import recompute_dob_complaint_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

DOB_API = "https://data.cityofnewyork.us/resource/eabe-havv.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "dob_complaints_unmatched.csv"

# Residential / tenant-relevant DOB category codes (from DOB complaint_category.pdf)
RESIDENTIAL_CATEGORIES: dict[str, str] = {
    "45": "ILLEGAL CONVERSION",
    "1A": "ILLEGAL CONVERSION COMMERCIAL/MANUFACTURING TO RESIDENTIAL",
    "30": "ELEVATOR: NO PERMIT / ILLEGAL",
    "62": "ELEVATOR: DANGER CONDITION / SHAFT OPEN",
    "63": "ELEVATOR: DEFECTIVE / INOPERATIVE",
    "64": "ELEVATOR SHAFT: OPEN AND UNGUARDED",
    "80": "ELEVATOR: NOT INSPECTED / ILLEGAL / NO PERMIT",
    "56": "BOILER: FUMES / SMOKE / CARBON MONOXIDE",
    "57": "BOILER: ILLEGAL",
    "58": "BOILER: DEFECTIVE / INOPERATIVE / NO PERMIT",
    "66": "PLUMBING: ILLEGAL / UNPERMITTED",
    "76": "PLUMBING: UNLICENSED OR IMPROPER WORK IN PROGRESS",
    "94": "PLUMBING: DEFECTIVE / LEAKING / NOT MAINTAINED",
    "52": "SPRINKLER SYSTEM – INADEQUATE",
    "54": "WALL / RETAINING WALL – BULGING / CRACKED",
    "84": "FACADE: DEFECTIVE / CRACKING",
    "31": "PERMIT - NO PERMIT POSTED",
    "05": "PERMIT - NO PERMIT POSTED",
    "4B": "CONSTRUCTION - AFTER HOURS",
    "73": "FAILURE TO MAINTAIN",
    "74": "PERMIT EXPIRED / WORK WITHOUT PERMIT",
    "23": "SIDEWALK SHED / SIDEWALK OBSTRUCTION",
}

# Keywords the product brief asked for — matched against mapped descriptions
RESIDENTIAL_KEYWORDS = (
    "PLUMBING",
    "ELEVATOR",
    "HEATING",
    "BOILER",
    "PAINT",
    "PLASTER",
    "UNSANITARY",
    "DOOR",
    "WINDOW",
    "GENERAL",
    "ILLEGAL CONVERSION",
    "SPRINKLER",
    "FACADE",
    "FAILURE TO MAINTAIN",
)


def community_board_allowed(cb: Any) -> bool:
    """Manhattan 101-112, Brooklyn 301-318, Queens 401-414 (and short forms)."""
    raw = str(cb or "").strip()
    if not raw.isdigit():
        return False
    n = int(raw)
    if 1 <= n <= 12:  # Manhattan sometimes stored without borough prefix
        return True
    if 101 <= n <= 112:
        return True
    if 301 <= n <= 318:
        return True
    if 401 <= n <= 414:
        return True
    return False


def category_allowed(code: str, description: str) -> bool:
    blob = f"{code} {description}".upper()
    if any(k in blob for k in RESIDENTIAL_KEYWORDS):
        return True
    return code.upper() in {c.upper() for c in RESIDENTIAL_CATEGORIES}


def row_to_complaint(row: dict[str, Any]) -> dict[str, Any] | None:
    if not community_board_allowed(row.get("community_board")):
        return None

    code = str(row.get("complaint_category") or "").strip()
    description = RESIDENTIAL_CATEGORIES.get(code) or RESIDENTIAL_CATEGORIES.get(code.upper()) or code
    if not category_allowed(code, description):
        return None

    address = build_address_from_parts(
        row.get("house_number") or row.get("housenumber"),
        row.get("house_street") or row.get("streetname") or row.get("street_name"),
        row.get("zip_code") or row.get("zip"),
    )
    if not address:
        return None

    date_entered = parse_date(row.get("date_entered") or row.get("dateentered"))
    if not date_entered:
        return None

    return {
        "address": address,
        "complaint_category": code or None,
        "complaint_description": description[:500] if description else None,
        "status": (row.get("status") or None),
        "date_entered": date_entered,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument(
        "--signals-only",
        action="store_true",
        help="Recompute dob_complaint_count from dob_complaints",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_dob_complaint_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    # Fetch a larger pool — many rows fail residential/CB filters
    raw = fetch_socrata(
        DOB_API,
        where=None,
        limit=max(args.limit * 4, args.limit),
        desc="Fetching DOB complaints",
    )

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for row in raw:
        rec = row_to_complaint(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append(
                {
                    "address": rec["address"],
                    "complaint_category": rec.get("complaint_category") or "",
                }
            )
        records.append({**rec, "complex_id": cid})
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "dob_complaints", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "complaint_category"])
    recompute_dob_complaint_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
