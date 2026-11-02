import os
import google.generativeai as genai

class GeminiNarrator:
    """Generates concise 1-sentence AI executive summaries with strict fallback validation."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)

    def narrate_card(self, title: str, message: str) -> str:
        fallback = f"{title}: {message}"
        if not self.api_key:
            return fallback

        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = (
                f"Summarize this waste collection insight into exactly ONE sentence of at most 35 words. "
                f"Do not invent any numbers. Insight: Title: {title}. Details: {message}"
            )
            response = model.generate_content(prompt)
            summary = response.text.strip()
            
            # Simple fallback check on length
            if summary and len(summary.split()) <= 35:
                return summary
            return fallback
        except Exception:
            return fallback
