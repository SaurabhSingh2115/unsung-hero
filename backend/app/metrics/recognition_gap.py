# Help given vs thanks received
"""Bias check: is help recognised equally across groups (e.g. remote vs office)?

Pure, deterministic aggregation; no AI involved.

For each group:
    thanks_per_help = thanks_received / help_given

Groups with fewer than ``min_group_size`` people are suppressed (numbers
hidden) so no individual can be re-identified from an aggregate.

A disparity is flagged using the "four-fifths rule": if a group's ratio is
below 80% of the best-recognised group's ratio, it is under-recognised.
"""
from typing import Any

DISPARITY_THRESHOLD = 0.8  # four-fifths rule


def compute_bias_check(
    nodes: list[dict[str, Any]],
    min_group_size: int,
    group_key: str = "location",
) -> dict[str, Any]:
    """Aggregate per-person help/thanks (from help_graph nodes) by ``group_key``."""
    buckets: dict[str, list[dict[str, Any]]] = {}
    for n in nodes:
        buckets.setdefault(n.get(group_key) or "unknown", []).append(n)

    groups: list[dict[str, Any]] = []
    for name in sorted(buckets):
        members = buckets[name]
        size = len(members)
        if size < min_group_size:
            groups.append({"group": name, "size": size, "suppressed": True})
            continue
        help_given = sum(m["help_given"] for m in members)
        thanks = sum(m["thanks_received"] for m in members)
        ratio = round(thanks / help_given, 2) if help_given else None
        groups.append({
            "group": name,
            "size": size,
            "suppressed": False,
            "help_given": help_given,
            "thanks_received": thanks,
            "thanks_per_help": ratio,
        })

    return {
        "min_group_size": min_group_size,
        "groups": groups,
        "note": _build_note(groups, min_group_size),
    }


def _build_note(groups: list[dict[str, Any]], min_group_size: int) -> str:
    comparable = [g for g in groups if not g["suppressed"] and g.get("thanks_per_help") is not None]
    if len(comparable) < 2:
        hidden = [g["group"] for g in groups if g["suppressed"]]
        hidden_txt = f" ({', '.join(hidden)} hidden)" if hidden else ""
        return (
            f"Not enough groups with at least {min_group_size} people to compare safely{hidden_txt}. "
            "Aggregates are withheld to protect individual privacy."
        )

    best = max(comparable, key=lambda g: g["thanks_per_help"])
    worst = min(comparable, key=lambda g: g["thanks_per_help"])
    if best["thanks_per_help"] == 0:
        return "No group is receiving recognition for the help it gives."

    rel = worst["thanks_per_help"] / best["thanks_per_help"]
    if rel < DISPARITY_THRESHOLD:
        pct = round((1 - rel) * 100)
        return (
            f"{worst['group'].capitalize()} employees receive {pct}% less thanks per unit of help "
            f"than {best['group']} peers (below the 80% fairness threshold)."
        )
    return "Recognition per unit of help is within the 80% fairness threshold across groups."
