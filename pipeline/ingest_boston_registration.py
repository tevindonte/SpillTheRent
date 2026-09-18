"""
Update Boston complex owner fields from open data.

The brief's rental-registration resource_id is no longer published on
Analyze Boston. We use:
  1) Short-Term Rental Eligibility (sam_address, units in building)
  2) RentSmart (address, owner) for owner_name_verified / owner_llc

Usage:
  python ingest_boston_registration.py [--limit 20000]
"""

from __future__ import annotations

import argparse
from typing import Any

from address_utils import ComplexAddressIndex, normalize_address
from boston_ckan import datastore_search, owner_is_llc
from supabase_client import fetch_all_complexes, get_supabase_client

STR_RESOURCE = "83621b97-9a00-4aa7-bf43-28cae04969d4"
RENTSMART_RESOURCE = "dc615ff7-2ff3-416a-922b-f0f334f085d0"


def _parse_units(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20_000)
    args = parser.parse_args()

    client = get_supabase_client()
    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    # Prefer owner data from RentSmart
    rs_rows = datastore_search(
        RENTSMART_RESOURCE,
        limit=args.limit,
        desc="Fetching RentSmart owners",
    )
    owner_by_addr: dict[str, str] = {}
    for row in rs_rows:
        addr = normalize_address(row.get("address"))
        owner = str(row.get("owner") or "").strip()
        if addr and owner and addr not in owner_by_addr:
            owner_by_addr[addr] = owner

    # Unit counts / registration flag from STR eligibility
    str_rows = datastore_search(
        STR_RESOURCE,
        limit=args.limit,
        desc="Fetching STR / registration eligibility",
    )

    updated = 0
    seen_ids: set[str] = set()

    for row in str_rows:
        addr = normalize_address(row.get("sam_address"))
        if not addr:
            continue
        cid = index.match(addr, threshold=85)
        if not cid or cid in seen_ids:
            continue

        owner = owner_by_addr.get(addr)
        if not owner:
            # fuzzy-match owner dictionary by exact normalized address only
            owner = None

        payload: dict[str, Any] = {}
        if owner:
            payload["owner_name_verified"] = owner
            if owner_is_llc(owner):
                payload["owner_llc"] = owner
        units = _parse_units(row.get("units in building"))
        if units is not None:
            payload["units"] = units

        if not payload:
            continue

        client.table("complexes").update(payload).eq("id", cid).execute()
        seen_ids.add(cid)
        updated += 1
        if updated >= args.limit:
            break

    # Also apply RentSmart owners to any remaining matched addresses
    for addr, owner in owner_by_addr.items():
        if updated >= args.limit:
            break
        cid = index.match(addr, threshold=85)
        if not cid or cid in seen_ids:
            continue
        payload = {"owner_name_verified": owner}
        if owner_is_llc(owner):
            payload["owner_llc"] = owner
        client.table("complexes").update(payload).eq("id", cid).execute()
        seen_ids.add(cid)
        updated += 1

    print(f"Done. Updated owner/registration fields on {updated} complexes.")


if __name__ == "__main__":
    main()
