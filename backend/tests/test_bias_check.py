"""Tests for the deterministic bias check."""
from app.metrics.recognition_gap import compute_bias_check


def _n(loc, help_given, thanks):
    return {"location": loc, "help_given": help_given, "thanks_received": thanks}


def test_small_groups_are_suppressed():
    nodes = [_n("office", 10, 5)] * 5 + [_n("remote", 10, 1)] * 3
    res = compute_bias_check(nodes, min_group_size=5)
    remote = next(g for g in res["groups"] if g["group"] == "remote")
    assert remote["suppressed"] is True
    assert "help_given" not in remote
    assert "Not enough groups" in res["note"]


def test_disparity_flagged_below_four_fifths():
    nodes = [_n("office", 10, 5)] * 5 + [_n("remote", 10, 2)] * 5
    res = compute_bias_check(nodes, min_group_size=5)
    ratios = {g["group"]: g["thanks_per_help"] for g in res["groups"]}
    assert ratios == {"office": 0.5, "remote": 0.2}
    assert "Remote employees receive 60% less" in res["note"]


def test_no_flag_within_threshold():
    nodes = [_n("office", 10, 5)] * 5 + [_n("remote", 10, 4)] * 5
    res = compute_bias_check(nodes, min_group_size=5)
    assert "within the 80% fairness threshold" in res["note"]
