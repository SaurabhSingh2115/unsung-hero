"""Code-review source: reads reviews from the scenario's code_reviews.json.

Swap this for a GitHub/Gerrit/Critique client later; keep the same `pull` contract.
"""
from sqlalchemy.orm import Session

from app.core.constants import SourceType
from app.ingestion.normalizer import normalize_event
from app.ingestion.scenario import Scenario, get_active_scenario
from app.models.activity import Activity


class CodeReviewsSource:
    name = SourceType.CODE_REVIEW

    def __init__(self, scenario: Scenario | None = None) -> None:
        self.scenario = scenario or get_active_scenario()

    def pull(self, db: Session) -> list[Activity]:
        acts: list[Activity] = []
        for n, r in enumerate(self.scenario.code_reviews, start=1):
            act_id = f"A-CR-{n:04d}"
            act = normalize_event(
                id=act_id,
                actor_id=r.reviewer,
                target_ids=[r.author],
                source=SourceType.CODE_REVIEW,
                source_ref=r.id or f"pr-{n}",
                timestamp=r.reviewed_at,
                text=r.review,
                link=f"/source/{act_id}",
                project_id=r.project,
                raw={"author": r.author, "request": r.request},
                gold_category=r.label,
            )
            db.merge(act)
            acts.append(act)
        db.commit()
        return acts
