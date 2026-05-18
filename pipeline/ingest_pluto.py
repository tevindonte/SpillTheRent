"""
Ingest NYC PLUTO multifamily buildings into SpillTheRent complexes.

Usage (from repo root):
  cd pipeline
  pip install -r requirements.txt
  python ingest_pluto.py
  python ingest_pluto.py --borough BK
  python ingest_pluto.py --borough QN --neighborhood "LONG ISLAND CITY"

Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
in pipeline/.env or ../.env.local
"""

from __future__ import annotations

import argparse
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

from borough_config import add_borough_cli_args, get_borough

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")

PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json"
PAGE_SIZE = 10_000

BUILDING_FILTERS = (
    "(upper(bldgclass) like 'C%' OR upper(bldgclass) like 'D%') AND "
    "numfloors > 3 AND unitsres > 10"
)

# PLUTO (64uk-42ks) has no neighborhood column — filter sub-areas by lat/lng after download.
NEIGHBORHOOD_BOUNDS: dict[str, dict[str, float]] = {
    "LONG ISLAND CITY": {
        "south": 40.728,
        "north": 40.758,
        "west": -73.962,
        "east": -73.928,
    },
}

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


def build_soql_where(pluto_code: str) -> str:
    return f"borough = '{pluto_code}' AND {BUILDING_FILTERS}"


def normalize_neighborhood_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().upper())


def neighborhood_bounds(neighborhood: str | None) -> dict[str, float] | None:
    if not neighborhood:
        return None
    return NEIGHBORHOOD_BOUNDS.get(normalize_neighborhood_key(neighborhood))


def in_bounds(
    lat: float | None, lng: float | None, bounds: dict[str, float]
) -> bool:
    if lat is None or lng is None:
        return False
    return (
        bounds["south"] <= lat <= bounds["north"]
        and bounds["west"] <= lng <= bounds["east"]
    )


def passes_filters(row: dict[str, Any], pluto_code: str, neighborhood: str | None) -> bool:
    borough = (row.get("borough") or "").strip().upper()
    if borough != pluto_code:
        return False

    bounds = neighborhood_bounds(neighborhood)
    if bounds and not in_bounds(
        _to_float(row.get("latitude")),
        _to_float(row.get("longitude")),
        bounds,
    ):
        return False

    bldgclass = (row.get("bldgclass") or "").strip().upper()
    numfloors = _to_float(row.get("numfloors"))
    unitsres = _to_int(row.get("unitsres"))

    if not (bldgclass.startswith("C") or bldgclass.startswith("D")):
        return False
    if numfloors is None or numfloors <= 3:
        return False
    if unitsres is None or unitsres <= 10:
        return False
    return True


def row_to_record(
    row: dict[str, Any],
    borough_label: str,
    neighborhood_label: str | None = None,
) -> dict[str, Any] | None:
    address = normalize_address(row.get("address"))
    if not address:
        return None

    lat = _to_float(row.get("latitude"))
    lon = _to_float(row.get("longitude"))
    hood = neighborhood_label.strip().title() if neighborhood_label else None

    return {
        "name": address,
        "address": address,
        "borough": borough_label,
        "neighborhood": hood,
        "zip": (row.get("zipcode") or "").strip() or None,
        "units": _to_int(row.get("unitsres")),
        "building_class": (row.get("bldgclass") or "").strip().upper() or None,
        "latitude": lat,
        "longitude": lon,
    }


def download_pluto(pluto_code: str, neighborhood: str | None) -> list[dict[str, Any]]:
    """Paginate NYC Open Data Socrata API."""
    bounds = neighborhood_bounds(neighborhood)
    if neighborhood and bounds is None:
        known = ", ".join(k.title() for k in NEIGHBORHOOD_BOUNDS)
        print(
            f"Warning: no PLUTO bounds for {neighborhood!r}; known areas: {known}",
            file=sys.stderr,
        )
    soql_where = build_soql_where(pluto_code)
    records: list[dict[str, Any]] = []
    offset = 0

    with tqdm(desc="Downloading PLUTO", unit=" rows") as bar:
        while True:
            response = requests.get(
                PLUTO_API,
                params={
                    "$limit": PAGE_SIZE,
                    "$offset": offset,
                    "$where": soql_where,
                },
                timeout=120,
            )
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break

            for row in batch:
                if passes_filters(row, pluto_code, neighborhood):
                    record = row_to_record(
                        row,
                        get_borough(pluto_code).label,
                        neighborhood,
                    )
                    if record:
                        records.append(record)

            bar.update(len(batch))
            offset += len(batch)

            if len(batch) < PAGE_SIZE:
                break

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
        "neighborhood",
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
        "neighborhood": record.get("neighborhood"),
        "zip": record["zip"],
        "units": record["units"],
        "building_class": record["building_class"],
    }
    lat = record.get("latitude")
    lon = record.get("longitude")
    if lat is not None and lon is not None:
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
    parser = argparse.ArgumentParser(description="Ingest PLUTO buildings into complexes")
    add_borough_cli_args(parser, default="MN")
    parser.add_argument(
        "--neighborhood",
        default=None,
        help='PLUTO neighborhood filter (e.g. "LONG ISLAND CITY" for Queens)',
    )
    args = parser.parse_args()

    borough = get_borough(args.borough)
    neighborhood = args.neighborhood.strip() if args.neighborhood else None

    label = borough.label
    if neighborhood:
        label = f"{label} ({neighborhood})"

    print(f"Fetching PLUTO for {label} (class C/D, >3 floors, >10 units)...")
    records = download_pluto(borough.pluto_code, neighborhood)
    print(f"Prepared {len(records)} unique records after filtering.")

    csv_name = f"pluto_{borough.code.lower()}"
    if neighborhood:
        csv_name += "_lic"
    write_csv(records, PIPELINE_DIR / "data" / f"{csv_name}.csv")

    client = get_supabase_client()
    existing = fetch_existing_addresses(client)
    print(f"Found {len(existing)} existing complexes in Supabase.")

    inserted, skipped = insert_complexes(client, records, existing)
    print(f"Done. Inserted: {inserted}, skipped (duplicate address): {skipped}")


if __name__ == "__main__":
    main()
