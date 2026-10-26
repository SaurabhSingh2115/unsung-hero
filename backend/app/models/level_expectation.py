"""level_expectation table — career ladder used for promo gap analysis."""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LevelExpectation(Base):
    __tablename__ = "level_expectation"

    level: Mapped[str] = mapped_column(String, primary_key=True)
    dimension: Mapped[str] = mapped_column(String, primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    min_score: Mapped[int] = mapped_column(Integer)  # radar score (0..100) that counts as "meets"
