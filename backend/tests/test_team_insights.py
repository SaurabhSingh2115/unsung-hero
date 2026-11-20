"""Tests for the leave simulator, ghost-credit detection and glue-trap warning (all deterministic)."""
from datetime import date, datetime
from types import SimpleNamespace

from app.enrichment.ghost_credit import detect_ghost_credit
from app.metrics.glue_trap import detect_glue_trap
from app.metrics.resilience import help_matrix, simulate_absence


def _p(pid, role="employee", name=None):
    name = name or f"{pid.title()} Lastname"
    return SimpleNamespace(id=pid, name=name, first_name=name.split()[0], role=role, aliases=[], team="t")


def _a(aid, actor, targets, text, when=datetime(2026, 9, 1), source="chat", thread=None):
    return SimpleNamespace(id=aid, actor_id=actor, target_ids=targets, text=text, timestamp=when, source=source,
                           raw={"thread_id": thread or aid}, link=f"/source/{aid}", project_id=None)


def _c(aid, cat, proposal=False):
    return SimpleNamespace(activity_id=aid, category=cat, is_proposal=proposal)


# ---------------- leave simulator ----------------
HERO, ALLY, NEWBIE, LONER = _p("hero"), _p("ally"), _p("newbie"), _p("loner")
TEAM = [HERO, ALLY, NEWBIE, LONER]
SIM_ACTS = [
    _a("H1", "hero", ["newbie"], "Ledger rounding uses banker's rounding on the invoice total only"),
    _a("H2", "hero", ["newbie"], "Kafka consumer lag was a poison message, add a dead letter queue"),
    _a("H3", "hero", ["newbie"], "Pin protoc to version 25 with make tools before generating stubs"),
    _a("H4", "hero", ["loner"], "Staging dashboard access needs the payments readers group membership"),
    _a("A1", "ally", ["newbie"], "Kafka consumer lag fixed by skipping the poison message"),
]
SIM_CLF = {a.id: _c(a.id, "unblocking") for a in SIM_ACTS}


def test_absence_dependency_stranding_and_load_shift():
    sim = simulate_absence(HERO, TEAM, SIM_ACTS, SIM_CLF)
    assert sim["help_share_lost"] == 0.8  # hero gave 4 of 5 helps
    dep = {x["pid"]: x for x in sim["affected"]}
    assert dep["newbie"]["dependency"] == 0.75 and dep["newbie"]["other_helpers"] == ["ally"]
    assert dep["loner"]["stranded"] is True  # nobody else ever helped loner
    ally = next(s for s in sim["load_shift"] if s["pid"] == "ally")
    assert ally["absorbed"] == 3.0  # newbie's 3 helps re-route to ally; loner's help is stranded
    assert any("Loner has no other helper" in r for r in sim["recommendations"])


def test_absence_knowledge_without_backup():
    sim = simulate_absence(HERO, TEAM, SIM_ACTS, SIM_CLF)
    orphaned = {a.id for a in sim["orphaned"]}
    assert "H2" not in orphaned  # ally has also handled kafka lag / poison messages
    assert {"H1", "H3", "H4"} <= orphaned
    assert sim["apprentices"][0]["pid"] == "newbie"


# ---------------- ghost credit ----------------
AUTHOR, OWNER, BOSS = _p("rahul", name="Rahul Verma"), _p("arjun", name="Arjun Mehta"), _p("karan", "manager", "Karan K")
GC_PEOPLE = [AUTHOR, OWNER, BOSS]
IDEA = _a("I1", "rahul", [], "Idea: what if we cache pricing lookups at the edge (CDN workers) and push invalidations "
                             "on catalog change to cut pricing latency", when=datetime(2026, 9, 18, 14))
PRAISE = _a("D1", "karan", ["arjun"], "Love the edge cache proposal Arjun, pricing latency matters",
            when=datetime(2026, 9, 19), source="doc_comment")
GC_CLF = {"I1": _c("I1", "core", proposal=True), "D1": _c("D1", "documentation")}


def _proj(doc, start=date(2026, 9, 18)):
    return SimpleNamespace(id="edge", name="Pricing edge cache", owner_ids=["arjun"], start=start, doc_text=doc)


def test_ghost_credit_detected_with_credit_signal():
    doc = "Owner: Arjun Mehta. Edge cache for pricing: CDN workers, invalidations via event bus, cut latency."
    found = detect_ghost_credit(GC_PEOPLE, [IDEA, PRAISE], GC_CLF, [_proj(doc)])
    assert len(found) == 1
    f = found[0]
    assert f["author"].id == "rahul" and [o.id for o in f["owners"]] == ["arjun"]
    assert {"edge", "cdn", "pricing"} <= set(f["shared_terms"])
    assert [s.id for s in f["signals"]] == ["D1"]


def test_ghost_credit_not_flagged_when_author_is_credited_or_doc_predates_idea():
    credited = "Owner: Arjun Mehta. Based on Rahul's idea: edge cache for pricing, CDN workers, invalidations."
    assert detect_ghost_credit(GC_PEOPLE, [IDEA, PRAISE], GC_CLF, [_proj(credited)]) == []
    old = "Owner: Arjun Mehta. Edge cache for pricing: CDN workers, invalidations, cut latency."
    assert detect_ghost_credit(GC_PEOPLE, [IDEA, PRAISE], GC_CLF, [_proj(old, start=date(2026, 8, 1))]) == []


# ---------------- glue trap ----------------
def test_glue_trap_flags_sustained_high_glue_share_only():
    glue_p, balanced, other = _p("glue"), _p("bal"), _p("oth")
    acts, clf = [], {}
    for month in (8, 9, 10):
        for i in range(5):
            aid = f"g{month}{i}"
            acts.append(_a(aid, "glue", ["bal"], "helped", when=datetime(2026, month, 1 + i)))
            clf[aid] = _c(aid, "unblocking" if i < 4 else "core")  # 80% glue
            for who in ("bal", "oth"):
                bid = f"{who}{month}{i}"
                acts.append(_a(bid, who, [], "shipped", when=datetime(2026, month, 1 + i)))
                clf[bid] = _c(bid, "unblocking" if i == 0 else "core")  # 20% glue
    found = detect_glue_trap([glue_p, balanced, other], acts, clf, help_matrix({"glue", "bal", "oth"}, acts, clf))
    assert [f["person"].id for f in found] == ["glue"]
    assert found[0]["high_months"] == 3 and found[0]["taught"] == ["bal"]
