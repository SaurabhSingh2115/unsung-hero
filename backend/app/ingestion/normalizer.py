"""Converts raw records into normalized Activity instances."""
from datetime import datetime
from app.models.activity import Activity


def normalize_event(
    id: str,
    actor_id: str,
    target_ids: list[str],
    source: str,
    source_ref: str,
    timestamp: datetime,
    text: str,
    link: str,
    project_id: str | None = None,
    raw: dict | None = None,
    gold_category: str | None = None,
) -> Activity:
    return Activity(
        id=id,
        actor_id=actor_id,
        target_ids=target_ids,
        source=source,
        source_ref=source_ref,
        timestamp=timestamp,
        text=text,
        link=link,
        project_id=project_id,
        raw=raw or {},
        gold_category=gold_category,
    )
