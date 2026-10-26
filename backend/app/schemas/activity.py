"""Activity request / response schemas."""
from typing import Any
from pydantic import BaseModel


class ActivityOut(BaseModel):
    id: str
    actor_id: str
    target_ids: list[str] = []
    source: str
    timestamp: str
    text: str
    link: str
    project_id: str | None = None
    project_name: str | None = None


class ClassificationOut(BaseModel):
    category: str
    confidence: float
    rationale: str
    model: str
    asks_for_help: bool


class AnnotationOut(BaseModel):
    activity_id: str
    person_id: str
    hidden: bool
    note: str | None = None
    disputed: bool


class EvidenceItemOut(BaseModel):
    activity: ActivityOut
    classification: ClassificationOut | None = None
    annotation: AnnotationOut | None = None
    dimensions: list[str] = []


class ManualActivityIn(BaseModel):
    text: str
    target_ids: list[str] = []
    timestamp: str
    project_id: str | None = None
    request_confirmation: bool = False


class AnnotationIn(BaseModel):
    hidden: bool | None = None
    note: str | None = None
    disputed: bool | None = None


class SourceRecordOut(BaseModel):
    activity: ActivityOut
    classification: ClassificationOut | None = None
    raw: dict[str, Any] = {}
