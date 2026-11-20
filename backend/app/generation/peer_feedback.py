"""Peer Feedback Drafter — write perf-season peer feedback for a teammate from how they helped YOU.

Evidence = glue work the peer did that was aimed at the writer (unblocking, reviews, mentoring...).
Every claim must cite those activity IDs; uncited claims are dropped by enforce_citations().
The one "growth" suggestion is clearly opinion and is never presented as evidence.
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from typing import Any

from app.core.constants import Category
from app.gemini.client import generate_structured
from app.generation.citation_check import enforce_citations
from app.ingestion.pii import strip_pii
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.collab import PeerCandidateOut, PeerFeedbackOut
from app.services.collab_common import person_out, snippet

GLUE = set(Category.GLUE_WORK)
MAX_PROMPT_EVIDENCE = 25

SCHEMA: dict[str, Any] = {
    "title": "peer_feedback",
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
        "growth": {"type": "string"},
    },
    "required": ["title", "summary", "sections", "growth"],
}

IMPACT_CATS = ("unblocking", "firefighting", "review")
COLLAB_CATS = ("mentoring", "onboarding", "documentation")

CLAIM_TEMPLATES = {
    "unblocking": "{first} unblocked me {n} time{s}, e.g. \"{ex}\"",
    "firefighting": "{first} jumped in on incidents that affected my work {n} time{s}, e.g. \"{ex}\"",
    "review": "{first} reviewed my work {n} time{s} and caught real issues, e.g. \"{ex}\"",
    "mentoring": "{first} mentored me {n} time{s}, e.g. \"{ex}\"",
    "onboarding": "{first} helped me ramp up {n} time{s}, e.g. \"{ex}\"",
    "documentation": "{first} improved docs I own or rely on {n} time{s}, e.g. \"{ex}\"",
}


def help_received_by(
    writer_id: str,
    activities: list[Activity],
    classifications: dict[str, Classification],
    team_ids: set[str],
) -> dict[str, list[Activity]]:
    """actor_id -> glue-work activities that actor aimed at the writer."""
    out: dict[str, list[Activity]] = defaultdict(list)
    for a in activities:
        if a.actor_id == writer_id or a.actor_id not in team_ids:
            continue
        if writer_id not in (a.target_ids or []):
            continue
        clf = classifications.get(a.id)
        if clf and clf.category in GLUE:
            out[a.actor_id].append(a)
    return out


def list_peer_candidates(
    writer: Person,
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
) -> list[PeerCandidateOut]:
    by_id = {p.id: p for p in people}
    received = help_received_by(writer.id, activities, classifications, set(by_id))
    result = [
        PeerCandidateOut(
            peer=person_out(by_id[pid]),
            interactions=len(acts),
            categories=dict(Counter(classifications[a.id].category for a in acts)),
        )
        for pid, acts in received.items()
    ]
    result.sort(key=lambda c: c.interactions, reverse=True)
    return result


def _heuristic_draft(
    writer: Person,
    peer: Person,
    evidence: list[Activity],
    classifications: dict[str, Classification],
    peer_is_go_to: bool,
) -> dict[str, Any]:
    by_cat: dict[str, list[Activity]] = defaultdict(list)
    for a in evidence:
        by_cat[classifications[a.id].category].append(a)

    def claims_for(cats: tuple[str, ...]) -> list[dict[str, Any]]:
        claims = []
        for c in cats:
            acts = by_cat.get(c, [])
            if not acts:
                continue
            n = len(acts)
            claims.append({
                "text": CLAIM_TEMPLATES[c].format(
                    first=peer.first_name, n=n, s="" if n == 1 else "s", ex=snippet(acts[0].text)
                ),
                "activity_ids": [a.id for a in acts[:4]],
            })
        return claims

    sections = []
    impact = claims_for(IMPACT_CATS)
    if impact:
        sections.append({"title": "Impact on my work", "claims": impact})
    collab = claims_for(COLLAB_CATS)
    if collab:
        sections.append({"title": "Collaboration & knowledge sharing", "claims": collab})

    if peer_is_go_to:
        growth = (
            f"{peer.first_name} is the team's go-to person. I'd love to see them turn the fixes they share "
            "most often into runbooks or a short talk, so their impact scales and their time is protected."
        )
    else:
        growth = (
            f"I'd encourage {peer.first_name} to share this expertise more widely, e.g. a design-review "
            "slot or a short write-up, so more of the team benefits."
        )

    top = Counter(classifications[a.id].category for a in evidence).most_common(1)[0][0]
    return {
        "title": f"Peer feedback for {peer.name}",
        "summary": (
            f"{peer.first_name} helped me directly {len(evidence)} times this cycle, most often through "
            f"{Category.LABELS.get(top, top).lower()}. Every point below links to the original interaction."
        ),
        "sections": sections,
        "growth": growth,
    }


def build_peer_feedback(
    writer: Person,
    peer: Person,
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
    help_given: dict[str, int],
    use_llm: bool = True,
) -> PeerFeedbackOut:
    received = help_received_by(writer.id, activities, classifications, {p.id for p in people})
    evidence = sorted(received.get(peer.id, []), key=lambda a: a.timestamp, reverse=True)
    valid_ids = {a.id for a in evidence}

    counts = [help_given.get(p.id, 0) for p in people]
    median = (statistics.median(counts) if counts else 0) or 1
    peer_is_go_to = help_given.get(peer.id, 0) >= 2 * median

    result: dict[str, Any] | None = None
    model = "heuristic"
    if evidence and use_llm:
        lines = "\n".join(
            f"- [{a.id}] ({classifications[a.id].category}) {strip_pii(a.text)}"
            for a in evidence[:MAX_PROMPT_EVIDENCE]
        )
        prompt = (
            f"You are helping {writer.first_name} ({writer.title}) write PEER FEEDBACK for "
            f"{peer.first_name} ({peer.title}, {peer.level}) for a performance review.\n"
            f"Use ONLY these interactions where {peer.first_name} helped {writer.first_name}:\n{lines}\n\n"
            "Write in first person from the writer's perspective, specific and warm but factual.\n"
            "Sections: 'Impact on my work' and 'Collaboration & knowledge sharing'.\n"
            "Every claim MUST list the exact activity IDs it is based on in activity_ids.\n"
            "'growth' is ONE constructive suggestion, phrased as the writer's opinion."
        )
        result, model = generate_structured(prompt, SCHEMA)

    if not result:
        model = "heuristic"
        if evidence:
            result = _heuristic_draft(writer, peer, evidence, classifications, peer_is_go_to)
        else:
            result = {
                "title": f"Peer feedback for {peer.name}",
                "summary": f"No recorded interactions where {peer.first_name} helped you directly.",
                "sections": [],
                "growth": "",
            }

    sections, citations, removed = enforce_citations(result.get("sections", []), valid_ids)

    md = [f"# {result.get('title', 'Peer feedback')}\n", f"{result.get('summary', '')}\n"]
    for s in sections:
        md.append(f"\n## {s.title}")
        for c in s.claims:
            md.append(f"- {c.text} " + " ".join(f"[{aid}](/source/{aid})" for aid in c.activity_ids))
    if result.get("growth"):
        md.append(f"\n## One suggestion (my opinion)\n{result['growth']}")

    return PeerFeedbackOut(
        writer_id=writer.id,
        peer=person_out(peer),
        title=result.get("title", f"Peer feedback for {peer.name}"),
        summary=result.get("summary", ""),
        sections=sections,
        growth=result.get("growth", ""),
        citations_count=citations,
        unverified_removed=removed,
        evidence_count=len(evidence),
        model=model,
        markdown="\n".join(md),
    )
