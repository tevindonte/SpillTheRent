"""
Ingest Boston ISD Building & Property Violations.

Source: Analyze Boston — building-and-property-violations1
(brief resource_id 800a2663-22cb-… was retired; using current datastore id).

Usage:
  python ingest_boston_violations.py [--limit 50000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, build_address_from_parts, normalize_address
from boston_ckan import datastore_search, parse_float
from nyc_ingest_common import insert_rows, log_unmatched
from supabase_batch import recompute_simple_count_signal
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

VIOLATIONS_RESOURCE = "800a2663-1d6a-46e7-9356-bedb70f5332c"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "boston_violations_unmatched.csv"


def recompute_boston_violation_signals(client=None) -> None:
    recompute_simple_count_signal(
        client,
        table="boston_violations",
        count_column="boston_violation_count",
        label="Boston ISD violation signals",
    )


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    city = str(row.get("violation_city") or "").strip().lower()
    state = str(row.get("violation_state") or "").strip().upper()
    if state and state not in ("MA", "MASSACHUSETTS"):
        return None
    if city and "boston" not in city and city not in (
        "dorchester",
        "roxbury",
        "allston",
        "brighton",
        "charlestown",
        "hyde park",
        "jamaica plain",
        "mattapan",
        "roslindale",
        "west roxbury",
        "east boston",
        "south boston",
        "mission hill",
        "fenway",
        "back bay",
        "beacon hill",
        "south end",
        "downtown",
        "north end",
        "west end",
        "chinatown",
        "bay village",
        "leather district",
        "longwood",
    ):
        # Still allow if state is MA and city empty-ish
        if state != "MA" and "boston" not in city:
            return None

    ticket = str(row.get("case_no") or row.get("ticket_no") or "").strip()
    if not ticket:
        return None

    street = " ".join(
        p
        for p in (
            str(row.get("violation_street") or "").strip(),
            str(row.get("violation_suffix") or "").strip(),
        )
        if p
    )
    address = build_address_from_parts(
        row.get("violation_stno"),
        street,
        None,  # omit zip — complexes store street only
    )
    if not address:
        contact = normalize_address(row.get("contact_addr1"))
        address = contact
    if not address:
        return None

    return {
        "address": address,
        "ticket_no": ticket,
        "code": (str(row.get("code") or "").strip() or None),
        "description": (str(row.get("description") or "").strip() or None),
        "status": (str(row.get("status") or "").strip() or None),
        "latitude": parse_float(row.get("latitude")),
        "longitude": parse_float(row.get("longitude")),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument(
        "--signals-only",
        action="store_true",
        help="Recompute boston_violation_count only",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_boston_violation_signals(client)
        print("Done (signals only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw = datastore_search(
        VIOLATIONS_RESOURCE,
        limit=max(args.limit * 2, args.limit),
        desc="Fetching Boston ISD violations",
    )

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for row in raw:
        rec = row_to_violation(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append({"address": rec["address"], "ticket_no": rec["ticket_no"]})
        records.append({**rec, "complex_id": cid})
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "boston_violations", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "ticket_no"])
    recompute_boston_violation_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
