import json
import os

class TrustScoreEngine:
    def __init__(self, thresholds_path="ai/veribin_ai/thresholds.json"):
        self.thresholds = self._load_thresholds(thresholds_path)

    def _load_thresholds(self, path):
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return {
            "weights": {
                "burst_rescan": 15,
                "very_low_weight": 20,
                "odd_hours": 10,
                "rejection": 25
            },
            "min_scans_for_score": 20
        }

    def calculate_bin_score(self, total_scans, anomaly_counts):
        """Calculates trust score (0-100) and penalties for a bin."""
        if total_scans < self.thresholds.get("min_scans_for_score", 20):
            return {"score": 100, "status": "insufficient_data", "penalties": []}

        score = 100
        penalties = []
        weights = self.thresholds.get("weights", {})

        for anomaly_type, count in anomaly_counts.items():
            if count > 0 and anomaly_type in weights:
                penalty = min(count * weights[anomaly_type], 40)
                score -= penalty
                penalties.append({"type": anomaly_type, "penalty": penalty, "count": count})

        score = max(0, score)
        status = "normal" if score >= 80 else ("warning" if score >= 50 else "critical")
        return {"score": score, "status": status, "penalties": penalties}
