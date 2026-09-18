"""
Ingest Boston building permits for multifamily / residential work.

Source: Analyze Boston Approved Building Permits
(brief resource_id 601e4810-… was retired).

Usage:
  python ingest_boston_permits.py [--limit 20000]
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from typing import Any

from address_utils import ComplexAddressIndex, normalize_address
from boston_ckan import datastore_search, parse_float
from nyc_ingest_common import insert_rows, log_unmatched, parse_date
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

PERMITS_RESOURCE = "6ddcd912-32a0-43df-9908-63574f8c7e77"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "boston_permits_unmatched.csv"

OCCUPANCY_OK = frozenset(
    {
        "MULTI-UNIT",
        "MULTI UNIT",
        "R2",
        "R3",
        "R4",
        "APARTMENT",
        "RESIDENTIAL",
        "1-2FAMILY",
        "1-3FAMILY",
        "1-4FAMILY",
        "1UNIT",
        "2UNIT",
        "3UNIT",
        "4UNIT",
        "5UNIT",
        "6UNIT",
        "7MORE",
        "MULTI",
    }
)


def occupancy_allowed(value: Any) -> bool:
    raw = str(value or "").strip().upper()
    if not raw:
        return False
    if raw in OCCUPANCY_OK:
        return True
    return any(
        tok in raw
        for tok in (
            "MULTI",
            "APART",
            "RESIDENT",
            "R2",
            "R3",
            "R4",
            "FAMILY",
            "UNIT",
        )
    )


def row_to_permit(row: dict[str, Any]) -> dict[str, Any] | None:
    worktype = str(row.get("worktype") or "").strip()
    if worktype.upper() == "SHORT FORM BLDG PERMIT":
        return None
    if not occupancy_allowed(row.get("occupancytype")):
        return None

    permitnumber = str(row.get("permitnumber") or "").strip()
    if not permitnumber:
        return None

    address = normalize_address(row.get("address"))
    if not address:
        return None

    return {
        "address": address,
        "permitnumber": permitnumber,
        "worktype": worktype or None,
        "description": (str(row.get("description") or "").strip() or None),
        "occupancytype": (str(row.get("occupancytype") or "").strip() or None),
        "latitude": parse_float(row.get("y_latitude") or row.get("latitude")),
        "longitude": parse_float(row.get("x_longitude") or row.get("longitude")),
        "issued_date": parse_date(row.get("issued_date")),
    }


def is_recent(issued_iso: str | None, years: int = 2) -> bool:
    if not issued_iso:
        return False
    try:
        dt = datetime.fromisoformat(issued_iso[:19])
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt >= datetime.now(timezone.utc) - timedelta(days=365 * years)
    except ValueError:
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20_000)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    client = get_supabase_client()
    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    raw = datastore_search(
        PERMITS_RESOURCE,
        limit=max(args.limit * 4, args.limit),
        desc="Fetching Boston permits",
    )

    records: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    construction_ids: set[str] = set()

    for row in raw:
        rec = row_to_permit(row)
        if not rec:
            continue
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched.append(
                {"address": rec["address"], "permitnumber": rec["permitnumber"]}
            )
        else:
            if is_recent(rec.get("issued_date")):
                construction_ids.add(cid)
        records.append({**rec, "complex_id": cid})
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "boston_permits", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "permitnumber"])

    for cid in construction_ids:
        client.table("complexes").update(
            {"has_active_construction": True}
        ).eq("id", cid).execute()
    print(f"Marked has_active_construction on {len(construction_ids)} complexes.")
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
