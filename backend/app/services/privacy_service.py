"""Handle employee privacy annotations (hide, note, dispute)."""
from sqlalchemy.orm import Session
from app.models.annotation import Annotation
from app.schemas.activity import AnnotationIn, AnnotationOut


def apply_annotation(
    db: Session, activity_id: str, person_id: str, data: AnnotationIn
) -> AnnotationOut:
    anno = db.get(Annotation, (activity_id, person_id))
    if anno is None:
        anno = Annotation(
            activity_id=activity_id,
            person_id=person_id,
            hidden=False,
            note=None,
            disputed=False,
        )
        db.add(anno)

    if data.hidden is not None:
        anno.hidden = data.hidden
    if data.note is not None:
        anno.note = data.note
    if data.disputed is not None:
        anno.disputed = data.disputed

    db.commit()
    db.refresh(anno)

    return AnnotationOut(
        activity_id=anno.activity_id,
        person_id=anno.person_id,
        hidden=anno.hidden,
        note=anno.note,
        disputed=anno.disputed,
    )
