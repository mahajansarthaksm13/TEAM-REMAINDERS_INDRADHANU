from unittest.mock import patch

from ai.veribin_ai.narration import GeminiNarrator


def test_fallback_without_api_key():
    narrator = GeminiNarrator(api_key="")
    res = narrator.narrate_card("High Anomaly", "Company A experienced 20% anomaly rate.")
    assert res == "High Anomaly: Company A experienced 20% anomaly rate."


def test_fallback_structure():
    narrator = GeminiNarrator(api_key="MOCK_KEY_FOR_TESTING")
    with patch(
        "google.generativeai.GenerativeModel.generate_content",
        side_effect=Exception("API Error"),
    ):
        res = narrator.narrate_card("Normal Operations", "5000 kg collected cleanly.")
    assert isinstance(res, str)
    assert res == "Normal Operations: 5000 kg collected cleanly."
