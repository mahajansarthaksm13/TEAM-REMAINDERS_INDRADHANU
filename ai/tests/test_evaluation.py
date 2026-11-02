import pytest
from ai.veribin_ai.evaluation import DetectorEvaluator

def test_evaluation_metrics():
    evaluator = DetectorEvaluator()
    predictions = {
        "BIN-001": {"very_low_weight", "odd_hours"},
        "BIN-002": {"burst_rescan"}
    }
    ground_truth = {
        "BIN-001": {"very_low_weight"},
        "BIN-002": {"burst_rescan"}
    }
    res = evaluator.evaluate_performance(predictions, ground_truth)
    assert res["caught"] == 2
    assert res["false_alarms"] == 1
    assert res["missed"] == 0
    assert res["precision"] == 0.6667
