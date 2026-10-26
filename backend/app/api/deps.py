"""Shared FastAPI dependencies (db session, current persona/user)."""
from collections.abc import Iterator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import Defaults
from app.core.db import SessionLocal
from app.models.person import Person


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    x_user_id: str = Header(Defaults.HERO_ID, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> Person:
    user = db.get(Person, x_user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unknown persona '{x_user_id}'",
        )
    return user
