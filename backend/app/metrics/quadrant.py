"""Compute Impact vs Effort quadrant points with project complexity as bubble size."""
from typing import Any
from app.models.activity import Activity
from app.models.person import Person
from app.models.project import Project


def compute_quadrant(
    person: Person,
    projects: list[Project],
    activities: list[Activity],
    hidden_ids: set[str],
) -> list[dict[str, Any]]:
    points = []
    for proj in projects:
        proj_acts = [
            a.id for a in activities
            if a.actor_id == person.id and a.project_id == proj.id and a.id not in hidden_ids
        ]
        is_owner = person.id in (proj.owner_ids or [])
        effort = len(proj_acts)

        if effort == 0 and not is_owner:
            continue

        role = "owner" if is_owner else ("enabler" if effort >= 3 else "contributor")

        points.append({
            "project_id": proj.id,
            "project_name": proj.name,
            "impact": proj.impact_score,
            "effort": max(1, effort),
            "complexity": proj.complexity,
            "role": role,
            "activity_ids": proj_acts[:10],
        })

    return points
