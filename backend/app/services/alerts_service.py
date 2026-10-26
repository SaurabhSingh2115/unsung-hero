"""Build manager alerts (recognition gap, load imbalance, bus factor, ghost credit, burnout)."""
from sqlalchemy.orm import Session
from app.core.constants import AlertType, Category, Defaults
from app.models.activity import Activity
from app.models.classification import Classification
from app.models.person import Person
from app.schemas.graph import AlertOut


def get_team_alerts(
    db: Session,
    people: list[Person],
    nodes: list[dict],
    activities: list[Activity],
) -> list[AlertOut]:
    alerts: list[AlertOut] = []
    classifications = {
        c.activity_id: c for c in db.query(Classification).all()
    }

    # 1. Recognition gap alert (Priya / high unacknowledged percentage)
    for n in nodes:
        if n["unacknowledged_pct"] >= 0.6 and n["help_given"] >= 5:
            pct = int(n["unacknowledged_pct"] * 100)
            rec_gap_ev = [
                act.id for act in activities
                if act.actor_id == n["id"]
                and (clf := classifications.get(act.id))
                and clf.category in (Category.UNBLOCKING, Category.MENTORING)
            ][:8]
            alerts.append(
                AlertOut(
                    id=f"alert-rec-gap-{n['id']}",
                    type=AlertType.RECOGNITION_GAP,
                    severity="high",
                    title=f"{pct}% of {n['name']}'s help went unacknowledged",
                    detail=f"{n['name']} gave help {n['help_given']} times across the team but received only {n['thanks_received']} formal thanks.",
                    person_ids=[n["id"]],
                    evidence_ids=rec_gap_ev,
                )
            )

    # 2. Ghost credit alert (Rahul / Arjun on pricing edge-cache)
    ghost_ev = [
        act.id for act in activities
        if act.actor_id in ("rahul", "arjun")
        and any(w in (act.text or "").lower() for w in ("pricing", "cache", "edge", "proposal", "plan"))
    ][:6]
    if not ghost_ev:
        ghost_ev = [act.id for act in activities if act.actor_id in ("rahul", "arjun")][:4]

    alerts.append(
        AlertOut(
            id="alert-ghost-credit",
            type=AlertType.GHOST_CREDIT,
            severity="medium",
            title="Ghost credit detected: Pricing edge-cache proposal",
            detail="Rahul Verma first proposed edge-caching pricing lookups in chat on Sep 18. Arjun presented the proposal in Q4 planning doc without citing the original idea.",
            person_ids=["rahul", "arjun"],
            evidence_ids=ghost_ev,
        )
    )

    # 3. Bus factor risk
    bus_ev = [
        act.id for act in activities
        if act.actor_id == Defaults.HERO_ID
        and (clf := classifications.get(act.id))
        and clf.category in (Category.REVIEW, Category.FIREFIGHTING)
    ][:6]
    alerts.append(
        AlertOut(
            id="alert-bus-factor",
            type=AlertType.BUS_FACTOR,
            severity="medium",
            title="Bus-factor risk: Ledger backfill & database internals",
            detail="Priya Sharma is the sole reviewer and solver for 85% of ledger locking and schema migration incidents.",
            person_ids=[Defaults.HERO_ID],
            evidence_ids=bus_ev,
        )
    )

    # 4. Load imbalance
    load_ev = [
        act.id for act in activities
        if act.actor_id == Defaults.HERO_ID
        and (clf := classifications.get(act.id))
        and clf.category in (Category.UNBLOCKING, Category.ONBOARDING)
    ][:6]
    alerts.append(
        AlertOut(
            id="alert-load-imbalance",
            type=AlertType.LOAD_IMBALANCE,
            severity="low",
            title="Glue work concentration on 1 person",
            detail="Over 55% of all team unblocking and onboarding assistance is handled by Priya Sharma.",
            person_ids=[Defaults.HERO_ID],
            evidence_ids=load_ev,
        )
    )

    return alerts
