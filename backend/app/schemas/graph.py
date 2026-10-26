"""Fix TeamStatsOut field mapping."""
from pydantic import BaseModel


class GraphNodeOut(BaseModel):
    id: str
    name: str
    title: str
    discipline: str
    location: str
    glue_work: int
    glue_share: float
    help_given: int
    thanks_received: int
    unacknowledged_pct: float
    recognition_gap: float
    bridge_score: float


class GraphLinkOut(BaseModel):
    source: str
    target: str
    weight: int
    categories: dict[str, int] = {}


class TeamGraphOut(BaseModel):
    team_id: str
    team_name: str
    nodes: list[GraphNodeOut]
    links: list[GraphLinkOut]


class AlertOut(BaseModel):
    id: str
    type: str
    severity: str
    title: str
    detail: str
    person_ids: list[str]
    evidence_ids: list[str] = []


class TeamStatsOut(BaseModel):
    team_id: str
    team_name: str
    people_count: int
    activity_count: int
    glue_work_share: float
    avg_time_to_unblock_hours: float | None = None
    follow_through_rate: float | None = None


class BiasGroupOut(BaseModel):
    group: str
    size: int
    suppressed: bool
    help_given: int | None = None
    thanks_received: int | None = None
    thanks_per_help: float | None = None


class BiasCheckOut(BaseModel):
    min_group_size: int
    groups: list[BiasGroupOut]
    note: str
