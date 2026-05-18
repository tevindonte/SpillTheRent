"""Batched Supabase writes with retries (avoids HTTP/2 connection exhaustion)."""

from __future__ import annotations

import os
import time
from typing import Any, Callable, TypeVar

from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

T = TypeVar("T")

RETRYABLE = (
    "ConnectionTerminated",
    "RemoteProtocolError",
    "Connection reset",
    "forcibly closed",
    "getaddrinfo failed",
    "10054",
    "timed out",
    "Timeout",
    "503",
    "502",
    "429",
)


def is_retryable_error(exc: Exception) -> bool:
    msg = str(exc)
    # Postgres / PostgREST constraint and client errors — do not retry
    if any(code in msg for code in ("23502", "23503", "23505", "23514", "PGRST")):
        return False
    if "violates" in msg.lower() and "constraint" in msg.lower():
        return False
    return any(s in msg for s in RETRYABLE)


def retry_execute(
    fn: Callable[[], T],
    *,
    max_attempts: int = 6,
    base_delay: float = 1.0,
    label: str = "request",
) -> T:
    last_err: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if not is_retryable_error(e):
                raise
            if attempt >= max_attempts - 1:
                break
            delay = base_delay * (2**attempt)
            print(f"  Retry {label} ({attempt + 1}/{max_attempts}) in {delay:.1f}s: {str(e)[:120]}")
            time.sleep(delay)
    assert last_err is not None
    raise last_err


def chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _get_database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")


def _run_sql_job(label: str, fn) -> bool:
    """Run a SQL job; return True on success. On failure, print hint and return False."""
    try:
        fn()
        return True
    except Exception as e:
        print(
            f"{label}: direct SQL failed ({str(e)[:160]}).\n"
            "  Falling back to REST. For faster pipeline runs, set DATABASE_URL to the "
            "**Session pooler** URI from Supabase (host `aws-0-….pooler.supabase.com`, "
            "port **6543**) — the `db.*.supabase.co` host often fails on Windows."
        )
        return False


def batch_update_ownernames(
    client: Client,
    updates: list[dict[str, Any]],
) -> int:
    """
    Set ownername on existing complexes only (never insert).
    Uses direct Postgres when DATABASE_URL is set; otherwise PATCH per row.
    """
    if not updates:
        return 0

    db_url = _get_database_url()
    if db_url:
        return _batch_update_ownernames_sql(db_url, updates)

    return _batch_update_ownernames_rest(client, updates)


def _batch_update_ownernames_sql(db_url: str, updates: list[dict[str, Any]]) -> int:
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            for batch in tqdm(
                chunked(updates, 500),
                desc="Updating ownername (SQL)",
                unit=" batch",
            ):
                execute_values(
                    cur,
                    """
                    UPDATE complexes AS c
                    SET ownername = v.ownername
                    FROM (VALUES %s) AS v(id, ownername)
                    WHERE c.id = v.id::uuid
                    """,
                    [(row["id"], row["ownername"]) for row in batch],
                    template="(%s::uuid, %s)",
                )
        conn.commit()
    finally:
        conn.close()
    return len(updates)


def _batch_update_ownernames_rest(
    client: Client,
    updates: list[dict[str, Any]],
) -> int:
    """Fallback: one PATCH per row with periodic client refresh."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    active = client
    done = 0

    for i, row in enumerate(tqdm(updates, desc="Updating ownername")):
        if i > 0 and i % 400 == 0 and url and key:
            active = create_client(url, key)
            time.sleep(0.3)

        retry_execute(
            lambda r=row, c=active: c.table("complexes")
            .update({"ownername": r["ownername"]})
            .eq("id", r["id"])
            .execute(),
            label="ownername patch",
        )
        done += 1

    return done


# Backwards-compatible alias
batch_upsert_ownernames = batch_update_ownernames


def _fresh_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def batch_insert(
    client: Client,
    table: str,
    rows: list[dict[str, Any]],
    *,
    batch_size: int = 50,
    refresh_every: int = 10,
    on_duplicate_skip: bool = True,
) -> tuple[int, int]:
    """Insert rows in batches with retries and periodic client refresh."""
    if not rows:
        return 0, 0

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    active = client
    inserted = 0
    skipped = 0

    def refresh() -> Client:
        nonlocal active
        if url and key:
            active = create_client(url, key)
            time.sleep(0.5)
        return active

    batches = chunked(rows, batch_size)
    bar = tqdm(total=len(rows), desc=f"Inserting {table}", unit=" rows")

    for i, batch in enumerate(batches):
        if i > 0 and i % refresh_every == 0:
            refresh()

        def do_batch(c: Client = active, b: list[dict[str, Any]] = batch) -> None:
            c.table(table).insert(b).execute()

        try:
            retry_execute(lambda: do_batch(), label=f"{table} batch insert")
            inserted += len(batch)
            bar.update(len(batch))
            continue
        except Exception as e:
            if not on_duplicate_skip:
                raise
            err = str(e).lower()
            if "duplicate" in err or "unique" in err or "23505" in err:
                skipped += len(batch)
                bar.update(len(batch))
                continue
            if is_retryable_error(e):
                refresh()
                try:
                    retry_execute(lambda: do_batch(), label=f"{table} batch insert retry")
                    inserted += len(batch)
                    bar.update(len(batch))
                    continue
                except Exception:
                    pass

        for row in batch:
            if inserted > 0 and inserted % (batch_size * refresh_every) == 0:
                refresh()

            try:
                retry_execute(
                    lambda r=row, c=active: c.table(table).insert(r).execute(),
                    label=f"{table} row insert",
                )
                inserted += 1
            except Exception as row_err:
                if not on_duplicate_skip:
                    raise
                row_msg = str(row_err).lower()
                if "duplicate" in row_msg or "unique" in row_msg or "23505" in row_msg:
                    skipped += 1
                elif is_retryable_error(row_err):
                    refresh()
                    retry_execute(
                        lambda r=row, c=active: c.table(table).insert(r).execute(),
                        label=f"{table} row insert retry",
                    )
                    inserted += 1
                else:
                    bar.close()
                    raise
            bar.update(1)

    bar.close()
    return inserted, skipped


def _recompute_hp_action_signals_sql(db_url: str) -> None:
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.complexes
                SET hp_action_count = 0,
                    hp_action_last_year = NULL
                """
            )
            cur.execute(
                """
                UPDATE public.complexes AS c
                SET
                  hp_action_count = agg.cnt,
                  hp_action_last_year = agg.last_year
                FROM (
                  SELECT
                    complex_id,
                    COUNT(*)::int AS cnt,
                    MAX(EXTRACT(YEAR FROM filing_date)::int) AS last_year
                  FROM public.hp_actions
                  WHERE complex_id IS NOT NULL
                  GROUP BY complex_id
                ) AS agg
                WHERE c.id = agg.complex_id
                """
            )
        conn.commit()
    finally:
        conn.close()


def recompute_hp_action_signals(client: Client | None = None) -> None:
    """Recompute hp_action_count and hp_action_last_year from hp_actions."""
    db_url = _get_database_url()
    if db_url:
        print("Recomputing HP action signals (SQL)…")
        if _run_sql_job("HP action signals", lambda: _recompute_hp_action_signals_sql(db_url)):
            print("HP action signals updated.")
            return

    if client is None:
        client = _fresh_supabase_client()

    print("Recomputing HP action signals (REST)…")
    by_complex: dict[str, dict[str, Any]] = {}
    offset = 0
    while True:
        res = retry_execute(
            lambda o=offset: client.table("hp_actions")
            .select("complex_id, filing_date")
            .not_.is_("complex_id", "null")
            .range(o, o + 999)
            .execute(),
            label="fetch hp_actions",
        )
        batch = res.data or []
        for row in batch:
            cid = row["complex_id"]
            if cid not in by_complex:
                by_complex[cid] = {"count": 0, "last_year": None}
            by_complex[cid]["count"] += 1
            fd = row.get("filing_date")
            if fd:
                try:
                    year = int(str(fd)[:4])
                    prev = by_complex[cid]["last_year"]
                    if prev is None or year > prev:
                        by_complex[cid]["last_year"] = year
                except ValueError:
                    pass
        if len(batch) < 1000:
            break
        offset += 1000

    retry_execute(
        lambda: client.table("complexes")
        .update({"hp_action_count": 0, "hp_action_last_year": None})
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .execute(),
        label="reset HP signals",
    )

    updates = {
        cid: {
            "hp_action_count": data["count"],
            "hp_action_last_year": data["last_year"],
        }
        for cid, data in by_complex.items()
    }
    if not updates:
        print("No HP actions linked to complexes.")
        return

    active = client
    for i, (cid, fields) in enumerate(tqdm(updates.items(), desc="Updating HP signals")):
        if i > 0 and i % 400 == 0:
            active = _fresh_supabase_client()
        retry_execute(
            lambda c=cid, f=fields, cl=active: cl.table("complexes")
            .update(f)
            .eq("id", c)
            .execute(),
            label="HP signal update",
        )
    print(f"Updated HP action signals for {len(updates)} complexes.")


def _recompute_dob_permit_signals_sql(db_url: str) -> None:
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.complexes
                SET has_active_construction = false,
                    active_permit_count = 0
                """
            )
            cur.execute(
                """
                UPDATE public.complexes AS c
                SET
                  has_active_construction = true,
                  active_permit_count = agg.cnt
                FROM (
                  SELECT complex_id, COUNT(*)::int AS cnt
                  FROM public.dob_permits
                  WHERE complex_id IS NOT NULL
                    AND (
                      expiration_date IS NULL
                      OR expiration_date > CURRENT_TIMESTAMP
                    )
                  GROUP BY complex_id
                ) AS agg
                WHERE c.id = agg.complex_id
                """
            )
        conn.commit()
    finally:
        conn.close()


def recompute_dob_permit_signals(client: Client | None = None) -> None:
    """Recompute active construction columns from dob_permits."""
    db_url = _get_database_url()
    if db_url:
        print("Recomputing DOB permit signals (SQL)…")
        if _run_sql_job("DOB permit signals", lambda: _recompute_dob_permit_signals_sql(db_url)):
            print("DOB permit signals updated.")
            return

    if client is None:
        client = _fresh_supabase_client()

    print("Recomputing DOB permit signals (REST)…")
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    by_complex: dict[str, int] = {}
    offset = 0
    while True:
        res = retry_execute(
            lambda o=offset: client.table("dob_permits")
            .select("complex_id, expiration_date")
            .not_.is_("complex_id", "null")
            .range(o, o + 999)
            .execute(),
            label="fetch dob_permits",
        )
        batch = res.data or []
        for row in batch:
            exp = row.get("expiration_date")
            if exp and str(exp) < now[:10]:
                continue
            cid = row["complex_id"]
            by_complex[cid] = by_complex.get(cid, 0) + 1
        if len(batch) < 1000:
            break
        offset += 1000

    retry_execute(
        lambda: client.table("complexes")
        .update({"has_active_construction": False, "active_permit_count": 0})
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .execute(),
        label="reset DOB signals",
    )

    updates = {
        cid: {"has_active_construction": True, "active_permit_count": count}
        for cid, count in by_complex.items()
    }
    if not updates:
        print("No active DOB permits linked to complexes.")
        return

    active = client
    for i, (cid, fields) in enumerate(tqdm(updates.items(), desc="Updating DOB signals")):
        if i > 0 and i % 400 == 0:
            active = _fresh_supabase_client()
        retry_execute(
            lambda c=cid, f=fields, cl=active: cl.table("complexes")
            .update(f)
            .eq("id", c)
            .execute(),
            label="DOB signal update",
        )
    print(f"Updated DOB permit signals for {len(updates)} complexes.")


def _recompute_bedbug_signals_sql(db_url: str) -> None:
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.complexes
                SET has_bedbug_history = false,
                    bedbug_report_count = 0,
                    bedbug_last_reported_year = NULL
                """
            )
            cur.execute(
                """
                UPDATE public.complexes AS c
                SET
                  has_bedbug_history = true,
                  bedbug_report_count = agg.cnt,
                  bedbug_last_reported_year = agg.last_year
                FROM (
                  SELECT
                    complex_id,
                    COUNT(*)::int AS cnt,
                    MAX(filing_year)::int AS last_year
                  FROM public.bedbug_reports
                  WHERE complex_id IS NOT NULL
                  GROUP BY complex_id
                ) AS agg
                WHERE c.id = agg.complex_id
                """
            )
        conn.commit()
    finally:
        conn.close()


def recompute_bedbug_signals(client: Client | None = None) -> None:
    """Recompute bedbug columns on complexes from bedbug_reports."""
    db_url = _get_database_url()
    if db_url:
        print("Recomputing bedbug signals (SQL)…")
        if _run_sql_job("Bedbug signals", lambda: _recompute_bedbug_signals_sql(db_url)):
            print("Bedbug signals updated.")
            return

    if client is None:
        client = _fresh_supabase_client()

    print("Recomputing bedbug signals (REST)…")
    by_complex: dict[str, dict[str, Any]] = {}
    offset = 0
    while True:
        res = retry_execute(
            lambda o=offset: client.table("bedbug_reports")
            .select("complex_id, filing_year")
            .not_.is_("complex_id", "null")
            .range(o, o + 999)
            .execute(),
            label="fetch bedbug_reports",
        )
        batch = res.data or []
        for row in batch:
            cid = row["complex_id"]
            if cid not in by_complex:
                by_complex[cid] = {"count": 0, "last_year": None}
            by_complex[cid]["count"] += 1
            year = row.get("filing_year")
            if year is not None:
                prev = by_complex[cid]["last_year"]
                if prev is None or year > prev:
                    by_complex[cid]["last_year"] = year
        if len(batch) < 1000:
            break
        offset += 1000

    retry_execute(
        lambda: client.table("complexes")
        .update(
            {
                "has_bedbug_history": False,
                "bedbug_report_count": 0,
                "bedbug_last_reported_year": None,
            }
        )
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .execute(),
        label="reset bedbug signals",
    )

    updates = {
        cid: {
            "has_bedbug_history": True,
            "bedbug_report_count": data["count"],
            "bedbug_last_reported_year": data["last_year"],
        }
        for cid, data in by_complex.items()
    }
    if not updates:
        print("No bedbug reports linked to complexes.")
        return

    active = client
    for i, (cid, fields) in enumerate(tqdm(updates.items(), desc="Updating bedbug signals")):
        if i > 0 and i % 400 == 0:
            active = _fresh_supabase_client()
        retry_execute(
            lambda c=cid, f=fields, cl=active: cl.table("complexes")
            .update(f)
            .eq("id", c)
            .execute(),
            label="bedbug signal update",
        )
    print(f"Updated bedbug signals for {len(updates)} complexes.")


def recompute_hpd_scores(client: Client | None = None) -> None:
    """Recompute hpd_open_violations and hpd_violation_score on all complexes."""
    db_url = _get_database_url()
    if db_url:
        print("Recomputing HPD scores (SQL)…")
        if _run_sql_job("HPD scores", lambda: _recompute_hpd_scores_sql(db_url)):
            print("HPD scores updated.")
            return

    if client is None:
        client = _fresh_supabase_client()

    print("Recomputing HPD scores (REST)…")
    open_by_complex: dict[str, int] = {}
    offset = 0
    while True:
        res = retry_execute(
            lambda o=offset: client.table("hpd_violations")
            .select("complex_id")
            .eq("status", "open")
            .not_.is_("complex_id", "null")
            .range(o, o + 999)
            .execute(),
            label="fetch open violations",
        )
        batch = res.data or []
        for row in batch:
            cid = row["complex_id"]
            open_by_complex[cid] = open_by_complex.get(cid, 0) + 1
        if len(batch) < 1000:
            break
        offset += 1000

    retry_execute(
        lambda: client.table("complexes")
        .update({"hpd_open_violations": 0, "hpd_violation_score": "Clean"})
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .execute(),
        label="reset HPD scores",
    )

    updates = {
        cid: {
            "hpd_open_violations": count,
            "hpd_violation_score": _hpd_score_label(count),
        }
        for cid, count in open_by_complex.items()
    }
    if not updates:
        print("No open HPD violations linked to complexes.")
        return

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    active = client
    items = list(updates.items())

    for i, (cid, fields) in enumerate(tqdm(items, desc="Updating HPD scores")):
        if i > 0 and i % 400 == 0 and url and key:
            active = create_client(url, key)
            time.sleep(0.3)
        retry_execute(
            lambda c=cid, f=fields, cl=active: cl.table("complexes")
            .update(f)
            .eq("id", c)
            .execute(),
            label="HPD score update",
        )

    print(f"Updated HPD scores for {len(updates)} complexes.")


def _hpd_score_label(open_count: int) -> str:
    if open_count <= 0:
        return "Clean"
    if open_count <= 5:
        return "Minor"
    if open_count <= 15:
        return "Moderate"
    return "Severe"


def _recompute_hpd_scores_sql(db_url: str) -> None:
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.complexes
                SET hpd_open_violations = 0,
                    hpd_violation_score = 'Clean'
                """
            )
            cur.execute(
                """
                UPDATE public.complexes AS c
                SET
                  hpd_open_violations = oc.cnt,
                  hpd_violation_score = CASE
                    WHEN oc.cnt <= 5 THEN 'Minor'
                    WHEN oc.cnt <= 15 THEN 'Moderate'
                    ELSE 'Severe'
                  END
                FROM (
                  SELECT complex_id, COUNT(*)::int AS cnt
                  FROM public.hpd_violations
                  WHERE status = 'open' AND complex_id IS NOT NULL
                  GROUP BY complex_id
                ) AS oc
                WHERE c.id = oc.complex_id
                """
            )
        conn.commit()
    finally:
        conn.close()
    print("HPD scores updated.")


def batch_mark_rent_stabilized(
    client: Client,
    complex_ids: list[str],
    *,
    stabilization_year: int = 2024,
    batch_size: int = 400,
) -> int:
    """
    Mark many complexes as rent-stabilized (batched; avoids HTTP/2 stream exhaustion).
  Uses DATABASE_URL SQL when set; otherwise .in_() PATCH batches with retries.
    """
    if not complex_ids:
        return 0

    unique_ids = list(dict.fromkeys(complex_ids))
    db_url = _get_database_url()

    if db_url:

        def _sql_job() -> None:
            import psycopg2

            conn = psycopg2.connect(db_url)
            try:
                with conn.cursor() as cur:
                    for batch in tqdm(
                        chunked(unique_ids, 500),
                        desc="Marking rent stabilized (SQL)",
                        unit=" batch",
                    ):
                        cur.execute(
                            """
                            UPDATE complexes
                            SET is_rent_stabilized = true,
                                stabilization_year = %s
                            WHERE id = ANY(%s::uuid[])
                            """,
                            (stabilization_year, batch),
                        )
                conn.commit()
            finally:
                conn.close()

        if _run_sql_job("Rent stabilization update", _sql_job):
            return len(unique_ids)

    active = client
    done = 0
    batches = list(chunked(unique_ids, batch_size))
    for i, batch in enumerate(tqdm(batches, desc="Marking rent stabilized", unit=" batch")):
        if i > 0 and i % 8 == 0:
            active = _fresh_supabase_client()
            time.sleep(0.2)

        payload: dict[str, Any] = {"is_rent_stabilized": True}
        if stabilization_year:
            payload["stabilization_year"] = stabilization_year

        retry_execute(
            lambda b=batch, p=payload, cl=active: cl.table("complexes")
            .update(p)
            .in_("id", b)
            .execute(),
            label="rent stabilization batch",
        )
        done += len(batch)
        time.sleep(0.05)

    return done


def batch_set_landlord_id(
    client: Client,
    complex_ids: list[str],
    landlord_id: str,
    batch_size: int = 400,
) -> int:
    """Set landlord_id on many complexes via .in_() filter."""
    if not complex_ids:
        return 0
    done = 0
    for batch in chunked(complex_ids, batch_size):
        retry_execute(
            lambda b=batch, lid=landlord_id: client.table("complexes")
            .update({"landlord_id": lid})
            .in_("id", b)
            .execute(),
            label="landlord_id update",
        )
        done += len(batch)
        time.sleep(0.05)
    return done
