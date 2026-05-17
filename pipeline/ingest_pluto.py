"""
Ingest NYC PLUTO (Manhattan multifamily) into SpillTheRent complexes.

Usage (from repo root):
  cd pipeline
  pip install -r requirements.txt
  python ingest_pluto.py

Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
in pipeline/.env or ../.env.local
"""

from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")

PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json"
PAGE_SIZE = 10_000
CSV_PATH = PIPELINE_DIR / "data" / "pluto_manhattan.csv"

# Server-side filter (SoQL); client-side filters applied again for safety.
SOQL_WHERE = (
    "borough = 'MN' AND "
    "(upper(bldgclass) like 'C%' OR upper(bldgclass) like 'D%') AND "
    "numfloors > 3 AND unitsres > 10"
)

BOROUGH_LABEL = "Manhattan"

SUFFIX_NORMALIZATIONS = (
    (re.compile(r"\bAVE\.?$"), "AVENUE"),
    (re.compile(r"\bAV\.?$"), "AVENUE"),
    (re.compile(r"\bST\.?$"), "STREET"),
    (re.compile(r"\bRD\.?$"), "ROAD"),
    (re.compile(r"\bDR\.?$"), "DRIVE"),
    (re.compile(r"\bBLVD\.?$"), "BOULEVARD"),
    (re.compile(r"\bPL\.?$"), "PLACE"),
    (re.compile(r"\bLN\.?$"), "LANE"),
    (re.compile(r"\bCT\.?$"), "COURT"),
    (re.compile(r"\bTER\.?$"), "TERRACE"),
    (re.compile(r"\bPKWY\.?$"), "PARKWAY"),
    (re.compile(r"\bSQ\.?$"), "SQUARE"),
    (re.compile(r"\bAPT\.?$"), "APARTMENT"),
)


def normalize_address(address: str | None) -> str:
    """Uppercase, collapse whitespace, tighten hyphens, expand street suffixes."""
    if not address:
        return ""
    addr = address.strip().upper()
    addr = re.sub(r"\s+", " ", addr)
    addr = re.sub(r"\s*-\s*", "-", addr)
    for pattern, replacement in SUFFIX_NORMALIZATIONS:
        addr = pattern.sub(replacement, addr)
    return addr.strip()


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def passes_filters(row: dict[str, Any]) -> bool:
    borough = (row.get("borough") or "").strip().upper()
    bldgclass = (row.get("bldgclass") or "").strip().upper()
    numfloors = _to_float(row.get("numfloors"))
    unitsres = _to_int(row.get("unitsres"))

    if borough != "MN":
        return False
    if not (bldgclass.startswith("C") or bldgclass.startswith("D")):
        return False
    if numfloors is None or numfloors <= 3:
        return False
    if unitsres is None or unitsres <= 10:
        return False
    return True


def row_to_record(row: dict[str, Any]) -> dict[str, Any] | None:
    address = normalize_address(row.get("address"))
    if not address:
        return None

    lat = _to_float(row.get("latitude"))
    lon = _to_float(row.get("longitude"))

    return {
        "name": address,
        "address": address,
        "borough": BOROUGH_LABEL,
        "zip": (row.get("zipcode") or "").strip() or None,
        "units": _to_int(row.get("unitsres")),
        "building_class": (row.get("bldgclass") or "").strip().upper() or None,
        "latitude": lat,
        "longitude": lon,
    }


def download_pluto() -> list[dict[str, Any]]:
    """Paginate NYC Open Data Socrata API."""
    records: list[dict[str, Any]] = []
    offset = 0

    with tqdm(desc="Downloading PLUTO", unit=" rows") as bar:
        while True:
            response = requests.get(
                PLUTO_API,
                params={
                    "$limit": PAGE_SIZE,
                    "$offset": offset,
                    "$where": SOQL_WHERE,
                },
                timeout=120,
            )
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break

            for row in batch:
                if passes_filters(row):
                    record = row_to_record(row)
                    if record:
                        records.append(record)

            bar.update(len(batch))
            offset += len(batch)

            if len(batch) < PAGE_SIZE:
                break

    # Deduplicate by normalized address within this run
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for record in records:
        key = record["address"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)

    return unique


def write_csv(records: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "name",
        "address",
        "borough",
        "zip",
        "units",
        "building_class",
        "latitude",
        "longitude",
    ]
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"Wrote {len(records)} rows to {path}")


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
            "SUPABASE_SERVICE_ROLE_KEY in pipeline/.env or .env.local",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_client(url, key)


def fetch_existing_addresses(client: Client) -> set[str]:
    existing: set[str] = set()
    offset = 0
    page_size = 1000

    while True:
        result = (
            client.table("complexes")
            .select("address")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            addr = normalize_address(row.get("address"))
            if addr:
                existing.add(addr)
        if len(rows) < page_size:
            break
        offset += page_size

    return existing


def record_to_supabase_row(record: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {
        "name": record["name"],
        "address": record["address"],
        "borough": record["borough"],
        "zip": record["zip"],
        "units": record["units"],
        "building_class": record["building_class"],
    }
    lat = record.get("latitude")
    lon = record.get("longitude")
    if lat is not None and lon is not None:
        # PostgREST expects EWKT for geography columns (not GeoJSON objects).
        row["coordinates"] = f"SRID=4326;POINT({lon} {lat})"
    return row


def insert_complexes(
    client: Client, records: list[dict[str, Any]], existing: set[str]
) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    batch: list[dict[str, Any]] = []
    batch_size = 500

    def flush_batch() -> None:
        nonlocal inserted, batch
        if not batch:
            return
        client.table("complexes").insert(batch).execute()
        inserted += len(batch)
        batch = []

    for record in tqdm(records, desc="Inserting into Supabase"):
        address = record["address"]
        if address in existing:
            skipped += 1
            continue

        batch.append(record_to_supabase_row(record))
        existing.add(address)

        if len(batch) >= batch_size:
            flush_batch()

    flush_batch()
    return inserted, skipped


def main() -> None:
    print("Fetching Manhattan PLUTO (class C/D, >3 floors, >10 units)...")
    records = download_pluto()
    print(f"Prepared {len(records)} unique records after filtering.")

    write_csv(records, CSV_PATH)

    client = get_supabase_client()
    existing = fetch_existing_addresses(client)
    print(f"Found {len(existing)} existing complexes in Supabase.")

    inserted, skipped = insert_complexes(client, records, existing)
    print(f"Done. Inserted: {inserted}, skipped (duplicate address): {skipped}")


if __name__ == "__main__":
    main()
