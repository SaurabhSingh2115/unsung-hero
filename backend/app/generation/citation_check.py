"""Server-side citation check: drops any generated claim whose activity IDs are missing from valid inputs."""
from typing import Any
from app.schemas.generation import ClaimOut, DraftSectionOut


def enforce_citations(
    sections: list[dict[str, Any]],
    valid_activity_ids: set[str],
) -> tuple[list[DraftSectionOut], int, int]:
    """Filters out uncited or hallucinated claims from AI-generated draft sections.

    Returns:
        (verified_sections, verified_count, removed_count)
    """
    verified_sections: list[DraftSectionOut] = []
    citations_count = 0
    removed_count = 0

    for sec in sections:
        verified_claims: list[ClaimOut] = []
        for claim in sec.get("claims", []):
            text = claim.get("text", "").strip()
            act_ids = [aid for aid in claim.get("activity_ids", []) if aid in valid_activity_ids]

            # Enforce principle: every claim must have verified source activity
            if act_ids and text:
                verified_claims.append(ClaimOut(text=text, activity_ids=act_ids))
                citations_count += len(act_ids)
            else:
                removed_count += 1

        if verified_claims:
            verified_sections.append(
                DraftSectionOut(title=sec.get("title", "Contributions"), claims=verified_claims)
            )

    return verified_sections, citations_count, removed_count
