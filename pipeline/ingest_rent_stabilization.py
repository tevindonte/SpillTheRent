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
from supabase_client import PIPELINE_DIR, fetch_all_complexes, get_supabase_client

# 2024 DHCR registration file (Manhattan) — update yearly from RGB site if needed
DEFAULT_MANHATTAN_PDF = (
    "https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/"
    "2025/12/2024-DHCR-Bldg-File-Manhattan.pdf"
)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SpillTheRent/1.0; "
        "+https://github.com/spilltherent-data-ingest)"
    ),
}

# ZIP BLDGNO STREET ... NEW YORK ...
LINE_RE = re.compile(
    r"^(\d{5})\s+(.+?)\s+NEW\s+YORK\b",
    re.IGNORECASE,
)

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

                match = LINE_RE.match(line)
                if not match:
                    continue

                zipcode = match.group(1)
                street_part = primary_street_segment(match.group(2).strip())
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
    parser.add_argument(
        "--pdf-url",
        default=DEFAULT_MANHATTAN_PDF,
        help="Manhattan DHCR PDF URL (Rent Guidelines Board)",
    )
    parser.add_argument(
        "--cache-pdf",
        type=Path,
        default=PIPELINE_DIR / "data" / "dhcr_manhattan.pdf",
        help="Local path to cache downloaded PDF",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Use cached PDF at --cache-pdf only",
    )
    args = parser.parse_args()

    if args.skip_download and args.cache_pdf.is_file():
        pdf_bytes = args.cache_pdf.read_bytes()
        print(f"Using cached PDF ({len(pdf_bytes):,} bytes)")
    elif args.cache_pdf.is_file() and not args.skip_download:
        # Refresh if missing; prefer re-download when not --skip-download
        pdf_bytes = download_pdf(args.pdf_url, args.cache_pdf)
    else:
        pdf_bytes = download_pdf(args.pdf_url, args.cache_pdf)

    records = parse_pdf_records(pdf_bytes, args.limit)
    print(f"Parsed {len(records)} unique stabilized addresses from PDF.")

    if not records:
        print("No records parsed — check PDF format or URL.", file=sys.stderr)
        sys.exit(1)

    client = get_supabase_client()
    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes for matching.")

    matched = 0
    unmatched = 0
    for rec in tqdm(records, desc="Matching to complexes"):
        cid = index.match(rec["address"], threshold=85)
        if not cid:
            unmatched += 1
            continue

        update: dict[str, Any] = {"is_rent_stabilized": True}
        if rec.get("stabilization_year"):
            update["stabilization_year"] = rec["stabilization_year"]

        client.table("complexes").update(update).eq("id", cid).execute()
        matched += 1

    print(f"Done. Matched {matched} complexes, {unmatched} addresses unmatched.")


if __name__ == "__main__":
    main()
