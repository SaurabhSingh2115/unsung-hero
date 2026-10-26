"""Chat source: turns messages from any ChatProvider into activities (opted-in spaces/people only)."""
from sqlalchemy.orm import Session

from app.core.constants import SourceType
from app.ingestion.chat_providers import ChatProvider, get_chat_provider
from app.ingestion.consent import is_space_opted_in, is_user_opted_in
from app.ingestion.normalizer import normalize_event
from app.ingestion.sources.base import get_cursor, set_cursor
from app.models.activity import Activity


class ChatSource:
    name = SourceType.CHAT

    def __init__(self, provider: ChatProvider | None = None) -> None:
        self.provider = provider or get_chat_provider()
        self.cursor_key = f"cursor:chat:{self.provider.name}"

    def pull(self, db: Session) -> list[Activity]:
        messages, new_cursor = self.provider.fetch_new(db, get_cursor(db, self.cursor_key))

        new_activities: list[Activity] = []
        for msg in messages:
            if not is_space_opted_in(db, msg.space_id) or not is_user_opted_in(db, msg.sender_id):
                continue

            targets = list(msg.mentions)
            if msg.parent_sender_id and msg.parent_sender_id != msg.sender_id and msg.parent_sender_id not in targets:
                targets.append(msg.parent_sender_id)

            act = normalize_event(
                id=f"A-CHAT-{self.provider.name.upper()}-{msg.id}",
                actor_id=msg.sender_id,
                target_ids=targets,
                source=SourceType.CHAT,
                source_ref=msg.id,
                timestamp=msg.created_at,
                text=msg.text,
                link=msg.link,
                raw={"provider": self.provider.name, "space_id": msg.space_id, "thread_id": msg.thread_id},
                gold_category=msg.label,
            )
            db.merge(act)
            new_activities.append(act)

        set_cursor(db, self.cursor_key, new_cursor)
        db.commit()
        return new_activities


def sync_chat_messages(db: Session) -> list[Activity]:
    """Backwards-compatible helper: pull new chat messages from the configured provider."""
    return ChatSource().pull(db)
