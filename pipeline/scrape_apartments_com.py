"""
Scrape Apartments.com reviews via Apify and import into Supabase.

Usage:
  cd pipeline
  python scrape_apartments_com.py --test
  python scrape_apartments_com.py --limit 100
  python scrape_apartments_com.py --input data/apify_export.json --test
  python scrape_apartments_com.py --input data/apify_export.json
  python scrape_apartments_com.py --dataset-id <Apify_dataset_id> --test

Requires in pipeline/.env or ../.env.local (for import / optional API):
  APIFY_API_TOKEN (only if using live API or --dataset-id)
  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY

Apply migration 20260604000001_apartments_com_source.sql before first import.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from apify_client import ApifyClient
from dotenv import load_dotenv
from tqdm import tqdm

from address_utils import ComplexAddressIndex, normalize_address
from classify_reviews import classify_text, sentiment_from_rating_and_flags
from nyc_ingest_common import insert_rows, log_unmatched, parse_date
from supabase_batch import retry_execute
from supabase_client import PIPELINE_DIR, ROOT_DIR, get_supabase_client

ACTOR_ID = "RloufiEC7cXilEMhI"
UNMATCHED_CSV = PIPELINE_DIR / "data" / "apify_unmatched.csv"
START_URLS = [
    "https://www.apartments.com/manhattan-new-york-ny/",
    "https://www.apartments.com/brooklyn-new-york-ny/",
]

# supabase_client loads these on import; reload so CLI edits to .env.local apply.
load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local", override=True)


@dataclass
class Summary:
    buildings_scraped: int = 0
    matched_existing: int = 0
    new_buildings: int = 0
    reviews_imported: int = 0
    reviews_with_flags: int = 0
    skipped_non_nyc: int = 0
    skipped_no_reviews: int = 0
    complexes_touched: set[str] = field(default_factory=set)


def get_apify_client() -> ApifyClient:
    token = (os.getenv("APIFY_API_TOKEN") or "").strip()
    if not token:
        print(
            "Missing APIFY_API_TOKEN.\n"
            "  Add it to .env.local (repo root) or pipeline/.env, e.g.:\n"
            "  APIFY_API_TOKEN=apify_api_...\n"
            f"  (.env.local path: {ROOT_DIR / '.env.local'})",
            file=sys.stderr,
        )
        sys.exit(1)
    return ApifyClient(token)


def load_items_from_file(path: Path) -> list[dict[str, Any]]:
    """Load Apify export: JSON array, JSONL, or { \"items\": [...] } wrapper."""
    if not path.is_file():
        print(f"Input file not found: {path}", file=sys.stderr)
        sys.exit(1)

    text = path.read_text(encoding="utf-8-sig").strip()
    if not text:
        print(f"Input file is empty: {path}", file=sys.stderr)
        sys.exit(1)

    if path.suffix.lower() == ".jsonl":
        items = [json.loads(line) for line in text.splitlines() if line.strip()]
    else:
        data = json.loads(text)
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            for key in ("items", "data", "results"):
                if isinstance(data.get(key), list):
                    items = data[key]
                    break
            else:
                print(
                    "JSON must be an array or an object with an 'items' array.",
                    file=sys.stderr,
                )
                sys.exit(1)
        else:
            print("Unsupported JSON root type.", file=sys.stderr)
            sys.exit(1)

    if not isinstance(items, list):
        print("Expected a list of building records.", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(items)} items from {path}")
    if not _items_have_data(items):
        print(
            "No usable building data in file (missing propertyName / address).",
            file=sys.stderr,
        )
        sys.exit(1)
    return items


def fetch_dataset(client: ApifyClient, dataset_id: str) -> list[dict[str, Any]]:
    print(f"Fetching Apify dataset {dataset_id}…")
    items = list(client.dataset(dataset_id).iterate_items())
    print(f"Fetched {len(items)} items.")
    if not items or not _items_have_data(items):
        print("Dataset has no usable building data.", file=sys.stderr)
        sys.exit(1)
    return items


def fetch_complexes(client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            client.table("complexes")
            .select("id, name, address, borough, zip")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def run_apify_scraper(client: ApifyClient, max_items: int) -> list[dict[str, Any]]:
    run_input = {
        "startUrls": START_URLS,
        "includeReviews": True,
        "includeVisuals": False,
        "includeInteriorAmenities": False,
        "includeWalkScore": False,
        "maxItems": max_items,
    }

    print(f"Starting Apify actor {ACTOR_ID} (maxItems={max_items})…")
    run = client.actor(ACTOR_ID).call(run_input=run_input)
    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        print("Apify run finished without a dataset id.", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching dataset {dataset_id}…")
    items: list[dict[str, Any]] = []
    for item in client.dataset(dataset_id).iterate_items():
        items.append(item)
    print(f"Fetched {len(items)} items from Apify.")

    if not items or not _items_have_data(items):
        print(
            "\nNo usable building data returned.\n"
            "The Apartments.com scraper actor (RloufiEC7cXilEMhI) blocks API runs on "
            "Apify's free plan — logs show: \"You cannot use the API with the Free Plan.\"\n"
            "Options:\n"
            "  1. Upgrade at https://apify.com/pricing (Starter plan unlocks API actors)\n"
            "  2. Re-run after upgrading: python scrape_apartments_com.py --test\n"
            "  3. Export JSON from Apify Console and run:\n"
            "       python scrape_apartments_com.py --input data/apify_export.json --test\n"
            "  4. Or import a dataset id:\n"
            f"       python scrape_apartments_com.py --dataset-id {dataset_id} --test",
            file=sys.stderr,
        )
        sys.exit(1)

    return items


def extract_building(item: dict[str, Any]) -> dict[str, Any]:
    location = item.get("location") if isinstance(item.get("location"), dict) else {}
    rent = item.get("rent") if isinstance(item.get("rent"), dict) else {}

    full_address = (
        location.get("fullAddress")
        or location.get("address")
        or item.get("fullAddress")
        or item.get("address")
        or ""
    )

    return {
        "property_name": (item.get("propertyName") or item.get("name") or "").strip(),
        "full_address": str(full_address).strip(),
        "city": str(location.get("city") or item.get("city") or "").strip(),
        "postal_code": str(location.get("postalCode") or location.get("zip") or "").strip(),
        "reviews": item.get("reviews") or [],
        "rating": item.get("rating"),
        "rent_min": rent.get("min"),
        "rent_max": rent.get("max"),
        "beds": item.get("beds"),
    }


def _items_have_data(items: list[dict[str, Any]]) -> bool:
    for item in items:
        building = extract_building(item)
        if building["full_address"] or building["property_name"]:
            return True
    return False


def is_nyc_city(city: str, full_address: str) -> bool:
    blob = f"{city} {full_address}".lower()
    markers = (
        "new york",
        "brooklyn",
        "queens",
        "manhattan",
        "bronx",
        "staten island",
        "long island city",
        " lic ",
    )
    return any(m in blob for m in markers)


def borough_from_city(city: str, full_address: str) -> str | None:
    c = city.lower()
    addr = full_address.lower()
    if "brooklyn" in c or "brooklyn" in addr:
        return "BK"
    if "queens" in c or "queens" in addr or "long island city" in c or " lic" in addr:
        return "QN"
    if "manhattan" in c or "manhattan" in addr:
        return "MN"
    if "new york" in c:
        return "MN"
    return None


def parse_reviews(reviews_raw: Any) -> list[dict[str, Any]]:
    if not isinstance(reviews_raw, list):
        return []

    parsed: list[dict[str, Any]] = []
    for review in reviews_raw:
        if not isinstance(review, dict):
            continue
        text = (
            review.get("text")
            or review.get("reviewText")
            or review.get("body")
            or review.get("comment")
            or review.get("review")
            or ""
        )
        text = str(text).strip()
        if not text:
            continue

        rating = review.get("rating") or review.get("stars") or review.get("score")
        if rating is not None:
            try:
                rating = float(rating)
            except (TypeError, ValueError):
                rating = None

        review_date = parse_date(
            review.get("submissionDate")
            or review.get("date")
            or review.get("reviewDate")
            or review.get("publishedAt")
        )

        parsed.append({"text": text, "rating": rating, "review_date": review_date})
    return parsed


def filter_duplicate_reviews(
    client, rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Skip reviews already imported for the same complex (text prefix match)."""
    if not rows:
        return rows
    by_complex: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_complex.setdefault(row["complex_id"], []).append(row)

    existing: set[tuple[str, str]] = set()
    for cid in by_complex:
        offset = 0
        while True:
            res = (
                client.table("reviews")
                .select("review_text")
                .eq("complex_id", cid)
                .eq("source", "apartments_com")
                .range(offset, offset + 999)
                .execute()
            )
            batch = res.data or []
            for r in batch:
                text = (r.get("review_text") or "").strip()[:400]
                if text:
                    existing.add((cid, text))
            if len(batch) < 1000:
                break
            offset += 1000

    fresh: list[dict[str, Any]] = []
    for row in rows:
        key = (row["complex_id"], (row.get("review_text") or "").strip()[:400])
        if key[1] and key in existing:
            continue
        fresh.append(row)
    if len(fresh) < len(rows):
        print(f"Deduped {len(rows) - len(fresh)} duplicate reviews.")
    return fresh


def review_rows(complex_id: str, reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for review in reviews:
        flags = classify_text(review["text"])
        rating = review.get("rating")
        rows.append(
            {
                "complex_id": complex_id,
                "source": "apartments_com",
                "review_text": review["text"],
                "rating": rating,
                "review_date": review.get("review_date"),
                "is_anonymous": True,
                "red_flags": flags,
                "sentiment_score": sentiment_from_rating_and_flags(
                    float(rating) if rating is not None else None, flags
                ),
            }
        )
    return rows


def insert_complex(
    client,
    *,
    name: str,
    address: str,
    borough: str | None,
    postal_code: str,
    index: ComplexAddressIndex,
    summary: Summary,
) -> str | None:
    payload: dict[str, Any] = {
        "name": name or address or "Unknown building",
        "address": normalize_address(address),
        "borough": borough,
        "zip": postal_code[:10] if postal_code else None,
        "verified": False,
        "source": "apartments_com",
    }
    result = retry_execute(
        lambda: client.table("complexes").insert(payload).execute(),
        label="insert complex",
    )
    data = result.data
    if not data:
        return None
    row = data[0] if isinstance(data, list) else data
    complex_id = str(row["id"])
    index.register(complex_id, payload["address"] or address)
    summary.new_buildings += 1
    return complex_id


def recalculate_cache(client, complex_ids: set[str]) -> None:
    for cid in tqdm(complex_ids, desc="Refreshing cached_review_count"):
        retry_execute(
            lambda c=cid: client.rpc(
                "recalculate_complex_cache", {"p_complex_id": c}
            ).execute(),
            label="recalculate cache",
        )


def print_summary(summary: Summary, *, test_mode: bool) -> None:
    print("\n--- Summary ---")
    print(f"Buildings scraped:        {summary.buildings_scraped}")
    print(f"Matched existing:         {summary.matched_existing}")
    print(f"New buildings added:      {summary.new_buildings}")
    print(f"Reviews imported:         {summary.reviews_imported}")
    print(f"Reviews with red flags:   {summary.reviews_with_flags}")
    print(f"Skipped (non-NYC):        {summary.skipped_non_nyc}")
    print(f"Skipped (no reviews):     {summary.skipped_no_reviews}")
    if test_mode:
        print("(test mode — nothing written to Supabase)")


def load_items(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.input:
        path = Path(args.input)
        if not path.is_absolute():
            path = PIPELINE_DIR / path
        items = load_items_from_file(path)
    elif args.dataset_id:
        items = fetch_dataset(get_apify_client(), args.dataset_id)
    else:
        max_items = 10 if args.test else (args.limit if args.limit is not None else 100)
        items = run_apify_scraper(get_apify_client(), max_items=max_items)

    if args.test:
        cap = 10
    elif args.limit is not None:
        cap = args.limit
    else:
        cap = None

    if cap is not None and len(items) > cap:
        print(f"Using first {cap} of {len(items)} items.")
        items = items[:cap]
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Apartments.com reviews via Apify")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="maxItems for live Apify (default 100), or cap rows from --input",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Process 10 items, print match results, do not insert",
    )
    parser.add_argument(
        "--input",
        "-i",
        metavar="FILE",
        help="Apify JSON/JSONL export (skip live API run)",
    )
    parser.add_argument(
        "--dataset-id",
        metavar="ID",
        help="Import from an existing Apify dataset id (skip actor run)",
    )
    args = parser.parse_args()

    if args.input and args.dataset_id:
        print("Use only one of --input or --dataset-id.", file=sys.stderr)
        sys.exit(1)

    items = load_items(args)

    summary = Summary()
    summary.buildings_scraped = len(items)
    unmatched_log: list[dict[str, str]] = []
    pending_reviews: list[dict[str, Any]] = []

    if args.test:
        complexes = fetch_complexes(get_supabase_client())
        index = ComplexAddressIndex(complexes)
        print(f"Loaded {len(complexes)} complexes for matching (read-only test).\n")

        for item in tqdm(items, desc="Test matching"):
            building = extract_building(item)
            norm_addr = normalize_address(building["full_address"])
            reviews = parse_reviews(building["reviews"])
            complex_id, score, matched_addr = index.match_with_score(
                building["full_address"], threshold=85
            )

            if complex_id:
                outcome = f"MATCH score={score} complex_id={complex_id}"
                summary.matched_existing += 1
            elif is_nyc_city(building["city"], building["full_address"]):
                borough = borough_from_city(building["city"], building["full_address"])
                outcome = f"NEW (borough={borough or '?'})"
            else:
                outcome = "SKIP non-NYC"
                summary.skipped_non_nyc += 1

            print(
                f"\n{building['property_name']!r}\n"
                f"  address: {building['full_address']}\n"
                f"  normalized: {norm_addr}\n"
                f"  city: {building['city']}  zip: {building['postal_code']}\n"
                f"  reviews: {len(reviews)}  → {outcome}"
            )
            if complex_id and matched_addr:
                print(f"  matched_db_address: {matched_addr}")

        print_summary(summary, test_mode=True)
        return

    client = get_supabase_client()
    complexes = fetch_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    for item in tqdm(items, desc="Processing buildings"):
        building = extract_building(item)
        reviews = parse_reviews(building["reviews"])
        if not reviews:
            summary.skipped_no_reviews += 1
            continue

        address = building["full_address"]
        complex_id, score, matched_addr = index.match_with_score(address, threshold=85)

        if complex_id:
            summary.matched_existing += 1
        elif is_nyc_city(building["city"], address):
            borough = borough_from_city(building["city"], address)
            unmatched_log.append(
                {
                    "property_name": building["property_name"],
                    "full_address": address,
                    "city": building["city"],
                    "postal_code": building["postal_code"],
                    "reason": "no_fuzzy_match",
                    "match_score": str(score),
                }
            )
            complex_id = insert_complex(
                client,
                name=building["property_name"],
                address=address,
                borough=borough,
                postal_code=building["postal_code"],
                index=index,
                summary=summary,
            )
            if not complex_id:
                unmatched_log[-1]["reason"] = "complex_insert_failed"
                continue
        else:
            summary.skipped_non_nyc += 1
            unmatched_log.append(
                {
                    "property_name": building["property_name"],
                    "full_address": address,
                    "city": building["city"],
                    "postal_code": building["postal_code"],
                    "reason": "non_nyc",
                    "match_score": str(score),
                }
            )
            continue

        rows = review_rows(complex_id, reviews)
        pending_reviews.extend(rows)
        summary.complexes_touched.add(complex_id)

    if pending_reviews:
        pending_reviews = filter_duplicate_reviews(client, pending_reviews)
        inserted, skipped = insert_rows(
            client, "reviews", pending_reviews, batch_size=50
        )
        summary.reviews_imported = inserted
        summary.reviews_with_flags = sum(
            1 for row in pending_reviews if row.get("red_flags")
        )
        if skipped:
            print(f"Skipped {skipped} duplicate review rows.")

    if summary.complexes_touched:
        recalculate_cache(client, summary.complexes_touched)

    if unmatched_log:
        log_unmatched(
            UNMATCHED_CSV,
            unmatched_log,
            ["property_name", "full_address", "city", "postal_code", "reason", "match_score"],
        )

    print_summary(summary, test_mode=False)


if __name__ == "__main__":
    main()
