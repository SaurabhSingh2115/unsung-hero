"""Generation schemas (Review drafts, promo packets, translations, 1:1 prep)."""
from pydantic import BaseModel
from app.schemas.activity import EvidenceItemOut
from app.schemas.person import PersonOut
from app.schemas.thanks import UnthankedHelperOut


class ClaimOut(BaseModel):
    text: str
    activity_ids: list[str] = []


class DraftSectionOut(BaseModel):
    title: str
    claims: list[ClaimOut] = []


class GapDimensionOut(BaseModel):
    dimension: str
    score: int
    required: int
    met: bool
    expectation: str
    suggestion: str


class GapAnalysisOut(BaseModel):
    current_level: str
    next_level: str
    dimensions: list[GapDimensionOut]


class DraftOut(BaseModel):
    person_id: str
    kind: str  # review | promo
    title: str
    summary: str
    sections: list[DraftSectionOut] = []
    citations_count: int
    unverified_removed: int
    model: str
    generated_at: str
    gap_analysis: GapAnalysisOut | None = None
    markdown: str


class BragMonthOut(BaseModel):
    month: str
    label: str
    items: list[EvidenceItemOut] = []


class BragDocOut(BaseModel):
    person_id: str
    months: list[BragMonthOut] = []


class TranslateIn(BaseModel):
    activity_ids: list[str]


class TranslationOut(BaseModel):
    activity_id: str
    original: str
    business_impact: str
    model: str


class BurnoutInfo(BaseModel):
    flag: bool
    reason: str


class OneOnOneOut(BaseModel):
    person: PersonOut
    wins: list[EvidenceItemOut] = []
    blockers: list[EvidenceItemOut] = []
    unthanked_help: list[UnthankedHelperOut] = []
    help_unacknowledged: int = 0
    burnout: BurnoutInfo | None = None
    open_action_items: int = 0
