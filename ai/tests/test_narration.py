from veribin_ai import narration

CARD = {"payload": {"dimension": "category", "value": "cat1_rigid",
                    "this_week_kg": "12.5", "last_week_kg": "10.0", "change_pct": "+25"}}


class Fake:
    def __init__(self, text):
        self.models = self
        self.text = text

    def generate_content(self, model, contents):
        return self


def test_good_reply_is_used():
    reply = "Rigid plastic collection rose 25% to 12.5 kg this week."
    assert narration.narrate(CARD, Fake(reply)) == reply


def test_invented_number_falls_back_to_template():
    reply = "Collection rose 40% this week."
    assert narration.narrate(CARD, Fake(reply)) == narration.template(CARD)


def test_two_sentences_fall_back():
    reply = "Collection rose 25%. Great work."
    assert narration.narrate(CARD, Fake(reply)) == narration.template(CARD)


def test_no_key_uses_template(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert narration.narrate(CARD) == narration.template(CARD)
