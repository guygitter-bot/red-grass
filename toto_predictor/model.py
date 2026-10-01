"""Turn the agent's structured research into 1/X/2 probabilities.

The model is deliberately simple and deterministic:

1. Base probabilities come from betting odds (margin removed) blended
   with the agent's own estimate. With no odds, the agent estimate alone.
2. Each criterion adds a shift ``delta`` in log-odds towards the home
   team (negative = towards the away team).
3. ``p1 *= e^delta``, ``p2 *= e^-delta``, then renormalise.

When odds exist the market already prices most public news, so the
adjustments are damped. All weights live in ``WEIGHTS`` so they can be
re-calibrated once results accumulate.
"""

from __future__ import annotations

import math

WEIGHTS = {
    "market_share": 0.75,  # share of the base taken from odds when present
    "damping_with_odds": 0.5,
    "absence": 0.25,  # per unit of summed absence importance
    "doubtful_miss_chance": 0.5,  # line-ups are unknown on Thursday
    "rotation": {"none": 0.0, "low": 0.04, "high": 0.12},
    "absence_cap": 3.0,
    "short_rest": 0.15,  # rest of fewer than 3 days
    "match_load": 0.04,  # per extra match in the last 14 days
    "match_load_cap": 0.16,
    "international": 0.04,  # per key player back from a long international trip
    "international_cap": 0.15,
    "no_home_advantage": 0.15,  # neutral ground or home fan ban
    "away_fans_banned": 0.05,
    "h2h": 0.15,  # times (home wins - away wins) / meetings
    "h2h_min_meetings": 3,
}

FALLBACK = {"1": 0.45, "X": 0.28, "2": 0.27}


def _normalise(p: dict[str, float]) -> dict[str, float]:
    total = sum(p.values())
    return {k: v / total for k, v in p.items()}


def implied_from_odds(odds: dict | None) -> dict[str, float] | None:
    if not odds:
        return None
    try:
        raw = {k: 1.0 / float(odds[k]) for k in ("1", "X", "2")}
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None
    if any(v <= 0 for v in raw.values()):
        return None
    return _normalise(raw)


def _agent_estimate(research: dict) -> dict[str, float] | None:
    est = research.get("agent_estimate")
    if not est:
        return None
    try:
        p = {k: max(float(est[k]), 0.0) for k in ("1", "X", "2")}
    except (KeyError, TypeError, ValueError):
        return None
    return _normalise(p) if sum(p.values()) > 0 else None


def base_probabilities(research: dict) -> tuple[dict[str, float], str]:
    market = implied_from_odds(research.get("odds"))
    agent = _agent_estimate(research)
    if market and agent:
        w = WEIGHTS["market_share"]
        return _normalise({k: w * market[k] + (1 - w) * agent[k] for k in market}), "odds+agent"
    if market:
        return market, "odds"
    if agent:
        return agent, "agent"
    return dict(FALLBACK), "fallback"


def adjustments(research: dict) -> dict[str, float]:
    """Each criterion's log-odds shift towards the home team."""
    w = WEIGHTS
    out: dict[str, float] = {}

    absences = research.get("absences") or []
    imp = {"home": 0.0, "away": 0.0}
    for a in absences:
        side = a.get("team")
        if side in imp:
            miss = w["doubtful_miss_chance"] if a.get("status") == "doubtful" else 1.0
            imp[side] += miss * max(0.0, min(1.0, float(a.get("importance") or 0)))
    imp = {k: min(v, w["absence_cap"]) for k, v in imp.items()}
    out["absences"] = w["absence"] * (imp["away"] - imp["home"])

    fatigue = research.get("fatigue") or {}
    shift = 0.0
    for side, sign in (("home", -1), ("away", 1)):
        rest = fatigue.get(f"{side}_rest_days")
        if rest is not None and rest < 3:
            shift += sign * w["short_rest"]
    hm, am = fatigue.get("home_matches_14d"), fatigue.get("away_matches_14d")
    if hm is not None and am is not None:
        load = w["match_load"] * (am - hm)
        shift += max(-w["match_load_cap"], min(w["match_load_cap"], load))
    out["fatigue"] = shift

    rot = research.get("rotation_risk") or {}
    out["rotation"] = w["rotation"].get(rot.get("away"), 0.0) - w["rotation"].get(rot.get("home"), 0.0)

    intl = research.get("internationals") or {}
    diff = (intl.get("away_key_players") or 0) - (intl.get("home_key_players") or 0)
    out["internationals"] = max(
        -w["international_cap"], min(w["international_cap"], w["international"] * diff)
    )

    venue = research.get("venue") or {}
    shift = 0.0
    if venue.get("neutral") or venue.get("home_fan_ban"):
        shift -= w["no_home_advantage"]
    if venue.get("away_fans_banned"):
        shift += w["away_fans_banned"]
    out["venue"] = shift

    h2h = research.get("h2h") or {}
    hw, d, aw = (h2h.get(k) or 0 for k in ("home_wins", "draws", "away_wins"))
    meetings = hw + d + aw
    out["h2h"] = w["h2h"] * (hw - aw) / meetings if meetings >= w["h2h_min_meetings"] else 0.0
    return out


def predict(research: dict) -> dict:
    base, source = base_probabilities(research)
    adj = adjustments(research)
    damping = WEIGHTS["damping_with_odds"] if source.startswith("odds") else 1.0
    delta = damping * sum(adj.values())
    p = _normalise(
        {"1": base["1"] * math.exp(delta), "X": base["X"], "2": base["2"] * math.exp(-delta)}
    )
    p = _normalise({k: min(max(v, 0.02), 0.96) for k, v in p.items()})
    return {
        "prob": {k: round(v, 4) for k, v in p.items()},
        "base": {k: round(v, 4) for k, v in base.items()},
        "base_source": source,
        "adjustments": {k: round(v * damping, 4) for k, v in adj.items()},
    }
