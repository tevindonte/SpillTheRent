"""
Ingest open lead-paint HPD violations into lead_paint_violations.

Source: wvxf-dwi5 (HPD Violations) filtered to LEAD in NOV text + Open status.
User-requested id 9ei5-s7tm is not published on NYC Open Data.

Usage:
  python ingest_lead_paint.py [--limit 30000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, build_address_from_parts
from nyc_ingest_common import fetch_socrata, insert_rows, log_unmatched, parse_date
from supabase_batch import recompute_lead_paint_signals
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

HPD_API = "https://data.cityofnewyork.us/resource/wvxf-dwi5.json"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "lead_paint_unmatched.csv"


def is_open(row: dict[str, Any]) -> bool:
    status = str(row.get("violationstatus") or "").strip().lower()
    current = str(row.get("currentstatus") or "").strip().lower()
    if status == "open":
        return True
    if "open" in current and "closed" not in current:
        return True
    return False


def is_lead(row: dict[str, Any]) -> bool:
    blob = " ".join(
        str(row.get(k) or "")
        for k in ("novdescription", "novtype", "violationtype", "ordernumber")
    ).upper()
    return "LEAD" in blob


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    boro = str(row.get("boroid") or row.get("boro") or "").strip()
    if boro not in ("1", "3", "4", "MANHATTAN", "BROOKLYN", "QUEENS"):
        return None
    if not is_lead(row) or not is_open(row):
        return None

    address = build_address_from_parts(
        row.get("housenumber"),
        row.get("streetname"),
        row.get("zip"),
    )
    if not address:
        return None

    return {
        "address": address,
        "violation_type": str(
            row.get("novdescription") or row.get("novtype") or "Lead paint"
        )[:500],
        "status": row.get("currentstatus") or row.get("violationstatus") or "Open",
        "approved_date": parse_date(
            row.get("approveddate") or row.get("novissueddate") or row.get("inspectiondate")
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--signals-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase_client()
    if args.signals_only:
        recompute_lead_paint_signals(client)
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    where = (
        "boroid in ('1','3','4') AND upper(novdescription) like '%LEAD%' "
        "AND (upper(violationstatus)='OPEN' OR upper(currentstatus) like '%OPEN%')"
    )
    raw = fetch_socrata(
        HPD_API,
        where=where,
        limit=args.limit * 2,
        desc="Fetching lead paint violations",
    )

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
        if len(records) >= args.limit:
            break

    inserted, skipped = insert_rows(
        client, "lead_paint_violations", records, batch_size=args.batch_size
    )
    log_unmatched(UNMATCHED_CSV, unmatched, ["address"])
    recompute_lead_paint_signals(client)
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
