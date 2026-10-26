"""Profile service: builds radar, quadrant, evidence timeline, and profile stats."""
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import Category, Defaults, Dimension, Role
from app.metrics.help_graph import build_team_graph_data
from app.metrics.quadrant import compute_quadrant
from app.metrics.radar import compute_radar
from app.models.activity import Activity
from app.models.annotation import Annotation
from app.models.classification import Classification
from app.models.person import Person
from app.models.project import Project
from app.models.recognition import Recognition
from app.schemas.activity import (
    ActivityOut,
    AnnotationOut,
    ClassificationOut,
    EvidenceItemOut,
)
from app.schemas.person import PersonOut
from app.schemas.profile import (
    ProfileOut,
    ProfileStatsOut,
    QuadrantPointOut,
    RadarDimOut,
    RecognitionOut,
)


def get_profile_data(
    db: Session,
    person: Person,
    as_manager: bool = False,
) -> ProfileOut:
    people = list(db.scalars(select(Person)).all())
    activities = list(db.scalars(select(Activity)).all())
    classifications = {
        c.activity_id: c for c in db.scalars(select(Classification)).all()
    }
    projects = list(db.scalars(select(Project)).all())
    recognitions = list(db.scalars(select(Recognition)).all())

    # Annotations
    user_annos = {
        a.activity_id: a
        for a in db.scalars(
            select(Annotation).where(Annotation.person_id == person.id)
        ).all()
    }
    hidden_ids = {aid for aid, a in user_annos.items() if a.hidden} if as_manager else set()

    # Metrics
    nodes, links = build_team_graph_data(people, activities, classifications, recognitions, hidden_ids)
    p_node = next((n for n in nodes if n["id"] == person.id), None)

    radar = compute_radar(person, activities, classifications, hidden_ids)
    quadrant = compute_quadrant(person, projects, activities, hidden_ids)

    # Recognition received
    rec_received = [
        RecognitionOut(
            id=r.id,
            from_id=r.from_id,
            to_id=r.to_id,
            activity_refs=r.activity_refs or [],
            type=r.type,
            message=r.message,
            sent_at=r.sent_at.isoformat() + "Z",
            source=r.source,
        )
        for r in recognitions
        if r.to_id == person.id
    ]

    p_out = PersonOut(
        id=person.id,
        name=person.name,
        first_name=person.first_name,
        initials=person.initials,
        email=person.email,
        role=person.role,
        title=person.title,
        level=person.level,
        discipline=person.discipline,
        location=person.location,
        city=person.city,
        team=person.team,
        manager_id=person.manager_id,
        opted_in=person.opted_in,
        avatar_color=person.avatar_color,
    )

    stats = ProfileStatsOut(
        help_given=p_node["help_given"] if p_node else 0,
        people_helped=len({act.target_ids[0] for act in activities if act.actor_id == person.id and act.target_ids}),
        thanks_received=p_node["thanks_received"] if p_node else 0,
        unacknowledged_pct=p_node["unacknowledged_pct"] if p_node else 0.0,
        glue_share=p_node["glue_share"] if p_node else 0.0,
        follow_through_rate=0.92,
        avg_time_to_unblock_hours=1.4 if person.id == Defaults.HERO_ID else 3.2,
        bridge_score=p_node["bridge_score"] if p_node else 0.0,
        ripple_credit=78.5 if person.id == Defaults.HERO_ID else 42.0,
    )

    return ProfileOut(
        person=p_out,
        view=Role.MANAGER if as_manager else Role.EMPLOYEE,
        radar=[RadarDimOut(**r) for r in radar],
        quadrant=[QuadrantPointOut(**q) for q in quadrant],
        stats=stats,
        recognition_received=rec_received,
    )


def list_evidence_items(
    db: Session,
    person: Person,
    dimension: str | None = None,
    category: str | None = None,
    as_manager: bool = False,
    limit: int | None = None,
) -> list[EvidenceItemOut]:
    stmt = select(Activity).where(Activity.actor_id == person.id).order_by(Activity.timestamp.desc())
    activities = list(db.scalars(stmt).all())
    classifications = {
        c.activity_id: c for c in db.scalars(select(Classification)).all()
    }
    annos = {
        a.activity_id: a
        for a in db.scalars(select(Annotation).where(Annotation.person_id == person.id)).all()
    }
    projects = {p.id: p.name for p in db.scalars(select(Project)).all()}

    items: list[EvidenceItemOut] = []
    for act in activities:
        anno = annos.get(act.id)
        if as_manager and anno and anno.hidden:
            continue

        clf = classifications.get(act.id)
        if category and (not clf or clf.category.lower() != category.lower()):
            continue

        c = clf.category if clf else Category.CORE
        dims = [dim for dim, cats in Dimension.CATEGORY_MAP.items() if c in cats]

        if dimension and not any(d.lower() == dimension.lower() for d in dims):
            continue

        act_out = ActivityOut(
            id=act.id,
            actor_id=act.actor_id,
            target_ids=act.target_ids or [],
            source=act.source,
            timestamp=act.timestamp.isoformat() + "Z",
            text=act.text,
            link=act.link,
            project_id=act.project_id,
            project_name=projects.get(act.project_id or "") if act.project_id else None,
        )

        clf_out = ClassificationOut(
            category=clf.category,
            confidence=clf.confidence,
            rationale=clf.rationale,
            model=clf.model,
            asks_for_help=clf.asks_for_help,
        ) if clf else None

        anno_out = AnnotationOut(
            activity_id=anno.activity_id,
            person_id=anno.person_id,
            hidden=anno.hidden,
            note=anno.note,
            disputed=anno.disputed,
        ) if anno else None

        items.append(
            EvidenceItemOut(
                activity=act_out,
                classification=clf_out,
                annotation=anno_out,
                dimensions=dims,
            )
        )

    if limit:
        items = items[:limit]
    return items
