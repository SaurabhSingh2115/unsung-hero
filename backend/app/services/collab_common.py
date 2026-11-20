"""Small serializers shared by the collaboration features."""
from app.models.activity import Activity
from app.models.person import Person
from app.schemas.person import PersonOut
from app.schemas.thanks import ActivityWithCategoryOut


def person_out(p: Person) -> PersonOut:
    return PersonOut(
        id=p.id,
        name=p.name,
        first_name=p.first_name,
        initials=p.initials,
        email=p.email,
        role=p.role,
        title=p.title,
        level=p.level,
        discipline=p.discipline,
        location=p.location,
        city=p.city,
        team=p.team,
        manager_id=p.manager_id,
        opted_in=p.opted_in,
        avatar_color=p.avatar_color,
    )


def activity_out(a: Activity, category: str) -> ActivityWithCategoryOut:
    return ActivityWithCategoryOut(
        id=a.id,
        actor_id=a.actor_id,
        target_ids=a.target_ids or [],
        source=a.source,
        timestamp=a.timestamp.isoformat() + "Z",
        text=a.text,
        link=a.link,
        project_id=a.project_id,
        project_name=None,
        category=category,
    )


def snippet(text: str, limit: int = 90) -> str:
    """First sentence of an activity, trimmed — used in templated (non-LLM) drafts."""
    t = " ".join(text.split())
    for sep in (". ", " — ", "; "):
        if sep in t[:limit]:
            t = t.split(sep)[0]
            break
    return t if len(t) <= limit else t[: limit - 1].rstrip() + "…"
