"""CKAN datastore helpers for Analyze Boston (data.boston.gov)."""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import quote

import requests
from tqdm import tqdm

CKAN_BASE = "https://data.boston.gov/api/3/action"
PAGE_SIZE = 10_000
USER_AGENT = "spillthe.rent-boston-ingest/1.0"


def _get(url: str, params: dict[str, Any] | None = None, timeout: int = 120) -> dict[str, Any]:
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                raise RuntimeError(data.get("error") or data)
            return data
        except Exception as e:
            last_err = e
            time.sleep(2**attempt)
    assert last_err is not None
    raise last_err


def datastore_search(
    resource_id: str,
    *,
    limit: int | None = None,
    filters: dict[str, Any] | None = None,
    q: str | None = None,
    desc: str = "Fetching",
    page_size: int = PAGE_SIZE,
) -> list[dict[str, Any]]:
    """Paginate CKAN datastore_search with offset."""
    rows: list[dict[str, Any]] = []
    offset = 0
    with tqdm(desc=desc, unit=" rows") as bar:
        while True:
            if limit is not None and len(rows) >= limit:
                return rows[:limit]
            params: dict[str, Any] = {
                "resource_id": resource_id,
                "limit": min(page_size, (limit - len(rows)) if limit else page_size),
                "offset": offset,
            }
            if filters:
                import json

                params["filters"] = json.dumps(filters)
            if q:
                params["q"] = q
            data = _get(f"{CKAN_BASE}/datastore_search", params)
            batch = data["result"].get("records") or []
            if not batch:
                break
            rows.extend(batch)
            bar.update(len(batch))
            offset += len(batch)
            if len(batch) < params["limit"]:
                break
    return rows


def datastore_search_sql(
    sql: str,
    *,
    limit: int | None = None,
    desc: str = "Fetching SQL",
    page_size: int = 5000,
) -> list[dict[str, Any]]:
    """
    Paginate CKAN datastore_search_sql.

    Wrap the caller's SELECT in an outer query that adds OFFSET/LIMIT.
    Caller SQL should NOT include a trailing semicolon.
    """
    rows: list[dict[str, Any]] = []
    offset = 0
    base = sql.strip().rstrip(";")
    with tqdm(desc=desc, unit=" rows") as bar:
        while True:
            if limit is not None and len(rows) >= limit:
                return rows[:limit]
            take = min(page_size, (limit - len(rows)) if limit else page_size)
            paged = f"SELECT * FROM ({base}) AS _q OFFSET {offset} LIMIT {take}"
            # CKAN expects the sql as a query param; quote carefully
            url = f"{CKAN_BASE}/datastore_search_sql?sql={quote(paged)}"
            data = _get(url, params=None)
            batch = data["result"].get("records") or []
            if not batch:
                break
            rows.extend(batch)
            bar.update(len(batch))
            offset += len(batch)
            if len(batch) < take:
                break
    return rows


def parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def owner_is_llc(name: str | None) -> bool:
    if not name:
        return False
    upper = name.upper()
    return any(tok in upper for tok in (" LLC", "LLC ", " INC", "INC ", " CORP", "CORP ", "REALTY"))
