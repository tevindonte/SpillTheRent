"""
Enrich Supabase complexes with Google Places (two-step: Find Place + Place Details).

Step 1 — Find Place from Text: resolve place_id from address query.
Step 2 — Place Details: fetch name, rating, review count, and review text.

Usage:
  cd pipeline
  python enrich_google_places.py              # default: 50 rows
  python enrich_google_places.py --limit 10 --verbose
  python enrich_google_places.py --limit 0    # full run (~$0.034 × row count)

Requires in pipeline/.env or ../.env.local:
  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_PLACES_API_KEY
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
DATA_DIR = PIPELINE_DIR / "data"
ERRORS_CSV = DATA_DIR / "google_enrich_errors.csv"

FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
BATCH_SIZE = 1000
API_DELAY_SECONDS = 0.1
COST_PER_REQUEST = 0.017  # Find Place + Place Details each billed at this tier

ERROR_CSV_COLUMNS = ["complex_id", "address", "error_message"]

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")


@dataclass
class Summary:
    processed: int = 0
    matched: int = 0
    not_found: int = 0
    errors: int = 0
    skipped_already_enriched: int = 0
    names_updated: int = 0
    ratings_written: int = 0
    ratings_missing_from_api: int = 0
    review_counts_written: int = 0
    review_counts_missing_from_api: int = 0
    google_reviews_inserted: int = 0
    details_errors: int = 0


@dataclass
class ApiResult:
    data: dict[str, Any] | None
    full_response: dict[str, Any]
    error_message: str | None = None


@dataclass
class UpdatePlan:
    payload: dict[str, Any]
    rating_in_api: bool
    review_count_in_api: bool
    name_changed: bool
    reviews_to_insert: list[dict[str, Any]] = field(default_factory=list)


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


def build_search_query(name: str, address: str | None) -> str:
    parts = [name.strip()]
    if address and address.strip():
        parts.append(address.strip())
    parts.extend(["Manhattan", "New York"])
    return " ".join(parts)


def fetch_complexes_without_place_id(client: Client, limit: int) -> list[dict[str, Any]]:
    """Rows with google_place_id IS NULL (resumable — enriched rows are excluded)."""
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        remaining = limit - len(rows) if limit > 0 else BATCH_SIZE
        if limit > 0 and remaining <= 0:
            break
        page_size = min(BATCH_SIZE, remaining) if limit > 0 else BATCH_SIZE

        result = (
            client.table("complexes")
            .select("id, name, address, google_place_id")
            .is_("google_place_id", "null")
            .order("name")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        batch = result.data or []
        if not batch:
            break

        for row in batch:
            if row.get("google_place_id"):
                continue
            rows.append(row)
            if limit > 0 and len(rows) >= limit:
                return rows

        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def find_place(session: requests.Session, api_key: str, query: str) -> ApiResult:
    """Step 1: resolve place_id (ratings are not returned here)."""
    try:
        response = session.get(
            FIND_PLACE_URL,
            params={
                "input": query,
                "inputtype": "textquery",
                "fields": "place_id,name,formatted_address",
                "key": api_key,
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        return ApiResult(None, {}, f"Find Place HTTP error: {exc}")
    except ValueError as exc:
        return ApiResult(None, {}, f"Find Place invalid JSON: {exc}")

    status = payload.get("status")
    if status == "OK" and payload.get("candidates"):
        return ApiResult(payload["candidates"][0], payload)
    if status in ("ZERO_RESULTS", "NOT_FOUND"):
        return ApiResult(None, payload)
    if status == "OK":
        return ApiResult(None, payload)

    error_detail = payload.get("error_message", status)
    return ApiResult(None, payload, f"Find Place status {status}: {error_detail}")


def get_place_details(
    session: requests.Session, api_key: str, place_id: str
) -> ApiResult:
    """Step 2: name, rating, user_ratings_total, reviews."""
    try:
        response = session.get(
            PLACE_DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": "name,rating,user_ratings_total,reviews",
                "key": api_key,
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        return ApiResult(None, {}, f"Place Details HTTP error: {exc}")
    except ValueError as exc:
        return ApiResult(None, {}, f"Place Details invalid JSON: {exc}")

    status = payload.get("status")
    if status == "OK" and payload.get("result"):
        return ApiResult(payload["result"], payload)

    error_detail = payload.get("error_message", status)
    return ApiResult(None, payload, f"Place Details status {status}: {error_detail}")


def google_review_rows(
    complex_id: str, reviews: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for review in reviews:
        text = review.get("text")
        if not text or not str(text).strip():
            continue
        review_date = None
        if review.get("time") is not None:
            review_date = datetime.fromtimestamp(
                int(review["time"]), tz=timezone.utc
            ).isoformat()
        rows.append(
            {
                "complex_id": complex_id,
                "source": "google",
                "rating": float(review["rating"])
                if review.get("rating") is not None
                else None,
                "review_text": str(text).strip(),
                "review_date": review_date,
                "red_flags": [],
            }
        )
    return rows


def build_update_plan(
    complex_id: str,
    current_name: str,
    place_id: str,
    details: dict[str, Any],
) -> UpdatePlan:
    """Build complexes update + review rows from Place Details (step 2)."""
    payload: dict[str, Any] = {"google_place_id": place_id}
    rating_in_api = "rating" in details
    review_count_in_api = "user_ratings_total" in details
    name_changed = False

    google_name = details.get("name")
    if (
        google_name
        and isinstance(google_name, str)
        and google_name.strip() != current_name.strip()
    ):
        payload["name"] = google_name.strip()
        name_changed = True

    if rating_in_api and details["rating"] is not None:
        payload["google_rating"] = float(details["rating"])

    if review_count_in_api and details["user_ratings_total"] is not None:
        payload["google_review_count"] = int(details["user_ratings_total"])

    return UpdatePlan(
        payload=payload,
        rating_in_api=rating_in_api,
        review_count_in_api=review_count_in_api,
        name_changed=name_changed,
        reviews_to_insert=google_review_rows(
            complex_id, details.get("reviews") or []
        ),
    )


def apply_enrichment(
    client: Client,
    complex_id: str,
    current_name: str,
    place_id: str,
    details: dict[str, Any],
) -> tuple[str | None, UpdatePlan]:
    try:
        plan = build_update_plan(complex_id, current_name, place_id, details)
    except (ValueError, TypeError) as exc:
        return str(exc), UpdatePlan({}, False, False, False)

    try:
        client.table("complexes").update(plan.payload).eq("id", complex_id).execute()

        if plan.reviews_to_insert:
            # Replace prior Google reviews so re-runs stay idempotent.
            client.table("reviews").delete().eq("complex_id", complex_id).eq(
                "source", "google"
            ).execute()
            client.table("reviews").insert(plan.reviews_to_insert).execute()
    except Exception as exc:
        return f"Supabase write failed: {exc}", plan

    return None, plan


def append_error_row(complex_id: str, address: str, error_message: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_exists = ERRORS_CSV.exists()
    with ERRORS_CSV.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=ERROR_CSV_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(
            {
                "complex_id": complex_id,
                "address": address,
                "error_message": error_message,
            }
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich complexes via Google Find Place + Place Details."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Max complexes to process (default: 50). Use 0 for no limit.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print full Google API JSON for each step.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    limit = args.limit
    verbose = args.verbose

    client = get_supabase_client()
    api_key = get_google_api_key()

    print("Fetching complexes where google_place_id IS NULL…")
    complexes = fetch_complexes_without_place_id(client, limit)
    print(f"Queued {len(complexes)} complexes for enrichment.")
    if complexes:
        est_cost = len(complexes) * COST_PER_REQUEST * 2
        print(
            f"Estimated API cost this run: ${est_cost:.2f} "
            f"({len(complexes)} × $0.034 — Find Place + Place Details)"
        )

    summary = Summary()
    session = requests.Session()
    progress = tqdm(complexes, desc="Google Places enrichment", disable=verbose)

    for row in progress:
        complex_id = row["id"]
        name = row.get("name") or ""
        address = row.get("address") or ""
        display_address = address or name

        if row.get("google_place_id"):
            summary.skipped_already_enriched += 1
            continue

        summary.processed += 1
        query = build_search_query(name, address)

        # --- Step 1: Find Place ---
        find_result = find_place(session, api_key, query)
        time.sleep(API_DELAY_SECONDS)

        if verbose:
            print(f"\n{'=' * 60}")
            print(f"Query: {query}")
            print(f"DB name: {name}")
            print("Step 1 — Find Place response:")
            print(json.dumps(find_result.full_response, indent=2))

        if find_result.error_message:
            summary.errors += 1
            append_error_row(complex_id, display_address, find_result.error_message)
            continue

        if not find_result.data:
            summary.not_found += 1
            if verbose:
                print("No Find Place match.")
            continue

        place_id = find_result.data.get("place_id")
        if not place_id:
            summary.errors += 1
            append_error_row(
                complex_id, display_address, "Find Place returned no place_id"
            )
            continue

        # --- Step 2: Place Details ---
        details_result = get_place_details(session, api_key, place_id)
        time.sleep(API_DELAY_SECONDS)

        if verbose:
            print("Step 2 — Place Details response:")
            print(json.dumps(details_result.full_response, indent=2))

        if details_result.error_message or not details_result.data:
            summary.details_errors += 1
            summary.errors += 1
            msg = details_result.error_message or "Place Details returned no result"
            append_error_row(complex_id, display_address, msg)
            # Save place_id only so we don't re-bill Find Place; ratings stay null.
            try:
                client.table("complexes").update(
                    {"google_place_id": place_id}
                ).eq("id", complex_id).execute()
            except Exception as exc:
                append_error_row(
                    complex_id,
                    display_address,
                    f"Partial update (place_id only) failed: {exc}",
                )
            continue

        update_error, plan = apply_enrichment(
            client,
            complex_id,
            name,
            place_id,
            details_result.data,
        )

        if verbose:
            print("Supabase complexes payload:", json.dumps(plan.payload, indent=2))
            print(
                f"Place Details rating: {details_result.data.get('rating', '<missing>')} "
                f"(in response: {plan.rating_in_api})"
            )
            print(
                f"Place Details user_ratings_total: "
                f"{details_result.data.get('user_ratings_total', '<missing>')} "
                f"(in response: {plan.review_count_in_api})"
            )
            print(f"Google reviews to insert: {len(plan.reviews_to_insert)}")

        if update_error:
            summary.errors += 1
            append_error_row(complex_id, display_address, update_error)
            continue

        summary.matched += 1
        if plan.name_changed:
            summary.names_updated += 1
        if "google_rating" in plan.payload:
            summary.ratings_written += 1
        elif not plan.rating_in_api:
            summary.ratings_missing_from_api += 1
        if "google_review_count" in plan.payload:
            summary.review_counts_written += 1
        elif not plan.review_count_in_api:
            summary.review_counts_missing_from_api += 1
        summary.google_reviews_inserted += len(plan.reviews_to_insert)

    print("\n--- Summary ---")
    print(f"Total processed:              {summary.processed}")
    print(f"Fully enriched (both steps):  {summary.matched}")
    print(f"Names updated:                {summary.names_updated}")
    print(f"Ratings written to DB:        {summary.ratings_written}")
    print(f"Ratings absent in Details:    {summary.ratings_missing_from_api}")
    print(f"Review counts written:        {summary.review_counts_written}")
    print(f"Review counts absent:         {summary.review_counts_missing_from_api}")
    print(f"Google reviews inserted:      {summary.google_reviews_inserted}")
    print(f"Place Details failures:       {summary.details_errors}")
    print(f"Not found (Find Place):       {summary.not_found}")
    print(f"Errors:                       {summary.errors}")
    if summary.skipped_already_enriched:
        print(f"Skipped (had place_id):       {summary.skipped_already_enriched}")
    if summary.errors:
        print(f"Failure log: {ERRORS_CSV}")


if __name__ == "__main__":
    main()
