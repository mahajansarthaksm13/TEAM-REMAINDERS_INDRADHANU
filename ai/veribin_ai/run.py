"""Nightly AI job (Y9 entry point, run by .github/workflows/nightly-ai.yml).

    AI_DATABASE_URL=... GEMINI_API_KEY=... GEMINI_MODEL=... python -m veribin_ai.run

Order: integrity -> scores -> flags -> trends -> forecast -> narration -> save.
If integrity fails, a chain_break alert is written and the run exits 1
without publishing anything else.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta

from veribin_ai import db, integrity, narration, scoring, trends


def main() -> int:
    today = (datetime.now(UTC) + timedelta(hours=5, minutes=30)).date()   # IST date
    fy, fy_start, _ = trends.fy_bounds(today)
    conn = db.connect()
    try:
        bins = db.load_bins(conn)
        scans = db.load_scans(conn, days=90)
        print(f"loaded {len(scans)} scans from {len(bins)} bins")
        # Every bin alert carries the bin's company, so the owner (and its
        # auditor) sees it. Alerts with no company are admin/regulator-only (D8).
        company_of = dict(zip(bins["id"], bins["company_id"], strict=True))

        # 1. Integrity
        bad = integrity.bad_signatures(scans)
        breaks = integrity.chain_breaks(lambda b: db.verify_chain(conn, b), bins["id"].tolist())
        if bad or breaks:
            for br in breaks:
                db.open_alert(conn, "chain_break", br["bin_id"], company_of.get(br["bin_id"]),
                              f"Chain check failed at scan {br['failing_scan']}: {br['reason']}")
            for b in bad[:20]:
                db.open_alert(conn, "chain_break", b["bin_id"], company_of.get(b["bin_id"]),
                              f"Signature does not verify for scan {b['scan_id']}")
            conn.commit()
            print(f"INTEGRITY FAILURE: {len(breaks)} chain breaks, {len(bad)} bad signatures")
            return 1

        real = scans[~scans["is_demo"]]

        # 2-3. Trust scores and flags
        rejected = db.load_rejected(conn, days=90)
        scores = scoring.trust_scores(scoring.bin_measures(real, rejected))
        db.save_bin_scores(conn, today, scores)
        for s in scores:
            if s["score"] is not None and s["score"] < scoring.CONFIG["anomaly_alert_threshold"]:
                top = s["reasons"][0]["code"] if s["reasons"] else "UNKNOWN"
                db.open_alert(conn, "anomaly", s["bin_id"], company_of.get(s["bin_id"]),
                              f"Trust score {s['score']:.0f}/100 (main reason: {top})")
        db.save_flags(conn, scoring.scan_flags(real))

        # 4-6. Trends, narration, forecast
        daily = db.load_daily_totals(conn, since=min(fy_start, today - timedelta(days=60)))
        cards = trends.insight_cards(daily, today)
        for c in cards:
            c["sentence"] = narration.narrate(c)
        db.replace_insights(conn, today - timedelta(days=today.weekday()), cards)

        fc = trends.forecasts(daily, db.load_targets(conn, fy), today)
        db.save_forecasts(conn, today, fy, fc)
        for f in fc:
            if f["at_risk"]:
                db.open_alert(conn, "target_at_risk", None, f["company_id"],
                              f"{f['category']}: projected {f['projected_kg']:.1f} kg "
                              f"vs target {f['target_kg']:.1f} kg")

        conn.commit()
        print(f"scored {len(scores)} bins, {len(cards)} insight cards, {len(fc)} forecasts")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
