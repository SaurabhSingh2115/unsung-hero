"""Seeds the database from a scenario folder, then runs the ingestion pipeline.

Order: reference data (people, ladder, projects, recognitions, chat spaces)
       -> local chat clone messages (only when CHAT_PROVIDER=local)
       -> run enabled activity sources -> classify.
"""
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.enrichment.impact_extractor import enrich_project
from app.ingestion.chat_providers.local import LocalChatProvider
from app.ingestion.pipeline import run_sources
from app.ingestion.scenario import Scenario
from app.models.chat import ChatMessage, ChatSpace
from app.models.level_expectation import LevelExpectation
from app.models.person import Person
from app.models.project import Project
from app.models.recognition import Recognition

RECOGNITION_TOOL_SOURCE = "recognition_tool"


def seed_reference_data(db: Session, sc: Scenario) -> None:
    for p in sc.people:
        db.merge(Person(
            id=p.id, name=p.name, email=sc.email_for(p.id), role=p.role, title=p.title,
            level=p.level, discipline=p.discipline, location=p.location, city=p.city,
            team=sc.team.id, manager_id=p.manager_id, opted_in=p.opted_in,
            avatar_color=p.avatar_color, aliases=p.aliases,
        ))

    for level, dims in sc.ladder.items():
        for dim, exp in dims.items():
            db.merge(LevelExpectation(level=level, dimension=dim, description=exp.description,
                                      min_score=exp.min_score))

    for pr in sc.projects:
        proj = Project(id=pr.id, name=pr.name, owner_ids=pr.owners, start=pr.start, end=pr.end,
                       doc_text=sc.project_doc(pr))
        enrich_project(proj, use_llm=False)
        db.merge(proj)

    for i, r in enumerate(sc.recognitions, start=1):
        db.merge(Recognition(id=f"REC-{i:04d}", from_id=r.from_, to_id=r.to, activity_refs=[],
                             type=r.type, message=r.message, sent_at=r.sent_at,
                             source=RECOGNITION_TOOL_SOURCE))

    for s in sc.spaces:
        db.merge(ChatSpace(id=s.id, name=s.name, kind=s.kind, description=s.description,
                           member_ids=s.members, opted_in_to_unsung=s.opted_in))
    db.commit()


def seed_local_chat(db: Session, sc: Scenario) -> int:
    """Write scenario chat threads into the local chat clone, ordered by time."""
    rows = []  # (created_at, thread_key, msg)
    for file_name, threads in sc.threads.items():
        for t_idx, t in enumerate(threads):
            ts = t.start
            for m_idx, m in enumerate(t.messages):
                ts = ts + timedelta(minutes=m.after_minutes)
                rows.append((ts, (file_name, t_idx), m_idx, t.space, m))

    rows.sort(key=lambda r: (r[0], r[2]))
    root_ids: dict[tuple, str] = {}
    for seq, (ts, key, m_idx, space, m) in enumerate(rows, start=1):
        mid = f"m-{seq:06d}"
        if m_idx == 0:
            root_ids[key] = mid
        db.merge(ChatMessage(
            id=mid, seq=seq, space_id=space, thread_id=root_ids.get(key, mid), sender_id=m.sender,
            text=m.text, created_at=ts, mentions=m.mentions, gold_category=m.label,
        ))
    db.commit()
    return len(rows)


def seed_from_scenario(db: Session, sc: Scenario, use_llm: bool = False) -> dict[str, int]:
    seed_reference_data(db, sc)
    chat_msgs = seed_local_chat(db, sc) if get_settings().chat_provider == LocalChatProvider.name else 0
    counts = run_sources(db, use_llm=use_llm)
    return {"people": len(sc.people), "projects": len(sc.projects), "chat_messages": chat_msgs, **counts}
