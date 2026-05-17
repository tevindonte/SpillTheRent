"""
Attach Google Street View URLs to complexes (metadata check + static API).

Usage:
  cd pipeline
  python enrich_street_view.py              # default: 50 rows
  python enrich_street_view.py --limit 10
  python enrich_street_view.py --limit 0    # full run (~$0.007 × images after free tier)

Requires in pipeline/.env or ../.env.local:
  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_PLACES_API_KEY

Cost: metadata requests are free; static image ~$0.007 each (~$90 for 12,787 images).

Stored URLs omit the API key:
  https://maps.googleapis.com/maps/api/streetview?size=800x500&location={lat},{lng}
The Next.js app serves images via /api/streetview (server-side proxy).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import struct
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import requests
from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent

METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"
STREET_VIEW_URL = "https://maps.googleapis.com/maps/api/streetview"
BATCH_SIZE = 1000
API_DELAY_SECONDS = 0.1
NONE_SENTINEL = "NONE"
IMAGE_SIZE = "800x500"
COST_PER_IMAGE = 0.007

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")


@dataclass
class Summary:
    processed: int = 0
    images_stored: int = 0
    marked_none: int = 0
    errors: int = 0


@dataclass
class ComplexRow:
    id: str
    name: str
    lat: float
    lng: float


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
            "SUPABASE_SERVICE_ROLE_KEY",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_client(url, key)


def get_google_api_key() -> str:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        print("Missing GOOGLE_PLACES_API_KEY in .env", file=sys.stderr)
        sys.exit(1)
    return key


def parse_wkb_hex(hex_value: str) -> tuple[float, float] | None:
    """Parse PostGIS EWKB point; returns (lat, lng)."""
    clean = hex_value.strip().replace("\\x", "").replace("0x", "")
    if not clean or len(clean) < 42:
        return None
    try:
        raw = bytes.fromhex(clean)
    except ValueError:
        return None

    if len(raw) < 21:
        return None

    little_endian = raw[0] == 1
    endian = "<" if little_endian else ">"
    geom_type = struct.unpack_from(f"{endian}I", raw, 1)[0]
    if (geom_type & 0xFF) != 1:
        return None

    offset = 5
    if geom_type & 0x20000000:
        offset += 4

    if len(raw) < offset + 16:
        return None

    lng, lat = struct.unpack_from(f"{endian}dd", raw, offset)
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng


def parse_coordinates(raw: Any) -> tuple[float, float] | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        trimmed = raw.strip()
        if trimmed.startswith("{"):
            try:
                return parse_coordinates(json.loads(trimmed))
            except json.JSONDecodeError:
                return None
        if all(c in "0123456789abcdefABCDEF" for c in trimmed.replace("\\x", "")):
            return parse_wkb_hex(trimmed)
        point_match = re.search(
            r"POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)",
            trimmed,
            re.IGNORECASE,
        )
        if point_match:
            lng, lat = float(point_match.group(1)), float(point_match.group(2))
            return lat, lng
    if isinstance(raw, dict) and raw.get("type") == "Point":
        coords = raw.get("coordinates") or []
        if len(coords) >= 2:
            return float(coords[1]), float(coords[0])
    return None


def fetch_pending_complexes(client: Client, limit: int) -> list[ComplexRow]:
    rows: list[ComplexRow] = []
    offset = 0

    while True:
        remaining = limit - len(rows) if limit > 0 else BATCH_SIZE
        if limit > 0 and remaining <= 0:
            break
        page_size = min(BATCH_SIZE, remaining) if limit > 0 else BATCH_SIZE

        result = (
            client.table("complexes")
            .select("id, name, coordinates")
            .is_("street_view_url", "null")
            .not_.is_("coordinates", "null")
            .order("name")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        batch = result.data or []
        if not batch:
            break

        for row in batch:
            point = parse_coordinates(row.get("coordinates"))
            if not point:
                continue
            lat, lng = point
            rows.append(
                ComplexRow(id=row["id"], name=row.get("name") or "", lat=lat, lng=lng)
            )
            if limit > 0 and len(rows) >= limit:
                return rows

        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def check_metadata(
    session: requests.Session, lat: float, lng: float, api_key: str
) -> tuple[str | None, str | None]:
    """
    Returns (status, error_message).
    status is "OK", NONE_SENTINEL, or None on transient/unknown errors.
    """
    try:
        response = session.get(
            METADATA_URL,
            params={"location": f"{lat},{lng}", "key": api_key},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        return None, f"Metadata HTTP error: {exc}"
    except ValueError as exc:
        return None, f"Metadata invalid JSON: {exc}"

    status = payload.get("status")
    if status == "OK":
        return "OK", None
    if status in ("ZERO_RESULTS", "REQUEST_DENIED"):
        return NONE_SENTINEL, None
    return None, f"Metadata status {status}: {payload.get('error_message', status)}"


def build_street_view_url(lat: float, lng: float) -> str:
    """Keyless URL stored in DB; the Next.js app proxies images server-side."""
    return (
        f"{STREET_VIEW_URL}?size={IMAGE_SIZE}&location={lat},{lng}"
    )


def validate_street_view_image(
    session: requests.Session, lat: float, lng: float, api_key: str
) -> tuple[bool, str | None]:
    """
    Paid Street View Static API call to confirm imagery exists.
    Returns (success, error_message). Caller stores build_street_view_url() on success.
    """
    params = {
        "size": IMAGE_SIZE,
        "location": f"{lat},{lng}",
        "key": api_key,
        "return_error_codes": "true",
    }
    try:
        response = session.get(STREET_VIEW_URL, params=params, timeout=60)
    except requests.RequestException as exc:
        return False, f"Street View HTTP error: {exc}"

    content_type = response.headers.get("Content-Type", "")
    if response.status_code == 200 and content_type.startswith("image/"):
        return True, None

    try:
        payload = response.json()
        status = payload.get("status")
        if status in ("ZERO_RESULTS", "REQUEST_DENIED"):
            return False, NONE_SENTINEL
        return False, f"Street View status {status}: {payload.get('error_message', status)}"
    except ValueError:
        return False, f"Street View unexpected response HTTP {response.status_code}"


def update_street_view_url(client: Client, complex_id: str, value: str) -> str | None:
    try:
        client.table("complexes").update({"street_view_url": value}).eq(
            "id", complex_id
        ).execute()
    except Exception as exc:
        return str(exc)
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich complexes with Google Street View URLs."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Max complexes to process (default: 50). Use 0 for no limit.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    limit = args.limit

    client = get_supabase_client()
    api_key = get_google_api_key()

    print("Fetching complexes where street_view_url IS NULL and coordinates exist…")
    complexes = fetch_pending_complexes(client, limit)
    print(f"Queued {len(complexes)} complexes.")
    if complexes:
        est = len(complexes) * COST_PER_IMAGE
        print(
            f"Estimated image cost (if all have imagery): ${est:.2f} "
            f"({len(complexes)} × ${COST_PER_IMAGE}) — metadata checks are free"
        )

    summary = Summary()
    session = requests.Session()

    for row in tqdm(complexes, desc="Street View enrichment"):
        summary.processed += 1
        location = f"{row.lat},{row.lng}"

        meta_result, meta_error = check_metadata(session, row.lat, row.lng, api_key)
        time.sleep(API_DELAY_SECONDS)

        if meta_error:
            summary.errors += 1
            tqdm.write(f"[error] {row.name}: {meta_error}")
            continue

        if meta_result == NONE_SENTINEL:
            err = update_street_view_url(client, row.id, NONE_SENTINEL)
            if err:
                summary.errors += 1
                tqdm.write(f"[error] {row.name}: {err}")
            else:
                summary.marked_none += 1
            continue

        if meta_result != "OK":
            summary.errors += 1
            continue

        ok, image_error = validate_street_view_image(
            session, row.lat, row.lng, api_key
        )
        time.sleep(API_DELAY_SECONDS)

        if image_error == NONE_SENTINEL:
            err = update_street_view_url(client, row.id, NONE_SENTINEL)
            if err:
                summary.errors += 1
            else:
                summary.marked_none += 1
            continue

        if image_error:
            summary.errors += 1
            tqdm.write(f"[error] {row.name} ({location}): {image_error}")
            continue

        if not ok:
            summary.errors += 1
            continue

        stored_url = build_street_view_url(row.lat, row.lng)
        err = update_street_view_url(client, row.id, stored_url)
        if err:
            summary.errors += 1
            tqdm.write(f"[error] {row.name}: {err}")
        else:
            summary.images_stored += 1

    print("\n--- Summary ---")
    print(f"Processed:              {summary.processed}")
    print(f"Image URLs stored:      {summary.images_stored}")
    print(f"Marked NONE (no imagery): {summary.marked_none}")
    print(f"Errors:                 {summary.errors}")
    if summary.images_stored:
        print(f"Est. image API cost:    ${summary.images_stored * COST_PER_IMAGE:.2f}")


if __name__ == "__main__":
    main()
