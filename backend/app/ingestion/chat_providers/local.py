"""Local provider: reads the built-in Google-Chat-like clone (chat_space / chat_message tables)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.chat_providers.base import RawChatMessage
from app.models.chat import ChatMessage


class LocalChatProvider:
    name = "local"

    def fetch_new(self, db: Session, cursor: str | None) -> tuple[list[RawChatMessage], str | None]:
        last_seq = int(cursor or 0)
        rows = list(db.scalars(
            select(ChatMessage).where(ChatMessage.seq > last_seq).order_by(ChatMessage.seq)
        ).all())

        out: list[RawChatMessage] = []
        for m in rows:
            parent_sender = None
            if m.thread_id and m.thread_id != m.id:
                parent = db.get(ChatMessage, m.thread_id)
                parent_sender = parent.sender_id if parent else None
            out.append(RawChatMessage(
                id=m.id,
                space_id=m.space_id,
                sender_id=m.sender_id,
                text=m.text,
                created_at=m.created_at,
                thread_id=m.thread_id,
                parent_sender_id=parent_sender,
                mentions=list(m.mentions or []),
                label=m.gold_category,
                link=f"/chat/{m.space_id}?msg={m.id}",
            ))

        new_cursor = str(rows[-1].seq) if rows else str(last_seq)
        return out, new_cursor
