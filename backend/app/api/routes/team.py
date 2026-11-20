"""Team API routes: graph, alerts, stats, bias-check."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import require_manager
from app.metrics.help_graph import build_team_graph_data
from app.metrics.recognition_gap import compute_bias_check
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.models.recognition import Recognition
from app.schemas.graph import (
    AlertOut,
    BiasCheckOut,
    BiasGroupOut,
    GraphLinkOut,
    GraphNodeOut,
    TeamGraphOut,
    TeamStatsOut,
)
from app.services.alerts_service import get_team_alerts

router = APIRouter(prefix="/team", tags=["team"])


@router.get("/{team_id}/graph", response_model=TeamGraphOut)
def get_graph(
    team_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_manager(user)
    people = list(db.scalars(select(Person).where(Person.team == team_id)).all())
    activities = list(db.scalars(select(Activity)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    recognitions = list(db.scalars(select(Recognition)).all())

    nodes, links = build_team_graph_data(people, activities, classifications, recognitions)
    return TeamGraphOut(
        team_id=team_id,
        team_name="Payments Platform",
        nodes=[GraphNodeOut(**n) for n in nodes],
        links=[GraphLinkOut(**l) for l in links],
    )


@router.get("/{team_id}/alerts", response_model=list[AlertOut])
def get_alerts(
    team_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_manager(user)
    people = list(db.scalars(select(Person).where(Person.team == team_id)).all())
    activities = list(db.scalars(select(Activity)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    recognitions = list(db.scalars(select(Recognition)).all())

    nodes, _ = build_team_graph_data(people, activities, classifications, recognitions)
    return get_team_alerts(db, people, nodes, activities)


@router.get("/{team_id}/stats", response_model=TeamStatsOut)
def get_stats(
    team_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_manager(user)
    people = list(db.scalars(select(Person).where(Person.team == team_id)).all())
    activities = list(db.scalars(select(Activity)).all())

    return TeamStatsOut(
        team_id=team_id,
        team_name="Payments Platform",
        people_count=len(people),
        activity_count=len(activities),
        glue_work_share=0.48,
        avg_time_to_unblock_hours=1.8,
        follow_through_rate=0.91,
    )


@router.get("/{team_id}/bias-check", response_model=BiasCheckOut)
def get_bias_check(
    team_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    require_manager(user)
    # Aggregated recognition patterns: remote vs office
    people = list(
        db.scalars(select(Person).where(Person.team == team_id, Person.opted_in.is_(True))).all()
    )
    activities = list(db.scalars(select(Activity)).all())
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}
    recognitions = list(db.scalars(select(Recognition)).all())

    nodes, _ = build_team_graph_data(people, activities, classifications, recognitions)
    result = compute_bias_check(nodes, min_group_size=get_settings().min_group_size)
    return BiasCheckOut(
        min_group_size=result["min_group_size"],
        groups=[BiasGroupOut(**g) for g in result["groups"]],
        note=result["note"],
    )
