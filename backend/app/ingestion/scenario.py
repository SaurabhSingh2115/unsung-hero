"""Loads and validates a data scenario folder (data/scenarios/<name>/) into typed models.

A scenario is plain JSON/Markdown so new stories can be added without touching code.
See data/scenarios/README.md for the file layout and schema.
"""
import json
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

from app.core.config import get_settings


class TeamIn(BaseModel):
    id: str
    name: str
    email_domain: str = "example.com"


class PersonIn(BaseModel):
    id: str
    name: str
    role: str = "employee"
    title: str
    level: str
    discipline: str
    location: str = "office"
    city: str = ""
    avatar_color: str = "#6366f1"
    manager_id: str | None = None
    opted_in: bool = True
    aliases: list[str] = []
    story: str = ""  # free-text note for scenario authors; not used by the app


class LevelDimIn(BaseModel):
    min_score: int
    description: str


class ProjectIn(BaseModel):
    id: str
    name: str
    owners: list[str]
    start: date
    end: date | None = None
    doc_file: str | None = None  # markdown file relative to the scenario folder
    doc: str = ""  # inline doc text (used if doc_file is absent)


class SpaceIn(BaseModel):
    id: str
    name: str = ""
    kind: str = "space"  # space | dm
    description: str = ""
    members: list[str]
    opted_in: bool = True


class ChatMessageIn(BaseModel):
    sender: str
    text: str
    after_minutes: int = 0  # delay after the previous message in the thread
    mentions: list[str] = []
    label: str | None = None  # ground-truth category (eval only; never shown to the classifier)


class ChatThreadIn(BaseModel):
    space: str
    start: datetime
    messages: list[ChatMessageIn] = Field(min_length=1)  # first message is the thread root


class DocCommentIn(BaseModel):
    author: str
    date: date
    text: str
    label: str | None = None


class DocIn(BaseModel):
    id: str
    title: str
    owner: str
    project: str | None = None
    kind: str = "design"
    created: date | None = None
    comments: list[DocCommentIn] = []


class CodeReviewIn(BaseModel):
    id: str | None = None
    author: str
    reviewer: str
    project: str | None = None
    reviewed_at: datetime
    request: str = ""
    review: str
    label: str | None = "review"


class RecognitionIn(BaseModel):
    from_: str = Field(alias="from")
    to: str
    type: str = "kudos"
    message: str = ""
    sent_at: datetime


class Scenario(BaseModel):
    path: Path
    team: TeamIn
    people: list[PersonIn]
    ladder: dict[str, dict[str, LevelDimIn]] = {}
    projects: list[ProjectIn] = []
    spaces: list[SpaceIn] = []
    threads: dict[str, list[ChatThreadIn]] = {}  # file stem -> threads
    docs: list[DocIn] = []
    code_reviews: list[CodeReviewIn] = []
    recognitions: list[RecognitionIn] = []

    @model_validator(mode="after")
    def _check_references(self) -> "Scenario":
        ids = {p.id for p in self.people}
        space_ids = {s.id for s in self.spaces}
        errors: list[str] = []

        def need(pid: str | None, where: str) -> None:
            if pid and pid not in ids:
                errors.append(f"{where}: unknown person '{pid}'")

        for p in self.people:
            need(p.manager_id, f"people[{p.id}].manager_id")
        for pr in self.projects:
            for o in pr.owners:
                need(o, f"projects[{pr.id}].owners")
        for s in self.spaces:
            for m in s.members:
                need(m, f"spaces[{s.id}].members")
        for name, threads in self.threads.items():
            for i, t in enumerate(threads):
                if t.space not in space_ids:
                    errors.append(f"chat/threads/{name}.json[{i}]: unknown space '{t.space}'")
                for m in t.messages:
                    need(m.sender, f"chat/threads/{name}.json[{i}].sender")
        for d in self.docs:
            need(d.owner, f"doc_comments[{d.id}].owner")
            for c in d.comments:
                need(c.author, f"doc_comments[{d.id}].author")
        for r in self.code_reviews:
            need(r.author, "code_reviews.author")
            need(r.reviewer, "code_reviews.reviewer")
        for r in self.recognitions:
            need(r.from_, "recognitions.from")
            need(r.to, "recognitions.to")

        if errors:
            raise ValueError("Invalid scenario:\n  " + "\n  ".join(errors))
        return self

    def project_doc(self, project: ProjectIn) -> str:
        if project.doc_file:
            return (self.path / project.doc_file).read_text()
        return project.doc

    def email_for(self, person_id: str) -> str:
        return f"{person_id}@{self.team.email_domain}"


def _read(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def load_scenario(path: Path | str) -> Scenario:
    root = Path(path)
    if not (root / "team.json").exists():
        raise FileNotFoundError(f"Scenario folder '{root}' has no team.json")

    team = _read(root / "team.json", {})
    threads = {
        f.stem: _read(f, {}).get("threads", [])
        for f in sorted((root / "chat" / "threads").glob("*.json"))
    }
    return Scenario(
        path=root,
        team=team["team"],
        people=team["people"],
        ladder=_read(root / "ladder.json", {}),
        projects=_read(root / "projects.json", []),
        spaces=_read(root / "chat" / "spaces.json", []),
        threads=threads,
        docs=_read(root / "doc_comments.json", []),
        code_reviews=_read(root / "code_reviews.json", []),
        recognitions=_read(root / "recognitions.json", []),
    )


@lru_cache
def get_active_scenario() -> Scenario:
    """Scenario selected by DATA_SCENARIO (default: payments-demo)."""
    return load_scenario(get_settings().scenario_path)
