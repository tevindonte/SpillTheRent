"""Shared Supabase client for pipeline scripts."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
            "SUPABASE_SERVICE_ROLE_KEY in pipeline/.env or .env.local",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_client(url, key)


def fetch_all_complexes(client: Client) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            client.table("complexes")
            .select("id, address, name, units, google_rating, ownername, landlord_id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows
