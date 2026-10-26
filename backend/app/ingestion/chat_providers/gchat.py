"""Google Chat provider (placeholder until API access is approved).

To enable later:
  1. Get a Chat app / service account approved with scopes
     `chat.spaces.readonly` and `chat.messages.readonly` (see docs/SETUP_AND_GCHAT_INTEGRATION.md).
  2. Set CHAT_PROVIDER=gchat and GCHAT_CREDENTIALS_FILE=/path/to/credentials.json.
  3. Implement `fetch_new` below:
       - for each opted-in space (chat_space rows), call spaces.messages.list with
         filter 'createTime > "<cursor>"', ordered by createTime;
       - map users/{id} -> Unsung person id via email (people.email);
       - map thread.name -> thread_id, annotations[USER_MENTION] -> mentions;
       - link = message permalink (https://chat.google.com/room/...);
       - return the max createTime seen as the new cursor.
Nothing else in the pipeline needs to change: ChatSource handles consent,
normalisation and classification for any provider.
"""
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.chat_providers.base import RawChatMessage


class GoogleChatProvider:
    name = "gchat"

    def __init__(self) -> None:
        self.credentials_file = get_settings().gchat_credentials_file

    def fetch_new(self, db: Session, cursor: str | None) -> tuple[list[RawChatMessage], str | None]:
        raise NotImplementedError(
            "Google Chat provider is not wired up yet. Use CHAT_PROVIDER=local, or implement "
            "GoogleChatProvider.fetch_new once Chat API access is granted."
        )
