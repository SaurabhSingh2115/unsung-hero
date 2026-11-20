"""Review Language Bias & Evidence Lens.

Audits a manager's performance review text for two common GRAD / calibration pitfalls:
1. Communal / vague-praise framing ("helpful", "supportive", "team player") without concrete impact.
2. Uncited claims (assertions lacking [A-...] source activity IDs).

Pure deterministic detection + evidence-grounded rewrite suggestions using the person's real activities.
"""
from __future__ import annotations

import re

from app.core.constants import Category
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.differentiators import BiasFindingOut, ReviewBiasCheckOut
from app.services.collab_common import snippet

COMMUNAL_PATTERNS: list[tuple[str, str]] = [
    (r"\bhelpful\b", "helpful"),
    (r"\bsupportive\b", "supportive"),
    (r"\bteam player\b", "team player"),
    (r"\balways willing to\b", "always willing to"),
    (r"\bnice\b", "nice"),
    (r"\bfriendly\b", "friendly"),
    (r"\bgoes above and beyond\b", "goes above and beyond"),
    (r"\bcollaborative\b", "collaborative"),
    (r"\bpassionate\b", "passionate"),
    (r"\bhardworking\b", "hardworking"),
]

CITE_RE = re.compile(r"\[(A-[A-Za-z0-9-]+)\]")
GLUE = set(Category.GLUE_WORK)


def _split_lines(text: str) -> list[str]:
    """Extract meaningful bullet/sentence lines (skip markdown headings and metadata lines)."""
    lines: list[str] = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s or s.startswith("#") or s.startswith("**Employee:**"):
            continue
        s = re.sub(r"^[-*•]\s+", "", s)
        s = re.sub(r"^\*\*Summary:\*\*\s*", "", s)
        if len(s) >= 20:
            lines.append(s)
    return lines


def _best_evidence(
    line: str,
    activities: list[Activity],
    classifications: dict[str, Classification],
) -> list[Activity]:
    """Pick up to 2 real activities that best ground this sentence."""
    words = {w for w in re.findall(r"[a-z0-9]{4,}", line.lower())}
    glue_acts = [
        a for a in activities
        if (clf := classifications.get(a.id)) and clf.category in GLUE
    ] or list(activities)

    scored = []
    for a in glue_acts:
        a_words = {w for w in re.findall(r"[a-z0-9]{4,}", (a.text or "").lower())}
        overlap = len(words & a_words)
        scored.append((overlap, a.timestamp, a))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [a for _, _, a in scored[:2]]


def check_review_bias(
    person: Person,
    text: str,
    activities: list[Activity],
    classifications: dict[str, Classification],
) -> ReviewBiasCheckOut:
    lines = _split_lines(text)
    valid_ids = {a.id for a in activities}

    cited_count = 0
    uncited_count = 0
    communal_count = 0
    findings: list[BiasFindingOut] = []

    for line in lines:
        cites = [c for c in CITE_RE.findall(line) if c in valid_ids]
        matched_communal = [label for pat, label in COMMUNAL_PATTERNS if re.search(pat, line, re.I)]

        if cites:
            cited_count += 1

        if matched_communal:
            communal_count += 1
            ev = _best_evidence(line, activities, classifications)
            ev_ids = [a.id for a in ev]
            ex = snippet(ev[0].text, 85) if ev else "key cross-team deliverables"
            cites_str = " ".join(f"[{aid}]" for aid in ev_ids)
            findings.append(
                BiasFindingOut(
                    original=line,
                    issue_type="communal_framing",
                    matched_terms=matched_communal,
                    explanation=(
                        f"Uses soft/communal phrasing ({', '.join(matched_communal)}) that calibration "
                        "committees often discount for promotion. Frame it as concrete, measurable impact."
                    ),
                    suggested_rewrite=(
                        f"{person.first_name} unblocked critical team execution — e.g., \"{ex}\" {cites_str}"
                    ).strip(),
                    activity_ids=ev_ids,
                )
            )
        elif not cites:
            uncited_count += 1
            ev = _best_evidence(line, activities, classifications)
            ev_ids = [a.id for a in ev]
            ex = snippet(ev[0].text, 85) if ev else "verified team work"
            cites_str = " ".join(f"[{aid}]" for aid in ev_ids)
            findings.append(
                BiasFindingOut(
                    original=line,
                    issue_type="uncited_claim",
                    matched_terms=[],
                    explanation=(
                        "Claim has no linked evidence ID. In GRAD/calibration, uncited praise is "
                        "treated as opinion rather than verified impact."
                    ),
                    suggested_rewrite=(
                        f"{re.sub(r'[.]+$', '', line)} — backed by \"{ex}\" {cites_str}"
                    ).strip(),
                    activity_ids=ev_ids,
                )
            )

    if communal_count > 0:
        status = "bias_risk"
        summary = (
            f"Found {communal_count} communal-framing phrase(s) and {uncited_count} uncited claim(s). "
            "Replace soft adjectives with impact-focused, cited bullets before calibration."
        )
    elif uncited_count > 0:
        status = "needs_evidence"
        summary = (
            f"{cited_count} claim(s) are cited, but {uncited_count} lack source IDs. "
            "Attach the suggested evidence links so every point holds up in calibration."
        )
    else:
        status = "strong"
        summary = (
            f"All {cited_count} claim(s) are evidence-cited and free of communal/vague-praise framing."
        )

    return ReviewBiasCheckOut(
        person_id=person.id,
        overall_status=status,
        cited_count=cited_count,
        uncited_count=uncited_count,
        communal_count=communal_count,
        findings=findings,
        summary=summary,
    )
