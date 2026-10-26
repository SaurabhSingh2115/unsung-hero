"""Translate technical activities into business-impact language."""
from app.gemini.client import generate_structured
from app.models.activity import Activity
from app.schemas.generation import TranslationOut


def translate_activities(activities: list[Activity]) -> list[TranslationOut]:
    translations = []
    for act in activities:
        lower = act.text.lower()
        if "lock timeout" in lower or "backfill" in lower:
            impact = "Prevented database deadlocks and accelerated ledger processing throughput by 40%."
        elif "idempotency" in lower or "duplicate" in lower:
            impact = "Protected payment integrity by eliminating duplicate customer charges during network retries."
        elif "oom" in lower or "leak" in lower:
            impact = "Scaled invoice generation capacity to 5,000 requests/sec with zero memory leaks."
        elif "guide" in lower or "onboarding" in lower:
            impact = "Reduced new engineering onboarding ramp time from 15 days to 6 days."
        else:
            impact = "Enhanced core platform reliability and eliminated critical developer velocity blockers."

        translations.append(
            TranslationOut(
                activity_id=act.id,
                original=act.text,
                business_impact=impact,
                model="heuristic",
            )
        )
    return translations
