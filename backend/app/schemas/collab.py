"""Schemas for collaboration features: Peer Feedback Drafter and "Who can unblock me?"."""
from pydantic import BaseModel

from app.schemas.generation import DraftSectionOut
from app.schemas.person import PersonOut
from app.schemas.thanks import ActivityWithCategoryOut


# ---------------- Peer Feedback Drafter ----------------
class PeerCandidateOut(BaseModel):
    peer: PersonOut
    interactions: int  # times this peer helped the writer (glue work aimed at the writer)
    categories: dict[str, int] = {}


class PeerFeedbackIn(BaseModel):
    peer_id: str


class PeerFeedbackOut(BaseModel):
    writer_id: str
    peer: PersonOut
    title: str
    summary: str
    sections: list[DraftSectionOut] = []
    growth: str  # one constructive, evidence-light suggestion (clearly labelled as opinion)
    citations_count: int
    unverified_removed: int
    evidence_count: int
    model: str
    markdown: str


# ---------------- Who can unblock me? ----------------
class HelperFinderIn(BaseModel):
    question: str


class HelperSuggestionOut(BaseModel):
    person: PersonOut
    rank: int
    relevance: float  # 0..1, topic match with past help
    load_ratio: float  # help given / team median
    load_status: str  # ok | busy | overloaded
    score: float  # relevance x load factor
    matched_terms: list[str] = []
    evidence: list[ActivityWithCategoryOut] = []
    reason: str
    ask_message: str


class HelperFinderOut(BaseModel):
    question: str
    terms: list[str]
    suggestions: list[HelperSuggestionOut] = []
    protected: list[str] = []  # names de-prioritised to protect them from overload
    bus_factor_warning: str | None = None
    model: str  # gemini | heuristic (for query understanding only — ranking is always deterministic)
