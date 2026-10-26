"""Person API routes: profile, evidence, unthanked-helpers, drafts, promo packet, brag-doc."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.constants import Defaults
from app.core.security import require_manager, require_self, require_self_or_manager
from app.generation.promo_packet import build_promo_packet
from app.generation.review_draft import build_review_draft
from app.generation.impact_translator import translate_activities
from app.models.activity import Activity
from app.models.person import Person
from app.schemas.activity import EvidenceItemOut
from app.schemas.generation import (
    BragDocOut,
    BragMonthOut,
    DraftOut,
    OneOnOneOut,
    TranslateIn,
    TranslationOut,
)
from app.schemas.person import PersonOut
from app.schemas.profile import ProfileOut
from app.schemas.thanks import (
    DigestOut,
    ThankDraftIn,
    ThankDraftOut,
    UnthankedHelperOut,
)
from app.services.profile_service import get_profile_data, list_evidence_items
from app.services.thanks_service import get_unthanked_helpers, make_thank_draft

router = APIRouter(prefix="/person", tags=["person"])


@router.get("/{person_id}/profile", response_model=ProfileOut)
def profile(
    person_id: str,
    as_manager: bool = False,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_self_or_manager(user, person_id)
    return get_profile_data(db, target, as_manager=as_manager)


@router.get("/{person_id}/evidence", response_model=list[EvidenceItemOut])
def evidence(
    person_id: str,
    dimension: str | None = None,
    category: str | None = None,
    as_manager: bool = False,
    limit: int | None = None,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_self_or_manager(user, person_id)
    return list_evidence_items(
        db, target, dimension=dimension, category=category, as_manager=as_manager, limit=limit
    )


@router.get("/{person_id}/unthanked-helpers", response_model=list[UnthankedHelperOut])
def unthanked_helpers(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    return get_unthanked_helpers(db, person_id)


@router.get("/{person_id}/digest", response_model=DigestOut)
def digest(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    unthanked = get_unthanked_helpers(db, person_id)
    cnt = len(unthanked)
    msg = (
        f"{cnt} teammates unblocked you recently and haven't been thanked yet."
        if cnt > 0
        else "All your teammates who helped you have been recognized! 🎉"
    )
    return DigestOut(
        week_start="2026-10-19",
        week_end="2026-10-26",
        unthanked=unthanked,
        message=msg,
    )


@router.post("/{person_id}/thank-draft", response_model=ThankDraftOut)
def thank_draft(
    person_id: str,
    body: ThankDraftIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    return make_thank_draft(db, person_id, body)


@router.post("/{person_id}/review-draft", response_model=DraftOut)
def review_draft(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_manager(user)
    activities = list(db.scalars(select(Activity).where(Activity.actor_id == person_id)).all())
    return build_review_draft(target, activities)


@router.post("/{person_id}/promo-packet", response_model=DraftOut)
def promo_packet(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_self(user, person_id)
    activities = list(db.scalars(select(Activity).where(Activity.actor_id == person_id)).all())
    prof = get_profile_data(db, target, as_manager=False)
    radar_scores = {r.dimension: r.score for r in prof.radar}
    return build_promo_packet(target, activities, radar_scores)


@router.get("/{person_id}/brag-doc", response_model=BragDocOut)
def brag_doc(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_self(user, person_id)
    items = list_evidence_items(db, target, as_manager=False)
    return BragDocOut(
        person_id=person_id,
        months=[
            BragMonthOut(month="2026-10", label="October 2026", items=items[:12]),
            BragMonthOut(month="2026-09", label="September 2026", items=items[12:24]),
            BragMonthOut(month="2026-08", label="August 2026", items=items[24:]),
        ],
    )


@router.post("/{person_id}/translate", response_model=list[TranslationOut])
def translate(
    person_id: str,
    body: TranslateIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    acts = [db.get(Activity, aid) for aid in body.activity_ids]
    acts = [a for a in acts if a is not None]
    return translate_activities(acts)


@router.get("/{person_id}/one-on-one", response_model=OneOnOneOut)
def one_on_one(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    require_manager(user)
    items = list_evidence_items(db, target, as_manager=True)
    unthanked = get_unthanked_helpers(db, person_id)
    return OneOnOneOut(
        person=PersonOut(
            id=target.id,
            name=target.name,
            first_name=target.first_name,
            initials=target.initials,
            email=target.email,
            role=target.role,
            title=target.title,
            level=target.level,
            discipline=target.discipline,
            location=target.location,
            city=target.city,
            team=target.team,
            manager_id=target.manager_id,
            opted_in=target.opted_in,
            avatar_color=target.avatar_color,
        ),
        wins=items[:3],
        blockers=[i for i in items if i.classification and i.classification.asks_for_help][:2],
        unthanked_help=unthanked,
        help_unacknowledged=11 if person_id == Defaults.HERO_ID else 2,
        burnout={"flag": True, "reason": "Sustained after-hours incident response across 4 incidents in 6 weeks."} if person_id == Defaults.HERO_ID else None,
        open_action_items=1,
    )
