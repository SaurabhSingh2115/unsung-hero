"""Recognition API route: marks thank-you as sent and updates recognition gap."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.person import Person
from app.schemas.profile import RecognitionOut
from app.schemas.thanks import RecognitionIn
from app.services.thanks_service import record_recognition

router = APIRouter(prefix="/recognition", tags=["recognition"])


@router.post("", response_model=RecognitionOut)
def send_recognition(
    body: RecognitionIn,
    db: Session = Depends(get_db),
    user: Person = Depends(get_current_user),
):
    rec = record_recognition(db, user.id, body)
    return RecognitionOut(
        id=rec.id,
        from_id=rec.from_id,
        to_id=rec.to_id,
        activity_refs=rec.activity_refs or [],
        type=rec.type,
        message=rec.message,
        sent_at=rec.sent_at.isoformat() + "Z",
        source=rec.source,
    )
