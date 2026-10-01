"""Tunable settings for the Toto 16 predictor.

Values can be overridden through environment variables so the GitHub
Actions workflow (or a local run) can change them without code edits.
"""

import os


def _env_float(name: str, default: float) -> float:
    value = os.environ.get(name, "").strip()
    return float(value) if value else default


# Price of a single column (טור) on the Toto 16 form, in ILS.
COLUMN_PRICE = _env_float("TOTO_COLUMN_PRICE", 3.0)
# Hard weekly budget, in ILS.
BUDGET = _env_float("TOTO_BUDGET", 120.0)
# Number of matches on the form.
MATCH_COUNT = 16
# The form can be sent until this many minutes before the first kickoff.
CLOSE_BEFORE_KICKOFF_MINUTES = 6

# Claude model used by the research agent.
MODEL = os.environ.get("TOTO_MODEL", "").strip() or "claude-opus-5-5"
# The per-match research is most of the cost; it can run on a cheaper model.
RESEARCH_MODEL = os.environ.get("TOTO_RESEARCH_MODEL", "").strip() or MODEL
EFFORT = os.environ.get("TOTO_EFFORT", "").strip() or "medium"
# Web tool budget per API call (each search is billed, and fetched pages add input tokens).
MAX_SEARCHES = int(_env_float("TOTO_MAX_SEARCHES", 8))
MAX_FETCHES = int(_env_float("TOTO_MAX_FETCHES", 4))
# How many matches are researched concurrently.
RESEARCH_WORKERS = int(_env_float("TOTO_RESEARCH_WORKERS", 4))


def max_columns() -> int:
    return int(BUDGET // COLUMN_PRICE)
