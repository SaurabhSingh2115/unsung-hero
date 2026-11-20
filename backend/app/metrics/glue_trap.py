"""Glue-trap early warning (after Tanya Reilly's talk "Being Glue").

Flags people whose recorded work is overwhelmingly glue work, sustained over several months and far above
the team median. That's the pattern that tends to get under-weighted at promo time.
Deterministic: monthly glue share from classified activities. No single score, no ranking.
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from typing import Any

from app.core.constants import Category, Role
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person

GLUE = set(Category.GLUE_WORK)
MIN_SHARE = 0.7  # >= 70% of recorded work is glue...
MEDIAN_MULTIPLE = 2.0  # ...at least 2x the team median...
MIN_HIGH_MONTHS = 2  # ...for at least 2 months
MIN_ACTS_PER_MONTH = 3
MIN_ACTS_TOTAL = 5


def detect_glue_trap(
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
    help_matrix: dict[str, Counter] | None = None,
) -> list[dict[str, Any]]:
    team_ids = {p.id for p in people}
    monthly: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    total: Counter[str] = Counter()
    glue: Counter[str] = Counter()
    for a in activities:
        if a.actor_id not in team_ids:
            continue
        clf = classifications.get(a.id)
        g = int(bool(clf and clf.category in GLUE))
        m = a.timestamp.strftime("%Y-%m")
        monthly[a.actor_id][m][0] += g
        monthly[a.actor_id][m][1] += 1
        glue[a.actor_id] += g
        total[a.actor_id] += 1

    shares = {pid: glue[pid] / total[pid] for pid in total if total[pid] >= MIN_ACTS_TOTAL}
    if not shares:
        return []
    median = statistics.median(shares.values())

    findings = []
    for p in people:
        s = shares.get(p.id)
        if s is None or p.role == Role.MANAGER:
            continue
        months = sorted(m for m, (_, t) in monthly[p.id].items() if t >= MIN_ACTS_PER_MONTH)
        trend = [(m, monthly[p.id][m][0] / monthly[p.id][m][1]) for m in months]
        high = [m for m, share in trend if share >= MIN_SHARE]
        if s < MIN_SHARE or s < MEDIAN_MULTIPLE * median or len(high) < MIN_HIGH_MONTHS:
            continue
        taught = [pid for pid, _ in (help_matrix or {}).get(p.id, Counter()).most_common(2)]
        findings.append({
            "person": p,
            "share": round(s, 2),
            "team_median": round(median, 2),
            "trend": [(m, round(v, 2)) for m, v in trend],
            "high_months": len(high),
            "core_items": total[p.id] - glue[p.id],
            "total_items": total[p.id],
            "taught": taught,
        })
    return findings
