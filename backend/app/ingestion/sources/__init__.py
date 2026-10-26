"""Activity source registry. Enabled sources are listed in ENABLED_SOURCES (.env)."""
from collections.abc import Callable

from app.core.config import get_settings
from app.ingestion.sources.base import ActivitySource
from app.ingestion.sources.chat import ChatSource
from app.ingestion.sources.code_reviews import CodeReviewsSource
from app.ingestion.sources.doc_comments import DocCommentsSource

SOURCES: dict[str, Callable[[], ActivitySource]] = {
    "chat": ChatSource,
    "doc_comments": DocCommentsSource,
    "code_reviews": CodeReviewsSource,
}


def build_sources(names: list[str] | None = None) -> list[ActivitySource]:
    names = names if names is not None else get_settings().enabled_source_names
    unknown = [n for n in names if n not in SOURCES]
    if unknown:
        raise ValueError(f"Unknown source(s) {unknown}. Options: {', '.join(SOURCES)}")
    return [SOURCES[n]() for n in names]


__all__ = ["ActivitySource", "SOURCES", "build_sources"]
