"""Research agent: Claude with web search finds the form and researches matches.

The agent never decides the final pick. It fills a fixed JSON schema
(through a strict ``submit_*`` tool) and the deterministic model in
``model.py`` turns that into probabilities.
"""

from __future__ import annotations

import datetime as dt
import logging
from concurrent.futures import ThreadPoolExecutor

import anthropic

from toto_predictor import config

log = logging.getLogger(__name__)

MAX_STEPS = 10
WEB_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 15},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 10},
]


def _nullable(schema_type: str) -> dict:
    return {"type": [schema_type, "null"]}


def _obj(props: dict) -> dict:
    return {
        "type": "object",
        "properties": props,
        "required": list(props),
        "additionalProperties": False,
    }


TRIPLE = _obj({"1": {"type": "number"}, "X": {"type": "number"}, "2": {"type": "number"}})

ROUND_TOOL = {
    "name": "submit_round",
    "description": "Submit the open Toto 16 form: round number, close time and the 16 matches in form order.",
    "strict": True,
    "input_schema": _obj(
        {
            "round_number": {"type": "string"},
            "close_time": {"type": "string", "description": "ISO 8601 with Israel offset if known, else free text"},
            "source_url": {"type": "string"},
            "matches": {
                "type": "array",
                "items": _obj(
                    {
                        "index": {"type": "integer"},
                        "home_he": {"type": "string"},
                        "away_he": {"type": "string"},
                        "home_en": {"type": "string"},
                        "away_en": {"type": "string"},
                        "league": {"type": "string"},
                        "kickoff": {
                            "type": "string",
                            "description": "ISO 8601 with offset, e.g. 2026-10-03T19:30:00+03:00",
                        },
                    }
                ),
            },
        }
    ),
}

RESEARCH_TOOL = {
    "name": "submit_match_research",
    "description": "Submit the structured research for one match. Use null where nothing reliable was found.",
    "strict": True,
    "input_schema": _obj(
        {
            "odds": {"anyOf": [TRIPLE, {"type": "null"}]},
            "odds_source": _nullable("string"),
            "agent_estimate": TRIPLE,
            "h2h": _obj(
                {
                    "home_wins": {"type": "integer"},
                    "draws": {"type": "integer"},
                    "away_wins": {"type": "integer"},
                    "note": {"type": "string"},
                }
            ),
            "absences": {
                "type": "array",
                "items": _obj(
                    {
                        "team": {"type": "string", "enum": ["home", "away"]},
                        "player": {"type": "string"},
                        "reason": {"type": "string", "enum": ["injury", "suspension", "other"]},
                        "status": {"type": "string", "enum": ["out", "doubtful"]},
                        "importance": {"type": "number"},
                        "source": {"type": "string"},
                    }
                ),
            },
            "fatigue": _obj(
                {
                    "home_rest_days": _nullable("integer"),
                    "away_rest_days": _nullable("integer"),
                    "home_matches_14d": _nullable("integer"),
                    "away_matches_14d": _nullable("integer"),
                    "home_matches_before_unplayed": {"type": "integer"},
                    "away_matches_before_unplayed": {"type": "integer"},
                    "note": {"type": "string"},
                }
            ),
            "internationals": _obj(
                {
                    "home_key_players": {"type": "integer"},
                    "away_key_players": {"type": "integer"},
                    "note": {"type": "string"},
                }
            ),
            "venue": _obj(
                {
                    "stadium": {"type": "string"},
                    "neutral": {"type": "boolean"},
                    "home_fan_ban": {"type": "boolean"},
                    "away_fans_banned": {"type": "boolean"},
                }
            ),
            "rotation_risk": _obj(
                {
                    "home": {"type": "string", "enum": ["none", "low", "high"]},
                    "away": {"type": "string", "enum": ["none", "low", "high"]},
                    "note": {"type": "string"},
                }
            ),
            "form": _obj({"home_last6": {"type": "string"}, "away_last6": {"type": "string"}}),
            "motivation": {"type": "string"},
            "other_factors": {"type": "string"},
            "confidence": {"type": "number"},
            "summary_he": {"type": "string"},
            "sources": {"type": "array", "items": {"type": "string"}},
        }
    ),
}

ROUND_PROMPT = """Today is {today}. Find the currently open Israeli "Toto 16" form \
(טוטו 16, also called ווינר 16) of the Israel Sports Betting Board (Winner).

Look at winner.co.il and at Israeli sports sites that publish the weekly form \
(for example one.co.il, sport5.co.il, footballlig.com/totoloto/toto.aspx). \
Make sure it is the form that is open now, not last week's.

Return the round number, the closing time, and all 16 matches in the order they \
appear on the form, with team names in Hebrew as written on the form and the \
common English name of each club, the league (for Israeli matches the exact \
competition, e.g. "Ligat HaAl", "Liga Leumit", "Liga Alef South", "State Cup"), \
and the exact kickoff date and \
time of every match as ISO 8601 with the Israel UTC offset \
(e.g. 2026-10-03T19:30:00+03:00). Kickoff times matter: the form closes 6 \
minutes before the first match starts, so double-check the earliest one.

When you are done, call submit_round. Do not answer in plain text."""

RESEARCH_SYSTEM = """You are a football research analyst preparing data for a \
Toto 16 (1/X/2) prediction model. You collect facts; a separate model computes \
the final probabilities, so be accurate and conservative.

Timing - this matters:
- The ticket is submitted on Thursday, before any of these matches. Many of \
them are played on Friday or Saturday, and official line-ups are published only \
about an hour before kickoff. So you can NEVER know the line-ups. Estimate who \
will be available as of today, and mark anything not yet certain as doubtful.
- Matches that are scheduled between today and this fixture (e.g. a Thursday \
night European game) have not been played yet: count them for fatigue, but \
their results and any injuries from them are unknown.

Rules:
- "home" always means the team hosting THIS fixture, "away" the visiting team.
- Every absence must have a source URL dated within the last 10 days. Do not \
include rumours or long-term absentees whose absence is already old news unless \
they are still out for this match.
- If you cannot find a value, use null (or 0 / empty list) instead of guessing.
- Write summary_he in Hebrew, 2-4 sentences: the key reasons for your estimate.
- When done, call submit_match_research. Do not answer in plain text.

Israeli matches (most of the form - Ligat HaAl, Liga Leumit, sometimes Liga \
Alef, the State Cup and the Toto Cup):
- Search in Hebrew, using the Hebrew club names from the form. English coverage \
of Israeli football is thin, especially below Ligat HaAl.
- Israel Football Association, football.org.il (ההתאחדות לכדורגל): fixtures, \
results, tables, past meetings between the clubs (for h2h), and the \
disciplinary court decisions (בית הדין המשמעתי) - suspensions (הרחקות, צהובים \
מצטברים) and penalties such as a match without fans (משחק ללא קהל) or a ban on \
away fans (איסור כניסת אוהדי חוץ).
- Injuries and expected line-ups: Israeli sports media - one.co.il, sport5.co.il, \
ynet sport, walla sport, Israel Hayom sport, Maariv sport - and the clubs' \
official sites and social accounts. Transfermarkt covers Ligat HaAl and Liga \
Leumit squads and injuries.
- Venue: many Israeli clubs share stadiums or play "home" games away from their \
city during renovations or after penalties. Set neutral=true when the home team \
does not play at its usual home ground.
- Odds for Liga Leumit and lower leagues are often missing online; then set odds \
to null and put extra care into agent_estimate (table, form, home/away records)."""

RESEARCH_PROMPT = """Today is {today}. Research this Toto 16 match (round {round_number}, match {index}):

{home_en} (home) vs {away_en} (away)
Hebrew on the form: {home_he} - {away_he}
League: {league}. Kickoff: {kickoff}.

Collect:
1. odds: current decimal 1/X/2 odds from a major bookmaker or odds comparison \
site (e.g. oddsportal, flashscore). null if this match has no odds online.
2. agent_estimate: your own 1/X/2 probability estimate (summing to 1) based on \
form, table position, strength (Elo/xG where available) and everything below.
3. h2h: results of all meetings between the two clubs in the last 10 years \
(any venue, all competitions), counted from the perspective of this fixture's \
home team.
4. absences: injured / suspended players for both teams, as known today. \
status "out" = confirmed to miss this match (suspension, long injury, club \
statement); "doubtful" = a race against time, a knock, or "will be assessed". \
Suspensions for this match are usually already known - check them. Use \
predicted line-ups from previews and the latest coach press conference. \
importance 0-1: 1 = star or first-choice goalkeeper, 0.5 = regular starter, \
0.2 = squad player.
5. fatigue: days between each team's previous match and this one - counting \
matches still scheduled before this fixture, such as a Thursday European game - \
and matches each team has in the 14 days up to this fixture (including cups and \
European games). *_matches_before_unplayed = how many of those are still \
scheduled after today.
5b. rotation_risk: chance the coach rests key players because of a more \
important match soon after (e.g. Champions League midweek, cup final): none / \
low / high.
6. internationals: number of key players per team who played for their \
national team in the last international break and returned with long travel \
(relevant only if the break ended within the last ~7 days, else 0).
7. venue: stadium, whether it is neutral ground, whether the home team plays \
without fans (fan ban penalty), whether away fans are banned.
8. form: last 6 results per team as a string like WWDLWD (most recent last).
9. motivation (title race, relegation, cup distraction, derby, new coach) and \
other_factors (weather, pitch, off-field issues, referee) in short English.
10. confidence 0-1 in your data quality, and the Hebrew summary.
"""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def _call_with_submit(client, system: str | None, prompt: str, submit_tool: dict) -> dict:
    """Run the web-research loop until the model calls the submit tool."""
    messages: list = [{"role": "user", "content": prompt}]
    kwargs = {}
    if system:
        kwargs["system"] = system
    for _ in range(MAX_STEPS):
        response = client.beta.messages.create(
            model=config.MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": config.EFFORT},
            tools=[*WEB_TOOLS, submit_tool],
            messages=messages,
            **kwargs,
        )
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Model refused: {response.stop_details}")
        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == submit_tool["name"]:
                return dict(block.input)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason == "pause_turn":
            continue  # server-side search loop paused; resend to resume
        messages.append(
            {"role": "user", "content": f"Call {submit_tool['name']} now with what you have found."}
        )
    raise RuntimeError(f"{submit_tool['name']} was not called after {MAX_STEPS} steps")


def _today() -> str:
    return dt.date.today().isoformat()


def find_round(client=None) -> dict:
    client = client or _client()
    data = _call_with_submit(client, None, ROUND_PROMPT.format(today=_today()), ROUND_TOOL)
    data["matches"] = sorted(data["matches"], key=lambda m: m["index"])
    if len(data["matches"]) != config.MATCH_COUNT:
        raise RuntimeError(
            f"Expected {config.MATCH_COUNT} matches on the form, got {len(data['matches'])}"
        )
    return data


def research_match(match: dict, round_number: str, client=None) -> dict:
    client = client or _client()
    prompt = RESEARCH_PROMPT.format(today=_today(), round_number=round_number, **match)
    return _call_with_submit(client, RESEARCH_SYSTEM, prompt, RESEARCH_TOOL)


def research_all(matches: list[dict], round_number: str, client=None) -> list[dict | None]:
    """Research every match concurrently. A failed match yields None."""
    client = client or _client()

    def one(match):
        try:
            return research_match(match, round_number, client)
        except Exception:  # keep the other 15 matches going
            log.exception("Research failed for match %s", match.get("index"))
            return None

    with ThreadPoolExecutor(max_workers=config.RESEARCH_WORKERS) as pool:
        return list(pool.map(one, matches))
