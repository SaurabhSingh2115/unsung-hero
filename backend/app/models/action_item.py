"""action_item table — commitments (from tickets) used for follow-through rate."""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ActionItem(Base):
    __tablename__ = "action_item"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_id: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String)  # open | done | dropped
    title: Mapped[str] = mapped_column(String, default="")
    source_activity: Mapped[str | None] = mapped_column(String, nullable=True)
