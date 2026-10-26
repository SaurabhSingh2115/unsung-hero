"""Combines all route modules into the main API router."""
from collections import Counter
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes import activity, person, recognition, team
from app.core.config import get_settings
from app.core.constants import SourceType
from app.ingestion.pipeline import sync_chat
from app.models.activity import Activity
from app.models.chat import ChatMessage, ChatSpace
from app.models.classification import Classification
from app.models.person import Person
from app.models.project import Project
from app.schemas.person import AppConfigOut, OptInIn, PersonOut, ProjectOut

api_router = APIRouter()
api_router.include_router(team.router)
api_router.include_router(person.router)
api_router.include_router(activity.router)
api_router.include_router(recognition.router)


# ---------------- People & Config ----------------
@api_router.get("/people", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_db)):
    people = list(db.scalars(select(Person)).all())
    return [
        PersonOut(
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
        for p in people
    ]


@api_router.get("/me", response_model=PersonOut)
def get_me(user: Person = Depends(get_current_user)):
    return PersonOut(
        id=user.id,
        name=user.name,
        first_name=user.first_name,
        initials=user.initials,
        email=user.email,
        role=user.role,
        title=user.title,
        level=user.level,
        discipline=user.discipline,
        location=user.location,
        city=user.city,
        team=user.team,
        manager_id=user.manager_id,
        opted_in=user.opted_in,
        avatar_color=user.avatar_color,
    )


@api_router.get("/config", response_model=AppConfigOut)
def get_config():
    s = get_settings()
    return AppConfigOut(
        recognition_tool_name=s.recognition_tool_name,
        gemini_enabled=s.gemini_enabled,
        min_group_size=s.min_group_size,
        team_id=s.team_id,
    )


@api_router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = list(db.scalars(select(Project)).all())
    return [
        ProjectOut(
            id=pr.id,
            name=pr.name,
            owner_ids=pr.owner_ids or [],
            start=pr.start.isoformat(),
            end=pr.end.isoformat() if pr.end else None,
            impact_summary=pr.impact_summary,
            impact_metric=pr.impact_metric,
            impact_value=pr.impact_value,
            users_affected=pr.users_affected,
            impact_quote=pr.impact_quote,
            complexity=pr.complexity,
            complexity_rationale=pr.complexity_rationale,
        )
        for pr in projects
    ]


@api_router.put("/person/{person_id}/opt-in", response_model=PersonOut)
def update_opt_in(
    person_id: str,
    body: OptInIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    p = db.get(Person, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    p.opted_in = body.opted_in
    db.commit()
    db.refresh(p)
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


# ---------------- Pipeline ----------------
class PipelineStatusOut(BaseModel):
    gemini_enabled: bool
    total_activities: int
    classified: int
    by_model: dict[str, int]
    sources: list[dict]
    chat: dict
    classifier_eval: dict | None = None


@api_router.get("/pipeline/status", response_model=PipelineStatusOut)
def pipeline_status(db: Session = Depends(get_db)):
    s = get_settings()
    acts = list(db.scalars(select(Activity)).all())
    clfs = list(db.scalars(select(Classification)).all())
    spaces = list(db.scalars(select(ChatSpace)).all())
    msgs_total = len(list(db.scalars(select(ChatMessage.id)).all()))

    by_source = Counter(a.source for a in acts)
    by_model = Counter(c.model for c in clfs)

    return PipelineStatusOut(
        gemini_enabled=s.gemini_enabled,
        total_activities=len(acts),
        classified=len(clfs),
        by_model={"gemini": by_model.get("gemini", 0), "heuristic": by_model.get("heuristic", 0)},
        sources=[{"source": src, "events": n} for src, n in by_source.most_common()],
        chat={
            "provider": s.chat_provider,
            "scenario": s.data_scenario,
            "spaces_total": len(spaces),
            "spaces_opted_in": sum(1 for sp in spaces if sp.opted_in_to_unsung),
            "messages_total": msgs_total,
            "messages_ingested": by_source.get(SourceType.CHAT, 0),
            "last_synced_at": datetime.utcnow().isoformat() + "Z",
        },
        classifier_eval=None,
    )


@api_router.post("/pipeline/sync")
def pipeline_sync(db: Session = Depends(get_db)):
    new_acts = sync_chat(db)
    status_data = pipeline_status(db).model_dump()
    status_data["new_activities"] = len(new_acts)
    return status_data


# ---------------- Chat Clone Endpoints ----------------
class ChatSpaceOut(BaseModel):
    id: str
    name: str
    kind: str
    description: str
    member_ids: list[str]
    opted_in_to_unsung: bool
    last_message_at: str | None = None
    last_message_preview: str | None = None


class ChatMessageOut(BaseModel):
    id: str
    space_id: str
    thread_id: str | None = None
    sender_id: str
    text: str
    created_at: str
    mentions: list[str] = []
    reply_count: int = 0
    ingested: bool = True


class PostMessageIn(BaseModel):
    text: str
    thread_id: str | None = None


class OpenDmIn(BaseModel):
    member_id: str


@api_router.get("/chat/spaces", response_model=list[ChatSpaceOut])
def get_chat_spaces(
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    spaces = list(db.scalars(select(ChatSpace)).all())
    user_spaces = [s for s in spaces if user.id in (s.member_ids or [])]

    results = []
    for sp in user_spaces:
        name = sp.name
        if sp.kind == "dm":
            other_id = next((m for m in sp.member_ids if m != user.id), user.id)
            other_p = db.get(Person, other_id)
            name = other_p.name if other_p else other_id

        # Look up last message
        last_m = db.scalars(
            select(ChatMessage)
            .where(ChatMessage.space_id == sp.id)
            .order_by(ChatMessage.created_at.desc())
        ).first()

        results.append(
            ChatSpaceOut(
                id=sp.id,
                name=name,
                kind=sp.kind,
                description=sp.description,
                member_ids=sp.member_ids or [],
                opted_in_to_unsung=sp.opted_in_to_unsung,
                last_message_at=last_m.created_at.isoformat() + "Z" if last_m else None,
                last_message_preview=last_m.text[:60] if last_m else None,
            )
        )
    return results


@api_router.get("/chat/spaces/{space_id}", response_model=ChatSpaceOut)
def get_chat_space(
    space_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    sp = db.get(ChatSpace, space_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Space not found")

    name = sp.name
    if sp.kind == "dm":
        other_id = next((m for m in sp.member_ids if m != user.id), user.id)
        other_p = db.get(Person, other_id)
        name = other_p.name if other_p else other_id

    last_m = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.space_id == sp.id)
        .order_by(ChatMessage.created_at.desc())
    ).first()

    return ChatSpaceOut(
        id=sp.id,
        name=name,
        kind=sp.kind,
        description=sp.description,
        member_ids=sp.member_ids or [],
        opted_in_to_unsung=sp.opted_in_to_unsung,
        last_message_at=last_m.created_at.isoformat() + "Z" if last_m else None,
        last_message_preview=last_m.text[:60] if last_m else None,
    )


@api_router.get("/chat/spaces/{space_id}/messages", response_model=list[ChatMessageOut])
def get_chat_messages(
    space_id: str,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.space_id == space_id)
            .order_by(ChatMessage.created_at.asc())
        ).all()
    )

    # Compute reply counts for root messages
    reply_counts: dict[str, int] = {}
    for m in messages:
        if m.thread_id and m.thread_id != m.id:
            reply_counts[m.thread_id] = reply_counts.get(m.thread_id, 0) + 1

    return [
        ChatMessageOut(
            id=m.id,
            space_id=m.space_id,
            thread_id=m.thread_id,
            sender_id=m.sender_id,
            text=m.text,
            created_at=m.created_at.isoformat() + "Z",
            mentions=m.mentions or [],
            reply_count=reply_counts.get(m.id, 0),
            ingested=True,
        )
        for m in messages
    ]


@api_router.post("/chat/spaces/{space_id}/messages", response_model=ChatMessageOut)
def post_chat_message(
    space_id: str,
    body: PostMessageIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    # Determine next sequence
    max_seq = db.scalar(select(ChatMessage.seq).order_by(ChatMessage.seq.desc())) or 0
    new_seq = max_seq + 1
    msg_id = f"m-{new_seq:06d}"

    # Parse mentions
    people = list(db.scalars(select(Person)).all())
    mentions = [
        p.id for p in people
        if f"@{p.first_name.lower()}" in body.text.lower()
    ]

    new_msg = ChatMessage(
        id=msg_id,
        seq=new_seq,
        space_id=space_id,
        thread_id=body.thread_id,
        sender_id=user.id,
        text=body.text,
        created_at=datetime.utcnow(),
        mentions=mentions,
        gold_category=None,
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Immediately ingest into Unsung activities if space is opted in.
    # Offline classifier keeps posting instant; Gemini runs on "Sync now".
    sp = db.get(ChatSpace, space_id)
    if sp and sp.opted_in_to_unsung and user.opted_in:
        sync_chat(db, use_llm=False)

    return ChatMessageOut(
        id=new_msg.id,
        space_id=new_msg.space_id,
        thread_id=new_msg.thread_id,
        sender_id=new_msg.sender_id,
        text=new_msg.text,
        created_at=new_msg.created_at.isoformat() + "Z",
        mentions=new_msg.mentions or [],
        reply_count=0,
        ingested=True,
    )


@api_router.post("/chat/dm", response_model=ChatSpaceOut)
def open_or_create_dm(
    body: OpenDmIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    # Check if DM space already exists
    spaces = list(db.scalars(select(ChatSpace).where(ChatSpace.kind == "dm")).all())
    existing = next(
        (s for s in spaces if user.id in (s.member_ids or []) and body.member_id in (s.member_ids or [])),
        None,
    )
    if existing:
        other_p = db.get(Person, body.member_id)
        return ChatSpaceOut(
            id=existing.id,
            name=other_p.name if other_p else body.member_id,
            kind="dm",
            description="",
            member_ids=existing.member_ids or [],
            opted_in_to_unsung=existing.opted_in_to_unsung,
        )

    # Create new DM space
    dm_id = f"dm-{user.id}-{body.member_id}"
    new_sp = ChatSpace(
        id=dm_id,
        name="",
        kind="dm",
        description="",
        member_ids=[user.id, body.member_id],
        opted_in_to_unsung=True,
    )
    db.add(new_sp)
    db.commit()
    db.refresh(new_sp)

    other_p = db.get(Person, body.member_id)
    return ChatSpaceOut(
        id=new_sp.id,
        name=other_p.name if other_p else body.member_id,
        kind="dm",
        description="",
        member_ids=new_sp.member_ids or [],
        opted_in_to_unsung=new_sp.opted_in_to_unsung,
    )
