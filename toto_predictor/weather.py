"""Kickoff-hour weather forecast from Open-Meteo (free, no API key).

The agent supplies the stadium coordinates; the forecast itself is fetched
here so it is exact for the kickoff hour rather than a summarised web page.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import urllib.parse
import urllib.request

from toto_predictor.closing import ISRAEL

log = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY = ("temperature_2m", "precipitation", "wind_speed_10m")


def _fetch(params: dict) -> dict:
    url = f"{FORECAST_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def kickoff_weather(lat: float, lon: float, kickoff: dt.datetime, fetch=_fetch) -> dict | None:
    """Average of the kickoff hour and the next hour (≈ the first half and the second)."""
    local = kickoff.astimezone(ISRAEL)
    data = fetch(
        {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(HOURLY),
            "timezone": "Asia/Jerusalem",
            "start_date": local.date().isoformat(),
            "end_date": (local + dt.timedelta(hours=2)).date().isoformat(),
        }
    )
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    start = local.replace(minute=0, second=0, microsecond=0, tzinfo=None)
    wanted = {(start + dt.timedelta(hours=h)).isoformat(timespec="minutes") for h in (0, 1)}
    idx = [i for i, t in enumerate(times) if t in wanted]
    if not idx:
        return None

    def avg(key):
        values = [hourly[key][i] for i in idx if hourly.get(key) and hourly[key][i] is not None]
        return round(sum(values) / len(values), 1) if values else None

    return {
        "temperature_c": avg("temperature_2m"),
        "precipitation_mm": avg("precipitation"),
        "wind_kmh": avg("wind_speed_10m"),
        "source": "open-meteo",
    }
