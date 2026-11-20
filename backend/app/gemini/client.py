"""Gemini client using google-genai SDK with structured output and disk caching."""
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.core.config import get_settings
from app.gemini.cache import get_cache

logger = logging.getLogger(__name__)

GEMINI_TIMEOUT_S = 12  # after this we fall back to the deterministic heuristic path
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="gemini")


def generate_structured(
    prompt: str,
    schema: dict[str, Any] | None = None,
    system_instruction: str = "",
) -> tuple[dict[str, Any] | None, str]:
    """Generates structured JSON using Gemini API or returns cached response.

    Returns:
        (parsed_dict, "gemini") on success, or (None, "heuristic") if not configured / error.
    """
    settings = get_settings()
    if not settings.gemini_enabled:
        return None, "heuristic"

    cache = get_cache()
    cached = cache.get(prompt, schema.get("title", "") if schema else "")
    if cached is not None:
        return cached, "gemini"

    try:
        from google import genai

        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options={"timeout": GEMINI_TIMEOUT_S * 1000, "retry_options": {"attempts": 1}},
        )

        kwargs: dict[str, Any] = {
            "model": settings.gemini_model,
            "input": prompt,
        }
        if schema:
            kwargs["response_format"] = {
                "type": "text",
                "mime_type": "application/json",
                "schema": schema,
            }
        if system_instruction:
            kwargs["system_instruction"] = system_instruction

        # Hard deadline: never let a slow/hung API call freeze a request (falls back to heuristics)
        future = _EXECUTOR.submit(client.interactions.create, **kwargs)
        interaction = future.result(timeout=GEMINI_TIMEOUT_S)
        text = interaction.output_text or ""
        # Strip markdown fences if present
        text = text.strip()
        if text.startswith("```json"):
            text = text[len("```json"):].strip()
        if text.startswith("```"):
            text = text[len("```"):].strip()
        if text.endswith("```"):
            text = text[:-len("```")].strip()

        parsed = json.loads(text)
        cache.set(prompt, schema.get("title", "") if schema else "", parsed)
        return parsed, "gemini"
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}. Falling back to heuristic.")
        return None, "heuristic"
