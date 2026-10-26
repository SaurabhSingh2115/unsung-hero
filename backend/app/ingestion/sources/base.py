"""Common interface for activity sources (chat, doc comments, code reviews, ...)."""
from typing import Protocol

from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.chat import KV


class ActivitySource(Protocol):
    name: str

    def pull(self, db: Session) -> list[Activity]:
        """Fetch new records, write them as Activity rows, and return the new ones."""
        ...


def get_cursor(db: Session, key: str) -> str | None:
    row = db.get(KV, key)
    return row.value if row else None


def set_cursor(db: Session, key: str, value: str | None) -> None:
    if value is None:
        return
    row = db.get(KV, key)
    if row is None:
        db.add(KV(key=key, value=value))
    else:
        row.value = value
