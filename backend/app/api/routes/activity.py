"""Activity API routes: manual entry, annotate, source record details."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.ingestion.sources.manual import create_manual_activity
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.activity import (
    ActivityOut,
    AnnotationIn,
    AnnotationOut,
    ClassificationOut,
    ManualActivityIn,
    SourceRecordOut,
)
from app.services.privacy_service import apply_annotation

router = APIRouter(prefix="/activity", tags=["activity"])


@router.post("", response_model=ActivityOut)
def log_manual_activity(
    body: ManualActivityIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    act = create_manual_activity(db, user.id, body)
    return ActivityOut(
        id=act.id,
        actor_id=act.actor_id,
        target_ids=act.target_ids or [],
        source=act.source,
        timestamp=act.timestamp.isoformat() + "Z",
        text=act.text,
        link=act.link,
        project_id=act.project_id,
        project_name=None,
    )


@router.post("/{activity_id}/annotate", response_model=AnnotationOut)
def annotate_activity(
    activity_id: str,
    body: AnnotationIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    return apply_annotation(db, activity_id, user.id, body)


@router.get("/{activity_id}", response_model=SourceRecordOut)
def get_activity_detail(
    activity_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    act = db.get(Activity, activity_id)
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    clf = db.get(Classification, activity_id)
    clf_out = (
        ClassificationOut(
            category=clf.category,
            confidence=clf.confidence,
            rationale=clf.rationale,
            model=clf.model,
            asks_for_help=clf.asks_for_help,
        )
        if clf
        else None
    )

    act_out = ActivityOut(
        id=act.id,
        actor_id=act.actor_id,
        target_ids=act.target_ids or [],
        source=act.source,
        timestamp=act.timestamp.isoformat() + "Z",
        text=act.text,
        link=act.link,
        project_id=act.project_id,
        project_name=None,
    )

    return SourceRecordOut(
        activity=act_out,
        classification=clf_out,
        raw=act.raw or {},
    )
