from ai.veribin_ai.trends import TrendsForecastEngine


def test_forecast_calculation():
    engine = TrendsForecastEngine()
    # 100 kg collected over 10 days out of 365 days
    res = engine.calculate_company_forecast(current_collected_kg=100.0, days_elapsed=10)
    assert res["daily_avg_kg"] == 10.0
    assert res["days_remaining"] == 355
    assert res["projected_total_kg"] == 3650.0


def test_insight_card_generation():
    engine = TrendsForecastEngine()
    insights = engine.generate_insight_cards("Company A", total_scans=100, anomaly_ratio=0.20)
    assert len(insights) > 0
    assert insights[0]["type"] == "alert"
