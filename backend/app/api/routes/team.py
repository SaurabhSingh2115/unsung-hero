"""Team API routes: graph, alerts, stats, bias-check, leave simulator."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import require_manager
from app.metrics.help_graph import build_team_graph_data
from app.metrics.recognition_gap import compute_bias_check
from app.metrics.resilience import simulate_absence
from app.models.activity import Activity
from app.models.annotation import Annotation
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
from app.schemas.resilience import (
    AbsenceSimOut,
    AffectedOut,
    ApprenticeOut,
    KnowledgeItemOut,
    LoadShiftOut,
)
from app.services.alerts_service import get_team_alerts
from app.services.collab_common import activity_out, person_out

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


@router.get("/{team_id}/absence-sim/{person_id}", response_model=AbsenceSimOut)
def get_absence_sim(
    team_id: str,
    person_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    """Leave simulator: what breaks if this person is out? Pure graph math over the consented help graph."""
    require_manager(user)
    people = list(db.scalars(select(Person).where(Person.team == team_id, Person.opted_in.is_(True))).all())
    by_id = {p.id: p for p in people}
    absent = by_id.get(person_id)
    if not absent:
        raise HTTPException(status_code=404, detail="Person not found on this team")
    hidden = {a.activity_id for a in db.scalars(select(Annotation).where(Annotation.hidden.is_(True))).all()}
    activities = [a for a in db.scalars(select(Activity)).all() if a.id not in hidden]
    classifications = {c.activity_id: c for c in db.scalars(select(Classification)).all()}

    sim = simulate_absence(absent, people, activities, classifications)
    cat = lambda a: classifications[a.id].category  # noqa: E731
    return AbsenceSimOut(
        absent=person_out(absent),
        headline=sim["headline"],
        help_share_lost=sim["help_share_lost"],
        team_help_total=sim["team_help_total"],
        absent_help=sim["absent_help"],
        people_affected=sim["people_affected"],
        stranded=sim["stranded"],
        orphaned_count=len(sim["orphaned"]),
        orphaned_by_category=sim["orphaned_by_category"],
        solo_incidents=sim["solo_incidents"],
        knowledge_items=[
            KnowledgeItemOut(
                activity=activity_out(a, cat(a)),
                learned_by=[person_out(by_id[t]) for t in (a.target_ids or []) if t in by_id and t != absent.id],
            )
            for a in sim["examples"]
        ],
        apprentices=[
            ApprenticeOut(person=person_out(by_id[x["pid"]]), items=x["items"], categories=x["categories"],
                          example_ids=x["example_ids"])
            for x in sim["apprentices"]
        ],
        affected=[
            AffectedOut(
                person=person_out(by_id[x["pid"]]),
                help_from_absent=x["help_from_absent"],
                total_help_received=x["total_help_received"],
                dependency=x["dependency"],
                other_helpers=[by_id[h].first_name for h in x["other_helpers"]],
                stranded=x["stranded"],
            )
            for x in sim["affected"]
        ],
        load_shift=[LoadShiftOut(person=person_out(by_id[x["pid"]]), **{k: v for k, v in x.items() if k != "pid"})
                    for x in sim["load_shift"]],
        median_help=sim["median_help"],
        recommendations=sim["recommendations"],
    )
