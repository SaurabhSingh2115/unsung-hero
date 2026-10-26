"""Consent check — filters out activities from users or spaces that have opted out."""
from sqlalchemy.orm import Session
from app.models.person import Person
from app.models.chat import ChatSpace


def is_user_opted_in(db: Session, person_id: str) -> bool:
    p = db.get(Person, person_id)
    return bool(p.opted_in) if p else False


def is_space_opted_in(db: Session, space_id: str) -> bool:
    s = db.get(ChatSpace, space_id)
    return bool(s.opted_in_to_unsung) if s else True
