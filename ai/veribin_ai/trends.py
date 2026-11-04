class TrendsForecastEngine:
    """Calculates weekly totals, insight cards, and financial year forecasts."""

    def calculate_company_forecast(
        self, current_collected_kg: float, days_elapsed: int, financial_year_days: int = 365
    ):
        if days_elapsed <= 0:
            return {"projected_total_kg": 0.0, "daily_avg_kg": 0.0, "status": "insufficient_time"}

        daily_avg = current_collected_kg / days_elapsed
        days_remaining = max(0, financial_year_days - days_elapsed)
        projected_total = current_collected_kg + (daily_avg * days_remaining)

        return {
            "current_collected_kg": round(current_collected_kg, 2),
            "daily_avg_kg": round(daily_avg, 2),
            "days_remaining": days_remaining,
            "projected_total_kg": round(projected_total, 2),
        }

    def generate_insight_cards(self, company_name: str, total_scans: int, anomaly_ratio: float):
        insights = []
        if anomaly_ratio > 0.15:
            insights.append(
                {
                    "type": "alert",
                    "title": "High Anomaly Rate",
                    "message": (
                        f"{company_name} experienced an anomaly rate of "
                        f"{round(anomaly_ratio * 100, 1)}% over the period."
                    ),
                }
            )
        else:
            insights.append(
                {
                    "type": "info",
                    "title": "Normal Operation",
                    "message": (
                        f"{company_name} maintained a stable scan flow across "
                        f"{total_scans} total scans."
                    ),
                }
            )
        return insights
