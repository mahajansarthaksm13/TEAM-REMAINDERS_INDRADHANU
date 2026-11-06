"""Trust scores and scan flags, computed ONLY from the scans themselves.

Ported from ai/notebooks/Y4_scoring_prototype.ipynb. Labels are never read
here: labels are the answer key and are used only by evaluation.py.

Input DataFrame columns (from db.load_scans or the mock CSVs):
    id, bin_id, scanned_at (tz-aware), code_type, code, weight_g, unit_weight_g
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

CONFIG = json.loads((Path(__file__).with_name("thresholds.json")).read_text())
RULES = CONFIG["scan_level_rules"]


def _prepare(scans: pd.DataFrame) -> pd.DataFrame:
    df = scans.copy()
    df["scanned_at"] = pd.to_datetime(df["scanned_at"], utc=True)
    df = df.sort_values(["bin_id", "scanned_at"]).reset_index(drop=True)
    df["gap_s"] = df.groupby("bin_id")["scanned_at"].diff().dt.total_seconds()
    hour_ist = df["scanned_at"].dt.tz_convert("Asia/Kolkata").dt.hour
    odd = RULES["odd_hours_ist"]
    measured = df["weight_g"] > 0                       # 0 = bin has no load cell
    ratio = (df["weight_g"] - df["unit_weight_g"]).abs() / df["unit_weight_g"]
    df["is_rescan"] = df["gap_s"] < RULES["repeat_scan_gap_seconds"]
    df["is_mismatch"] = measured & (ratio > RULES["weight_mismatch_ratio"])
    low_limit = RULES["very_low_weight_ratio"] * df["unit_weight_g"]
    df["is_very_low"] = measured & (df["weight_g"] < low_limit)
    df["is_wrong_category_weight"] = measured & (
        df["weight_g"] > RULES["wrong_category_weight_multiplier"] * df["unit_weight_g"])
    df["is_odd_hours"] = (hour_ist >= odd["start_hour"]) & (hour_ist < odd["end_hour"])
    df["is_scripted"] = _scripted_mask(df)
    return df


def _scripted_mask(df: pd.DataFrame) -> pd.Series:
    """Runs of >= N consecutive scans with the same code, same weight and the
    same spacing (rounded seconds) on one bin."""
    n = RULES["scripted_repeat_min_run"]
    mask = pd.Series(False, index=df.index)
    for _, g in df.groupby("bin_id"):
        idx = g.index.to_list()
        for start in range(0, len(idx) - n + 1):
            window = df.loc[idx[start:start + n]]
            gaps = window["scanned_at"].diff().dt.total_seconds().dropna().round()
            if (window["code"].nunique() == 1 and window["weight_g"].nunique() == 1
                    and gaps.nunique() == 1 and gaps.iloc[0] > 0):
                mask.loc[idx[start:start + n]] = True
    return mask


def bin_measures(scans: pd.DataFrame, rejected: pd.DataFrame) -> pd.DataFrame:
    df = _prepare(scans)
    rej = rejected.groupby("bin_id").size() if len(rejected) else pd.Series(dtype=int)
    rows = []
    for bin_id, g in df.groupby("bin_id"):
        n = len(g)
        n_rej = int(rej.get(bin_id, 0))
        rows.append({
            "bin_id": bin_id,
            "accepted_scans": n,
            "rescan_share": g["is_rescan"].sum() / n,
            "weight_mismatch_share": g["is_mismatch"].sum() / n,
            "very_low_weight_share": g["is_very_low"].sum() / n,
            "odd_hours_share": g["is_odd_hours"].sum() / n,
            "scripted_repeat_share": g["is_scripted"].sum() / n,
            "barcode_share": (g["code_type"] == "barcode").sum() / n,
            "rejection_rate": n_rej / (n + n_rej),
        })
    return pd.DataFrame(rows)


def trust_scores(measures: pd.DataFrame) -> list[dict]:
    """score = 100 - sum(min(cap, slope * max(0, share - free_share) * 100)).
    Fewer than min_scans_required scans -> score None, reason NOT_ENOUGH_DATA."""
    out = []
    for _, row in measures.iterrows():
        n = int(row["accepted_scans"])
        if n < CONFIG["min_scans_required"]:
            out.append({"bin_id": row["bin_id"], "score": None, "scans_considered": n,
                        "reasons": [{"code": "NOT_ENOUGH_DATA", "points": 0,
                                     "detail": f"{n} scans, need {CONFIG['min_scans_required']}"}]})
            continue
        score, reasons = 100.0, []
        for code, c in CONFIG["bin_scoring_measures"].items():
            share = float(row[c["measure"]])
            points = min(c["cap"], c["slope"] * max(0.0, share - c["free_share"]) * 100.0)
            if points > 0:
                score -= points
                reasons.append({"code": code, "points": round(points, 1),
                                "detail": f"{c['description']}: {share:.1%}"})
        out.append({"bin_id": row["bin_id"], "score": max(0.0, min(100.0, score)),
                    "scans_considered": n,
                    "reasons": sorted(reasons, key=lambda r: -r["points"])})
    return out


SEVERITY = {"VERY_LOW_WEIGHT": "high", "WRONG_CATEGORY_WEIGHT": "high", "SCRIPTED_REPEAT": "high",
            "REPEAT_SCAN": "medium", "WEIGHT_MISMATCH": "medium", "ODD_HOURS": "low"}


def scan_flags(scans: pd.DataFrame) -> list[dict]:
    """One flag row per (scan, reason). Flags never change the ledger."""
    df = _prepare(scans)
    checks = {"REPEAT_SCAN": "is_rescan", "WEIGHT_MISMATCH": "is_mismatch",
              "VERY_LOW_WEIGHT": "is_very_low", "WRONG_CATEGORY_WEIGHT": "is_wrong_category_weight",
              "ODD_HOURS": "is_odd_hours", "SCRIPTED_REPEAT": "is_scripted"}
    flags = []
    for reason, col in checks.items():
        for scan_id in df.loc[df[col], "id"]:
            flags.append({"scan_id": str(scan_id), "reason": reason, "severity": SEVERITY[reason]})
    return flags
