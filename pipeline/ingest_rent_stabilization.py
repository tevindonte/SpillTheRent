"""
Ingest NYC rent stabilized buildings and match to complexes.

Source: NYC Rent Guidelines Board DHCR building registration PDFs
(https://rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/)

The former Socrata dataset (bebr-mq7t) is no longer published on NYC Open Data.

Usage:
  python ingest_rent_stabilization.py [--limit 1000]
  python ingest_rent_stabilization.py --pdf-url <url>
"""

from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path
from typing import Any

import pdfplumber
import requests
from tqdm import tqdm

from address_utils import normalize_address, ComplexAddressIndex
from borough_config import add_borough_cli_args, get_borough
from supabase_batch import batch_mark_rent_stabilized
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SpillTheRent/1.0; "
        "+https://github.com/spilltherent-data-ingest)"
    ),
}

# Row trailer: "... CITY 61|62|63 MULTIPLE DWELLING ..." (61=Kings, 62=NY, 63=Queens)
TRAILER_RE = re.compile(r"\s+(61|62|63)\s+MULTIPLE\s+DWELLING\b", re.IGNORECASE)
ZIP_PREFIX_RE = re.compile(r"^(\d{5})\s+(.+)$", re.IGNORECASE)

# DHCR city names by county code (longest match first within each county).
CITIES_BY_COUNTY: dict[str, list[str]] = {
    "62": ["NEW YORK"],
    "61": ["BROOKLYN"],
    "63": [
        "LONG ISLAND CITY",
        "KEW GARDENS HILLS",
        "KEW GARDEN HILLS",
        "KEW GARDENS",
        "SOUTH OZONE PARK",
        "SOUTH RICHMOND HILL",
        "SPRINGFIELD GARDENS",
        "CAMBRIA HEIGHTS",
        "QUEENS VILLAGE",
        "MIDDLE VILLAGE",
        "EAST ELMHURST",
        "JACKSON HEIGHTS",
        "COLLEGE POINT",
        "FRESH MEADOWS",
        "OAKLAND GARDENS",
        "HOWARD BEACH",
        "ROCKAWAY BEACH",
        "ROCKAWAY PARK",
        "FAR ROCKAWAY",
        "BREEZY POINT",
        "BROAD CHANNEL",
        "RICHMOND HILL",
        "SAINT ALBANS",
        "ST ALBANS",
        "LITTLE NECK",
        "FLORAL PARK",
        "GLEN OAKS",
        "REGO PARK",
        "FOREST HILLS",
        "FLUSHING",
        "SUNNYSIDE",
        "GLENDALE",
        "WOODHAVEN",
        "JAMAICA",
        "ASTORIA",
        "CORONA",
        "ELMHURST",
        "RIDGEWOOD",
        "WOODSIDE",
        "BAYSIDE",
        "WHITESTONE",
        "BELLEROSE",
        "LAURELTON",
        "ROSEDALE",
        "HOLLISWOOD",
        "HOLLIS",
        "MASPETH",
        "OZONE PARK",
        "ARVERNE",
        "BRIARWOOD",
        "BEECHHURST",
        "DOUGLASTON",
    ],
}

STREET_SUFFIXES = {
    "AVE", "AVENUE", "ST", "STREET", "RD", "ROAD", "DR", "DRIVE", "BLVD",
    "BOULEVARD", "PL", "PLACE", "LN", "LANE", "CT", "COURT", "TER", "TERRACE",
    "PKWY", "PARKWAY", "BROADWAY", "WAY", "SQ", "SQUARE", "CRES", "CRESCENT",
}

STABILIZATION_YEAR = 2024


def download_pdf(url: str, dest: Path | None = None) -> bytes:
    print(f"Downloading {url}")
    resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=180)
    resp.raise_for_status()
    data = resp.content
    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"Saved {len(data):,} bytes to {dest}")
    return data


def primary_street_segment(street_part: str) -> str:
    """
    DHCR rows may include a cross street (e.g. '320 11TH AVE 545577 W 30TH ST').
    Keep the primary segment before a second house-number + street pattern.
    """
    tokens = street_part.split()
    if len(tokens) <= 3:
        return street_part

    suffixes = {
        "AVE", "AVENUE", "ST", "STREET", "RD", "ROAD", "DR", "DRIVE",
        "BLVD", "BOULEVARD", "PL", "PLACE", "LN", "LANE", "CT", "COURT",
        "TER", "TERRACE", "PKWY", "PARKWAY", "BROADWAY", "WAY",
    }

    first_suffix_idx = None
    for i, tok in enumerate(tokens):
        if tok.upper() in suffixes or tok.upper().rstrip(".") in suffixes:
            first_suffix_idx = i
            break

    if first_suffix_idx is None:
        return street_part

    # Look for a second address after the first suffix (number + name + suffix)
    rest_start = first_suffix_idx + 1
    if rest_start < len(tokens) and re.match(r"^\d", tokens[rest_start]):
        return " ".join(tokens[: rest_start + 1])

    return street_part


def split_street_city(rest: str, county: str) -> tuple[str, str] | tuple[None, None]:
    """Split address remainder into street segment and city name."""
    rest_u = rest.upper().strip()
    if not rest_u:
        return None, None

    for city in sorted(CITIES_BY_COUNTY.get(county, []), key=len, reverse=True):
        if rest_u.endswith(city):
            street = rest[: len(rest) - len(city)].strip()
            if street:
                return street, city

    # Queens fallback: city is often a single trailing word (e.g. SUNNYSIDE, GLENDALE).
    if county == "63":
        tokens = rest_u.split()
        if len(tokens) >= 2:
            last = tokens[-1].rstrip(".")
            if (
                last.isalpha()
                and len(last) > 2
                and last not in STREET_SUFFIXES
            ):
                street = rest[: len(rest) - len(tokens[-1])].strip()
                if street:
                    return street, last

    return None, None


def parse_dhcr_line(line: str) -> tuple[str, str, str] | None:
    """Return (zip, street_part, city) or None if line does not match."""
    trailer = TRAILER_RE.search(line)
    if not trailer:
        return None

    prefix = line[: trailer.start()]
    zip_match = ZIP_PREFIX_RE.match(prefix)
    if not zip_match:
        return None

    zipcode = zip_match.group(1)
    street, city = split_street_city(zip_match.group(2), trailer.group(1))
    if not street:
        return None

    return zipcode, street, city


def parse_pdf_records(pdf_bytes: bytes, limit: int | None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = pdf.pages
        for page in tqdm(pages, desc="Parsing PDF pages", unit=" page"):
            text = page.extract_text() or ""
            for raw_line in text.splitlines():
                line = raw_line.strip()
                if not line or line.startswith("ZIP ") or line.startswith("List of"):
                    continue

                parsed = parse_dhcr_line(line)
                if not parsed:
                    continue

                zipcode, street_part, _city = parsed
                street_part = primary_street_segment(street_part)
                address = normalize_address(street_part)
                if not address:
                    continue

                key = f"{address}|{zipcode}"
                if key in seen:
                    continue
                seen.add(key)

                records.append(
                    {
                        "address": address,
                        "zip": zipcode,
                        "stabilization_year": STABILIZATION_YEAR,
                    }
                )

                if limit is not None and len(records) >= limit:
                    return records

    return records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest rent stabilized buildings from RGB DHCR PDF"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max records to process (default: all)",
    )
    add_borough_cli_args(parser, default="MN")
    parser.add_argument(
        "--pdf-url",
        default=None,
        help="Override DHCR PDF URL (default: borough-specific RGB file)",
    )
    parser.add_argument(
        "--cache-pdf",
        type=Path,
        default=None,
        help="Local path to cache downloaded PDF (default: data/<borough>.pdf)",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Use cached PDF at --cache-pdf only",
    )
    args = parser.parse_args()
    borough = get_borough(args.borough)
    pdf_url = args.pdf_url or borough.dhcr_pdf_url
    cache_pdf = args.cache_pdf or (PIPELINE_DIR / "data" / borough.dhcr_cache_name)

    if args.skip_download and cache_pdf.is_file():
        pdf_bytes = cache_pdf.read_bytes()
        print(f"Using cached PDF ({len(pdf_bytes):,} bytes)")
    elif cache_pdf.is_file() and not args.skip_download:
        # Refresh if missing; prefer re-download when not --skip-download
        pdf_bytes = download_pdf(pdf_url, cache_pdf)
    else:
        pdf_bytes = download_pdf(pdf_url, cache_pdf)

    records = parse_pdf_records(pdf_bytes, args.limit)
    print(f"Parsed {len(records)} unique stabilized addresses from PDF.")

    if not records:
        print("No records parsed — check PDF format or URL.", file=sys.stderr)
        sys.exit(1)

    client = get_supabase_client()
    all_complexes = fetch_all_complexes(client)
    borough_label = borough.label
    complexes = [
        c
        for c in all_complexes
        if (c.get("borough") or "").strip() == borough_label
    ]
    print(
        f"Loaded {len(complexes)} {borough_label} complexes for matching "
        f"(of {len(all_complexes)} total)."
    )
    if not complexes:
        print(
            f"No complexes with borough = {borough_label!r}. "
            f"Run ingest_pluto.py --borough {borough.code} first.",
            file=sys.stderr,
        )
        sys.exit(1)

    index = ComplexAddressIndex(complexes)

    matched_ids: list[str] = []
    unmatched = 0
    for rec in tqdm(records, desc="Matching to complexes"):
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched += 1
            continue
        matched_ids.append(cid)

    year = STABILIZATION_YEAR
    if records and records[0].get("stabilization_year"):
        year = int(records[0]["stabilization_year"])

    print(f"Matched {len(matched_ids)} addresses → updating complexes in batches…")
    written = batch_mark_rent_stabilized(
        client, matched_ids, stabilization_year=year
    )
    print(f"Done. Updated {written} complexes, {unmatched} addresses unmatched.")


if __name__ == "__main__":
    main()
