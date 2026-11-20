"""Collaboration routes: Peer Feedback Drafter and "Who can unblock me?"."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import require_manager, require_self
from app.generation.peer_feedback import build_peer_feedback, list_peer_candidates
from app.generation.review_bias_lens import check_review_bias
from app.generation.runbook_draft import build_runbook_draft
from app.metrics.help_graph import build_team_graph_data
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.models.recognition import Recognition
from app.schemas.collab import (
    HelperFinderIn,
    HelperFinderOut,
    PeerCandidateOut,
    PeerFeedbackIn,
    PeerFeedbackOut,
)
from app.schemas.differentiators import (
    ReviewBiasCheckIn,
    ReviewBiasCheckOut,
    RunbookDraftIn,
    RunbookDraftOut,
)
from app.services.helper_finder import find_helpers

router = APIRouter(prefix="/person", tags=["collaboration"])


def _team_context(db: Session, team: str):
    people = list(db.scalars(select(Person).where(Person.team == team)).all())
    activities = list(db.scalars(select(Activity)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    recognitions = list(db.scalars(select(Recognition)).all())
    nodes, _ = build_team_graph_data(people, activities, classifications, recognitions)
    help_given = {n["id"]: n["help_given"] for n in nodes}
    return people, activities, classifications, help_given


@router.get("/{person_id}/peer-feedback/candidates", response_model=list[PeerCandidateOut])
def peer_feedback_candidates(
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    people, activities, classifications, _ = _team_context(db, user.team)
    return list_peer_candidates(user, people, activities, classifications)


@router.post("/{person_id}/peer-feedback", response_model=PeerFeedbackOut)
def peer_feedback(
    person_id: str,
    body: PeerFeedbackIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    peer = db.get(Person, body.peer_id)
    if not peer or peer.id == user.id:
        raise HTTPException(status_code=404, detail="Peer not found")
    people, activities, classifications, help_given = _team_context(db, user.team)
    return build_peer_feedback(user, peer, people, activities, classifications, help_given)


@router.post("/{person_id}/find-helper", response_model=HelperFinderOut)
def find_helper(
    person_id: str,
    body: HelperFinderIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_self(user, person_id)
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Describe what you're stuck on")
    people, activities, classifications, help_given = _team_context(db, user.team)
    return find_helpers(user, body.question, people, activities, classifications, help_given)


@router.post("/{person_id}/review-bias-check", response_model=ReviewBiasCheckOut)
def review_bias_check(
    person_id: str,
    body: ReviewBiasCheckIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_manager(user)
    target = db.get(Person, person_id)
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Provide review text to analyze")
    activities = list(db.scalars(select(Activity).where(Activity.actor_id == person_id)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    return check_review_bias(target, body.text, activities, classifications)


@router.post("/{person_id}/draft-runbook", response_model=RunbookDraftOut)
def draft_runbook(
    person_id: str,
    body: RunbookDraftIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    author = db.get(Person, person_id)
    if not author:
        raise HTTPException(status_code=404, detail="Person not found")
    if not body.topic.strip():
        raise HTTPException(status_code=422, detail="Provide a runbook topic")
    all_acts = list(
        db.scalars(select(Activity).where(Activity.actor_id == person_id)).all()
    )
    if body.activity_ids:
        id_set = set(body.activity_ids)
        acts = [a for a in all_acts if a.id in id_set]
    else:
        acts = all_acts
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    return build_runbook_draft(author, body.topic, acts, classifications)
