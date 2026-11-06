import pandas as pd
from veribin_ai.evaluation import evaluate


def test_caught_missed_and_false_alarms():
    labels = pd.DataFrame([
        {"bin_id": "B", "sequence": 1, "fraud_type": "very_low_weight"},
        {"bin_id": "B", "sequence": 2, "fraud_type": "very_low_weight"},
        {"bin_id": "B", "sequence": 3, "fraud_type": "normal"},
    ])
    flagged = pd.DataFrame([{"bin_id": "B", "sequence": 1, "reason": "VERY_LOW_WEIGHT"},
                            {"bin_id": "B", "sequence": 3, "reason": "ODD_HOURS"}])
    r = evaluate(labels, flagged)
    assert r["very_low_weight"] == {"planted": 2, "caught": 1, "missed": 1}
    assert r["false_alarms"] == {"clean_scans": 1, "flagged": 1}
