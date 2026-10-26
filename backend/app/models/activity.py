"""activity table — the normalized Activity Event every source is converted into."""
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Activity(Base):
    __tablename__ = "activity"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # "A-0001"
    actor_id: Mapped[str] = mapped_column(String, index=True)
    target_ids: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String, index=True)
    source_ref: Mapped[str] = mapped_column(String, index=True)  # id in the source system
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    text: Mapped[str] = mapped_column(Text)
    link: Mapped[str] = mapped_column(String)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    raw: Mapped[dict] = mapped_column(JSON, default=dict)  # original source payload
    # Ground-truth label from the synthetic generator — used ONLY by the eval script.
    gold_category: Mapped[str | None] = mapped_column(String, nullable=True)
