"""
Ingest HPD violations (Manhattan, class A/B/C) and match to complexes.

Usage:
  python ingest_hpd.py [--limit 1000]
  python ingest_hpd.py --scores-only   # resume after inserts finished
"""

from __future__ import annotations

import argparse
from datetime import datetime
from typing import Any

import requests
from tqdm import tqdm

from address_utils import build_address_from_parts, ComplexAddressIndex
from supabase_batch import batch_insert, recompute_hpd_scores
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client
from nyc_ingest_common import log_unmatched

HPD_API = "https://data.cityofnewyork.us/resource/wvxf-dwi5.json"
PAGE_SIZE = 10_000
UNMATCHED_CSV = PIPELINE_DIR / "data" / "hpd_unmatched.csv"


def parse_ts(value: Any) -> str | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
        return datetime.strptime(s[:10], "%Y-%m-%d").isoformat()
    except ValueError:
        return None


def violation_status(row: dict[str, Any]) -> str:
    raw = (
        row.get("violationstatus")
        or row.get("currentstatus")
        or row.get("novdescription")
        or ""
    )
    s = str(raw).lower()
    if "close" in s or "certif" in s:
        return "close"
    return "open"


def row_to_violation(row: dict[str, Any]) -> dict[str, Any] | None:
    vclass = (row.get("class") or row.get("violationclass") or "").strip().upper()
    if vclass not in ("A", "B", "C"):
        return None

    address = build_address_from_parts(
        row.get("housenumber"),
        row.get("streetname"),
        row.get("zip"),
    )
    if not address:
        return None

    approved = parse_ts(row.get("approveddate") or row.get("inspectiondate"))
    if not approved:
        return None

    violation_type = (
        row.get("novdescription")
        or row.get("violationtype")
        or row.get("rentimpairing")
        or "HPD Violation"
    )
    violation_type = str(violation_type).strip()[:500]

    closed = parse_ts(row.get("currentstatusdate") or row.get("certifieddate"))
    status = violation_status(row)

    return {
        "address": address,
        "violation_class": vclass,
        "violation_type": violation_type,
        "description": str(row.get("novdescription") or row.get("description") or "")[:2000] or None,
        "status": status,
        "approved_date": approved,
        "closed_date": closed if status == "close" else None,
    }


def fetch_hpd_rows(limit: int | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    where = "boro='MANHATTAN' AND class in ('A','B','C')"

    with tqdm(desc="Fetching HPD violations", unit=" rows") as bar:
        while True:
            if limit is not None and len(rows) >= limit:
                rows = rows[:limit]
                break

            params: dict[str, Any] = {
                "$limit": PAGE_SIZE,
                "$offset": offset,
                "$where": where,
            }
            resp = requests.get(HPD_API, params=params, timeout=120)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break

            for row in batch:
                rec = row_to_violation(row)
                if rec:
                    rows.append(rec)
                    if limit is not None and len(rows) >= limit:
                        break

            bar.update(len(batch))
            offset += len(batch)
            if len(batch) < PAGE_SIZE:
                break

    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=1000, help="Max violations to process")
    parser.add_argument(
        "--scores-only",
        action="store_true",
        help="Skip fetch/insert; recompute complex HPD scores from hpd_violations table",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Rows per Supabase insert batch (default 100)",
    )
    args = parser.parse_args()

    client = get_supabase_client()

    if args.scores_only:
        recompute_hpd_scores(client)
        print("Done (scores only).")
        return

    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes for address matching.")

    violations = fetch_hpd_rows(args.limit)
    print(f"Prepared {len(violations)} violations.")

    unmatched: list[dict[str, str]] = []
    payloads: list[dict[str, Any]] = []

    for v in violations:
        complex_id = index.match(v["address"], threshold=85)
        if not complex_id:
            unmatched.append({"address": v["address"], "violation_type": v["violation_type"]})
        payloads.append({**v, "complex_id": complex_id})

    inserted, skipped = batch_insert(
        client,
        "hpd_violations",
        payloads,
        batch_size=args.batch_size,
    )

    log_unmatched(UNMATCHED_CSV, unmatched, ["address", "violation_type"])

    recompute_hpd_scores(client)
    print(f"Done. Inserted: {inserted}, skipped duplicates: {skipped}")


if __name__ == "__main__":
    main()
