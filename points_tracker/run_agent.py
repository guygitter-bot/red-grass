"""Find points for foods missing from the shared database and add them.

Sources of work, combined in one run:
- FOODS: names separated by ";" or new lines (manual workflow input).
- --issues: open GitHub issues labelled "food-request" opened by allowed authors.
  Each issue is answered with the result and closed.
- --discover N: the agent scans Israeli sources for N popular foods that are missing.

Writes points_tracker/data/foods.json; the workflow commits it and redeploys the app.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from points_tracker import agent, db  # noqa: E402

log = logging.getLogger("points_agent")
LABEL = "food-request"
WORKERS = int(os.environ.get("POINTS_WORKERS") or 3)


def split_foods(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[;\n]", text or "") if s.strip()]


def issue_food_name(title: str) -> str:
    """'ניקוד: במבה נוגט' -> 'במבה נוגט'."""
    return re.sub(r"^\s*(ניקוד|נקד|food|points)\s*[:\-]\s*", "", title, flags=re.I).strip()


def _gh(*args: str) -> str:
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def open_issues() -> list[dict]:
    allowed = {a.strip().lower() for a in (os.environ.get("ALLOWED_AUTHORS") or "").split(",") if a.strip()}
    raw = _gh("issue", "list", "--label", LABEL, "--state", "open", "--limit", "50", "--json", "number,title,author")
    issues = json.loads(raw)
    if allowed:  # issue titles go into the prompt: only trusted people may queue work
        issues = [i for i in issues if i["author"]["login"].lower() in allowed]
    return issues


def answer_issue(number: int, body: str, close: bool) -> None:
    _gh("issue", "comment", str(number), "--body", body)
    if close:
        _gh("issue", "close", str(number), "--reason", "completed")


def research_many(names: list[str], client=None) -> dict[str, dict | Exception]:
    def one(name):
        try:
            return name, agent.research_food(name, client)
        except Exception as exc:  # keep the other foods going
            log.exception("Research failed for %s", name)
            return name, exc

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return dict(pool.map(one, names))


def process(data: dict, requests: list[dict], client=None) -> list[dict]:
    """requests: [{"name": ..., "issue": number|None}]. Returns one report row per request."""
    reports, todo = [], []
    for req in requests:
        existing = db.find(data, req["name"])
        if existing:
            reports.append({**req, "status": "exists", "food": existing})
        else:
            todo.append(req)

    results = research_many([r["name"] for r in todo], client)
    for req in todo:
        result = results[req["name"]]
        if isinstance(result, Exception):
            reports.append({**req, "status": "error", "error": str(result)})
            continue
        entry = agent.to_db_entry(result)
        if entry is None:
            reports.append({**req, "status": "not_found", "notes": result.get("notes_he", "")})
        elif db.add(data, entry):
            reports.append({**req, "status": "added", "food": entry})
        else:
            reports.append({**req, "status": "exists", "food": db.find(data, entry["name"])})
    return reports


def issue_comment(report: dict) -> str:
    food = report.get("food") or {}
    if report["status"] == "added":
        lines = [
            f'✅ נוסף למאגר: **{food["name"]}** = **{food["points"]} נקודות**',
            f'({food["grams"]} גרם; ל-100 גרם: חלבון {food["per100"]["protein"]}, פחמימות {food["per100"]["carbs"]}, '
            f'שומן {food["per100"]["fat"]}, סיבים {food["per100"]["fiber"]})',
        ]
        if food.get("published_points") is not None:
            lines.append(f'ערך שפורסם ברשת: {food["published_points"]} נקודות')
        lines += [f"- {s}" for s in food.get("sources", [])]
        lines.append("\nהאפליקציה תתעדכן בעוד כמה דקות.")
        return "\n".join(lines)
    if report["status"] == "exists":
        return f'ℹ️ כבר קיים במאגר: **{food["name"]}** = {food["points"]} נקודות'
    if report["status"] == "not_found":
        return f'🤷 הסוכן לא מצא מידע אמין. {report.get("notes", "")}\nאפשר לפתוח בקשה חדשה עם שם מדויק יותר (כולל יצרן).'
    return f'⚠️ שגיאה בחיפוש: {report.get("error", "")}\nאנסה שוב בהרצה הבאה.'


def summary_markdown(reports: list[dict], discovered: list[dict]) -> str:
    rows = ["| בקשה | תוצאה | נקודות |", "|---|---|---|"]
    for r in reports:
        food = r.get("food") or {}
        rows.append(f'| {r["name"]} | {r["status"]} {food.get("name", "")} | {food.get("points", "")} |')
    text = "## Points agent\n\n" + "\n".join(rows)
    if discovered:
        text += "\n\n### Discovered\n" + "\n".join(f'- {d["name"]}: {d["why"]}' for d in discovered)
    text += f"\n\nUsage: `{json.dumps(agent.USAGE.summary())}`\n"
    return text


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issues", action="store_true", help="process open food-request issues")
    parser.add_argument("--discover", type=int, default=0, help="find N popular foods missing from the db")
    parser.add_argument("--dry-run", action="store_true", help="do not write the db or touch issues")
    args = parser.parse_args(argv)

    data = db.load()
    requests = [{"name": n, "issue": None} for n in split_foods(os.environ.get("FOODS", ""))]

    issues = open_issues() if args.issues else []
    requests += [{"name": issue_food_name(i["title"]), "issue": i["number"]} for i in issues]

    discovered = []
    if args.discover > 0:
        discovered = agent.discover_missing([f["name"] for f in data["foods"]], args.discover)
        requests += [{"name": d["name"], "issue": None} for d in discovered]

    # One research per distinct name, even if it was requested twice.
    seen, unique = set(), []
    for req in requests:
        key = db.normalize(req["name"])
        if key and key not in seen:
            seen.add(key)
            unique.append(req)
    duplicates = [r for r in requests if db.normalize(r["name"]) and r not in unique]

    reports = process(data, unique)
    by_name = {db.normalize(r["name"]): r for r in reports}
    reports += [{**by_name[db.normalize(d["name"])], "issue": d["issue"]} for d in duplicates]

    added = [r for r in reports if r["status"] == "added"]
    log.info("Requests: %d, added: %d, usage: %s", len(reports), len(added), agent.USAGE.summary())

    if not args.dry_run:
        if added:
            db.save(data)
        for r in reports:
            if r.get("issue"):
                answer_issue(r["issue"], issue_comment(r), close=r["status"] != "error")

    summary = summary_markdown(reports, discovered)
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
