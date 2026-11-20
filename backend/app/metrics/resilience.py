"""Leave simulator — what breaks if one teammate is out? (bus factor, made concrete)

Pure graph math over the consented help graph, no AI:
  * dependency  = help R received from X / all help R received
  * load shift  = X's help to R is re-routed to R's *other* past helpers, in proportion to how much
                  each has helped R before. If R has no other helper, R is "stranded".
  * no backup   = X's help items that no one else on the team has ever covered (IDF word overlap)
  * apprentices = teammates who received those explanations from X: the natural successors
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from typing import Any

from app.core.constants import Category
from app.metrics.text_match import Idf, tokenize
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person

GLUE = set(Category.GLUE_WORK)
BUSY_RATIO = 1.5
OVERLOADED_RATIO = 3.0
COVER_MIN_SHARED = 2  # another teammate's help must share >= 2 distinctive words...
COVER_MIN_WEIGHT = 8.0  # ...with enough combined IDF weight to count as "someone else knows this"
MIN_KNOWLEDGE_WORDS = 4  # "LGTM 👍" isn't knowledge
MAX_ITEMS = 6


def load_status(ratio: float) -> str:
    if ratio >= OVERLOADED_RATIO:
        return "overloaded"
    if ratio >= BUSY_RATIO:
        return "busy"
    return "ok"


def is_glue(a: Activity, classifications: dict[str, Classification]) -> bool:
    clf = classifications.get(a.id)
    return bool(clf and clf.category in GLUE)


def help_matrix(
    team_ids: set[str],
    activities: list[Activity],
    classifications: dict[str, Classification],
) -> dict[str, Counter]:
    """helper -> Counter(receiver -> number of glue-work activities aimed at them)."""
    H: dict[str, Counter] = defaultdict(Counter)
    for a in activities:
        if a.actor_id not in team_ids or not is_glue(a, classifications):
            continue
        for t in a.target_ids or []:
            if t != a.actor_id and t in team_ids:
                H[a.actor_id][t] += 1
    return H


def simulate_absence(
    absent: Person,
    people: list[Person],
    activities: list[Activity],
    classifications: dict[str, Classification],
) -> dict[str, Any]:
    by_id = {p.id: p for p in people}
    team_ids = set(by_id)
    first = absent.first_name
    H = help_matrix(team_ids, activities, classifications)

    help_given = {pid: sum(H[pid].values()) for pid in team_ids}
    total_help = sum(help_given.values()) or 1
    absent_help = help_given.get(absent.id, 0)
    received: Counter[str] = Counter()
    for row in H.values():
        received.update(row)

    def other_helpers(r: str) -> dict[str, int]:
        return {h: H[h][r] for h in team_ids if h not in (absent.id, r) and H[h][r] > 0}

    # 1) Who loses support
    affected = []
    for r, c in H[absent.id].items():
        others = other_helpers(r)
        affected.append({
            "pid": r,
            "help_from_absent": c,
            "total_help_received": received[r],
            "dependency": round(c / received[r], 2) if received[r] else 0.0,
            "other_helpers": sorted(others, key=lambda h: others[h], reverse=True),
            "stranded": not others,
        })
    affected.sort(key=lambda x: (x["dependency"], x["help_from_absent"]), reverse=True)

    # 2) Who absorbs the load (re-route to each receiver's other past helpers)
    absorbed: Counter[str] = Counter()
    for r, c in H[absent.id].items():
        others = other_helpers(r)
        tot = sum(others.values())
        for h, w in others.items():
            absorbed[h] += c * w / tot
    remaining = [pid for pid in team_ids if pid != absent.id]
    median = statistics.median([help_given[p] for p in remaining]) if remaining else 1
    median = median or 1
    load_shift = []
    for pid in remaining:
        before, add = help_given[pid], absorbed[pid]
        if before == 0 and add == 0:
            continue
        after = before + add
        load_shift.append({
            "pid": pid,
            "before": before,
            "after": round(after, 1),
            "absorbed": round(add, 1),
            "before_ratio": round(before / median, 1),
            "after_ratio": round(after / median, 1),
            "status_before": load_status(before / median),
            "status_after": load_status(after / median),
        })
    load_shift.sort(key=lambda s: s["after"], reverse=True)

    # 3) Knowledge only the absent person has shared
    idf = Idf(a.text for a in activities)
    mine = [
        a for a in activities
        if a.actor_id == absent.id and is_glue(a, classifications) and len(tokenize(a.text)) >= MIN_KNOWLEDGE_WORDS
    ]
    others_tok = [
        tokenize(a.text) for a in activities
        if a.actor_id in team_ids and a.actor_id != absent.id and is_glue(a, classifications)
    ]
    orphaned: list[Activity] = []
    for a in mine:
        toks = tokenize(a.text)
        covered = any(
            len(shared := toks & bt) >= COVER_MIN_SHARED and idf.weight(shared) >= COVER_MIN_WEIGHT
            for bt in others_tok
        )
        if not covered:
            orphaned.append(a)
    by_cat = Counter(classifications[a.id].category for a in orphaned)
    solo_incidents = {
        (a.raw or {}).get("thread_id") or a.id
        for a in orphaned if classifications[a.id].category == Category.FIREFIGHTING
    }

    learners: dict[str, list[Activity]] = defaultdict(list)
    for a in orphaned:
        for t in a.target_ids or []:
            if t in team_ids and t != absent.id:
                learners[t].append(a)
    apprentices = sorted(
        (
            {
                "pid": pid,
                "items": len(items),
                "categories": dict(Counter(classifications[a.id].category for a in items).most_common()),
                "example_ids": [a.id for a in sorted(items, key=lambda a: a.timestamp, reverse=True)[:2]],
            }
            for pid, items in learners.items()
        ),
        key=lambda x: x["items"],
        reverse=True,
    )
    examples = sorted(orphaned, key=lambda a: (bool(a.target_ids), a.timestamp), reverse=True)[:MAX_ITEMS]

    # 4) Plain-language plan
    share = absent_help / total_help
    recs: list[str] = []
    newly_over = [s for s in load_shift if s["status_after"] == "overloaded" and s["status_before"] != "overloaded"]
    if newly_over:
        s = newly_over[0]
        co = [
            by_id[x["pid"]].first_name for x in load_shift
            if x["absorbed"] > 0 and x["status_after"] != "overloaded"
        ][:2]
        share_txt = f" Share it with {' and '.join(co)}, who already help the same people." if co else ""
        recs.append(
            f"Don't let coverage land on {by_id[s['pid']].first_name} alone: re-routing {first}'s help would take "
            f"them from {s['before_ratio']}× to {s['after_ratio']}× the team median.{share_txt}"
        )
    for x in affected:
        if x["stranded"]:
            recs.append(f"{by_id[x['pid']].first_name} has no other helper on the team besides {first}. "
                        "Assign a buddy before the leave starts.")
    for ap in apprentices[:2]:
        name = by_id[ap["pid"]].first_name
        top = list(ap["categories"])[:2]
        mostly = " & ".join(Category.LABELS.get(c, c).lower() for c in top)
        if top and top[0] in (Category.ONBOARDING, Category.MENTORING):
            action = f"{name} is well placed to buddy the next new hire."
        else:
            action = f"Before the leave, have {first} walk {name} through them so {name} can take first-line questions."
        recs.append(f"Knowledge transfer: {name} already received {ap['items']} of {first}'s explanations "
                    f"(mostly {mostly}). {action}")
    if len(solo_incidents) >= 2:
        recs.append(f"{first} handled {len(solo_incidents)} incidents with no teammate covering. Add a secondary on-call.")

    return {
        "absent": absent,
        "headline": f"If {first} is out, {share:.0%} of the team's day-to-day help disappears.",
        "help_share_lost": round(share, 2),
        "team_help_total": total_help,
        "absent_help": absent_help,
        "people_affected": len(affected),
        "stranded": [by_id[x["pid"]].first_name for x in affected if x["stranded"]],
        "orphaned": orphaned,
        "orphaned_by_category": dict(by_cat),
        "solo_incidents": len(solo_incidents),
        "examples": examples,
        "apprentices": apprentices,
        "affected": affected,
        "load_shift": load_shift,
        "median_help": median,
        "recommendations": recs,
    }
