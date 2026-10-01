"""Weekly Toto 16 run: find the form, research, predict, build ticket, notify.

Environment variables:
  ANTHROPIC_API_KEY        Claude API key (required unless DEMO=1).
  MANUAL_MATCHES           Optional. 16 matches "מארחת - אורחת", one per line or separated by ";",
                           to skip finding the form.
  MANUAL_ROUND             Optional round number to use with MANUAL_MATCHES.
  MANUAL_FIRST_KICKOFF     Optional first kickoff with MANUAL_MATCHES, e.g. 2026-10-03T19:30
                           (Israel time); the form closes 6 minutes earlier.
  DRY_RUN=1                Build and save the ticket but do not send notifications.
  DEMO=1                   No API calls: use canned research (for testing the pipeline).
  TOTO_SITE_URL            Link to the web app, included in the notifications.
  CALLMEBOT_PHONE / CALLMEBOT_APIKEY, GMAIL_ADDRESS / GMAIL_APP_PASSWORD, TOTO_EMAIL_TO
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toto_predictor import closing, config, model, notify, optimizer, weather  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent / "data"
log = logging.getLogger("toto")


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


def parse_manual_matches(text: str) -> list[dict]:
    matches = []
    for line in text.replace(";", "\n").splitlines():
        line = line.strip()
        if not line:
            continue
        for sep in (" - ", " – ", "-", "–"):
            if sep in line:
                home, away = (s.strip() for s in line.split(sep, 1))
                break
        else:
            raise ValueError(f"Cannot split match line (expected 'home - away'): {line!r}")
        matches.append(
            {
                "index": len(matches) + 1,
                "home_he": home,
                "away_he": away,
                "home_en": home,
                "away_en": away,
                "league": "unknown",
                "kickoff": "unknown",
            }
        )
    if len(matches) != config.MATCH_COUNT:
        raise ValueError(f"Expected {config.MATCH_COUNT} manual matches, got {len(matches)}")
    return matches


def get_round(agent) -> dict:
    manual = os.environ.get("MANUAL_MATCHES", "").strip()
    if manual:
        first = closing.parse_time(os.environ.get("MANUAL_FIRST_KICKOFF", "").strip())
        close = first - dt.timedelta(minutes=config.CLOSE_BEFORE_KICKOFF_MINUTES) if first else None
        return {
            "round_number": os.environ.get("MANUAL_ROUND", "").strip()
            or f"manual-{dt.date.today().isoformat()}",
            "close_time": close.isoformat() if close else None,
            "source_url": "manual",
            "matches": parse_manual_matches(manual),
        }
    return agent.find_round()


def add_weather(matches: list[dict], research: list[dict | None], fetch=None) -> None:
    """Attach the kickoff-hour forecast to each researched match (best effort)."""
    for match, res in zip(matches, research):
        if not res:
            continue
        venue = res.get("venue") if isinstance(res.get("venue"), dict) else {}
        lat, lon = model._num(venue.get("latitude")), model._num(venue.get("longitude"))
        kickoff = closing.parse_time(match.get("kickoff"))
        if lat is None or lon is None or kickoff is None:
            continue
        try:
            kwargs = {"fetch": fetch} if fetch else {}
            res["weather"] = weather.kickoff_weather(lat, lon, kickoff, **kwargs)
        except Exception:  # weather is a nice-to-have; never fail the run
            log.warning("Weather lookup failed for match %s", match.get("index"), exc_info=True)


def build_result(round_info: dict, research: list[dict | None]) -> dict:
    matches = []
    for match, res in zip(round_info["matches"], research):
        pred = model.predict(res or {})
        kickoff = closing.parse_time(match.get("kickoff"))
        local = kickoff.astimezone(closing.ISRAEL) if kickoff else None
        matches.append(
            {
                **match,
                "kickoff_local": local.strftime("%d.%m %H:%M") if local else None,
                "research": res,
                "researched": res is not None,
                **pred,
            }
        )

    ticket, alternatives = optimizer.build_ticket(
        [m["prob"] for m in matches], config.max_columns(), config.COLUMN_PRICE
    )
    for m, cover in zip(matches, ticket.covers):
        m["cover"] = cover

    def ticket_dict(t: optimizer.Ticket) -> dict:
        return {
            "doubles": t.shape.doubles,
            "triples": t.shape.triples,
            "columns": t.columns,
            "cost": t.cost,
            "p16": round(t.p16, 6),
        }

    close, close_source = closing.close_time(round_info["matches"], round_info.get("close_time"))
    return {
        "round_number": str(round_info["round_number"]),
        "close_time": close.isoformat() if close else None,
        "close_time_source": close_source,
        "first_kickoff_rule_minutes": config.CLOSE_BEFORE_KICKOFF_MINUTES,
        "source_url": round_info.get("source_url"),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "column_price": config.COLUMN_PRICE,
        "budget": config.BUDGET,
        "site_url": os.environ.get("TOTO_SITE_URL", "").strip() or None,
        "ticket": ticket_dict(ticket),
        "alternatives": [{**ticket_dict(t), "covers": t.covers} for t in alternatives],
        "matches": matches,
    }


def save(result: dict, data_dir: Path = DATA_DIR) -> Path:
    rounds = data_dir / "rounds"
    rounds.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in result["round_number"])
    path = rounds / f"{safe}.json"
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    path.write_text(payload, encoding="utf-8")
    (data_dir / "latest.json").write_text(payload, encoding="utf-8")

    index = sorted(p.stem for p in rounds.glob("*.json"))
    (data_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    return path


def agent_module():
    """The research agent, or the offline demo stand-in when DEMO=1."""
    if _flag("DEMO"):
        from toto_predictor import demo

        return demo
    from toto_predictor import agent

    return agent


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    agent = agent_module()
    round_info = get_round(agent)
    log.info("Round %s: %d matches", round_info["round_number"], len(round_info["matches"]))
    research = agent.research_all(round_info["matches"], str(round_info["round_number"]))
    if not _flag("DEMO"):
        add_weather(round_info["matches"], research)
    usage = agent.USAGE.summary() if agent.USAGE else None
    if usage:
        log.info("API usage: %s", usage)
    failed = sum(r is None for r in research)
    if failed > config.MATCH_COUNT // 2:
        log.error("Research failed for %d matches; not publishing a ticket", failed)
        return 1

    result = build_result(round_info, research)
    result["usage"] = usage
    path = save(result)
    log.info("Saved %s", path)
    print(notify.ticket_text(result))

    close = closing.parse_time(result["close_time"])
    if close and close <= dt.datetime.now(dt.timezone.utc):
        log.error("The form already closed at %s; not sending notifications", result["close_time"])
        return 1
    if _flag("DRY_RUN"):
        log.info("DRY_RUN: skipping notifications")
    else:
        notify.notify(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
