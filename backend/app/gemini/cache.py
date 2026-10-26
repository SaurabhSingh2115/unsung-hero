"""File-based cache for Gemini calls to guarantee reproducibility and prevent rate-limit hits."""
import hashlib
import json
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class DiskCache:
    def __init__(self, cache_dir: Path | None = None):
        self.cache_dir = cache_dir or get_settings().cache_path
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _key(self, prompt: str, schema_name: str = "") -> str:
        h = hashlib.sha256(f"{schema_name}:{prompt}".encode("utf-8")).hexdigest()
        return h

    def get(self, prompt: str, schema_name: str = "") -> Any | None:
        key = self._key(prompt, schema_name)
        p = self.cache_dir / f"{key}.json"
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                return None
        return None

    def set(self, prompt: str, schema_name: str, value: Any) -> None:
        key = self._key(prompt, schema_name)
        p = self.cache_dir / f"{key}.json"
        try:
            p.write_text(json.dumps(value, indent=2), encoding="utf-8")
        except Exception:
            pass


_default_cache = None


def get_cache() -> DiskCache:
    global _default_cache
    if _default_cache is None:
        _default_cache = DiskCache()
    return _default_cache
