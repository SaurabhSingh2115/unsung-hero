"""Thanks service: unthanked helpers list, thank drafts, record recognition."""
from datetime import datetime
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.generation.thank_draft import generate_thank_draft
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.models.recognition import Recognition
from app.schemas.person import PersonOut
from app.schemas.thanks import (
    ActivityWithCategoryOut,
    DigestOut,
    RecognitionIn,
    ThankDraftIn,
    ThankDraftOut,
    UnthankedHelperOut,
)


def get_unthanked_helpers(db: Session, person_id: str) -> list[UnthankedHelperOut]:
    # Find all activities where target_ids contains person_id, but person_id has not sent a recognition referencing it
    activities = list(db.scalars(select(Activity)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    recs = list(db.scalars(select(Recognition).where(Recognition.from_id == person_id)).all())

    thanked_act_ids = set()
    for r in recs:
        for ref in (r.activity_refs or []):
            thanked_act_ids.add(ref)

    helpers_map: dict[str, list[ActivityWithCategoryOut]] = {}

    for act in activities:
        if person_id in (act.target_ids or []) and act.actor_id != person_id:
            clf = classifications.get(act.id)
            cat = clf.category if clf else "core"
            if cat in ["unblocking", "mentoring", "review", "onboarding"]:
                if act.id not in thanked_act_ids:
                    if act.actor_id not in helpers_map:
                        helpers_map[act.actor_id] = []
                    helpers_map[act.actor_id].append(
                        ActivityWithCategoryOut(
                            id=act.id,
                            actor_id=act.actor_id,
                            target_ids=act.target_ids or [],
                            source=act.source,
                            timestamp=act.timestamp.isoformat() + "Z",
                            text=act.text,
                            link=act.link,
                            project_id=act.project_id,
                            project_name=None,
                            category=cat,
                        )
                    )

    results: list[UnthankedHelperOut] = []
    for helper_id, acts in helpers_map.items():
        helper_p = db.get(Person, helper_id)
        if not helper_p:
            continue
        p_out = PersonOut(
            id=helper_p.id,
            name=helper_p.name,
            first_name=helper_p.first_name,
            initials=helper_p.initials,
            email=helper_p.email,
            role=helper_p.role,
            title=helper_p.title,
            level=helper_p.level,
            discipline=helper_p.discipline,
            location=helper_p.location,
            city=helper_p.city,
            team=helper_p.team,
            manager_id=helper_p.manager_id,
            opted_in=helper_p.opted_in,
            avatar_color=helper_p.avatar_color,
        )
        suggested = "peer_bonus" if len(acts) >= 3 else "kudos"
        results.append(
            UnthankedHelperOut(
                helper=p_out,
                count=len(acts),
                activities=acts,
                suggested_type=suggested,
            )
        )

    results.sort(key=lambda x: x.count, reverse=True)
    return results


def make_thank_draft(db: Session, person_id: str, data: ThankDraftIn) -> ThankDraftOut:
    helper = db.get(Person, data.helper_id)
    acts = [db.get(Activity, aid) for aid in data.activity_ids]
    acts = [a for a in acts if a is not None]
    return generate_thank_draft(helper, acts, data.type)


def record_recognition(db: Session, from_id: str, data: RecognitionIn) -> Recognition:
    rec_id = f"R-{uuid.uuid4().hex[:8].upper()}"
    rec = Recognition(
        id=rec_id,
        from_id=from_id,
        to_id=data.to_id,
        activity_refs=data.activity_ids,
        type=data.type,
        message=data.message,
        sent_at=datetime.utcnow(),
        source="unsung",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
