"""Central constants module for Unsung Hero.

Eliminates magic strings across the codebase for categories, dimensions,
roles, alert types, recognition types, and default persona IDs.
"""
from typing import Final


# ---------------------------------------------------------------------------
# Activity & Glue Work Categories
# ---------------------------------------------------------------------------
class Category:
    MENTORING: Final[str] = "mentoring"
    UNBLOCKING: Final[str] = "unblocking"
    REVIEW: Final[str] = "review"
    DOCUMENTATION: Final[str] = "documentation"
    ONBOARDING: Final[str] = "onboarding"
    FIREFIGHTING: Final[str] = "firefighting"
    CORE: Final[str] = "core"

    ALL: Final[tuple[str, ...]] = (
        MENTORING,
        UNBLOCKING,
        REVIEW,
        DOCUMENTATION,
        ONBOARDING,
        FIREFIGHTING,
        CORE,
    )

    GLUE_WORK: Final[tuple[str, ...]] = (
        MENTORING,
        UNBLOCKING,
        REVIEW,
        DOCUMENTATION,
        ONBOARDING,
        FIREFIGHTING,
    )

    LABELS: Final[dict[str, str]] = {
        MENTORING: "Mentoring & 1:1s",
        UNBLOCKING: "Unblocking others",
        REVIEW: "Code & design review",
        DOCUMENTATION: "Documentation & runbooks",
        ONBOARDING: "New hire onboarding",
        FIREFIGHTING: "Incident triage & fixes",
        CORE: "Core feature delivery",
    }


# ---------------------------------------------------------------------------
# Contribution Radar Dimensions (6 dimensions, 0-100, no single score)
# ---------------------------------------------------------------------------
class Dimension:
    IMPACT: Final[str] = "Impact"
    COLLABORATION: Final[str] = "Collaboration"
    KNOWLEDGE: Final[str] = "Knowledge"
    QUALITY: Final[str] = "Quality"
    LEADERSHIP: Final[str] = "Leadership"
    GROWTH: Final[str] = "Growth"

    ALL: Final[tuple[str, ...]] = (
        IMPACT,
        COLLABORATION,
        KNOWLEDGE,
        QUALITY,
        LEADERSHIP,
        GROWTH,
    )

    # Deterministic mapping from activity categories to radar dimensions
    CATEGORY_MAP: Final[dict[str, tuple[str, ...]]] = {
        IMPACT: (Category.CORE, Category.FIREFIGHTING),
        COLLABORATION: (Category.UNBLOCKING, Category.MENTORING),
        KNOWLEDGE: (Category.DOCUMENTATION, Category.MENTORING),
        QUALITY: (Category.REVIEW, Category.FIREFIGHTING),
        LEADERSHIP: (Category.ONBOARDING, Category.UNBLOCKING, Category.MENTORING),
        GROWTH: (Category.ONBOARDING, Category.CORE),
    }

    # Level baseline benchmarks for normalization
    BENCHMARKS: Final[dict[str, int]] = {
        IMPACT: 20,
        COLLABORATION: 15,
        KNOWLEDGE: 10,
        QUALITY: 15,
        LEADERSHIP: 8,
        GROWTH: 10,
    }


# ---------------------------------------------------------------------------
# Organization Roles
# ---------------------------------------------------------------------------
class Role:
    EMPLOYEE: Final[str] = "employee"
    MANAGER: Final[str] = "manager"

    ALL: Final[tuple[str, ...]] = (EMPLOYEE, MANAGER)


# ---------------------------------------------------------------------------
# Team Alert Types (Manager signals)
# ---------------------------------------------------------------------------
class AlertType:
    RECOGNITION_GAP: Final[str] = "recognition_gap"
    LOAD_IMBALANCE: Final[str] = "load_imbalance"
    BUS_FACTOR: Final[str] = "bus_factor"
    GHOST_CREDIT: Final[str] = "ghost_credit"
    BURNOUT: Final[str] = "burnout"

    ALL: Final[tuple[str, ...]] = (
        RECOGNITION_GAP,
        LOAD_IMBALANCE,
        BUS_FACTOR,
        GHOST_CREDIT,
        BURNOUT,
    )


# ---------------------------------------------------------------------------
# Recognition Types
# ---------------------------------------------------------------------------
class RecognitionType:
    KUDOS: Final[str] = "kudos"
    PEER_BONUS: Final[str] = "peer_bonus"
    CHAT_THANKS: Final[str] = "chat_thanks"

    ALL: Final[tuple[str, ...]] = (KUDOS, PEER_BONUS, CHAT_THANKS)


# ---------------------------------------------------------------------------
# Activity Sources
# ---------------------------------------------------------------------------
class SourceType:
    CHAT: Final[str] = "chat"
    DOC_COMMENT: Final[str] = "doc_comment"
    CODE_REVIEW: Final[str] = "code_review"
    TICKET: Final[str] = "ticket"
    CALENDAR: Final[str] = "calendar"
    MANUAL: Final[str] = "manual"
    LAUNCH_DOC: Final[str] = "launch_doc"
    RECOGNITION: Final[str] = "recognition"

    ALL: Final[tuple[str, ...]] = (
        CHAT,
        DOC_COMMENT,
        CODE_REVIEW,
        TICKET,
        CALENDAR,
        MANUAL,
        LAUNCH_DOC,
        RECOGNITION,
    )


# ---------------------------------------------------------------------------
# Default Person & Team Identifiers for Demo
# ---------------------------------------------------------------------------
class Defaults:
    HERO_ID: Final[str] = "priya"
    MANAGER_ID: Final[str] = "karan"
    UNBLOCKED_PEER_ID: Final[str] = "arjun"
    TEAM_ID: Final[str] = "payments"
    TEAM_NAME: Final[str] = "Payments Platform"
    MODEL_NAME: Final[str] = "gemini-3.8-flash"
    HEURISTIC_MODEL: Final[str] = "heuristic"
