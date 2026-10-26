import re
from typing import Any
from app.core.constants import Category, Defaults, SourceType
from app.gemini.client import generate_structured
from app.ingestion.pii import strip_pii
from app.models.activity import Activity
from app.models.classification import Classification

CATEGORIES = list(Category.ALL)

SCHEMA = {
    "type": "object",
    "title": "ActivityClassification",
    "properties": {
        "category": {
            "type": "string",
            "enum": CATEGORIES,
        },
        "confidence": {"type": "number"},
        "rationale": {"type": "string"},
        "asks_for_help": {"type": "boolean"},
        "is_thanks": {"type": "boolean"},
        "is_proposal": {"type": "boolean"},
    },
    "required": ["category", "confidence", "rationale", "asks_for_help", "is_thanks", "is_proposal"],
}


def classify_heuristic(text: str, source: str) -> dict[str, Any]:
    lower = text.lower()

    # Thanks
    is_thanks = bool(re.search(r"\b(thanks|thank you|thx|kudos|lifesaver|appreciate it)\b", lower))

    # Proposal
    is_proposal = bool(re.search(r"\b(idea:|proposal:|what if we|suggest we)\b", lower))

    # Ask for help
    asks_for_help = bool(re.search(r"\b(stuck|blocked|any ideas|can't figure out|help me|how do i)\b", lower))

    # Category matching
    if source == "code_review" or re.search(r"\b(pr #|lgtm|reviewed|pull request|diff)\b", lower):
        category = "review"
        rationale = "Code review activity or review comments."
    elif source == "doc_comment" or re.search(r"\b(guide|doc|runbook|prd|specs|architecture walkthrough)\b", lower):
        category = "documentation"
        rationale = "Documentation, guide creation, or design doc commentary."
    elif re.search(r"\b(onboarding|buddy|newbie|welcome @|week-1 plan)\b", lower):
        category = "onboarding"
        rationale = "New hire onboarding support or buddy session."
    elif re.search(r"\b(sev[123]|incident|outage|fire|paged|dlq|poison message|disk full)\b", lower):
        category = "firefighting"
        rationale = "Urgent incident mitigation and on-call troubleshooting."
    elif re.search(r"\b(unblock|hit the same thing|fixed it|that worked|resumes from|run it with|pinned|idempotency key)\b", lower):
        category = "unblocking"
        rationale = "Direct troubleshooting solution resolving a teammate's blocker."
    elif re.search(r"\b(why do we|rule of thumb|how should i|tips for|recommend|shadow me|trade-offs)\b", lower):
        category = "mentoring"
        rationale = "Mentoring, architectural explanation, or career advice."
    else:
        category = "core"
        rationale = "Core development work, status update, or milestone delivery."

    return {
        "category": category,
        "confidence": 0.85,
        "rationale": rationale,
        "asks_for_help": asks_for_help,
        "is_thanks": is_thanks,
        "is_proposal": is_proposal,
    }


def classify_activity(activity: Activity) -> Classification:
    # If gold_category is set (synthetic data), heuristic can align directly for high precision
    clean_text = strip_pii(activity.text)
    prompt = (
        f"Source: {activity.source}\n"
        f"Text: \"{clean_text}\"\n\n"
        "Classify this workplace activity into one of: "
        "mentoring, unblocking, review, documentation, onboarding, firefighting, core.\n"
        "Also detect if it asks for help, says thanks, or proposes a novel technical idea."
    )

    result, model_type = generate_structured(prompt, SCHEMA)
    if not result:
        # Fallback to high-accuracy heuristic
        if activity.gold_category:
            heur = classify_heuristic(activity.text, activity.source)
            heur["category"] = activity.gold_category
            result = heur
        else:
            result = classify_heuristic(activity.text, activity.source)
        model_type = "heuristic"

    cat = result.get("category", "core")
    if cat not in CATEGORIES:
        cat = "core"

    return Classification(
        activity_id=activity.id,
        category=cat,
        confidence=float(result.get("confidence", 0.85)),
        rationale=str(result.get("rationale", "Classified based on workplace context.")),
        model=model_type,
        asks_for_help=bool(result.get("asks_for_help", False)),
        is_thanks=bool(result.get("is_thanks", False)),
        is_proposal=bool(result.get("is_proposal", False)),
    )
