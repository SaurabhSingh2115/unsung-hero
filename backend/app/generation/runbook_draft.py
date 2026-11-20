"""Silo-to-Runbook Generator: turns repeated unblocking threads into a cited runbook credited to the author."""
from __future__ import annotations

import re
from typing import Any

from app.core.constants import Category
from app.gemini.client import generate_structured
from app.generation.citation_check import enforce_citations
from app.ingestion.pii import strip_pii
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.differentiators import RunbookDraftOut
from app.services.collab_common import snippet

GLUE = set(Category.GLUE_WORK)

RUNBOOK_SCHEMA: dict[str, Any] = {
    "title": "runbook_draft",
    "type": "object",
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
                                "activity_ids": {"type": "array", "items": {"type": "string"}},
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


def _slugify(topic: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    parts = [p for p in slug.split("-") if p][:4]
    return "-".join(parts) or "team-runbook"


def build_runbook_draft(
    author: Person,
    topic: str,
    activities: list[Activity],
    classifications: dict[str, Classification],
    use_llm: bool = True,
) -> RunbookDraftOut:
    valid_ids = {a.id for a in activities}
    go_link = f"go/{_slugify(topic)}-runbook"

    result: dict[str, Any] | None = None
    model = "heuristic"
    if activities and use_llm:
        ev_text = "\n".join(
            f"- [{a.id}] ({classifications[a.id].category if a.id in classifications else 'help'}) {strip_pii(a.text)}"
            for a in activities[:15]
        )
        prompt = (
            f"Turn {author.name}'s repeated unblocking/troubleshooting messages on '{topic}' "
            f"into a crisp internal engineering runbook.\n"
            f"Source threads:\n{ev_text}\n\n"
            "Sections: 'When to use this', 'Step-by-step resolution', 'Gotchas & prevention'.\n"
            "Every bullet MUST cite exact activity IDs in activity_ids."
        )
        result, model = generate_structured(prompt, RUNBOOK_SCHEMA)

    if not result:
        model = "heuristic"
        steps = [
            {"text": snippet(a.text, 130), "activity_ids": [a.id]}
            for a in activities[:4]
        ]
        result = {
            "title": f"Runbook: {topic.strip().rstrip('?')}",
            "summary": (
                f"Distilled from {len(activities)} unblocking thread(s) by {author.name} ({author.title}) "
                "so teammates can self-serve instead of pinging a single expert."
            ),
            "sections": [
                {
                    "title": "When to use this",
                    "claims": [
                        {
                            "text": f"Use this guide when hitting issues related to: {topic.strip()}.",
                            "activity_ids": [activities[0].id],
                        }
                    ],
                },
                {
                    "title": "Step-by-step resolution",
                    "claims": steps,
                },
            ] if activities else [],
        }

    verified_sections, citations, removed = enforce_citations(result.get("sections", []), valid_ids)

    md = [
        f"# {result.get('title', 'Team Runbook')}",
        f"**Suggested short link:** `{go_link}`  ",
        f"**Original Author / Unsung Expert:** {author.name} ({author.title}, {author.level})\n",
        f"{result.get('summary', '')}\n",
    ]
    for s in verified_sections:
        md.append(f"\n## {s.title}")
        for c in s.claims:
            cites = " ".join(f"[{aid}](/source/{aid})" for aid in c.activity_ids)
            md.append(f"- {c.text} {cites}")

    from app.services.collab_common import person_out
    return RunbookDraftOut(
        author=person_out(author),
        title=result.get("title", f"Runbook: {topic}"),
        suggested_go_link=go_link,
        summary=result.get("summary", ""),
        sections=verified_sections,
        citations_count=citations,
        unverified_removed=removed,
        model=model,
        markdown="\n".join(md),
    )
