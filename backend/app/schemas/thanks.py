"""Thanks schemas: unthanked helpers, drafts, recognition creation."""
from pydantic import BaseModel
from app.schemas.person import PersonOut


class ActivityWithCategoryOut(BaseModel):
    id: str
    actor_id: str
    target_ids: list[str] = []
    source: str
    timestamp: str
    text: str
    link: str
    project_id: str | None = None
    project_name: str | None = None
    category: str


class UnthankedHelperOut(BaseModel):
    helper: PersonOut
    count: int
    activities: list[ActivityWithCategoryOut]
    suggested_type: str  # kudos | peer_bonus


class DigestOut(BaseModel):
    week_start: str
    week_end: str
    unthanked: list[UnthankedHelperOut]
    message: str


class ThankDraftIn(BaseModel):
    helper_id: str
    activity_ids: list[str]
    type: str = "kudos"  # kudos | peer_bonus


class ThankDraftOut(BaseModel):
    message: str
    recognition_link: str
    tool_name: str
    activity_ids: list[str]
    model: str = "heuristic"


class RecognitionIn(BaseModel):
    to_id: str
    activity_ids: list[str] = []
    type: str = "kudos"  # kudos | peer_bonus
    message: str = ""
