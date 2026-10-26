"""Ingestion pipeline: run enabled sources, then classify the new activities."""
from sqlalchemy.orm import Session

from app.core.constants import Defaults
from app.enrichment.classifier import classify_activity, classify_heuristic
from app.ingestion.sources import build_sources
from app.ingestion.sources.chat import ChatSource
from app.models.activity import Activity
from app.models.classification import Classification


def classify_offline(act: Activity) -> Classification:
    """Fast, no-LLM classification. Uses the scenario's ground-truth label when present."""
    heur = classify_heuristic(act.text, act.source)
    if act.gold_category:
        heur["category"] = act.gold_category
    return Classification(
        activity_id=act.id,
        category=heur["category"],
        confidence=heur["confidence"],
        rationale=heur["rationale"],
        model=Defaults.HEURISTIC_MODEL,
        asks_for_help=heur["asks_for_help"],
        is_thanks=heur["is_thanks"],
        is_proposal=heur["is_proposal"],
    )


def classify_activities(db: Session, acts: list[Activity], use_llm: bool = True) -> None:
    for act in acts:
        db.merge(classify_activity(act) if use_llm else classify_offline(act))
    db.commit()


def run_sources(db: Session, names: list[str] | None = None, use_llm: bool = True) -> dict[str, int]:
    """Pull every enabled source and classify what's new. Returns new-activity counts per source."""
    counts: dict[str, int] = {}
    for source in build_sources(names):
        new = source.pull(db)
        classify_activities(db, new, use_llm=use_llm)
        counts[source.name] = len(new)
    return counts


def sync_chat(db: Session, use_llm: bool = True) -> list[Activity]:
    """Pull just the chat source (used by the chat clone and the 'Sync now' button)."""
    new = ChatSource().pull(db)
    classify_activities(db, new, use_llm=use_llm)
    return new
