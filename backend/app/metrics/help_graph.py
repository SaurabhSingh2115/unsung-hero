"""Pure deterministic graph metrics using NetworkX."""
from typing import Any
import networkx as nx

from app.core.constants import Category
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.models.recognition import Recognition

HELP_CATEGORIES = set(Category.GLUE_WORK)


def build_team_graph_data(
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
    recognitions: list[Recognition],
    hidden_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    hidden = hidden_ids or set()
    di_g = nx.DiGraph()
    un_g = nx.Graph()

    for p in people:
        di_g.add_node(p.id)
        un_g.add_node(p.id)

    # Track help edge weights & category counts
    edge_weights: dict[tuple[str, str], int] = {}
    edge_categories: dict[tuple[str, str], dict[str, int]] = {}
    glue_count: dict[str, int] = {p.id: 0 for p in people}
    help_count: dict[str, int] = {p.id: 0 for p in people}
    total_acts: dict[str, int] = {p.id: 0 for p in people}

    for act in activities:
        if act.id in hidden:
            continue
        actor = act.actor_id
        if actor not in glue_count:
            continue
        total_acts[actor] += 1
        clf = classifications.get(act.id)
        cat = clf.category if clf else "core"

        if cat in HELP_CATEGORIES:
            glue_count[actor] += 1
            for target in act.target_ids:
                if target == actor or not any(p.id == target for p in people):
                    continue
                help_count[actor] += 1
                key = (actor, target)
                edge_weights[key] = edge_weights.get(key, 0) + 1
                if key not in edge_categories:
                    edge_categories[key] = {}
                edge_categories[key][cat] = edge_categories[key].get(cat, 0) + 1
                di_g.add_edge(actor, target)
                un_g.add_edge(actor, target)

    # Thanks counts
    thanks_received: dict[str, int] = {p.id: 0 for p in people}
    for rec in recognitions:
        if rec.to_id in thanks_received:
            thanks_received[rec.to_id] += 1

    # Betweenness centrality (bridge score) on undirected collaboration graph
    betweenness = nx.betweenness_centrality(un_g) if un_g.number_of_nodes() > 0 else {}

    # Team median help given and thanks received
    import statistics
    med_help = statistics.median(help_count.values()) if help_count else 1
    med_thanks = statistics.median(thanks_received.values()) if thanks_received else 1
    if med_help == 0:
        med_help = 1
    if med_thanks == 0:
        med_thanks = 1

    nodes = []
    for p in people:
        hg = help_count[p.id]
        tr = thanks_received[p.id]
        tot = total_acts[p.id] or 1
        glue_share = round(glue_count[p.id] / tot, 2)

        # Recognition gap: relative help given minus relative thanks received
        # Higher positive value = significantly under-recognised
        gap = round((hg / med_help) - (tr / med_thanks), 2)
        unack_pct = round(max(0.0, min(1.0, (hg - tr) / hg)), 2) if hg > 0 else 0.0

        nodes.append({
            "id": p.id,
            "name": p.name,
            "title": p.title,
            "discipline": p.discipline,
            "location": p.location,
            "glue_work": glue_count[p.id],
            "glue_share": glue_share,
            "help_given": hg,
            "thanks_received": tr,
            "unacknowledged_pct": unack_pct,
            "recognition_gap": gap,
            "bridge_score": round(betweenness.get(p.id, 0.0), 3),
        })

    links = []
    for (src, tgt), w in edge_weights.items():
        links.append({
            "source": src,
            "target": tgt,
            "weight": w,
            "categories": edge_categories.get((src, tgt), {}),
        })

    return nodes, links
