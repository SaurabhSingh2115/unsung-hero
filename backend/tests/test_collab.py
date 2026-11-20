"""Tests for Peer Feedback Drafter and Who-can-unblock-me (deterministic paths, no Gemini)."""
from datetime import datetime
from types import SimpleNamespace

from app.generation.peer_feedback import build_peer_feedback, list_peer_candidates
from app.services.helper_finder import find_helpers, tokenize


def _p(pid, **kw):
    base = dict(id=pid, name=f"{pid.title()} X", first_name=pid.title(), initials=pid[:2].upper(),
                email=f"{pid}@x.com", role="employee", title="SWE", level="L4", discipline="eng",
                location="office", city="BLR", team="t", manager_id=None, opted_in=True,
                avatar_color="#000")
    base.update(kw)
    return SimpleNamespace(**base)


def _a(aid, actor, targets, text, day=1):
    return SimpleNamespace(id=aid, actor_id=actor, target_ids=targets, source="chat", source_ref=aid,
                           timestamp=datetime(2026, 10, day), text=text, link=f"/source/{aid}",
                           project_id=None)


def _c(aid, cat):
    return SimpleNamespace(activity_id=aid, category=cat)


PEOPLE = [_p("asker"), _p("hero"), _p("helper"), _p("other")]
ACTS = [
    _a("A1", "hero", ["asker"], "Skipped the poison message in the kafka consumer, lag recovering", 1),
    _a("A2", "hero", ["asker"], "Kafka consumer lag fixed by adding a DLQ", 2),
    _a("A3", "helper", ["other"], "Kafka lag was a poison message in partition 7", 3),
    _a("A4", "hero", ["asker"], "Reviewed #12 — backoff needs jitter", 4),
    _a("A5", "other", ["asker"], "Shipped the billing feature", 5),
]
CLF = {"A1": _c("A1", "firefighting"), "A2": _c("A2", "unblocking"), "A3": _c("A3", "unblocking"),
       "A4": _c("A4", "review"), "A5": _c("A5", "core")}


def test_tokenize_stems_and_drops_stopwords():
    assert tokenize("My retries keep failing for the Kafka consumers") == {"retry", "fail", "kafka", "consumer"}


def test_overloaded_hero_is_moved_after_capable_teammate():
    help_given = {"asker": 1, "hero": 20, "helper": 2, "other": 1}  # hero = 20x median-ish
    res = find_helpers(PEOPLE[0], "kafka consumer lag poison message", PEOPLE, ACTS, CLF, help_given,
                       use_llm=False)
    ids = [s.person.id for s in res.suggestions]
    assert ids[0] == "helper" and "hero" in ids  # protected, never hidden
    assert res.suggestions[ids.index("hero")].load_status == "overloaded"
    assert res.protected and "Hero" in res.protected[0]


def test_knowledge_silo_when_only_one_person_qualifies():
    help_given = {"asker": 1, "hero": 1, "helper": 1, "other": 1}
    res = find_helpers(PEOPLE[0], "backoff jitter review", PEOPLE, ACTS, CLF, help_given, use_llm=False)
    assert [s.person.id for s in res.suggestions] == ["hero"]
    assert res.bus_factor_warning and "Only Hero" in res.bus_factor_warning


def test_peer_candidates_count_only_glue_work_aimed_at_writer():
    cands = list_peer_candidates(PEOPLE[0], PEOPLE, ACTS, CLF)
    assert [(c.peer.id, c.interactions) for c in cands] == [("hero", 3)]  # A5 is core work -> excluded


def test_peer_feedback_cites_only_real_shared_evidence():
    help_given = {"asker": 1, "hero": 10, "helper": 1, "other": 1}
    fb = build_peer_feedback(PEOPLE[0], PEOPLE[1], PEOPLE, ACTS, CLF, help_given, use_llm=False)
    cited = {aid for s in fb.sections for c in s.claims for aid in c.activity_ids}
    assert cited and cited <= {"A1", "A2", "A4"}
    assert fb.evidence_count == 3 and fb.unverified_removed == 0
    assert "go-to person" in fb.growth  # hero gives >= 2x median help
