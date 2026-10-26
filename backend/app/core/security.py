"""Role-based access checks and visibility helpers."""
from fastapi import HTTPException, status

from app.models.person import Person


def require_manager(user: Person) -> None:
    if user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager view only",
        )


def require_self_or_manager(user: Person, target_id: str) -> None:
    if user.id != target_id and user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own data or your reports",
        )


def require_self(user: Person, target_id: str) -> None:
    if user.id != target_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee-only action for your own account",
        )
