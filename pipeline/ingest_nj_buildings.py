"""
Ingest NJ multifamily parcels (MOD-IV) into complexes.

Source: NJ OGIS MOD-IV ArcGIS layer (Socrata id 9s9p-umfy is not published).
Counties: Hudson, Essex, Bergen, Union.
Filter: PROP_CLASS in 4A/4B/4C (no unit-count requirement — DWELL is usually blank).

Usage:
  python ingest_nj_buildings.py [--limit 20000]
"""

from __future__ import annotations

import argparse
import re
import time
from typing import Any

import requests
from tqdm import tqdm

from address_utils import normalize_address
from supabase_batch import batch_insert
from supabase_client import get_supabase_client

NJ_MOD4_URL = (
    "https://maps.nj.gov/arcgis/rest/services/Applications/"
    "NJ_TaxListSearch/MapServer/2/query"
)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Four-county North Jersey expansion
TARGET_COUNTIES = ("HUDSON", "ESSEX", "BERGEN", "UNION")
PAGE_SIZE = 1000

# Friendly display names for common municipalities
MUN_DISPLAY = {
    "JERSEY CITY CITY": "Jersey City",
    "HOBOKEN CITY": "Hoboken",
    "BAYONNE CITY": "Bayonne",
    "UNION CITY CITY": "Union City",
    "NEWARK CITY": "Newark",
    "EAST ORANGE CITY": "East Orange",
    "MONTCLAIR TWP": "Montclair",
    "FORT LEE BORO": "Fort Lee",
    "ENGLEWOOD CITY": "Englewood",
    "HACKENSACK CITY": "Hackensack",
    "ELIZABETH CITY": "Elizabeth",
}


def _title_municipality(mun: str) -> str:
    raw = (mun or "").strip()
    upper = raw.upper()
    if upper in MUN_DISPLAY:
        return MUN_DISPLAY[upper]
    cleaned = re.sub(
        r"\s+(CITY|TOWN|TWP|TOWNSHIP|BORO|BOROUGH)\s*$",
        "",
        upper,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned.title() if cleaned else raw.title()


def _centroid(geom: dict[str, Any] | None) -> tuple[float, float] | None:
    if not geom:
        return None
    if "x" in geom and "y" in geom:
        try:
            return float(geom["y"]), float(geom["x"])
        except (TypeError, ValueError):
            return None
    rings = geom.get("rings")
    if not rings:
        return None
    xs: list[float] = []
    ys: list[float] = []
    for ring in rings:
        for pt in ring:
            if len(pt) >= 2:
                xs.append(float(pt[0]))
                ys.append(float(pt[1]))
    if not xs:
        return None
    return sum(ys) / len(ys), sum(xs) / len(xs)


def geocode_nominatim(address: str, city: str) -> tuple[float, float] | None:
    q = f"{address}, {city}, NJ"
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": q, "format": "json", "limit": 1},
            headers={"User-Agent": "spillthe.rent-nj-ingest/1.0"},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return None


def _parse_units(dwell: Any) -> int | None:
    if dwell is None or dwell == "":
        return None
    try:
        return int(float(dwell))
    except (TypeError, ValueError):
        return None


def fetch_county_parcels(county: str, limit: int) -> list[dict[str, Any]]:
    """Fetch up to `limit` 4A/4B/4C parcels for one county (no unit filter)."""
    rows: list[dict[str, Any]] = []
    offset = 0
    where = f"COUNTY='{county}' AND PROP_CLASS IN ('4A','4B','4C')"

    with tqdm(desc=f"Fetching {county.title()}", unit=" rows") as bar:
        while len(rows) < limit:
            params = {
                "where": where,
                "outFields": "PROP_LOC,MUN_NAME,OWNER_NAME,BLDG_DESC,DWELL,PROP_CLASS,COUNTY",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultOffset": offset,
                "resultRecordCount": min(PAGE_SIZE, limit - len(rows)),
                "f": "json",
            }
            resp = requests.get(NJ_MOD4_URL, params=params, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            feats = data.get("features") or []
            if not feats:
                break

            for feat in feats:
                attrs = feat.get("attributes") or {}
                loc = normalize_address(attrs.get("PROP_LOC"))
                if not loc:
                    continue
                mun = str(attrs.get("MUN_NAME") or "").strip()
                rows.append(
                    {
                        "address": loc,
                        "municipality": _title_municipality(mun),
                        "county": county.title(),
                        "owner_name": (attrs.get("OWNER_NAME") or "").strip() or None,
                        "building_description": (attrs.get("BLDG_DESC") or "").strip() or None,
                        "units": _parse_units(attrs.get("DWELL")),
                        "latlon": _centroid(feat.get("geometry")),
                    }
                )
                if len(rows) >= limit:
                    break

            bar.update(len(feats))
            offset += len(feats)
            if not data.get("exceededTransferLimit") and len(feats) < PAGE_SIZE:
                break

    return rows


def fetch_nj_parcels(limit: int) -> list[dict[str, Any]]:
    """Pull apartments across TARGET_COUNTIES, splitting the limit evenly."""
    per_county = max(1, limit // len(TARGET_COUNTIES))
    leftover = limit - per_county * len(TARGET_COUNTIES)
    rows: list[dict[str, Any]] = []

    for i, county in enumerate(TARGET_COUNTIES):
        county_limit = per_county + (leftover if i == 0 else 0)
        if len(rows) >= limit:
            break
        county_limit = min(county_limit, limit - len(rows))
        chunk = fetch_county_parcels(county, county_limit)
        rows.extend(chunk)
        print(f"  {county}: {len(chunk)} parcels")

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = f"{row['municipality']}|{row['address']}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


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
    parser.add_argument("--limit", type=int, default=20_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument(
        "--geocode-missing",
        action="store_true",
        help="Use Nominatim when parcel geometry is missing (slow; 1 req/sec)",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    existing = fetch_existing_addresses(client)
    print(f"Existing complexes: {len(existing)}")

    parcels = fetch_nj_parcels(args.limit)
    print(f"Parcels fetched: {len(parcels)}")

    records: list[dict[str, Any]] = []
    for row in tqdm(parcels, desc="Preparing NJ complexes"):
        if row["address"] in existing:
            continue
        latlon = row.get("latlon")
        if not latlon and args.geocode_missing:
            latlon = geocode_nominatim(row["address"], row["municipality"])
            time.sleep(1.1)
        if not latlon:
            continue
        lat, lon = latlon
        name = row["address"].title()
        records.append(
            {
                "name": name,
                "address": row["address"],
                "borough": row["municipality"],
                "neighborhood": row["municipality"],
                "units": row.get("units"),
                "ownername": row.get("owner_name"),
                "verified": False,
                "source": "nj_mod4",
                "coordinates": f"SRID=4326;POINT({lon} {lat})",
            }
        )

    if not records:
        print("No new NJ buildings to insert.")
        return

    inserted, skipped = batch_insert(
        client, "complexes", records, batch_size=args.batch_size
    )
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
