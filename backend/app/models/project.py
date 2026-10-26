"""project table — launches/projects with impact extracted from launch docs."""
from datetime import date

from sqlalchemy import JSON, Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Project(Base):
    __tablename__ = "project"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    owner_ids: Mapped[list] = mapped_column(JSON, default=list)
    start: Mapped[date] = mapped_column(Date)
    end: Mapped[date | None] = mapped_column(Date, nullable=True)
    doc_text: Mapped[str] = mapped_column(Text, default="")
    impact_summary: Mapped[str] = mapped_column(Text, default="")
    impact_metric: Mapped[str | None] = mapped_column(String, nullable=True)
    impact_value: Mapped[str | None] = mapped_column(String, nullable=True)
    users_affected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impact_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_score: Mapped[int] = mapped_column(Integer, default=50)  # 0..100, deterministic from extracted fields
    complexity: Mapped[int] = mapped_column(Integer, default=3)
    complexity_rationale: Mapped[str] = mapped_column(Text, default="")
    enrichment_model: Mapped[str] = mapped_column(String, default="heuristic")
