"""App settings, read from environment / .env (repo root or backend/)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import Defaults

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent
DATA_DIR = REPO_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_DIR / ".env"), str(BACKEND_DIR / ".env")),
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = Defaults.MODEL_NAME
    ai_cache_dir: str = str(DATA_DIR / "cache")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'unsung.db'}"

    recognition_link_template: str = (
        "https://example.com/recognize?to={recipient}&msg={message}&type={type}"
    )
    recognition_tool_name: str = "gThanks"

    min_group_size: int = 5
    team_id: str = Defaults.TEAM_ID
    team_name: str = Defaults.TEAM_NAME

    # Data ingestion
    data_scenario: str = "payments-demo"  # folder under data/scenarios/ to seed from
    chat_provider: str = "local"  # local (built-in chat clone) | gchat (Google Chat API)
    enabled_sources: str = "chat,doc_comments,code_reviews"  # comma-separated activity sources
    gchat_credentials_file: str = ""  # service-account / OAuth client JSON for the gchat provider

    @property
    def scenario_path(self) -> Path:
        p = Path(self.data_scenario)
        return p if p.is_absolute() else DATA_DIR / "scenarios" / p

    @property
    def enabled_source_names(self) -> list[str]:
        return [s.strip() for s in self.enabled_sources.split(",") if s.strip()]

    # Serve built frontend (frontend/dist/frontend/browser) from FastAPI if present.
    frontend_dist: str = str(REPO_DIR / "frontend" / "dist" / "frontend" / "browser")

    @property
    def resolved_database_url(self) -> str:
        """Resolve SQLite relative paths to absolute paths within BACKEND_DIR."""
        url = self.database_url
        if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            rel_path = url[len("sqlite:///"):]
            if rel_path.startswith("./"):
                rel_path = rel_path[2:]
            return f"sqlite:///{BACKEND_DIR / rel_path}"
        return url

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def cache_path(self) -> Path:
        p = Path(self.ai_cache_dir)
        if not p.is_absolute():
            p = (BACKEND_DIR / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
