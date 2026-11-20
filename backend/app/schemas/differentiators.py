"""Schemas for Snippets-Machine-differentiated features:
1. Review Language Bias & Evidence Lens
2. Silo-to-Runbook Generator (with Author Credit)
"""
from pydantic import BaseModel

from app.schemas.generation import DraftSectionOut
from app.schemas.person import PersonOut


class ReviewBiasCheckIn(BaseModel):
    text: str


class BiasFindingOut(BaseModel):
    original: str
    issue_type: str  # communal_framing | uncited_claim
    matched_terms: list[str] = []
    explanation: str
    suggested_rewrite: str
    activity_ids: list[str] = []


class ReviewBiasCheckOut(BaseModel):
    person_id: str
    overall_status: str  # strong | needs_evidence | bias_risk
    cited_count: int
    uncited_count: int
    communal_count: int
    findings: list[BiasFindingOut] = []
    summary: str


class RunbookDraftIn(BaseModel):
    topic: str
    activity_ids: list[str] = []


class RunbookDraftOut(BaseModel):
    author: PersonOut
    title: str
    suggested_go_link: str
    summary: str
    sections: list[DraftSectionOut] = []
    citations_count: int
    unverified_removed: int
    model: str
    markdown: str
