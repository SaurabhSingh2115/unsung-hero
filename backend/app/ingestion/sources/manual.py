"""Manual entry source — allows employees to log offline/untracked help."""
from datetime import datetime
import uuid
from sqlalchemy.orm import Session

from app.ingestion.normalizer import normalize_event
from app.models.activity import Activity
from app.schemas.activity import ManualActivityIn


def create_manual_activity(
    db: Session, actor_id: str, data: ManualActivityIn
) -> Activity:
    act_id = f"A-MANUAL-{uuid.uuid4().hex[:8].upper()}"
    ts = datetime.fromisoformat(data.timestamp.replace("Z", "+00:00")).replace(tzinfo=None)

    act = normalize_event(
        id=act_id,
        actor_id=actor_id,
        target_ids=data.target_ids,
        source="manual",
        source_ref=act_id,
        timestamp=ts,
        text=data.text,
        link=f"/source/{act_id}",
        project_id=data.project_id,
        raw={"request_confirmation": data.request_confirmation},
        gold_category="mentoring",
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act
