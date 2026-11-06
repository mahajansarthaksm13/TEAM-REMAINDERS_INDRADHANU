"""Y12 · Weekly insight cards and the financial-year shortfall forecast.

All arithmetic happens here, in Python. Gemini (narration.py) only turns the
already-formatted numbers into one sentence.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

MIN_KG_FOR_CARD = 0.5     # ignore % swings on tiny volumes


def fy_bounds(today: date) -> tuple[str, date, date]:
    y = today.year if today.month >= 4 else today.year - 1
    return f"{y}-{(y + 1) % 100:02d}", date(y, 4, 1), date(y + 1, 3, 31)


def insight_cards(daily: pd.DataFrame, today: date, max_cards: int = 5) -> list[dict]:
    """daily: day, company_id, category, city, scan_count, weight_g.
    Compares the last 7 days with the 7 before, per company x category and
    company x city. Returns the biggest changes with pre-formatted numbers."""
    df = daily.copy()
    df["day"] = pd.to_datetime(df["day"]).dt.date
    this_start, prev_start = today - timedelta(days=7), today - timedelta(days=14)
    df["week"] = df["day"].map(lambda d: "this" if d >= this_start
                               else ("prev" if d >= prev_start else None))
    df = df[df["week"].notna()]
    cards = []
    for dim in ("category", "city"):
        grams = df.groupby(["company_id", dim, "week"])["weight_g"].sum()
        pivot = (grams / 1000).unstack(fill_value=0)
        for (company_id, value), row in pivot.iterrows():
            now_kg, before_kg = float(row.get("this", 0)), float(row.get("prev", 0))
            if max(now_kg, before_kg) < MIN_KG_FOR_CARD or before_kg == 0:
                continue
            change = (now_kg - before_kg) / before_kg * 100
            cards.append({
                "company_id": company_id,
                "kind": f"weekly_change_{dim}",
                "payload": {"dimension": dim, "value": value,
                            "this_week_kg": f"{now_kg:.1f}", "last_week_kg": f"{before_kg:.1f}",
                            "change_pct": f"{change:+.0f}"},
                "scan_filter": {"company_id": company_id, dim: value,
                                "from": this_start.isoformat(), "to": today.isoformat()},
                "_rank": abs(change),
            })
    best: dict[str, list[dict]] = {}
    for c in sorted(cards, key=lambda c: -c["_rank"]):
        bucket = best.setdefault(c["company_id"], [])
        if len(bucket) < max_cards:
            bucket.append({k: v for k, v in c.items() if k != "_rank"})
    return [c for bucket in best.values() for c in bucket]


def forecasts(daily: pd.DataFrame, targets: pd.DataFrame, today: date) -> list[dict]:
    """projected = collected so far this FY + (8-week daily average x days left).
    low/high use the slowest and fastest of those 8 weeks."""
    fy, fy_start, fy_end = fy_bounds(today)
    df = daily.copy()
    df["day"] = pd.to_datetime(df["day"]).dt.date
    days_left = (fy_end - today).days
    window_start = today - timedelta(days=56)
    out = []
    for t in targets.itertuples(index=False):
        mine = df[(df["company_id"] == t.company_id) & (df["category"] == t.category)]
        so_far = mine[mine["day"] >= fy_start]["weight_g"].sum() / 1000
        recent = mine[mine["day"] >= window_start]
        weekly = []
        for w in range(8):
            lo = window_start + timedelta(days=7 * w)
            hi = lo + timedelta(days=7)
            week = recent[(recent["day"] >= lo) & (recent["day"] < hi)]
            weekly.append(week["weight_g"].sum() / 1000 / 7)
        avg = sum(weekly) / 8
        projected = so_far + avg * days_left
        out.append({
            "company_id": t.company_id, "category": t.category, "financial_year": fy,
            "projected_kg": round(projected, 3),
            "low_kg": round(so_far + min(weekly) * days_left, 3),
            "high_kg": round(so_far + max(weekly) * days_left, 3),
            "target_kg": float(t.target_kg),
            "at_risk": projected < float(t.target_kg),
        })
    return out
