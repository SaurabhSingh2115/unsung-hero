"""PII scrubbing before model calls — removes emails, phone numbers, auth tokens."""
import re

EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
TOKEN_RE = re.compile(r"(?i)(bearer|token|secret|key)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-\.]{12,}['\"]?")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")


def strip_pii(text: str) -> str:
    cleaned = EMAIL_RE.sub("[EMAIL]", text)
    cleaned = TOKEN_RE.sub(r"\1: [REDACTED]", cleaned)
    cleaned = PHONE_RE.sub("[PHONE]", cleaned)
    return cleaned
