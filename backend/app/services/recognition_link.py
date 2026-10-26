"""Build pre-filled URL for company recognition tool (FR-18, FR-23)."""
from urllib.parse import quote
from app.core.config import get_settings


def build_recognition_link(recipient: str, message: str, thanks_type: str = "kudos") -> str:
    tpl = get_settings().recognition_link_template
    return tpl.format(
        recipient=quote(recipient),
        message=quote(message),
        type=quote(thanks_type),
    )
