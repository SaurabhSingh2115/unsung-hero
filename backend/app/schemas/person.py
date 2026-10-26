"""Person and config schemas."""
from pydantic import BaseModel


class PersonOut(BaseModel):
    id: str
    name: str
    first_name: str
    initials: str
    email: str
    role: str
    title: str
    level: str
    discipline: str
    location: str
    city: str
    team: str
    manager_id: str | None = None
    opted_in: bool
    avatar_color: str


class OptInIn(BaseModel):
    opted_in: bool


class AppConfigOut(BaseModel):
    recognition_tool_name: str
    gemini_enabled: bool
    min_group_size: int
    team_id: str


class ProjectOut(BaseModel):
    id: str
    name: str
    owner_ids: list[str]
    start: str
    end: str | None = None
    impact_summary: str
    impact_metric: str | None = None
    impact_value: str | None = None
    users_affected: int | None = None
    impact_quote: str | None = None
    complexity: int
    complexity_rationale: str
