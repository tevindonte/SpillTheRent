"""
Ingest Hudson County (NJ) multifamily parcels into complexes.

Source: NJ OGIS MOD-IV ArcGIS layer (Socrata id 9s9p-umfy is not published).
Filters: COUNTY=HUDSON, PROP_CLASS in 4A/4B/4C, DWELL > 10.
Municipalities: Jersey City + Hoboken first (expand later).

Usage:
  python ingest_nj_buildings.py [--limit 100]
"""

from __future__ import annotations

import argparse
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
TARGET_MUNS = {"JERSEY CITY CITY", "HOBOKEN CITY"}
PAGE_SIZE = 1000


def _title_municipality(mun: str) -> str:
    upper = mun.strip().upper()
    if upper.startswith("JERSEY CITY"):
        return "Jersey City"
    if upper.startswith("HOBOKEN"):
        return "Hoboken"
    return mun.title().replace(" City", "").replace("CITY", "").strip() or mun.title()


def _centroid(geom: dict[str, Any] | None) -> tuple[float, float] | None:
    if not geom:
        return None
    # ArcGIS polygon rings or x/y point
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


def fetch_nj_parcels(limit: int, *, min_units: int = 10) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    per_mun = max(1, (limit + 1) // 2)

    for mun_name in sorted(TARGET_MUNS):
        offset = 0
        where = (
            f"COUNTY='HUDSON' AND PROP_CLASS IN ('4A','4B','4C') "
            f"AND MUN_NAME='{mun_name}'"
        )
        mun_rows = 0
        with tqdm(desc=f"Fetching {mun_name.title()}", unit=" rows") as bar:
            while mun_rows < per_mun and len(rows) < limit:
                params = {
                    "where": where,
                    "outFields": "PROP_LOC,MUN_NAME,OWNER_NAME,BLDG_DESC,DWELL,PROP_CLASS,COUNTY",
                    "returnGeometry": "true",
                    "outSR": "4326",
                    "resultOffset": offset,
                    "resultRecordCount": min(PAGE_SIZE, per_mun - mun_rows),
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
                    mun = str(attrs.get("MUN_NAME") or "").strip().upper()
                    if mun not in TARGET_MUNS:
                        continue
                    loc = normalize_address(attrs.get("PROP_LOC"))
                    if not loc:
                        continue
                    dwell = attrs.get("DWELL")
                    try:
                        units = (
                            int(float(dwell))
                            if dwell is not None and dwell != ""
                            else None
                        )
                    except (TypeError, ValueError):
                        units = None
                    if units is not None and units <= min_units:
                        continue
                    if units is None and str(attrs.get("PROP_CLASS") or "").upper() not in (
                        "4B",
                        "4C",
                    ):
                        continue
                    latlon = _centroid(feat.get("geometry"))
                    rows.append(
                        {
                            "address": loc,
                            "municipality": _title_municipality(mun),
                            "owner_name": (attrs.get("OWNER_NAME") or "").strip() or None,
                            "building_description": (attrs.get("BLDG_DESC") or "").strip()
                            or None,
                            "units": units,
                            "latlon": latlon,
                        }
                    )
                    mun_rows += 1
                    if mun_rows >= per_mun or len(rows) >= limit:
                        break
                bar.update(len(feats))
                offset += len(feats)
                if not data.get("exceededTransferLimit") and len(feats) < PAGE_SIZE:
                    break

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        if row["address"] in seen:
            continue
        seen.add(row["address"])
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
    parser.add_argument("--limit", type=int, default=5_000)
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
