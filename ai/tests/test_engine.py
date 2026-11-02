import pytest
from ai.veribin_ai.engine import TrustScoreEngine

def test_insufficient_data():
    engine = TrustScoreEngine()
    res = engine.calculate_bin_score(total_scans=5, anomaly_counts={"very_low_weight": 1})
    assert res["status"] == "insufficient_data"
    assert res["score"] == 100

def test_clean_bin_scoring():
    engine = TrustScoreEngine()
    res = engine.calculate_bin_score(total_scans=50, anomaly_counts={})
    assert res["score"] == 100
    assert res["status"] == "normal"

def test_anomaly_penalties():
    engine = TrustScoreEngine()
    res = engine.calculate_bin_score(total_scans=50, anomaly_counts={"very_low_weight": 2, "odd_hours": 1})
    assert res["score"] < 100
    assert res["status"] in ["normal", "warning", "critical"]
