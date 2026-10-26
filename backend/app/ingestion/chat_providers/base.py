"""Chat providers: where chat messages come from.

Unsung's chat ingestion only talks to this interface, so swapping the built-in chat
clone for Google Chat is a config change (CHAT_PROVIDER=gchat), not a rewrite.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session


@dataclass
class RawChatMessage:
    """Provider-neutral chat message, already mapped to Unsung person/space ids."""

    id: str
    space_id: str
    sender_id: str
    text: str
    created_at: datetime
    thread_id: str | None = None  # id of the thread root (None or == id for roots)
    parent_sender_id: str | None = None  # sender of the thread root, for reply targets
    mentions: list[str] = field(default_factory=list)
    label: str | None = None  # ground-truth category (synthetic data only)
    link: str = ""  # deep link shown as the evidence source


class ChatProvider(Protocol):
    name: str

    def fetch_new(self, db: Session, cursor: str | None) -> tuple[list[RawChatMessage], str | None]:
        """Return messages newer than `cursor` plus the new cursor to persist."""
        ...
