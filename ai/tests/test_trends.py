from datetime import date

import pandas as pd
from veribin_ai import trends


def test_fy_bounds():
    assert trends.fy_bounds(date(2026, 11, 3))[0] == "2026-27"
    assert trends.fy_bounds(date(2027, 2, 1))[0] == "2026-27"


def test_forecast_flags_shortfall():
    days = pd.date_range("2026-09-08", "2026-11-02").date
    daily = pd.DataFrame({"day": days, "company_id": "c1", "category": "cat1_rigid",
                          "city": "PUN", "scan_count": 1, "weight_g": 100})
    targets = pd.DataFrame([{"company_id": "c1", "category": "cat1_rigid", "target_kg": 1000}])
    [f] = trends.forecasts(daily, targets, date(2026, 11, 3))
    assert f["at_risk"] and f["low_kg"] <= f["projected_kg"] <= f["high_kg"]
