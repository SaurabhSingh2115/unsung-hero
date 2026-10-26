"""Profile schemas (radar, quadrant, profile stats, recognition)."""
from pydantic import BaseModel
from app.schemas.person import PersonOut


class RadarDimOut(BaseModel):
    dimension: str
    score: int
    evidence_count: int
    explanation: str


class QuadrantPointOut(BaseModel):
    project_id: str
    project_name: str
    impact: int
    effort: int
    complexity: int
    role: str  # owner | contributor | enabler
    activity_ids: list[str] = []


class ProfileStatsOut(BaseModel):
    help_given: int
    people_helped: int
    thanks_received: int
    unacknowledged_pct: float
    glue_share: float
    follow_through_rate: float | None = None
    avg_time_to_unblock_hours: float | None = None
    bridge_score: float
    ripple_credit: float


class RecognitionOut(BaseModel):
    id: str
    from_id: str
    to_id: str
    activity_refs: list[str] = []
    type: str
    message: str
    sent_at: str
    source: str


class ProfileOut(BaseModel):
    person: PersonOut
    view: str  # self | manager
    radar: list[RadarDimOut]
    quadrant: list[QuadrantPointOut]
    stats: ProfileStatsOut
    recognition_received: list[RecognitionOut] = []
