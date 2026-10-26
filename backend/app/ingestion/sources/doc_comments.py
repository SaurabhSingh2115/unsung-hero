"""Doc-comment source: reads design-doc / guide comments from the scenario's doc_comments.json.

Swap this for a Google Docs/Drive comments client later; keep the same `pull` contract.
"""
from datetime import datetime, time

from sqlalchemy.orm import Session

from app.core.constants import SourceType
from app.ingestion.normalizer import normalize_event
from app.ingestion.scenario import Scenario, get_active_scenario
from app.models.activity import Activity

COMMENT_HOUR = time(14, 0)  # doc comments only carry a date; place them mid-afternoon


class DocCommentsSource:
    name = SourceType.DOC_COMMENT

    def __init__(self, scenario: Scenario | None = None) -> None:
        self.scenario = scenario or get_active_scenario()

    def pull(self, db: Session) -> list[Activity]:
        acts: list[Activity] = []
        n = 0
        for doc in self.scenario.docs:
            for c in doc.comments:
                n += 1
                act_id = f"A-DOC-{n:04d}"
                act = normalize_event(
                    id=act_id,
                    actor_id=c.author,
                    target_ids=[doc.owner] if doc.owner != c.author else [],
                    source=SourceType.DOC_COMMENT,
                    source_ref=doc.id,
                    timestamp=datetime.combine(c.date, COMMENT_HOUR),
                    text=f"[{doc.title}] {c.text}",
                    link=f"/source/{act_id}",
                    project_id=doc.project,
                    raw={"doc_id": doc.id, "doc_title": doc.title},
                    gold_category=c.label,
                )
                db.merge(act)
                acts.append(act)
        db.commit()
        return acts
