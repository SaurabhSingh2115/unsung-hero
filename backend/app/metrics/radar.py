from typing import Any
from app.core.constants import Category, Dimension
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person

DIMENSIONS = list(Dimension.ALL)
DIM_MAP = {k: list(v) for k, v in Dimension.CATEGORY_MAP.items()}
BENCHMARKS = Dimension.BENCHMARKS


def compute_radar(
    person: Person,
    activities: list[Activity],
    classifications: dict[str, Classification],
    hidden_ids: set[str],
) -> list[dict[str, Any]]:
    # Tally counts by dimension
    dim_counts = {d: 0 for d in DIMENSIONS}
    dim_evidence = {d: [] for d in DIMENSIONS}

    for act in activities:
        if act.actor_id != person.id or act.id in hidden_ids:
            continue
        clf = classifications.get(act.id)
        cat = clf.category if clf else "core"

        for dim, cats in DIM_MAP.items():
            if cat in cats:
                dim_counts[dim] += 1
                dim_evidence[dim].append(act.id)

    # Normalize to 0..100 based on realistic benchmarks
    # For Priya: high Collaboration, Knowledge, Quality, Leadership
    # For Arjun: high Impact, moderate Collaboration
    results = []
    for dim in DIMENSIONS:
        cnt = dim_counts[dim]
        bm = BENCHMARKS.get(dim, 15)
        # Baseline score scales with count, maxes at 95
        score = min(95, max(15, int((cnt / bm) * 60) + (20 if cnt > 0 else 0)))
        results.append({
            "dimension": dim,
            "score": score,
            "evidence_count": cnt,
            "explanation": f"Grounded in {cnt} verified {dim.lower()} activities this quarter.",
        })

    return results
