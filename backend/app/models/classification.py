"""classification table — Gemini (or heuristic fallback) label per activity."""
from sqlalchemy import JSON, Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Classification(Base):
    __tablename__ = "classification"

    activity_id: Mapped[str] = mapped_column(String, ForeignKey("activity.id"), primary_key=True)
    category: Mapped[str] = mapped_column(String, index=True)
    confidence: Mapped[float] = mapped_column(Float)
    rationale: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String)  # gemini | heuristic
    asks_for_help: Mapped[bool] = mapped_column(Boolean, default=False)
    # Thanks detection
    is_thanks: Mapped[bool] = mapped_column(Boolean, default=False)
    thanked_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Ideas (for ghost-credit detection)
    is_proposal: Mapped[bool] = mapped_column(Boolean, default=False)
