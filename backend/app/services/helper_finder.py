"""Who can unblock me? — route a question to the right teammate without burning out the usual hero.

Gemini interprets, code calculates:
  * Gemini (optional) only expands the question into technical search terms.
  * Ranking is deterministic:
        relevance  = IDF-weighted overlap between the question and each teammate's past help (0..1)
        load_ratio = help they've given / team median help
        Burnout protection: if anyone qualified is not overloaded, they're suggested first.
        Overloaded people are moved to the end of the list, never hidden.
"""
from __future__ import annotations

import math
import re
import statistics
from collections import Counter
from typing import Any

from app.core.constants import Category
from app.gemini.client import generate_structured
from app.ingestion.pii import strip_pii
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.collab import HelperFinderOut, HelperSuggestionOut
from app.services.collab_common import activity_out, person_out

GLUE = set(Category.GLUE_WORK)
TOP_EVIDENCE_PER_PERSON = 3
MAX_SUGGESTIONS = 5
MIN_RELEVANCE = 0.3  # below this (vs. the best match) it's a coincidental word overlap

# Load thresholds (help given relative to team median); busy people get a mild penalty
BUSY_RATIO = 1.5
OVERLOADED_RATIO = 3.0
LOAD_FACTOR = {"ok": 1.0, "busy": 0.8, "overloaded": 0.5}

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "has", "had", "you", "your", "are",
    "was", "were", "but", "not", "can", "cant", "could", "would", "should", "how", "what", "why",
    "when", "where", "who", "does", "doing", "did", "into", "out", "our", "its", "it's", "all", "any",
    "get", "got", "getting", "keep", "keeps", "kept", "just", "like", "need", "needs", "help", "stuck",
    "anyone", "someone", "know", "idea", "ideas", "please", "thanks", "about", "after", "before",
    "there", "their", "then", "than", "them", "they", "will", "also", "some", "one", "two", "use",
    "using", "used", "way", "make", "made", "still", "very", "really", "here", "being", "been", "too",
    "i'm", "im", "me", "my", "we", "us", "is", "am", "be", "to", "of", "in", "on", "at", "it", "a",
    "an", "or", "if", "so", "do", "up", "no", "yes", "first", "new", "again", "every", "each",
    "maybe", "probably", "think", "seems", "issue", "problem", "thing", "things", "work", "working",
}

TERMS_SCHEMA: dict[str, Any] = {
    "title": "helper_terms",
    "type": "object",
    "properties": {"terms": {"type": "array", "items": {"type": "string"}}},
    "required": ["terms"],
}


def _stem(tok: str) -> str:
    if len(tok) > 4 and tok.endswith("ies"):
        return tok[:-3] + "y"  # retries -> retry
    for suf in ("ing", "ed", "es", "s"):
        if len(tok) > len(suf) + 3 and tok.endswith(suf):
            return tok[: -len(suf)]
    return tok


def tokenize(text: str) -> set[str]:
    raw = re.findall(r"[a-z0-9_]+", text.lower())
    return {_stem(t) for t in raw if len(t) >= 3 and t not in STOPWORDS and not t.isdigit()}


def expand_terms(question: str, use_llm: bool = True) -> tuple[list[str], str]:
    """Question -> search terms. Gemini may add synonyms; the literal question words are always kept."""
    base = tokenize(question)
    model = "heuristic"
    if use_llm:
        prompt = (
            "Extract up to 8 short technical search keywords (single words, lowercase) that an engineer "
            "who has solved this problem before would likely have used. Include close synonyms.\n"
            f'Problem: "{strip_pii(question)}"'
        )
        result, model = generate_structured(prompt, TERMS_SCHEMA)
        if result:
            for t in result.get("terms", [])[:8]:
                base |= tokenize(str(t))
    return sorted(base), model


def _load_status(ratio: float) -> str:
    if ratio >= OVERLOADED_RATIO:
        return "overloaded"
    if ratio >= BUSY_RATIO:
        return "busy"
    return "ok"


def find_helpers(
    asker: Person,
    question: str,
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
    help_given: dict[str, int],
    use_llm: bool = True,
) -> HelperFinderOut:
    terms, model = expand_terms(question, use_llm=use_llm)
    term_set = set(terms)

    # IDF over every activity so rare, specific words ("kafka", "dlq") outweigh common ones ("test")
    tokenized = {a.id: tokenize(a.text) for a in activities}
    df: Counter[str] = Counter()
    for toks in tokenized.values():
        df.update(toks)
    n_docs = max(1, len(activities))
    idf = {t: math.log((1 + n_docs) / (1 + df[t])) + 1.0 for t in term_set}

    candidates = {p.id: p for p in people if p.id != asker.id and p.opted_in}

    # Score each candidate's past glue work against the question
    per_person: dict[str, list[tuple[float, Activity, set[str]]]] = {pid: [] for pid in candidates}
    for a in activities:
        if a.actor_id not in candidates:
            continue
        clf = classifications.get(a.id)
        if not clf or clf.category not in GLUE:
            continue
        hit = term_set & tokenized[a.id]
        if hit:
            per_person[a.actor_id].append((sum(idf[t] for t in hit), a, hit))

    raw: dict[str, float] = {}
    for pid, rows in per_person.items():
        rows.sort(key=lambda r: r[0], reverse=True)
        raw[pid] = sum(r[0] for r in rows[:TOP_EVIDENCE_PER_PERSON])

    top_raw = max(raw.values(), default=0.0)
    team_counts = [help_given.get(pid, 0) for pid in [p.id for p in people]]
    median_help = statistics.median(team_counts) if team_counts else 1
    median_help = median_help or 1

    scored: list[dict[str, Any]] = []
    for pid, r in raw.items():
        if r <= 0:
            continue
        relevance = round(r / top_raw, 2)
        if relevance < MIN_RELEVANCE:
            continue  # a single generic word in common isn't "has solved this before"
        ratio = round(help_given.get(pid, 0) / median_help, 1)
        status = _load_status(ratio)
        scored.append({
            "pid": pid,
            "relevance": relevance,
            "ratio": ratio,
            "status": status,
            "score": round(relevance * LOAD_FACTOR[status], 3),
        })

    # Burnout protection: anyone qualified who is NOT overloaded goes first; overloaded heroes go last
    by_relevance = sorted(scored, key=lambda s: s["relevance"], reverse=True)
    ranked = sorted(
        scored,
        key=lambda s: (s["status"] != "overloaded", s["score"], s["relevance"]),
        reverse=True,
    )[:MAX_SUGGESTIONS]

    # Who did we deliberately move down the list to protect their time?
    protected: list[str] = []
    if by_relevance and ranked and by_relevance[0]["pid"] != ranked[0]["pid"]:
        top = by_relevance[0]
        protected.append(
            f"{candidates[top['pid']].first_name} is the strongest match but is {top['status']} "
            f"({top['ratio']}× the team's median help), so we suggest "
            f"{candidates[ranked[0]['pid']].first_name} first."
        )

    bus_factor_warning = None
    if len(scored) == 1:
        who = candidates[scored[0]["pid"]].first_name
        bus_factor_warning = (
            f"Only {who} has solved this kind of problem before — that's a knowledge silo. "
            f"Once you're unblocked, consider asking {who} to turn the answer into a runbook."
        )

    suggestions: list[HelperSuggestionOut] = []
    for i, s in enumerate(ranked, start=1):
        p = candidates[s["pid"]]
        rows = per_person[s["pid"]][:TOP_EVIDENCE_PER_PERSON]
        matched = sorted({t for _, _, hit in rows for t in hit})
        evidence = [activity_out(a, classifications[a.id].category) for _, a, _ in rows]
        load_txt = {
            "ok": "has capacity",
            "busy": f"is busy ({s['ratio']}× team median help)",
            "overloaded": f"is overloaded ({s['ratio']}× team median help)",
        }[s["status"]]
        reason = (
            f"Solved {len(per_person[s['pid']])} similar issue"
            f"{'s' if len(per_person[s['pid']]) != 1 else ''} before "
            f"(matched: {', '.join(matched[:4])}) and {load_txt}."
        )
        ref = f" ({evidence[0].id})" if evidence else ""
        ask = (
            f"Hi {p.first_name}! I'm stuck on: \"{question.strip()}\". I saw you handled something "
            f"similar before{ref} — could you point me in the right direction when you have a moment? 🙏"
        )
        suggestions.append(HelperSuggestionOut(
            person=person_out(p),
            rank=i,
            relevance=s["relevance"],
            load_ratio=s["ratio"],
            load_status=s["status"],
            score=s["score"],
            matched_terms=matched,
            evidence=evidence,
            reason=reason,
            ask_message=ask,
        ))

    return HelperFinderOut(
        question=question,
        terms=terms,
        suggestions=suggestions,
        protected=protected,
        bus_factor_warning=bus_factor_warning,
        model=model,
    )
