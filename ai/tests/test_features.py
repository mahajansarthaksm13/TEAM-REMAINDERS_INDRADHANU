import pandas as pd

from ai.veribin_ai.features import FeaturePipeline


def test_feature_extraction():
    pipeline = FeaturePipeline()
    data = [
        {"bin_id": "BIN-001", "label": "normal"},
        {"bin_id": "BIN-001", "label": "very_low_weight"},
        {"bin_id": "BIN-002", "label": "normal"},
    ]
    df = pd.DataFrame(data)
    feats = pipeline.extract_features_from_dataframe(df)

    assert "BIN-001" in feats
    assert feats["BIN-001"]["total_scans"] == 2
    assert feats["BIN-001"]["very_low_weight_count"] == 1
