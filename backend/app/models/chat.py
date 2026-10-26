"""Chat clone tables — the "Chat" app (Google Chat-like). This is a *source system*:
Unsung never reads these tables directly from metrics code; the chat ingestion
source pulls new messages from opted-in spaces and turns them into activities."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ChatSpace(Base):
    __tablename__ = "chat_space"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String, default="space")  # space | dm
    description: Mapped[str] = mapped_column(Text, default="")
    member_ids: Mapped[list] = mapped_column(JSON, default=list)
    opted_in_to_unsung: Mapped[bool] = mapped_column(Boolean, default=True)


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # "m-000001"
    seq: Mapped[int] = mapped_column(index=True)  # monotonically increasing; ingestion cursor
    space_id: Mapped[str] = mapped_column(String, index=True)
    thread_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    sender_id: Mapped[str] = mapped_column(String, index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    mentions: Mapped[list] = mapped_column(JSON, default=list)
    # Ground-truth label from the synthetic generator (eval only; never shown to the classifier).
    gold_category: Mapped[str | None] = mapped_column(String, nullable=True)


class KV(Base):
    """Tiny key/value store for pipeline state (e.g. chat ingestion cursor)."""

    __tablename__ = "kv"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text)
