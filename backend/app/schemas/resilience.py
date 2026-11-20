"""Schemas for the Leave Simulator ("what if X is out?")."""
from pydantic import BaseModel

from app.schemas.person import PersonOut
from app.schemas.thanks import ActivityWithCategoryOut


class AffectedOut(BaseModel):
    person: PersonOut
    help_from_absent: int
    total_help_received: int
    dependency: float  # share of all help this person received that came from the absent person
    other_helpers: list[str] = []  # first names, most-helpful first
    stranded: bool  # no one else on the team has ever helped them


class LoadShiftOut(BaseModel):
    person: PersonOut
    before: int
    after: float
    absorbed: float
    before_ratio: float  # vs team median help
    after_ratio: float
    status_before: str  # ok | busy | overloaded
    status_after: str


class ApprenticeOut(BaseModel):
    person: PersonOut
    items: int  # explanations they received that nobody else on the team has given
    categories: dict[str, int] = {}
    example_ids: list[str] = []


class KnowledgeItemOut(BaseModel):
    activity: ActivityWithCategoryOut
    learned_by: list[PersonOut] = []


class AbsenceSimOut(BaseModel):
    absent: PersonOut
    headline: str
    help_share_lost: float
    team_help_total: int
    absent_help: int
    people_affected: int
    stranded: list[str] = []
    orphaned_count: int
    orphaned_by_category: dict[str, int] = {}
    solo_incidents: int
    knowledge_items: list[KnowledgeItemOut] = []
    apprentices: list[ApprenticeOut] = []
    affected: list[AffectedOut] = []
    load_shift: list[LoadShiftOut] = []
    median_help: float
    recommendations: list[str] = []
