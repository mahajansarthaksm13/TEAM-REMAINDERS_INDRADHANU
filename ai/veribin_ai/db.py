"""Database access for the nightly AI job. Reads with the ai_job login (D13).

Every read returns a pandas DataFrame; every write is an upsert, so running
the job twice on the same day is safe.
"""

from __future__ import annotations

import json
import os

import pandas as pd
import psycopg


def connect() -> psycopg.Connection:
    url = os.environ.get("AI_DATABASE_URL")
    if not url:
        raise SystemExit("AI_DATABASE_URL is not set")
    return psycopg.connect(url, autocommit=False)


def _frame(conn: psycopg.Connection, sql: str, params: tuple = ()) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [c.name for c in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def load_scans(conn: psycopg.Connection, days: int = 90) -> pd.DataFrame:
    return _frame(conn, """
        select s.id, s.bin_id, s.company_id, s.category::text as category, s.sequence,
               s.scanned_at, s.code_type::text as code_type, s.code, s.weight_g,
               s.record_text, s.signature, s.chain_hash, s.insertion_order,
               p.unit_weight_g, b.public_key, b.is_demo
        from public.scans s
        join public.products p on p.id = s.product_id
        join public.bins b on b.id = s.bin_id
        where s.scanned_at >= now() - make_interval(days => %s)
        order by s.bin_id, s.insertion_order
    """, (days,))


def load_scans_since(conn: psycopg.Connection, after_order: int) -> pd.DataFrame:
    return _frame(conn, """
        select s.id, s.bin_id, s.record_text, s.signature, s.insertion_order, b.public_key
        from public.scans s join public.bins b on b.id = s.bin_id
        where s.insertion_order > %s order by s.insertion_order
    """, (after_order,))


def load_rejected(conn: psycopg.Connection, days: int = 90) -> pd.DataFrame:
    return _frame(conn, """
        select bin_id, reason, received_at from public.rejected_scans
        where received_at >= now() - make_interval(days => %s)
    """, (days,))


def load_bins(conn: psycopg.Connection) -> pd.DataFrame:
    return _frame(conn, "select id, company_id, city, status::text as status, is_demo "
                        "from public.bins order by id")


def load_targets(conn: psycopg.Connection, fy: str) -> pd.DataFrame:
    return _frame(conn, "select company_id, category::text as category, target_kg "
                        "from public.targets where financial_year = %s", (fy,))


def load_daily_totals(conn: psycopg.Connection, since) -> pd.DataFrame:
    return _frame(conn, """
        select d.day, d.company_id, d.category::text as category, b.city,
               d.scan_count, d.weight_g
        from public.daily_totals d
        join public.bins b on b.id = d.bin_id
        join public.companies c on c.id = d.company_id
        where d.day >= %s and not c.is_demo
    """, (since,))


def verify_chain(conn: psycopg.Connection, bin_id: str) -> dict:
    df = _frame(conn, "select * from public.verify_chain(%s)", (bin_id,))
    return df.iloc[0].to_dict()


# ------------------------------------------------------------------ writes

def save_bin_scores(conn: psycopg.Connection, day, scores: list[dict]) -> None:
    with conn.cursor() as cur:
        for s in scores:
            if s["score"] is None:          # not enough data: write nothing
                continue
            cur.execute("""
                insert into public.bin_scores (bin_id, day, score, reasons, scans_considered)
                values (%s, %s, %s, %s, %s)
                on conflict (bin_id, day) do update
                set score = excluded.score, reasons = excluded.reasons,
                    scans_considered = excluded.scans_considered
            """, (s["bin_id"], day, int(round(s["score"])), json.dumps(s["reasons"]),
                  s["scans_considered"]))


def save_flags(conn: psycopg.Connection, flags: list[dict]) -> None:
    with conn.cursor() as cur:
        for f in flags:
            cur.execute("""
                insert into public.scan_flags (scan_id, reason, severity)
                values (%s, %s, %s) on conflict (scan_id, reason) do nothing
            """, (f["scan_id"], f["reason"], f["severity"]))


def open_alert(conn: psycopg.Connection, kind: str, bin_id: str | None,
               company_id: str | None, message: str) -> None:
    """One open alert per (kind, bin, company): never duplicates."""
    with conn.cursor() as cur:
        cur.execute("""
            insert into public.alerts (kind, bin_id, company_id, message)
            select %s, %s, %s, %s
            where not exists (
              select 1 from public.alerts a
              where a.kind = %s::public.alert_kind and a.closed_at is null
                and a.bin_id is not distinct from %s and a.company_id is not distinct from %s)
        """, (kind, bin_id, company_id, message, kind, bin_id, company_id))


def replace_insights(conn: psycopg.Connection, week_start, cards: list[dict]) -> None:
    # default=str: company_id comes back from psycopg as uuid.UUID
    with conn.cursor() as cur:
        cur.execute("delete from public.insights where week_start = %s", (week_start,))
        for c in cards:
            cur.execute("""
                insert into public.insights
                  (company_id, week_start, kind, payload, sentence, scan_filter)
                values (%s, %s, %s, %s, %s, %s)
            """, (c["company_id"], week_start, c["kind"], json.dumps(c["payload"], default=str),
                  c["sentence"], json.dumps(c["scan_filter"], default=str)))


def save_forecasts(conn: psycopg.Connection, as_of, fy: str, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        for r in rows:
            cur.execute("""
                insert into public.forecasts (company_id, category, financial_year, as_of,
                                              projected_kg, low_kg, high_kg)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (company_id, category, financial_year, as_of) do update
                set projected_kg = excluded.projected_kg, low_kg = excluded.low_kg,
                    high_kg = excluded.high_kg
            """, (r["company_id"], r["category"], fy, as_of, r["projected_kg"],
                  r["low_kg"], r["high_kg"]))
