"""When the form closes: a Toto form can be sent until 6 minutes before
the first match on it kicks off."""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

from toto_predictor import config

ISRAEL = ZoneInfo("Asia/Jerusalem")
WEEKDAYS_HE = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]


def parse_time(value) -> dt.datetime | None:
    """ISO 8601 -> aware datetime. A time without an offset is Israel time."""
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=ISRAEL)


def close_time(matches: list[dict], published_close: str | None = None) -> tuple[dt.datetime | None, str]:
    """Earliest of (first kickoff - 6 minutes) and the close time published on the form.

    Returns the time and where it came from: "first_kickoff", "form" or "unknown".
    """
    kickoffs = [k for k in (parse_time(m.get("kickoff")) for m in matches) if k]
    candidates = []
    if kickoffs:
        margin = dt.timedelta(minutes=config.CLOSE_BEFORE_KICKOFF_MINUTES)
        candidates.append((min(kickoffs) - margin, "first_kickoff"))
    published = parse_time(published_close)
    if published:
        candidates.append((published, "form"))
    if not candidates:
        return None, "unknown"
    return min(candidates, key=lambda c: c[0])


def format_he(when: dt.datetime | None) -> str:
    if when is None:
        return "לא ידוע"
    local = when.astimezone(ISRAEL)
    return f"יום {WEEKDAYS_HE[local.weekday()]} {local:%d.%m} בשעה {local:%H:%M}"
