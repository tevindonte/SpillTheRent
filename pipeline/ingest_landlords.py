"""
Build landlord portfolios from PLUTO owner names and link complexes.

Usage:
  python ingest_landlords.py
  python ingest_landlords.py --skip-ownername   # only link landlord_id
"""

from __future__ import annotations

import argparse
import re
from collections import defaultdict
from typing import Any

import requests
from rapidfuzz import fuzz, process
from tqdm import tqdm

from address_utils import normalize_address
from supabase_batch import batch_set_landlord_id, batch_update_ownernames, retry_execute
from supabase_client import fetch_all_complexes, get_supabase_client

PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json"
PAGE_SIZE = 10_000
SOQL_WHERE = "borough = 'MN'"

SUFFIX_RE = re.compile(
    r"\b(LLC|L\.L\.C\.|LP|L\.P\.|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY)\b\.?",
    re.IGNORECASE,
)


def normalize_owner(name: str | None) -> str:
    if not name:
        return ""
    n = name.strip().upper()
    n = SUFFIX_RE.sub("", n)
    n = re.sub(r"[^\w\s&-]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def hpd_score_numeric(score: str | None) -> float:
    return {
        "Clean": 5.0,
        "Minor": 3.5,
        "Moderate": 2.0,
        "Severe": 0.0,
    }.get(score or "", 2.5)


def portfolio_score(
    avg_google: float | None,
    avg_hpd: float,
    severe_ratio: float,
) -> str:
    if severe_ratio > 0.5:
        return "Poor"
    if avg_google is None:
        weighted = avg_hpd
    else:
        weighted = 0.6 * avg_google + 0.4 * avg_hpd
    if weighted > 4.0:
        return "Excellent"
    if weighted >= 3.0:
        return "Good"
    if weighted >= 2.0:
        return "Fair"
    return "Poor"


def fetch_pluto_owners() -> dict[str, str]:
    """Map normalized address -> normalized owner name."""
    address_owner: dict[str, str] = {}
    offset = 0

    with tqdm(desc="Fetching PLUTO owners", unit=" rows") as bar:
        while True:
            resp = requests.get(
                PLUTO_API,
                params={"$limit": PAGE_SIZE, "$offset": offset, "$where": SOQL_WHERE},
                timeout=120,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break

            for row in batch:
                addr = normalize_address(row.get("address"))
                owner = normalize_owner(row.get("ownername"))
                if addr and owner:
                    address_owner[addr] = owner

            bar.update(len(batch))
            offset += len(batch)
            if len(batch) < PAGE_SIZE:
                break

    return address_owner


def cluster_owners(raw_owners: list[str], threshold: int = 90) -> dict[str, str]:
    """Map each raw owner -> canonical cluster key."""
    canonical: list[str] = []
    mapping: dict[str, str] = {}

    for owner in tqdm(sorted(set(raw_owners)), desc="Clustering owners"):
        if not owner:
            continue
        if not canonical:
            canonical.append(owner)
            mapping[owner] = owner
            continue
        result = process.extractOne(
            owner, canonical, scorer=fuzz.token_sort_ratio, score_cutoff=threshold
        )
        if result:
            mapping[owner] = result[0]
        else:
            canonical.append(owner)
            mapping[owner] = owner

    return mapping


def fetch_complexes_with_hpd(client) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    page_size = 1000
    cols = (
        "id, address, name, units, google_rating, ownername, landlord_id, "
        "hpd_violation_score"
    )
    while True:
        result = retry_execute(
            lambda o=offset: client.table("complexes")
            .select(cols)
            .range(o, o + page_size - 1)
            .execute(),
            label="fetch complexes",
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-ownername",
        action="store_true",
        help="Skip writing ownername to complexes (faster; landlord_id still set)",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    complexes = fetch_complexes_with_hpd(client)
    print(f"Loaded {len(complexes)} complexes.")

    pluto_owners = fetch_pluto_owners()
    print(f"PLUTO owner records: {len(pluto_owners)}")

    complex_owners: dict[str, str] = {}
    ownername_updates: list[dict[str, Any]] = []

    for c in complexes:
        addr = normalize_address(c.get("address"))
        owner = normalize_owner(c.get("ownername"))
        if not owner and addr in pluto_owners:
            owner = pluto_owners[addr]
        if owner:
            complex_owners[c["id"]] = owner
            if not args.skip_ownername and not c.get("ownername"):
                ownername_updates.append({"id": c["id"], "ownername": owner})

    if ownername_updates:
        print(f"Batch upserting {len(ownername_updates)} owner names…")
        written = batch_update_ownernames(client, ownername_updates)
        print(f"Updated {written} ownername fields.")

    owner_clusters = cluster_owners(list(complex_owners.values()))

    groups: dict[str, list[dict]] = defaultdict(list)
    raw_names_by_canonical: dict[str, set[str]] = defaultdict(set)

    for c in complexes:
        raw = complex_owners.get(c["id"])
        if not raw:
            continue
        canonical = owner_clusters.get(raw, raw)
        groups[canonical].append(c)
        raw_names_by_canonical[canonical].add(raw)

    print(f"Landlord groups: {len(groups)}")

    linked = 0
    for canonical, members in tqdm(groups.items(), desc="Upserting landlords"):
        if not members:
            continue

        ratings = [m["google_rating"] for m in members if m.get("google_rating") is not None]
        avg_google = sum(ratings) / len(ratings) if ratings else None

        hpd_scores = [hpd_score_numeric(m.get("hpd_violation_score")) for m in members]
        avg_hpd = sum(hpd_scores) / len(hpd_scores) if hpd_scores else 2.5
        severe_count = sum(1 for m in members if m.get("hpd_violation_score") == "Severe")
        severe_ratio = severe_count / len(members)

        score = portfolio_score(avg_google, avg_hpd, severe_ratio)
        total_units = sum(m.get("units") or 0 for m in members)

        landlord_row = {
            "name": canonical.title(),
            "raw_names": sorted(raw_names_by_canonical[canonical]),
            "building_count": len(members),
            "total_units": total_units,
            "avg_google_rating": round(avg_google, 2) if avg_google is not None else None,
            "avg_hpd_violations": round(avg_hpd, 2),
            "portfolio_score": score,
        }

        existing = retry_execute(
            lambda n=landlord_row["name"]: client.table("landlords")
            .select("id")
            .eq("name", n)
            .limit(1)
            .execute(),
            label="landlord lookup",
        )

        if existing.data:
            landlord_id = existing.data[0]["id"]
            retry_execute(
                lambda lid=landlord_id, row=landlord_row: client.table("landlords")
                .update(row)
                .eq("id", lid)
                .execute(),
                label="landlord update",
            )
        else:
            ins = retry_execute(
                lambda row=landlord_row: client.table("landlords").insert(row).execute(),
                label="landlord insert",
            )
            landlord_id = ins.data[0]["id"]

        member_ids = [m["id"] for m in members]
        linked += batch_set_landlord_id(client, member_ids, landlord_id)

    print(f"Done. Linked {linked} complexes to {len(groups)} landlords.")


if __name__ == "__main__":
    main()
