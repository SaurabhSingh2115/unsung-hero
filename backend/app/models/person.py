"""person table."""
from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Person(Base):
    __tablename__ = "person"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="employee")  # employee | manager
    title: Mapped[str] = mapped_column(String)
    level: Mapped[str] = mapped_column(String)
    discipline: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)  # office | remote
    city: Mapped[str] = mapped_column(String)
    team: Mapped[str] = mapped_column(String)
    manager_id: Mapped[str | None] = mapped_column(String, nullable=True)
    opted_in: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar_color: Mapped[str] = mapped_column(String, default="#6366f1")
    aliases: Mapped[list] = mapped_column(JSON, default=list)  # other names used in text

    @property
    def first_name(self) -> str:
        return self.name.split()[0]

    @property
    def initials(self) -> str:
        return "".join(part[0] for part in self.name.split()[:2]).upper()
