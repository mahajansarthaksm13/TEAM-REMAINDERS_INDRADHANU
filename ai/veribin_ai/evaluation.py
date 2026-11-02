import pandas as pd

class DetectorEvaluator:
    """Evaluates AI anomaly detection performance against ground-truth labels."""

    def evaluate_performance(self, predictions: dict, ground_truth: dict):
        caught = 0
        missed = 0
        false_alarms = 0

        all_bins = set(predictions.keys()).union(set(ground_truth.keys()))

        for bin_id in all_bins:
            pred_anomalies = predictions.get(bin_id, set())
            true_anomalies = ground_truth.get(bin_id, set())

            for anomaly in pred_anomalies:
                if anomaly in true_anomalies:
                    caught += 1
                else:
                    false_alarms += 1

            for anomaly in true_anomalies:
                if anomaly not in pred_anomalies:
                    missed += 1

        total_actual = caught + missed
        precision = round(caught / (caught + false_alarms), 4) if (caught + false_alarms) > 0 else 1.0
        recall = round(caught / total_actual, 4) if total_actual > 0 else 1.0

        return {
            "caught": caught,
            "missed": missed,
            "false_alarms": false_alarms,
            "precision": precision,
            "recall": recall
        }
