import pandas as pd
from datetime import datetime

class FeaturePipeline:
    """Transforms raw scan logs into bin feature vectors for trust scoring."""
    
    def extract_features_from_dataframe(self, df):
        if df.empty:
            return {}
            
        features = {}
        grouped = df.groupby("bin_id")
        
        for bin_id, group in grouped:
            total_scans = len(group)
            anomaly_counts = group["label"].value_counts().to_dict()
            normal_scans = anomaly_counts.get("normal", 0)
            
            features[bin_id] = {
                "total_scans": total_scans,
                "normal_ratio": round(normal_scans / total_scans, 4) if total_scans > 0 else 0.0,
                "burst_rescan_count": anomaly_counts.get("burst_rescan", 0),
                "very_low_weight_count": anomaly_counts.get("very_low_weight", 0),
                "odd_hours_count": anomaly_counts.get("odd_hours", 0),
                "anomaly_counts": {k: v for k, v in anomaly_counts.items() if k != "normal"}
            }
            
        return features
