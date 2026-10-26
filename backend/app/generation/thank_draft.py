from app.core.constants import Defaults, RecognitionType
from app.models.activity import Activity
from app.models.person import Person
from app.schemas.thanks import ThankDraftOut
from app.services.recognition_link import build_recognition_link


def generate_thank_draft(
    helper: Person,
    activities: list[Activity],
    thanks_type: str = RecognitionType.KUDOS,
) -> ThankDraftOut:
    act_ids = [a.id for a in activities]
    first_act = activities[0] if activities else None

    if first_act:
        detail = first_act.text[:120].strip()
        msg = f"Thanks {helper.first_name} for helping unblock: \"{detail}\" [{first_act.id}]"
    else:
        msg = f"Thanks {helper.first_name} for your continuous help and dedication to the team!"

    rec_link = build_recognition_link(helper.email, msg, thanks_type)

    return ThankDraftOut(
        message=msg,
        recognition_link=rec_link,
        tool_name="gThanks",
        activity_ids=act_ids,
        model=Defaults.HEURISTIC_MODEL,
    )
