"""
Ingest HPD Multiple Dwelling Registrations + Contacts (shell-company exposer).

Datasets:
  - tesw-yqqr Multiple Dwelling Registrations (building address / registrationid)
  - feu5-w2e2 Registration Contacts (HeadOfficer / CorporateOwner / IndividualOwner)

Note: Contacts API has no phone column in the published schema; owner_phone stays null.

Usage:
  python ingest_hpd_registration.py [--limit 50000]
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from typing import Any

import requests
from tqdm import tqdm

from address_utils import ComplexAddressIndex, build_address_from_parts
from nyc_ingest_common import batch_update_complex_signals, fetch_socrata, insert_rows, parse_date
from supabase_client import fetch_all_complexes, get_supabase_client

REG_API = "https://data.cityofnewyork.us/resource/tesw-yqqr.json"
CONTACTS_API = "https://data.cityofnewyork.us/resource/feu5-w2e2.json"
BOROIDS = ("1", "3", "4")


def person_name(row: dict[str, Any]) -> str | None:
    first = (row.get("firstname") or "").strip()
    last = (row.get("lastname") or "").strip()
    name = " ".join(p for p in (first, last) if p).strip()
    return name or None


def pick_owner_fields(contacts: list[dict[str, Any]]) -> dict[str, Any]:
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c in contacts:
        by_type[str(c.get("type") or "").strip()].append(c)

    corp = (by_type.get("CorporateOwner") or [None])[0]
    head = (by_type.get("HeadOfficer") or [None])[0]
    indiv = (by_type.get("IndividualOwner") or [None])[0]

    owner_llc = None
    if corp:
        owner_llc = (corp.get("corporationname") or "").strip() or None

    owner_name = None
    owner_type = None
    phone = None
    business_name = owner_llc

    if head:
        owner_name = person_name(head)
        owner_type = "HeadOfficer"
        phone = head.get("phone") or (corp.get("phone") if corp else None)
    elif indiv:
        owner_name = person_name(indiv) or (indiv.get("corporationname") or "").strip() or None
        owner_type = "IndividualOwner"
        phone = indiv.get("phone")
    elif corp:
        owner_name = (corp.get("corporationname") or "").strip() or None
        owner_type = "CorporateOwner"
        phone = corp.get("phone")

    if not owner_name and owner_llc:
        owner_name = owner_llc

    return {
        "owner_name": owner_name,
        "owner_type": owner_type,
        "business_name": business_name,
        "owner_llc": owner_llc,
        "phone": (str(phone).strip() if phone else None),
    }


def fetch_contacts_for_regs(registration_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """Fetch contacts in chunks keyed by registrationid."""
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    chunk_size = 50
    for i in tqdm(range(0, len(registration_ids), chunk_size), desc="Fetching contacts"):
        chunk = registration_ids[i : i + chunk_size]
        quoted = ",".join(f"'{rid}'" for rid in chunk)
        where = (
            f"registrationid in ({quoted}) "
            "AND type in ('HeadOfficer','CorporateOwner','IndividualOwner')"
        )
        params = {"$limit": 5000, "$where": where}
        resp = requests.get(CONTACTS_API, params=params, timeout=120)
        resp.raise_for_status()
        for row in resp.json():
            rid = str(row.get("registrationid") or "").strip()
            if rid:
                out[rid].append(row)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50_000)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    client = get_supabase_client()
    complexes = fetch_all_complexes(client)
    index = ComplexAddressIndex(complexes)
    print(f"Loaded {len(complexes)} complexes.")

    where_reg = "boroid in ('" + "','".join(BOROIDS) + "')"
    registrations = fetch_socrata(
        REG_API,
        where=where_reg,
        limit=args.limit,
        desc="Fetching HPD registrations",
    )
    print(f"Registrations fetched: {len(registrations)}")

    reg_by_id: dict[str, dict[str, Any]] = {}
    for row in registrations:
        rid = str(row.get("registrationid") or "").strip()
        if not rid:
            continue
        address = build_address_from_parts(
            row.get("housenumber") or row.get("lowhousenumber"),
            row.get("streetname"),
            row.get("zip"),
        )
        if not address:
            continue
        reg_by_id[rid] = {
            "address": address,
            "registration_date": parse_date(
                row.get("lastregistrationdate") or row.get("registrationenddate")
            ),
        }

    if not reg_by_id:
        print("No registrations to process.")
        return

    contacts_by_reg = fetch_contacts_for_regs(list(reg_by_id.keys()))

    records: list[dict[str, Any]] = []
    complex_updates: dict[str, dict[str, Any]] = {}

    for rid, reg in reg_by_id.items():
        owner = pick_owner_fields(contacts_by_reg.get(rid, []))
        if not owner.get("owner_name") and not owner.get("owner_llc"):
            continue

        cid = index.match(reg["address"], threshold=85)
        records.append(
            {
                "complex_id": cid,
                "address": reg["address"],
                "owner_name": owner.get("owner_name"),
                "owner_type": owner.get("owner_type"),
                "business_name": owner.get("business_name"),
                "phone": owner.get("phone"),
                "registration_date": reg.get("registration_date"),
            }
        )

        if cid:
            complex_updates[cid] = {
                "owner_name_verified": owner.get("owner_name"),
                "owner_llc": owner.get("owner_llc"),
                "owner_phone": owner.get("phone"),
            }

    inserted, skipped = insert_rows(
        client, "hpd_property_registration", records, batch_size=args.batch_size
    )
    print(f"Registration rows inserted: {inserted}, skipped: {skipped}")

    if complex_updates:
        batch_update_complex_signals(complex_updates)
        print(f"Updated owner fields on {len(complex_updates)} complexes.")

    print("Done.")


if __name__ == "__main__":
    main()
