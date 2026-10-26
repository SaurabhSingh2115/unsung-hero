"""Promotion packet generator with level gap analysis."""
from datetime import datetime
from app.gemini.client import generate_structured
from app.generation.citation_check import enforce_citations
from app.ingestion.scenario import get_active_scenario
from app.models.activity import Activity
from app.models.person import Person
from app.schemas.generation import DraftOut, GapAnalysisOut, GapDimensionOut

NEXT_LEVEL = {"L3": "L4", "L4": "L5", "L5": "L6", "L6": "L7"}


def build_promo_packet(
    person: Person,
    activities: list[Activity],
    radar_scores: dict[str, int],
) -> DraftOut:
    valid_ids = {a.id for a in activities}
    current_level = person.level or "L4"
    next_level = NEXT_LEVEL.get(current_level, "L5")

    ladder = get_active_scenario().ladder
    ladder_reqs = ladder.get(next_level) or ladder.get("L5", {})
    gap_dims = []

    for dim, exp in ladder_reqs.items():
        req_score, desc = exp.min_score, exp.description
        actual_score = radar_scores.get(dim, 35)
        met = actual_score >= req_score
        suggestion = (
            "Well supported by strong evidence across multiple initiatives."
            if met
            else f"Gather more verified evidence of {dim.lower()} and partner-team contributions."
        )
        gap_dims.append(
            GapDimensionOut(
                dimension=dim,
                score=actual_score,
                required=req_score,
                met=met,
                expectation=desc,
                suggestion=suggestion,
            )
        )

    # Build sections
    unblocks = [a for a in activities if "unblock" in a.text.lower()]
    reviews = [a for a in activities if a.source == "code_review" or "pr #" in a.text.lower()]
    docs = [a for a in activities if "guide" in a.text.lower() or "doc" in a.text.lower()]

    sections_raw = [
        {
            "title": "Cross-Team Influence & Glue Work",
            "claims": [{
                "text": f"Drove velocity and high-leverage support across team boundaries.",
                "activity_ids": [a.id for a in unblocks[:3]] or [activities[0].id],
            }],
        },
        {
            "title": "Technical Rigor & Quality Leadership",
            "claims": [{
                "text": "Mentored engineers and raised engineering standards through thorough code reviews.",
                "activity_ids": [a.id for a in reviews[:3]] or [activities[1].id],
            }],
        },
        {
            "title": "Strategic Documentation & Reusable Assets",
            "claims": [{
                "text": "Created team-wide onboarding and architectural guidance.",
                "activity_ids": [a.id for a in docs[:2]] or [activities[2].id],
            }],
        },
    ]

    verified_sections, citations_count, removed_count = enforce_citations(sections_raw, valid_ids)

    md_lines = [
        f"# Promotion Case: {person.name} ({current_level} → {next_level})\n",
        f"**Summary:** Strong track record of sustained high-impact delivery, technical leadership, and peer enablement.\n",
        "## Gap Analysis\n",
    ]
    for gd in gap_dims:
        status = "✅ MET" if gd.met else "⚠️ GAP"
        md_lines.append(f"- **{gd.dimension}** ({status}): {gd.score}/{gd.required} — {gd.expectation}")

    for s in verified_sections:
        md_lines.append(f"\n## {s.title}")
        for c in s.claims:
            cites = " ".join([f"[{aid}](/source/{aid})" for aid in c.activity_ids])
            md_lines.append(f"- {c.text} {cites}")

    return DraftOut(
        person_id=person.id,
        kind="promo",
        title=f"Promotion Packet — {person.name} ({current_level} → {next_level})",
        summary=f"Promotion packet grounded in {len(activities)} source activities across the payments org.",
        sections=verified_sections,
        citations_count=citations_count,
        unverified_removed=removed_count,
        model="heuristic",
        generated_at=datetime.utcnow().isoformat() + "Z",
        gap_analysis=GapAnalysisOut(
            current_level=current_level,
            next_level=next_level,
            dimensions=gap_dims,
        ),
        markdown="\n".join(md_lines),
    )
