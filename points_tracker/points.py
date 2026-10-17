"""Points formula. Must stay identical to web/src/lib/points.js."""

from __future__ import annotations


def points_from_nutrition(per100: dict) -> float:
    """Classic points formula (grams of protein, carbs, fat, fiber)."""
    raw = (
        (per100.get("protein") or 0) / 10.9375
        + (per100.get("carbs") or 0) / 9.2105
        + (per100.get("fat") or 0) / 3.8889
        - (per100.get("fiber") or 0) / 12.5
    )
    return max(0.0, raw)


def points_for_grams(per100: dict, grams: float) -> float:
    if not per100 or not grams or grams <= 0:
        return 0.0
    return points_from_nutrition(per100) * grams / 100


def round1(value: float) -> float:
    # Same as JS Math.round(n * 10) / 10 (round half up, not banker's rounding).
    import math

    return math.floor(value * 10 + 0.5) / 10
