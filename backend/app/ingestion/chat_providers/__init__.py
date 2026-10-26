"""Chat provider registry. Selected by CHAT_PROVIDER in .env."""
from app.core.config import get_settings
from app.ingestion.chat_providers.base import ChatProvider, RawChatMessage
from app.ingestion.chat_providers.gchat import GoogleChatProvider
from app.ingestion.chat_providers.local import LocalChatProvider

PROVIDERS: dict[str, type] = {
    LocalChatProvider.name: LocalChatProvider,
    GoogleChatProvider.name: GoogleChatProvider,
}


def get_chat_provider(name: str | None = None) -> ChatProvider:
    key = name or get_settings().chat_provider
    if key not in PROVIDERS:
        raise ValueError(f"Unknown CHAT_PROVIDER '{key}'. Options: {', '.join(PROVIDERS)}")
    return PROVIDERS[key]()


__all__ = ["ChatProvider", "RawChatMessage", "get_chat_provider"]
