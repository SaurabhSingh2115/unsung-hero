# Detects ideas presented by someone other than the author
"""Ghost-credit detection: an idea first proposed by A shows up later in B's doc or launch, without crediting A.

Deterministic, no AI:
  1. Ideas      = activities the classifier flagged as proposals ("Idea:", "what if we...").
  2. Echoes     = projects owned by someone else, started on/after the idea, whose doc shares many of the
                  idea's distinctive words (IDF-weighted overlap).
  3. Attribution check = the doc, or any later message about the idea, mentions the original author -> no flag.
     We'd rather miss a case than wrongly accuse someone.
  4. Credit signals = later messages that credit the doc owner for the idea (e.g. "Love the proposal, Arjun").
"""
from __future__ import annotations

import re
from typing import Any

from app.metrics.text_match import surface_tokens, tokenize, words
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.models.project import Project

PROPOSAL_RE = re.compile(r"\b(idea:|proposal:|what if we|suggest we|how about we)", re.I)
MIN_SHARED = 4  # distinctive words the idea and the doc must share
MIN_COVERAGE = 0.3  # ...and at least this share of the idea's words
SIGNAL_MIN_SHARED = 2


def _person_names(p: Person) -> set[str]:
    out = words(p.name) | {p.id.lower()}
    for alias in p.aliases or []:
        out |= words(alias)
    return out


def _mentions(text: str, names: set[str]) -> bool:
    return bool(words(text) & names)


def detect_ghost_credit(
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
    projects: list[Project],
) -> list[dict[str, Any]]:
    by_id = {p.id: p for p in people}
    names = {p.id: _person_names(p) for p in people}
    all_names: set[str] = set().union(*names.values()) if names else set()

    findings: list[dict[str, Any]] = []
    for idea in sorted(activities, key=lambda a: a.timestamp):
        if idea.actor_id not in by_id:
            continue
        clf = classifications.get(idea.id)
        if not ((clf and clf.is_proposal) or PROPOSAL_RE.search(idea.text or "")):
            continue
        idea_toks = tokenize(idea.text) - all_names
        if len(idea_toks) < MIN_SHARED:
            continue
        author = by_id[idea.actor_id]

        for pr in projects:
            owner_ids = [o for o in (pr.owner_ids or []) if o in by_id]
            if not owner_ids or author.id in owner_ids:
                continue
            if pr.start and pr.start < idea.timestamp.date():
                continue  # doc existed before the idea
            doc = f"{pr.name}\n{pr.doc_text or ''}"
            shared = idea_toks & tokenize(doc)
            if len(shared) < MIN_SHARED or len(shared) / len(idea_toks) < MIN_COVERAGE:
                continue
            if _mentions(doc, names[author.id]):
                continue  # the doc credits the author

            later = [
                a for a in activities
                if a.timestamp > idea.timestamp and a.actor_id != author.id
                and len(idea_toks & tokenize(a.text)) >= SIGNAL_MIN_SHARED
            ]
            if any(_mentions(a.text, names[author.id]) for a in later):
                continue  # someone credited the author in a later message

            owner_names: set[str] = set().union(*(names[o] for o in owner_ids))
            signals = [a for a in later if a.actor_id not in owner_ids and _mentions(a.text, owner_names)]
            surface = surface_tokens(idea.text)  # insertion order = order of appearance in the idea
            findings.append({
                "idea": idea,
                "author": author,
                "owners": [by_id[o] for o in owner_ids],
                "project": pr,
                "shared_terms": [surf for st, surf in surface.items() if st in shared],
                "coverage": round(len(shared) / len(idea_toks), 2),
                "signals": signals,
            })
    return findings
