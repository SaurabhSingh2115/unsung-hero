"""Build manager alerts. Every alert is computed from the data (no canned text):

  recognition gap  - help given vs thanks received (help_graph)
  glue trap        - sustained, team-relative glue share (metrics/glue_trap)
  bus factor       - leave simulation for anyone carrying a large share of team help (metrics/resilience)
  ghost credit     - an idea later presented by someone else without attribution (enrichment/ghost_credit)
  load imbalance   - top helper vs team median
"""
import calendar
import statistics

from sqlalchemy.orm import Session

from app.core.constants import AlertType, Category, Role
from app.enrichment.ghost_credit import detect_ghost_credit
from app.metrics.glue_trap import detect_glue_trap
from app.metrics.resilience import OVERLOADED_RATIO, help_matrix, simulate_absence
from app.models.activity import Activity
from app.models.annotation import Annotation
from app.models.classification import Classification
from app.models.person import Person
from app.models.project import Project
from app.schemas.graph import AlertOut
from app.services.collab_common import snippet

BUS_FACTOR_SHARE = 0.3  # simulate leave for anyone carrying >= 30% of the team's help
SOURCE_PHRASE = {"chat": "in chat", "doc_comment": "in a doc comment", "code_review": "in a code review"}


def _month(m: str) -> str:
    return calendar.month_abbr[int(m.split("-")[1])]


def get_team_alerts(
    db: Session,
    people: list[Person],
    nodes: list[dict],
    activities: list[Activity],
) -> list[AlertOut]:
    alerts: list[AlertOut] = []
    classifications = {c.activity_id: c for c in db.query(Classification).all()}
    hidden = {a.activity_id for a in db.query(Annotation).filter(Annotation.hidden.is_(True)).all()}
    visible = [a for a in activities if a.id not in hidden]  # respect employees' privacy choices
    projects = db.query(Project).all()
    by_id = {p.id: p for p in people}
    team_ids = set(by_id)

    # 1. Recognition gap: people giving far more help than typical, most of it never thanked
    help_counts = [n["help_given"] for n in nodes]
    gap_floor = max(5, 2 * statistics.median(help_counts)) if help_counts else 5
    for n in nodes:
        person = by_id.get(n["id"])
        if person is None or person.role == Role.MANAGER:
            continue
        if n["unacknowledged_pct"] >= 0.6 and n["help_given"] >= gap_floor:
            pct = int(n["unacknowledged_pct"] * 100)
            rec_gap_ev = [
                act.id for act in visible
                if act.actor_id == n["id"]
                and (clf := classifications.get(act.id))
                and clf.category in (Category.UNBLOCKING, Category.MENTORING)
            ][:8]
            alerts.append(AlertOut(
                id=f"alert-rec-gap-{n['id']}",
                type=AlertType.RECOGNITION_GAP,
                severity="high",
                title=f"{pct}% of {n['name']}'s help went unacknowledged",
                detail=f"{n['name']} gave help {n['help_given']} times across the team but received only "
                       f"{n['thanks_received']} formal thanks.",
                person_ids=[n["id"]],
                evidence_ids=rec_gap_ev,
            ))

    H = help_matrix(team_ids, visible, classifications)
    help_given = {pid: sum(H[pid].values()) for pid in team_ids}
    total_help = sum(help_given.values()) or 1

    # 2. Glue trap
    for f in detect_glue_trap(people, visible, classifications, H):
        p = f["person"]
        trend = " → ".join(f"{_month(m)} {v:.0%}" for m, v in f["trend"])
        glue_ev = [
            a.id for a in visible
            if a.actor_id == p.id and (clf := classifications.get(a.id)) and clf.category in Category.GLUE_WORK
        ][:8]
        alerts.append(AlertOut(
            id=f"alert-glue-trap-{p.id}",
            type=AlertType.GLUE_TRAP,
            severity="high",
            title=f"Glue-trap risk: {f['share']:.0%} of {p.first_name}'s work is glue "
                  f"(team median {f['team_median']:.0%})",
            detail=f"Sustained for {f['high_months']} months ({trend}). Only {f['core_items']} of "
                   f"{p.first_name}'s {f['total_items']} recorded items are core delivery. Promo committees tend "
                   f"to under-weight glue work without visible technical ownership. Suggest giving {p.first_name} "
                   "a visible technical project, and growing other go-to people (see Leave simulator) so the "
                   "glue work is shared.",
            person_ids=[p.id],
            evidence_ids=glue_ev,
        ))

    # 3. Bus factor: simulate the leave of anyone carrying a large share of team help
    for pid in sorted(team_ids, key=lambda x: help_given[x], reverse=True):
        if help_given[pid] / total_help < BUS_FACTOR_SHARE:
            break
        sim = simulate_absence(by_id[pid], people, visible, classifications)
        first = by_id[pid].first_name
        hit = ", ".join(
            f"{by_id[x['pid']].first_name} loses {x['dependency']:.0%}" for x in sim["affected"][:2]
        )
        over = [s for s in sim["load_shift"] if s["status_after"] == "overloaded" and s["status_before"] != "overloaded"]
        over_txt = (
            f" Covering would push {by_id[over[0]['pid']].first_name} from {over[0]['before_ratio']}× to "
            f"{over[0]['after_ratio']}× the team median." if over else ""
        )
        alerts.append(AlertOut(
            id=f"alert-bus-factor-{pid}",
            type=AlertType.BUS_FACTOR,
            severity="medium",
            title=f"Bus-factor risk: {sim['help_share_lost']:.0%} of the team's help runs through {first}",
            detail=f"If {first} is out: {hit} of their support.{over_txt} {len(sim['orphaned'])} of {first}'s "
                   "help items have no backup on the team. Open the Leave simulator to plan coverage.",
            person_ids=[pid] + [s["pid"] for s in over[:1]],
            evidence_ids=[a.id for a in sim["orphaned"][:8]],
        ))

    # 4. Ghost credit
    for f in detect_ghost_credit(people, visible, classifications, projects):
        idea, author, pr = f["idea"], f["author"], f["project"]
        owners = ", ".join(o.first_name for o in f["owners"])
        signal_txt = ""
        if f["signals"]:
            s = f["signals"][0]
            signal_txt = f" {by_id[s.actor_id].first_name}'s comment credits {f['owners'][0].first_name} for it."
        alerts.append(AlertOut(
            id=f"alert-ghost-credit-{idea.id}-{pr.id}",
            type=AlertType.GHOST_CREDIT,
            severity="medium",
            title=f"Possible missing credit: {author.first_name}'s idea in “{pr.name}”",
            detail=f"{author.first_name} proposed it {SOURCE_PHRASE.get(idea.source, '')} on "
                   f"{idea.timestamp:%b %d}: “{snippet(idea.text, 110)}”. “{pr.name}” (owner: {owners}) describes "
                   f"the same idea ({', '.join(f['shared_terms'][:6])}) but never mentions {author.first_name}."
                   f"{signal_txt} Suggest adding “Original idea: {author.name}” to the doc.",
            person_ids=[author.id] + [o.id for o in f["owners"]],
            evidence_ids=[idea.id] + [s.id for s in f["signals"]],
        ))

    # 5. Load imbalance
    median = statistics.median(help_given.values()) if help_given else 0
    if median:
        top = max(team_ids, key=lambda x: help_given[x])
        ratio = help_given[top] / median
        if ratio >= OVERLOADED_RATIO:
            first = by_id[top].first_name
            alerts.append(AlertOut(
                id=f"alert-load-imbalance-{top}",
                type=AlertType.LOAD_IMBALANCE,
                severity="low",
                title=f"Help load concentrated: {first} gives {ratio:.1f}× the team median",
                detail=f"{help_given[top]} of {total_help} helps ({help_given[top] / total_help:.0%}) came from "
                       f"{first}; the median teammate gave {median:g}. 'Who can unblock me?' now steers new "
                       "questions to people with capacity.",
                person_ids=[top],
                evidence_ids=[
                    a.id for a in visible
                    if a.actor_id == top and (clf := classifications.get(a.id))
                    and clf.category in (Category.UNBLOCKING, Category.ONBOARDING)
                ][:6],
            ))

    return alerts
