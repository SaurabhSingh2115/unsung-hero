"""Generate cited performance review drafts with Gemini and heuristic fallback."""
from datetime import datetime
from typing import Any
from app.gemini.client import generate_structured
from app.generation.citation_check import enforce_citations
from app.models.activity import Activity
from app.models.person import Person
from app.schemas.generation import DraftOut

SCHEMA = {
    "type": "object",
    "title": "ReviewDraft",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "claims": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": {"type": "string"},
                                "activity_ids": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["text", "activity_ids"],
                        },
                    },
                },
                "required": ["title", "claims"],
            },
        },
    },
    "required": ["title", "summary", "sections"],
}


def build_review_draft(person: Person, activities: list[Activity]) -> DraftOut:
    valid_ids = {a.id for a in activities}

    evidence_summary = "\n".join([f"[{a.id}] ({a.source}): {a.text[:140]}" for a in activities[:30]])
    prompt = (
        f"Generate a balanced, cited performance review draft for {person.name} ({person.title}, {person.level}).\n"
        f"Grounded strictly in these activities:\n{evidence_summary}\n\n"
        "Every claim MUST include the exact activity IDs in activity_ids list."
    )

    result, model_type = generate_structured(prompt, SCHEMA)

    if not result:
        # High quality heuristic fallback
        unblocks = [a for a in activities if "unblock" in a.text.lower() or "fix" in a.text.lower()]
        reviews = [a for a in activities if a.source == "code_review" or "pr #" in a.text.lower()]
        docs = [a for a in activities if "guide" in a.text.lower() or "doc" in a.text.lower()]

        sections_raw = []
        if unblocks:
            sections_raw.append({
                "title": "Unblocking Teammates & Glue Work",
                "claims": [{
                    "text": f"Consistently unblocked critical development pathways across services.",
                    "activity_ids": [a.id for a in unblocks[:3]],
                }],
            })
        if reviews:
            sections_raw.append({
                "title": "Code & Architecture Review",
                "claims": [{
                    "text": "Raised engineering quality through thorough, actionable PR reviews.",
                    "activity_ids": [a.id for a in reviews[:3]],
                }],
            })
        if docs:
            sections_raw.append({
                "title": "Documentation & Knowledge Sharing",
                "claims": [{
                    "text": "Authored comprehensive guides and technical runbooks adopted across teams.",
                    "activity_ids": [a.id for a in docs[:2]],
                }],
            })

        result = {
            "title": f"Performance Review Draft — {person.name}",
            "summary": f"{person.name} demonstrated outstanding collaborative impact and high-leverage contributions.",
            "sections": sections_raw,
        }
        model_type = "heuristic"

    # Enforce citations
    verified_sections, citations_count, removed_count = enforce_citations(
        result.get("sections", []), valid_ids
    )

    # Markdown export
    md_lines = [
        f"# {result.get('title', 'Performance Review')}\n",
        f"**Employee:** {person.name} ({person.title})\n",
        f"**Summary:** {result.get('summary', '')}\n",
    ]
    for s in verified_sections:
        md_lines.append(f"\n## {s.title}")
        for c in s.claims:
            cites = " ".join([f"[{aid}](/source/{aid})" for aid in c.activity_ids])
            md_lines.append(f"- {c.text} {cites}")

    return DraftOut(
        person_id=person.id,
        kind="review",
        title=result.get("title", f"Performance Review — {person.name}"),
        summary=result.get("summary", ""),
        sections=verified_sections,
        citations_count=citations_count,
        unverified_removed=removed_count,
        model=model_type,
        generated_at=datetime.utcnow().isoformat() + "Z",
        gap_analysis=None,
        markdown="\n".join(md_lines),
    )
