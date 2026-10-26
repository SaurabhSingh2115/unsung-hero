"""annotation table — employee privacy controls per activity (hide / note / dispute)."""
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Annotation(Base):
    __tablename__ = "annotation"

    activity_id: Mapped[str] = mapped_column(String, ForeignKey("activity.id"), primary_key=True)
    person_id: Mapped[str] = mapped_column(String, primary_key=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    disputed: Mapped[bool] = mapped_column(Boolean, default=False)
