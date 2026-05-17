"""Shared helpers for NYC Open Data ingestion pipelines."""

from __future__ import annotations

import csv
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Iterator

import requests
from tqdm import tqdm

from address_utils import build_address_from_parts, normalize_address, ComplexAddressIndex
from supabase_client import PIPELINE_DIR

PAGE_SIZE = 10_000


def fetch_socrata(
    api_url: str,
    *,
    where: str | None = None,
    limit: int | None = None,
    desc: str = "Fetching",
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0

    with tqdm(desc=desc, unit=" rows") as bar:
        while True:
            if limit is not None and len(rows) >= limit:
                return rows[:limit]

            params: dict[str, Any] = {"$limit": PAGE_SIZE, "$offset": offset}
            if where:
                params["$where"] = where

            resp = requests.get(api_url, params=params, timeout=120)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break

            rows.extend(batch)
            bar.update(len(batch))
            offset += len(batch)

            if len(batch) < PAGE_SIZE:
                break

    return rows


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%Y %H:%M:%S",
    ):
        try:
            return datetime.strptime(s[:26].replace("Z", ""), fmt).isoformat()
        except ValueError:
            continue
    return None


def parse_date_only(value: Any) -> date | None:
    iso = parse_date(value)
    if not iso:
        return None
    return datetime.fromisoformat(iso[:19]).date()


def year_from_date(value: Any) -> int | None:
    d = parse_date_only(value)
    return d.year if d else None


def dob_address(row: dict[str, Any]) -> str:
    return build_address_from_parts(
        row.get("house__") or row.get("house_no"),
        row.get("street_name"),
        row.get("zip_code"),
    )


def dob_now_address(row: dict[str, Any]) -> str:
    return build_address_from_parts(
        row.get("house_no"),
        row.get("street_name"),
        row.get("zip_code"),
    )


def oath_address(row: dict[str, Any]) -> str:
    house = row.get("violation_location_house") or row.get("respondent_address_house")
    street = (
        row.get("violation_location_street_name")
        or row.get("violation_location_street")
        or row.get("respondent_address_street_name")
        or row.get("respondent_address_street")
    )
    zipcode = row.get("violation_location_zip_code") or row.get("respondent_address_zip_code")
    if house and street:
        return build_address_from_parts(house, street, zipcode)
    return ""


def oath_text_blob(row: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("violation_details", "violation_description"):
        val = row.get(key)
        if val:
            parts.append(str(val))
    for i in range(1, 11):
        desc = row.get(f"charge_{i}_code_description")
        if desc:
            parts.append(str(desc))
    return " ".join(parts)


def oath_description(row: dict[str, Any]) -> str | None:
    details = (row.get("violation_details") or "").strip()
    if details:
        return details[:2000]
    blob = oath_text_blob(row).strip()
    return blob[:2000] if blob else None


def oath_is_short_term(row: dict[str, Any]) -> bool:
    text = oath_text_blob(row).upper()
    phrases = (
        "SHORT TERM",
        "SHORT-TERM",
        "ILLEGAL HOTEL",
        "ILLEGAL SHORT",
        "AIRBNB",
        "TRANSIENT USE",
        "TRANSIENT LODGING",
        "TRANSIENT OCCUPANCY",
        "SHORT TERM OCCUPANCY",
        "SHORT TERM RENTAL",
        "SHORT-TERM RENTAL",
    )
    return any(p in text for p in phrases)


def oath_fetch_where() -> str:
    """SoQL filter for short-term / illegal hotel violations in Manhattan."""
    clauses = [
        "upper(violation_details) like '%SHORT TERM%'",
        "upper(violation_details) like '%ILLEGAL HOTEL%'",
        "upper(violation_details) like '%AIRBNB%'",
        "upper(violation_details) like '%ILLEGAL SHORT%'",
        "upper(violation_details) like '%TRANSIENT USE%'",
        "upper(violation_details) like '%TRANSIENT LODGING%'",
        "upper(violation_details) like '%SHORT-TERM%'",
        "upper(violation_description) like '%SHORT TERM%'",
        "upper(violation_description) like '%AIRBNB%'",
    ]
    return (
        "violation_location_borough='MANHATTAN' "
        f"AND ({' OR '.join(clauses)}) "
        "AND violation_location_house IS NOT NULL "
        "AND violation_location_street_name IS NOT NULL"
    )


def hp_address(row: dict[str, Any]) -> str:
    return build_address_from_parts(
        row.get("housenumber"),
        row.get("streetname"),
        row.get("zip"),
    )


def insert_rows(
    client,
    table: str,
    rows: list[dict[str, Any]],
    *,
    on_duplicate_skip: bool = True,
    batch_size: int = 100,
) -> tuple[int, int]:
    from supabase_batch import batch_insert

    return batch_insert(
        client,
        table,
        rows,
        batch_size=batch_size,
        on_duplicate_skip=on_duplicate_skip,
    )


def log_unmatched(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Logged {len(rows)} unmatched to {path}")


def batch_update_complex_signals(updates: dict[str, dict[str, Any]]) -> None:
    """Bulk-update complexes signal columns by id."""
    if not updates:
        return

    import os

    from dotenv import load_dotenv

    load_dotenv(PIPELINE_DIR / ".env")
    load_dotenv(PIPELINE_DIR.parent / ".env.local")

    from supabase_batch import _fresh_supabase_client, _run_sql_job, retry_execute

    def _sql_update() -> None:
        import psycopg2

        db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if not db_url:
            raise RuntimeError("No DATABASE_URL")
        items = list(updates.items())
        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                for cid, fields in items:
                    sets = ", ".join(f"{k} = %s" for k in fields)
                    vals = list(fields.values()) + [cid]
                    cur.execute(
                        f"UPDATE complexes SET {sets} WHERE id = %s::uuid",
                        vals,
                    )
            conn.commit()
        finally:
            conn.close()

    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if db_url and _run_sql_job("Complex signal update", _sql_update):
        return

    client = _fresh_supabase_client()
    items = list(updates.items())
    for i, (cid, fields) in enumerate(tqdm(items, desc="Updating complexes")):
        if i > 0 and i % 400 == 0:
            client = _fresh_supabase_client()
        retry_execute(
            lambda c=cid, f=fields, cl=client: cl.table("complexes")
            .update(f)
            .eq("id", c)
            .execute(),
            label="complex signal update",
        )
