"""The "bites" formula of the Bis app. Must stay identical to web/src/lib/points.js.

bites = (kcal - 3 * protein - 4 * fiber) / 35 per 100 g, never below 0.
An energy base (35 kcal = one bite) with a discount for protein and dietary fiber.
Without kcal, it is computed from the macros (4 protein / carbs, 9 fat).
"""

from __future__ import annotations

import math

KCAL_PER_BITE = 35


def kcal_of(per100: dict) -> float:
    kcal = per100.get("kcal") or 0
    if kcal > 0:
        return kcal
    return 4 * (per100.get("protein") or 0) + 4 * (per100.get("carbs") or 0) + 9 * (per100.get("fat") or 0)


def points_from_nutrition(per100: dict) -> float:
    raw = (kcal_of(per100) - 3 * (per100.get("protein") or 0) - 4 * (per100.get("fiber") or 0)) / KCAL_PER_BITE
    return max(0.0, raw)


def points_for_grams(per100: dict, grams: float) -> float:
    if not per100 or not grams or grams <= 0:
        return 0.0
    return points_from_nutrition(per100) * grams / 100


def round1(value: float) -> float:
    # Same as JS Math.round(n * 10) / 10 (round half up, not banker's rounding).
    return math.floor(value * 10 + 0.5) / 10
