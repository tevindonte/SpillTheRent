#"""Backfill complexes.owner_* from hpd_property_registration after a timed-out update."""

from __future__ import annotations

import os
import time

from dotenv import load_dotenv
from tqdm import tqdm

from supabase_batch import _fresh_supabase_client, retry_execute
from supabase_client import PIPELINE_DIR, get_supabase_client

load_dotenv(PIPELINE_DIR / ".env")
load_dotenv(PIPELINE_DIR.parent / ".env.local")


def backfill_sql(db_url: str) -> int:
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '120s'")
            cur.execute(
                """
                UPDATE public.complexes AS c
                SET
                  owner_name_verified = r.owner_name,
                  owner_llc = r.business_name,
                  owner_phone = r.phone
                FROM (
                  SELECT DISTINCT ON (complex_id)
                    complex_id,
                    owner_name,
                    business_name,
                    phone
                  FROM public.hpd_property_registration
                  WHERE complex_id IS NOT NULL
                    AND (owner_name IS NOT NULL OR business_name IS NOT NULL)
                  ORDER BY complex_id, created_at DESC NULLS LAST
                ) AS r
                WHERE c.id = r.complex_id
                """
            )
            return cur.rowcount
    finally:
        conn.close()


def backfill_rest() -> int:
    client = get_supabase_client()
    by_complex: dict = {}
    offset = 0
    while True:
        res = retry_execute(
            lambda o=offset: client.table("hpd_property_registration")
            .select("complex_id, owner_name, business_name, phone")
            .not_.is_("complex_id", "null")
            .range(o, o + 999)
            .execute(),
            label="fetch registrations",
        )
        batch = res.data or []
        for row in batch:
            cid = row["complex_id"]
            prev = by_complex.get(cid)
            if prev is None:
                by_complex[cid] = row
            else:
                score = int(bool(row.get("business_name"))) + int(bool(row.get("owner_name")))
                prev_score = int(bool(prev.get("business_name"))) + int(bool(prev.get("owner_name")))
                if score >= prev_score:
                    by_complex[cid] = row
        if len(batch) < 1000:
            break
        offset += 1000

    active = client
    updated = 0
    items = list(by_complex.items())
    for i, (cid, row) in enumerate(tqdm(items, desc="Updating owner fields")):
        if i > 0 and i % 200 == 0:
            active = _fresh_supabase_client()
            time.sleep(0.2)
        payload = {
            "owner_name_verified": row.get("owner_name"),
            "owner_llc": row.get("business_name"),
            "owner_phone": row.get("phone"),
        }
        retry_execute(
            lambda c=cid, p=payload, cl=active: cl.table("complexes")
            .update(p)
            .eq("id", c)
            .execute(),
            label="owner update",
        )
        updated += 1
    return updated


def main() -> None:
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if db_url:
        try:
            n = backfill_sql(db_url)
            print(f"SQL backfill updated {n} complexes.")
            return
        except Exception as e:
            print(f"SQL backfill failed ({e}); falling back to REST...")

    n = backfill_rest()
    print(f"REST backfill updated {n} complexes.")


if __name__ == "__main__":
    main()
