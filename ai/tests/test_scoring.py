from datetime import UTC, datetime, timedelta

import pandas as pd
from veribin_ai import scoring


def scans(rows):
    base = datetime(2026, 10, 1, 6, 0, tzinfo=UTC)   # 11:30 IST, normal hours
    return pd.DataFrame([{
        "id": f"s{i}", "bin_id": b, "scanned_at": base + timedelta(minutes=m),
        # half QR, half barcode: an all-barcode bin is (rightly) penalised
        "code_type": "qr" if i % 2 else "barcode", "code": c, "weight_g": w, "unit_weight_g": u,
    } for i, (b, m, c, w, u) in enumerate(rows)])


def test_clean_bin_scores_100():
    df = scans([("VB-PUN-0001", i * 5, f"89012345{i:05d}", 24, 24) for i in range(30)])
    [s] = scoring.trust_scores(scoring.bin_measures(df, pd.DataFrame(columns=["bin_id"])))
    assert s["score"] == 100 and s["reasons"] == []


def test_few_scans_means_not_enough_data():
    df = scans([("VB-PUN-0001", i * 5, "8901234500011", 24, 24) for i in range(5)])
    [s] = scoring.trust_scores(scoring.bin_measures(df, pd.DataFrame(columns=["bin_id"])))
    assert s["score"] is None and s["reasons"][0]["code"] == "NOT_ENOUGH_DATA"


def test_very_low_weights_lower_the_score_with_a_reason():
    df = scans([("VB-PUN-0001", i * 5, f"89012345{i:05d}", 2 if i % 3 == 0 else 24, 24)
                for i in range(30)])
    [s] = scoring.trust_scores(scoring.bin_measures(df, pd.DataFrame(columns=["bin_id"])))
    assert s["score"] < 60
    assert "VERY_LOW_WEIGHT" in {r["code"] for r in s["reasons"]}


def test_flags_never_use_labels_and_find_low_weight():
    df = scans([("VB-PUN-0001", 0, "8901234500011", 2, 24)])
    expected = {"scan_id": "s0", "reason": "VERY_LOW_WEIGHT", "severity": "high"}
    assert expected in scoring.scan_flags(df)
