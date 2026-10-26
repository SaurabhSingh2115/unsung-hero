"""Seed (or re-seed) the database from a data scenario.

Usage (from backend/):
  python -m scripts.seed_db                       # DATA_SCENARIO from .env (default payments-demo)
  python -m scripts.seed_db --scenario my-team    # data/scenarios/my-team/
  python -m scripts.seed_db --llm                 # classify with Gemini instead of heuristics
  python -m scripts.seed_db --keep                # merge into existing DB instead of rebuilding
"""
import argparse

from app.core.config import get_settings
from app.core.db import Base, engine, SessionLocal, init_db
from app.ingestion.loader import seed_from_scenario
from app.ingestion.scenario import load_scenario


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scenario", help="Scenario folder name under data/scenarios/ (or a path)")
    parser.add_argument("--llm", action="store_true", help="Classify activities with Gemini (slower)")
    parser.add_argument("--keep", action="store_true", help="Keep existing rows instead of rebuilding the DB")
    args = parser.parse_args()

    settings = get_settings()
    if args.scenario:
        settings.data_scenario = args.scenario
    scenario = load_scenario(settings.scenario_path)  # validates JSON before touching the DB

    if not args.keep:
        import app.models  # noqa: F401  (register models)
        Base.metadata.drop_all(engine)
    init_db()

    with SessionLocal() as db:
        counts = seed_from_scenario(db, scenario, use_llm=args.llm)

    print(f"Seeded scenario '{scenario.path.name}': " + ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
