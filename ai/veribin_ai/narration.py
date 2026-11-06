"""Y13 · One-sentence narration for insight cards.

Rules (task sheet):
  * Gemini receives ONLY the card's pre-formatted numbers.
  * Reply must be one sentence of at most 35 words.
  * Any number in the reply that is not in the input -> reject, use template.
  * Any error, missing key, or empty reply -> template.
  * Model is pinned by GEMINI_MODEL (set it to an exact model id that is
    currently listed in Google AI Studio; never "latest").
"""

from __future__ import annotations

import os
import re

NUMBER = re.compile(r"[-+]?\d+(?:\.\d+)?")


def template(card: dict) -> str:
    p = card["payload"]
    direction = "rose" if not p["change_pct"].startswith("-") else "fell"
    return (f"Collection for {p['value']} {direction} {p['change_pct'].lstrip('+-')}% "
            f"this week, from {p['last_week_kg']} kg to {p['this_week_kg']} kg.")


def numbers_in(text: str) -> set[str]:
    return {n.lstrip("+-") for n in NUMBER.findall(text)}


def acceptable(reply: str, card: dict) -> bool:
    sentence_ends = re.findall(r"[.!?](?:\s|$)", reply)
    if not reply or len(reply.split()) > 35 or len(sentence_ends) > 1:
        return False
    allowed = set().union(*(numbers_in(str(v)) for v in card["payload"].values()))
    return numbers_in(reply) <= allowed


def narrate(card: dict, client=None) -> str:
    api_key, model = os.getenv("GEMINI_API_KEY"), os.getenv("GEMINI_MODEL")
    if client is None:
        if not (api_key and model):
            return template(card)
        from google import genai  # package: google-genai
        client = genai.Client(api_key=api_key)
    p = card["payload"]
    prompt = ("Write ONE plain sentence (max 35 words) for a recycling-compliance dashboard. "
              "Use only these facts and do not add any other numbers:\n"
              f"- {p['dimension']}: {p['value']}\n- this week: {p['this_week_kg']} kg\n"
              f"- last week: {p['last_week_kg']} kg\n- change: {p['change_pct']}%")
    try:
        reply = client.models.generate_content(model=model, contents=prompt).text.strip()
    except Exception:  # noqa: BLE001 - any failure falls back
        return template(card)
    return reply if acceptable(reply, card) else template(card)
