"""
Ingest Boston multifamily parcels (Property Assessment) into complexes.

Source: Analyze Boston Property Assessment FY2026 (CKAN datastore).
LU codes: R4 (4–8 units), A (9+ apartments); also R2/R3 when NUM_BLDGS > 1.

Usage:
  python ingest_boston_buildings.py [--limit 10000]
"""

from __future__ import annotations

import argparse
import re
import time
from typing import Any

import requests
from tqdm import tqdm

from address_utils import normalize_address
from boston_ckan import datastore_search, parse_float
from supabase_batch import batch_insert
from supabase_client import get_supabase_client

# FY2026 Property Assessment (datastore-active CSV). Brief ID was retired.
ASSESSMENT_RESOURCE = "ee73430d-96c0-423e-ad21-c4cfb54c8961"
# Live SAM addresses for geocoding
SAM_RESOURCE = "6d6cfc99-6f26-4974-bbb3-17b5dbad49a9"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

MULTIFAMILY_LU = frozenset({"R4", "A"})
CONDITIONAL_LU = frozenset({"R2", "R3"})


def _title_neighborhood(city: str | None) -> str:
    raw = (city or "").strip()
    if not raw or raw.upper() in ("BOSTON", "MA", "MASSACHUSETTS"):
        return "Boston"
    return raw.title()


def _build_address(st_num: Any, st_name: Any) -> str:
    num = str(st_num or "").strip()
    name = str(st_name or "").strip()
    if not num and not name:
        return ""
    return normalize_address(f"{num} {name}".strip())


def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _wkt_point(shape_wkt: str | None) -> tuple[float, float] | None:
    if not shape_wkt:
        return None
    m = re.search(
        r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)",
        shape_wkt,
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    try:
        lon, lat = float(m.group(1)), float(m.group(2))
        if 41.0 < lat < 43.0 and -72.0 < lon < -69.0:
            return lat, lon
    except ValueError:
        return None
    return None


def load_sam_geocode_index(limit: int = 200_000) -> dict[str, tuple[float, float]]:
    """Map normalized FULL_ADDRESS → (lat, lon) from SAM."""
    index: dict[str, tuple[float, float]] = {}
    rows = datastore_search(
        SAM_RESOURCE,
        limit=limit,
        desc="Loading SAM geocodes",
        page_size=10_000,
    )
    for row in rows:
        addr = normalize_address(row.get("FULL_ADDRESS"))
        if not addr or addr in index:
            continue
        pt = _wkt_point(row.get("shape_wkt"))
        if not pt:
            lat = parse_float(row.get("POINT_Y") or row.get("Y_COORD"))
            lon = parse_float(row.get("POINT_X") or row.get("X_COORD"))
            # State-plane coords are huge; skip those
            if lat is not None and lon is not None and 41.0 < lat < 43.0 and -72.0 < lon < -69.0:
                pt = (lat, lon)
        if pt:
            index[addr] = pt
    print(f"SAM geocode index: {len(index)} addresses")
    return index


def geocode_nominatim(address: str) -> tuple[float, float] | None:
    q = f"{address}, Boston, MA"
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": q, "format": "json", "limit": 1},
            headers={"User-Agent": "spillthe.rent-boston-ingest/1.0"},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return None


def is_multifamily(row: dict[str, Any]) -> bool:
    lu = str(row.get("LU") or "").strip().upper()
    if lu in MULTIFAMILY_LU:
        return True
    if lu in CONDITIONAL_LU:
        n = _parse_int(row.get("NUM_BLDGS")) or 0
        return n > 1
    return False


def fetch_existing_addresses(client) -> set[str]:
    existing: set[str] = set()
    offset = 0
    while True:
        res = (
            client.table("complexes")
            .select("address")
            .range(offset, offset + 999)
            .execute()
        )
        batch = res.data or []
        for row in batch:
            addr = normalize_address(row.get("address"))
            if addr:
                existing.add(addr)
        if len(batch) < 1000:
            break
        offset += 1000
    return existing


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument(
        "--geocode-missing",
        action="store_true",
        help="Use Nominatim when SAM has no match (slow; 1 req/sec)",
    )
    parser.add_argument(
        "--skip-sam",
        action="store_true",
        help="Skip SAM preload (Nominatim only if --geocode-missing)",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    existing = fetch_existing_addresses(client)
    print(f"Existing complexes: {len(existing)}")

    sam = {} if args.skip_sam else load_sam_geocode_index()

    # Fetch multifamily LU codes separately (CKAN exact filters are reliable).
    raw: list[dict[str, Any]] = []
    per_lu = max(args.limit * 4, args.limit)
    for lu in ("A", "R4", "R2", "R3"):
        chunk = datastore_search(
            ASSESSMENT_RESOURCE,
            limit=per_lu,
            filters={"LU": lu},
            desc=f"Fetching assessment LU={lu}",
        )
        raw.extend(chunk)
        if len(raw) >= args.limit * 12:
            break

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    geocode_calls = 0
    skipped_geo = 0

    for row in tqdm(raw, desc="Filtering multifamily"):
        if not is_multifamily(row):
            continue
        address = _build_address(row.get("ST_NUM"), row.get("ST_NAME"))
        if not address or address in existing or address in seen:
            continue

        # Try exact SAM key, then without suffix expansion mismatches
        latlon = sam.get(address)
        if not latlon:
            # SAM often stores "St" which we expand to STREET — also try raw title case key
            alt = normalize_address(
                f"{str(row.get('ST_NUM') or '').strip()} {str(row.get('ST_NAME') or '').strip()}"
            )
            latlon = sam.get(alt)
        if not latlon and args.geocode_missing:
            latlon = geocode_nominatim(address)
            geocode_calls += 1
            time.sleep(1.05)
        if not latlon:
            skipped_geo += 1
            continue

        lat, lon = latlon
        owner = (str(row.get("OWNER") or "").strip() or None)
        borough = _title_neighborhood(row.get("CITY"))
        zip_code = str(row.get("ZIP_CODE") or "").strip().rstrip("_") or None
        units = _parse_int(row.get("RES_UNITS") or row.get("RC_UNITS") or row.get("COM_UNITS"))

        records.append(
            {
                "name": f"{str(row.get('ST_NUM') or '').strip()} {str(row.get('ST_NAME') or '').strip()}".strip(),
                "address": address,
                "borough": borough,
                "zip": zip_code,
                "units": units,
                "source": "boston_assessment",
                "verified": True,
                "owner_name_verified": owner,
                "coordinates": f"SRID=4326;POINT({lon} {lat})",
            }
        )
        seen.add(address)
        if len(records) >= args.limit:
            break

    print(f"Skipped (no geocode): {skipped_geo}")

    print(f"Ready to insert {len(records)} Boston buildings (Nominatim calls: {geocode_calls})")
    if not records:
        print("Nothing to insert.")
        return

    inserted, skipped = batch_insert(
        client, "complexes", records, batch_size=args.batch_size
    )
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
