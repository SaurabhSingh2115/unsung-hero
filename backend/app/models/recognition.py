"""recognition table — thanks/kudos/peer bonus records."""
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Recognition(Base):
    __tablename__ = "recognition"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    from_id: Mapped[str] = mapped_column(String, index=True)
    to_id: Mapped[str] = mapped_column(String, index=True)
    activity_refs: Mapped[list] = mapped_column(JSON, default=list)  # activity ids the thanks refers to
    type: Mapped[str] = mapped_column(String)  # kudos | peer_bonus | chat_thanks
    message: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[datetime] = mapped_column(DateTime)
    source: Mapped[str] = mapped_column(String)  # unsung | chat | recognition_tool
