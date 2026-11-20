"""Tests for Review Language Bias Lens and Silo-to-Runbook Generator."""
from datetime import datetime
from types import SimpleNamespace

from app.generation.review_bias_lens import check_review_bias
from app.generation.runbook_draft import build_runbook_draft


def _p(pid="priya"):
    return SimpleNamespace(
        id=pid, name="Priya Sharma", first_name="Priya", initials="PS",
        email="priya@x.com", role="employee", title="SWE", level="L4", discipline="eng",
        location="office", city="BLR", team="payments", manager_id="karan", opted_in=True,
        avatar_color="#000",
    )


def _a(aid, text):
    return SimpleNamespace(
        id=aid, actor_id="priya", target_ids=["arjun"], source="chat", source_ref=aid,
        timestamp=datetime(2026, 10, 1), text=text, link=f"/source/{aid}", project_id=None,
    )


ACTS = [
    _a("A-CHAT-1", "Your idempotency key includes the retry attempt number; key it on (invoice_id, cycle)."),
    _a("A-CR-1", "Reviewed #412 — added jitter to retry backoff so retries don't stampede."),
]
CLF = {
    "A-CHAT-1": SimpleNamespace(activity_id="A-CHAT-1", category="unblocking"),
    "A-CR-1": SimpleNamespace(activity_id="A-CR-1", category="review"),
}


def test_review_bias_lens_flags_communal_and_uncited_claims():
    text = (
        "Priya is always helpful, supportive, and a great team player.\n"
        "She consistently unblocked the retry backoff work.\n"
        "Caught retry stampede bug in code review [A-CR-1]."
    )
    res = check_review_bias(_p(), text, ACTS, CLF)
    assert res.overall_status == "bias_risk"
    assert res.communal_count == 1
    assert res.uncited_count == 1
    assert res.cited_count == 1
    assert len(res.findings) == 2
    assert res.findings[0].issue_type == "communal_framing"
    assert res.findings[0].activity_ids  # grounded in real evidence


def test_review_bias_lens_passes_clean_cited_text():
    text = "- Prevented retry stampede in [A-CR-1].\n- Fixed idempotency key bug in [A-CHAT-1]."
    res = check_review_bias(_p(), text, ACTS, CLF)
    assert res.overall_status == "strong"
    assert res.findings == []


def test_runbook_draft_credits_author_and_enforces_citations():
    rb = build_runbook_draft(_p(), "Idempotency key for payment retries?", ACTS, CLF, use_llm=False)
    assert rb.author.id == "priya"
    assert rb.suggested_go_link.startswith("go/")
    assert rb.citations_count >= 2
    assert rb.unverified_removed == 0
    assert "Priya Sharma" in rb.markdown
