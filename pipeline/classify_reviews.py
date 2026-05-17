"""
Classify Google/external reviews with keyword-based red flag detection.

Usage:
  python classify_reviews.py
  python classify_reviews.py --source google
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from typing import Any

from tqdm import tqdm

from supabase_client import get_supabase_client

# (flag_value, patterns) — context-aware where noted
RULES: list[tuple[str, list[re.Pattern]]] = [
    (
        "mold",
        [
            re.compile(r"\bmold\b|\bmould\b", re.I),
        ],
    ),
    (
        "roaches",
        [
            re.compile(
                r"\broach\w*\b|\bcockroach\w*\b|\bpest\w*\b|\bmice\b|\bmouse\b|\brat\w*\b|\brodent\w*\b|\binfest\w*\b",
                re.I,
            ),
        ],
    ),
    (
        "maintenance",
        [
            re.compile(
                r"maintenance.{0,40}(never|months|ignored|unresponsive|broken|won'?t|doesn'?t)",
                re.I,
            ),
            re.compile(
                r"(never|months|ignored|unresponsive|broken).{0,40}maintenance",
                re.I,
            ),
            re.compile(r"\brepair\w*\b.{0,30}(never|months|ignored|unresponsive)", re.I),
        ],
    ),
    (
        "deposit",
        [
            re.compile(
                r"\bdeposit\b|\bsecurity\b.{0,15}deposit",
                re.I,
            ),
            re.compile(
                r"(kept|withheld|stole|never returned|refused|illegal).{0,40}(deposit|security)",
                re.I,
            ),
        ],
    ),
    (
        "noise",
        [
            re.compile(
                r"\bnoise\b|\bloud\b|\bthin walls\b|\bhear everything\b|\bparties\b",
                re.I,
            ),
        ],
    ),
    (
        "safety",
        [
            re.compile(
                r"\bsecurity\b|\bunsafe\b|\bbreak[\s-]?in\b|\brobbery\b|\bdoorman\b|\bpackage theft\b",
                re.I,
            ),
        ],
    ),
    (
        "heat_ac",
        [
            re.compile(
                r"(heat|ac|air conditioning|hvac).{0,40}(broken|not working|months|never fixed|cold|freezing)",
                re.I,
            ),
            re.compile(
                r"(broken|not working|months|never fixed|cold|freezing).{0,40}(heat|ac|air conditioning|hvac)",
                re.I,
            ),
        ],
    ),
    (
        "flooding",
        [
            re.compile(
                r"\bflood\w*\b|\bleak\w*\b|\bwater damage\b|\bpipe burst\b|\bwet ceiling\b",
                re.I,
            ),
        ],
    ),
]

MOLD_CONTEXT = re.compile(r"\b(bathroom|ceiling|wall|smell|apartment|unit)\b", re.I)


def classify_text(text: str) -> list[str]:
    flags: list[str] = []
    for flag, patterns in RULES:
        for pat in patterns:
            if pat.search(text):
                if flag == "mold" and not MOLD_CONTEXT.search(text):
                    # Still flag mold if word present in housing context
                    if not re.search(r"\bmold\b|\bmould\b", text, re.I):
                        continue
                if flag not in flags:
                    flags.append(flag)
                break
    return flags


def sentiment_from_rating_and_flags(rating: float | None, flags: list[str]) -> float | None:
    if rating is None:
        return None
    score = float(rating)
    score -= 0.1 * len(flags)
    return round(max(0.0, min(5.0, score)), 2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=None, help="e.g. google (default: all non-user)")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    client = get_supabase_client()
    query = (
        client.table("reviews")
        .select("id, review_text, rating, red_flags, source")
        .neq("source", "user")
    )
    if args.source:
        query = query.eq("source", args.source)

    reviews: list[dict[str, Any]] = []
    offset = 0
    while True:
        res = query.range(offset, offset + 999).execute()
        batch = res.data or []
        reviews.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
        if args.limit and len(reviews) >= args.limit:
            reviews = reviews[: args.limit]
            break

    print(f"Classifying {len(reviews)} reviews…")
    flag_counts: Counter[str] = Counter()
    updated = 0

    for review in tqdm(reviews):
        text = (review.get("review_text") or "").strip()
        if not text:
            continue
        existing = review.get("red_flags") or []
        if existing:
            continue

        flags = classify_text(text)
        rating = review.get("rating")
        sentiment = sentiment_from_rating_and_flags(
            float(rating) if rating is not None else None, flags
        )

        client.table("reviews").update(
            {"red_flags": flags, "sentiment_score": sentiment}
        ).eq("id", review["id"]).execute()

        for f in flags:
            flag_counts[f] += 1
        updated += 1

    print(f"Done. Classified {updated} reviews.")
    if flag_counts:
        print("Most common flags:")
        for flag, count in flag_counts.most_common():
            print(f"  {flag}: {count}")


if __name__ == "__main__":
    main()
