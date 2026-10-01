"""Offline stand-in for ``agent`` (DEMO=1): canned form and research, no API calls."""

from __future__ import annotations

import datetime as dt
import random

from toto_predictor.closing import ISRAEL

TEAMS = [
    ("מכבי חיפה", "הפועל באר שבע"), ("מכבי ת\"א", "בית\"ר ירושלים"),
    ("הפועל ת\"א", "מכבי נתניה"), ("בני סכנין", "הפועל חיפה"),
    ("מ.ס. אשדוד", "הפועל ירושלים"), ("עירוני קריית שמונה", "מכבי בני ריינה"),
    ("ארסנל", "צ'לסי"), ("ליברפול", "אסטון וילה"), ("ריאל מדריד", "סביליה"),
    ("ברצלונה", "אתלטיקו מדריד"), ("אינטר", "נאפולי"), ("יובנטוס", "רומא"),
    ("באיירן מינכן", "דורטמונד"), ("פ.ס.ז'", "מרסיי"),
    ("הפועל פתח תקווה", "הפועל רעננה"), ("הפועל כפר סבא", "מכבי הרצליה"),
]


def find_round() -> dict:
    today = dt.date.today()
    saturday = today + dt.timedelta(days=(5 - today.weekday()) % 7 or 7)
    first = dt.datetime.combine(saturday, dt.time(15, 0), ISRAEL)
    return {
        "round_number": "demo",
        "close_time": None,
        "source_url": "demo",
        "matches": [
            {"index": i + 1, "home_he": h, "away_he": a, "home_en": h, "away_en": a,
             "league": "demo",
             "kickoff": (first + dt.timedelta(minutes=30 * i)).isoformat()}
            for i, (h, a) in enumerate(TEAMS)
        ],
    }


def research_all(matches: list[dict], round_number: str) -> list[dict]:
    rng = random.Random(16)
    out = []
    for _ in matches:
        p1 = rng.uniform(0.2, 0.7)
        px = rng.uniform(0.2, 0.32)
        p2 = max(0.05, 1 - p1 - px)
        out.append({
            "odds": {"1": round(0.95 / p1, 2), "X": round(0.95 / px, 2), "2": round(0.95 / p2, 2)},
            "odds_source": "demo",
            "agent_estimate": {"1": p1, "X": px, "2": p2},
            "h2h": {"home_wins": rng.randint(0, 6), "draws": rng.randint(0, 4),
                    "away_wins": rng.randint(0, 6), "note": ""},
            "absences": [],
            "fatigue": {"home_rest_days": rng.randint(2, 7), "away_rest_days": rng.randint(2, 7),
                        "home_matches_14d": rng.randint(2, 4), "away_matches_14d": rng.randint(2, 4),
                        "note": ""},
            "internationals": {"home_key_players": 0, "away_key_players": 0, "note": ""},
            "venue": {"stadium": "", "neutral": False, "home_fan_ban": False, "away_fans_banned": False},
            "form": {"home_last6": "WDLWWD", "away_last6": "LDWDLW"},
            "motivation": "", "other_factors": "", "confidence": 0.5,
            "summary_he": "נתוני הדגמה – לא מחקר אמיתי.",
            "sources": [],
        })
    return out
