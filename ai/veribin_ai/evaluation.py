"""Y15 · How well do the flags catch the simulator's planted fraud?

    AI_DATABASE_URL=... python -m veribin_ai.evaluation simulator/state/labels.csv

Joins labels (bin_id, sequence, fraud_type) to scan_flags through scans
(bin_id, sequence) and reports caught / missed / false alarms per fraud type.
'replay' is judged by ingest rejection (duplicate_sequence), not by flags.
Saves the result as an insight of kind 'detector_accuracy' for A13.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime

import pandas as pd

EXPECTED_FLAG = {
    "burst_rescan": "REPEAT_SCAN",
    "very_low_weight": "VERY_LOW_WEIGHT",
    "wrong_category_weight": "WRONG_CATEGORY_WEIGHT",
    "night_burst": "ODD_HOURS",
}


def evaluate(labels: pd.DataFrame, flagged: pd.DataFrame) -> dict:
    """labels: bin_id, sequence, fraud_type ('normal' etc. for clean scans)
    flagged: bin_id, sequence, reason   (one row per flag)"""
    labels = labels.copy()
    labels["sequence"] = labels["sequence"].astype(int)
    flags = flagged.groupby(["bin_id", "sequence"])["reason"].apply(set).to_dict()
    result = {}
    for fraud, reason in EXPECTED_FLAG.items():
        rows = labels[labels["fraud_type"] == fraud]
        caught = sum(reason in flags.get((r.bin_id, r.sequence), set())
                     for r in rows.itertuples(index=False))
        result[fraud] = {"planted": len(rows), "caught": caught, "missed": len(rows) - caught}
    clean = labels[~labels["fraud_type"].isin(list(EXPECTED_FLAG) + ["replay"])]
    false_alarms = sum(bool(flags.get((r.bin_id, r.sequence)))
                       for r in clean.itertuples(index=False))
    result["false_alarms"] = {"clean_scans": len(clean), "flagged": false_alarms}
    return result


def main(labels_path: str) -> None:
    from veribin_ai import db
    labels = pd.read_csv(labels_path)
    conn = db.connect()
    flagged = db._frame(conn, """select s.bin_id, s.sequence, f.reason
                                 from public.scan_flags f
                                 join public.scans s on s.id = f.scan_id""")
    report = evaluate(labels, flagged)
    print(json.dumps(report, indent=2))
    companies = db._frame(conn, "select id from public.companies where not is_demo")
    with conn.cursor() as cur:
        for cid in companies["id"]:
            cur.execute("""insert into public.insights
                             (company_id, week_start, kind, payload, sentence)
                           values (%s, %s, 'detector_accuracy', %s, %s)""",
                        (cid, datetime.now(UTC).date(), json.dumps(report),
                         "Detector accuracy measured against simulator ground truth."))
    conn.commit()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "simulator/state/labels.csv")
