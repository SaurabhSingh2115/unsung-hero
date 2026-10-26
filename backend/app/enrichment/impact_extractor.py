"""Extract impact metrics (value, metric, users affected) from launch docs."""
import re
from typing import Any
from app.gemini.client import generate_structured
from app.models.project import Project

SCHEMA = {
    "type": "object",
    "title": "LaunchImpact",
    "properties": {
        "impact_summary": {"type": "string"},
        "impact_metric": {"type": "string"},
        "impact_value": {"type": "string"},
        "users_affected": {"type": "integer"},
        "impact_quote": {"type": "string"},
        "impact_score": {"type": "integer"},
        "complexity": {"type": "integer"},
        "complexity_rationale": {"type": "string"},
    },
    "required": [
        "impact_summary", "impact_metric", "impact_value",
        "impact_quote", "impact_score", "complexity", "complexity_rationale"
    ],
}


def extract_impact_heuristic(doc_text: str) -> dict[str, Any]:
    users = None
    m = re.search(r"([\d\.]+)\s*(million|k|thousand)?\s*merchants", doc_text, re.IGNORECASE)
    if m:
        num = float(m.group(1))
        unit = (m.group(2) or "").lower()
        if "million" in unit:
            users = int(num * 1_000_000)
        elif "k" in unit or "thousand" in unit:
            users = int(num * 1_000)
        else:
            users = int(num)

    quote = None
    for line in doc_text.splitlines():
        if any(w in line.lower() for w in ["reduced", "increased", "cut", "saved", "conversion", "latency"]):
            quote = line.strip("#- ").strip()
            break

    return {
        "impact_summary": quote or "Delivered measurable engineering and business improvements.",
        "impact_metric": "Conversion / Latency / Error reduction",
        "impact_value": "+2.1% - 35%",
        "users_affected": users or 50_000,
        "impact_quote": quote or "Delivered measurable business impact.",
        "impact_score": 85 if (users and users > 500_000) else 70,
        "complexity": 4 if "zero-downtime" in doc_text.lower() or "streaming" in doc_text.lower() else 3,
        "complexity_rationale": "Multi-system migration, cross-functional dependencies.",
    }


def enrich_project(project: Project, use_llm: bool = True) -> Project:
    if not use_llm:
        result = extract_impact_heuristic(project.doc_text)
        model_type = "heuristic"
    else:
        prompt = f"Extract impact and rate complexity for launch doc:\n\n{project.doc_text}"
        result, model_type = generate_structured(prompt, SCHEMA)
        if not result:
            result = extract_impact_heuristic(project.doc_text)
            model_type = "heuristic"

    project.impact_summary = result.get("impact_summary", "")
    project.impact_metric = result.get("impact_metric")
    project.impact_value = result.get("impact_value")
    project.users_affected = result.get("users_affected")
    project.impact_quote = result.get("impact_quote")
    project.impact_score = int(result.get("impact_score", 70))
    project.complexity = int(result.get("complexity", 3))
    project.complexity_rationale = result.get("complexity_rationale", "")
    project.enrichment_model = model_type
    return project
