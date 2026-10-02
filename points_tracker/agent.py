"""Food research agent: Claude with web search finds nutrition data for foods.

Same idea as the in-app agent (web/src/lib/ai.js): the model fills a fixed
schema through a strict ``submit_*`` tool and the points are computed here
with the deterministic formula in ``points.py``.
"""

from __future__ import annotations

import datetime as dt
import logging
import os
import threading

import anthropic

from points_tracker.points import points_for_grams, round1

log = logging.getLogger(__name__)

MODEL = os.environ.get("POINTS_MODEL", "").strip() or "claude-opus-5-5"
EFFORT = os.environ.get("POINTS_EFFORT", "").strip() or "medium"
MAX_STEPS = 10
WEB_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": int(os.environ.get("POINTS_MAX_SEARCHES") or 6)},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": int(os.environ.get("POINTS_MAX_FETCHES") or 3)},
]

# USD per million tokens: (input, output, cache read). Cache writes cost 1.25x input.
PRICES = {
    "claude-opus-5-5": (4.0, 20.0, 0.20),
    "claude-sonnet-5-5": (2.0, 10.0, 0.20),
    "claude-haiku-4-5": (1.0, 5.0, 0.10),
}
SEARCH_PRICE = 10.0 / 1000


class Usage:
    """Thread-safe running total of tokens, searches and estimated cost."""

    def __init__(self):
        self._lock = threading.Lock()
        self.calls = self.input_tokens = self.output_tokens = self.searches = 0
        self.cost = 0.0

    def add(self, model: str, usage) -> None:
        if usage is None:
            return

        def n(obj, name):
            return getattr(obj, name, 0) or 0

        inp, out = n(usage, "input_tokens"), n(usage, "output_tokens")
        cache_read, cache_write = n(usage, "cache_read_input_tokens"), n(usage, "cache_creation_input_tokens")
        searches = n(getattr(usage, "server_tool_use", None), "web_search_requests")
        p_in, p_out, p_cache = PRICES.get(model, PRICES["claude-opus-5-5"])
        cost = (inp * p_in + out * p_out + cache_read * p_cache + cache_write * p_in * 1.25) / 1e6
        cost += searches * SEARCH_PRICE
        with self._lock:
            self.calls += 1
            self.input_tokens += inp + cache_read + cache_write
            self.output_tokens += out
            self.searches += searches
            self.cost += cost

    def summary(self) -> dict:
        return {
            "api_calls": self.calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "web_searches": self.searches,
            "estimated_cost_usd": round(self.cost, 2),
        }


USAGE = Usage()


def _obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


NUTRITION = _obj({k: {"type": "number"} for k in ("kcal", "protein", "carbs", "fat", "fiber")})

FOOD_TOOL = {
    "name": "submit_food",
    "description": "Submit the researched nutrition data for the requested food.",
    "strict": True,
    "input_schema": _obj(
        {
            "found": {"type": "boolean", "description": "false if no reliable data was found"},
            "name": {"type": "string", "description": "Canonical Hebrew name (brand included for packaged products)"},
            "aliases": {"type": "array", "items": {"type": "string"}},
            "serving_desc": {"type": "string", "description": 'Hebrew common serving, e.g. "יחידה", "פרוסה", "כוס"'},
            "serving_grams": {"type": "number"},
            "per100": NUTRITION,
            "published_points": {
                "type": ["number", "null"],
                "description": "Points per serving if an Israeli points-diet source publishes one, else null",
            },
            "sources": {"type": "array", "items": {"type": "string"}},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
            "notes_he": {"type": "string"},
        }
    ),
}

DISCOVER_TOOL = {
    "name": "submit_missing_foods",
    "description": "Submit foods that are missing from the database and worth adding.",
    "strict": True,
    "input_schema": _obj(
        {
            "foods": {
                "type": "array",
                "items": _obj(
                    {
                        "name": {"type": "string", "description": "Specific Hebrew name, with brand for products"},
                        "why": {"type": "string", "description": "Where you saw it / why it is popular"},
                    }
                ),
            }
        }
    ),
}

RESEARCH_SYSTEM = """You research nutrition data for an Israeli diet-points app. The app computes \
points from protein, carbs, fat and fiber per 100 g, so those numbers must be accurate.

Where to look (search in Hebrew first):
- The manufacturer's site or the product page at Israeli supermarkets (shufersal.co.il, \
rami-levy.co.il, yochananof.co.il, victoryonline.co.il) - the nutrition table is on the package.
- The Ministry of Health Tzameret food composition database and nutrition sites (foodsdictionary.co.il).
- Restaurant / chain menus that publish nutrition values.
- Israeli points-diet sites, forums and Facebook groups, for a published points value per serving.
- International databases (USDA FoodData Central) only for generic foods.

Use the most common serving in Israel (unit, slice, cup, package). If values disagree, prefer the \
manufacturer label. Put the URLs you used in sources. If you find nothing reliable, set found=false. \
Call submit_food. Do not answer in plain text."""

DISCOVER_PROMPT = """Today is {today}. An Israeli diet-points app has the food database below. \
Scan Israeli sources to find up to {count} foods that Israelis commonly eat and that are MISSING \
from it: new and popular supermarket products (shufersal.co.il, rami-levy.co.il, manufacturers' \
new-product pages), popular dishes and street food, restaurant / café chain items, and foods that \
people ask about in Israeli points-diet sites, forums and groups.

Rules:
- Each name must be specific enough to look up one nutrition table (brand + product for packaged \
food; a typical portion for dishes, e.g. "שקשוקה (מנה במסעדה)").
- Skip anything already covered by the database, even under a different wording.
- Prefer foods people eat often over rare ones.

Current database:
{names}

Call submit_missing_foods. Do not answer in plain text."""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def _call_with_submit(client, system: str | None, prompt: str, submit_tool: dict) -> dict:
    """Run the web-research loop until the model calls the submit tool."""
    messages: list = [{"role": "user", "content": prompt}]
    kwargs = {"system": system} if system else {}
    for _ in range(MAX_STEPS):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": EFFORT},
            tools=[*WEB_TOOLS, submit_tool],
            messages=messages,
            **kwargs,
        )
        USAGE.add(MODEL, getattr(response, "usage", None))
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Model refused: {response.stop_details}")
        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == submit_tool["name"]:
                return dict(block.input)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason == "pause_turn":
            continue  # server-side search loop paused; resend to resume
        messages.append({"role": "user", "content": f"Call {submit_tool['name']} now with what you have found."})
    raise RuntimeError(f"{submit_tool['name']} was not called after {MAX_STEPS} steps")


def _today() -> str:
    return dt.date.today().isoformat()


def to_db_entry(result: dict) -> dict | None:
    """Turn a submit_food result into a foods.json entry (None if nothing usable was found)."""
    grams = result.get("serving_grams") or 0
    per100 = result.get("per100") or {}
    if not result.get("found") or grams <= 0 or not per100:
        return None
    entry = {
        "name": f'{result["name"]} ({result["serving_desc"]})',
        "points": round1(points_for_grams(per100, grams)),
        "grams": grams,
        "per100": per100,
        "source": "agent",
        "confidence": result.get("confidence", "medium"),
        "added": _today(),
    }
    if result.get("aliases"):
        entry["aliases"] = result["aliases"]
    if result.get("published_points") is not None:
        entry["published_points"] = result["published_points"]
    if result.get("sources"):
        entry["sources"] = result["sources"][:5]
    return entry


def research_food(query: str, client=None) -> dict:
    client = client or _client()
    prompt = f"Today is {_today()}. Find nutrition data for: {query}"
    return _call_with_submit(client, RESEARCH_SYSTEM, prompt, FOOD_TOOL)


def discover_missing(existing_names: list[str], count: int, client=None) -> list[dict]:
    client = client or _client()
    prompt = DISCOVER_PROMPT.format(today=_today(), count=count, names="\n".join(existing_names))
    return _call_with_submit(client, None, prompt, DISCOVER_TOOL)["foods"][:count]
