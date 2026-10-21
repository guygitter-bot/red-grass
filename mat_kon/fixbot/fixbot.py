"""Helper for .github/workflows/mat-kon-fix.yml ("send to Claude" from the mat-kon admin app's issues screen).

  start    mark the request as "working" (labels are what the app shows)
  prepare  read the issue and its comments, download the owner's screenshots, write .fix/prompt.txt
  check    read .fix/result.json and the changed files, decide what to publish
  report   comment on the issue (the app shows the last comment) and set the status label

The owner approves the PR from inside the admin app (api/fixes.js merges it).

Uses only the standard library. GitHub calls use GH_TOKEN; screenshots are downloaded from the mat-kon
server with an owner session (OWNER_PASSWORD), because the repository is public.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FIX = Path(".fix")
PROMPT = Path(__file__).with_name("prompt.md")
BOT_LOGIN = "github-actions[bot]"
SHOT_RE = re.compile(r"<!-- matkon-fix-shot: (\d{8}-[A-Za-z0-9_-]{16,40}) -->")
MAX_SHOTS = 6


def env(name: str) -> str:
    return os.environ.get(name, "").strip()


def github(path: str, data: dict | None = None, method: str | None = None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{env('GITHUB_REPOSITORY')}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        method=method or ("POST" if data is not None else "GET"),
        headers={
            "authorization": f"Bearer {env('GH_TOKEN')}",
            "accept": "application/vnd.github+json",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read() or b"null")


def output(**values: str) -> None:
    with open(env("GITHUB_OUTPUT") or os.devnull, "a", encoding="utf-8") as f:
        for key, value in values.items():
            f.write(f"{key}={value}\n")


def conversation(issue: dict, comments: list[dict]) -> str:
    parts = [f"Title: {issue['title']}\n\n{(issue.get('body') or '').strip()}"]
    for c in comments:
        who = "Claude (earlier run)" if c["user"]["login"] == BOT_LOGIN else "App owner"
        parts.append(f"--- {who}:\n{c['body'].strip()}")
    return "\n\n".join(parts)


def set_status(number: str, label: str) -> None:
    github(f"/issues/{number}/labels", {"labels": ["matkon-fix", label]}, method="PUT")


def start() -> None:
    set_status(env("ISSUE"), "matkon-working")


def api(path: str, data: dict | None = None, session: str = "", raw: bool = False):
    base = env("API") or "https://mat-kon-api.guygitter.workers.dev"
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        method="POST" if data is not None else "GET",
        headers={
            "content-type": "application/json",
            "origin": "https://mat-kon-admin.pages.dev",
            **({"authorization": f"Bearer {session}"} if session else {}),
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
    return body if raw else json.loads(body or b"null")


def shot_ids(issue: dict, comments: list[dict]) -> list[str]:
    """Screenshot ids the server wrote, only in the issue body or in comments by the repository owner."""
    owner = env("GITHUB_REPOSITORY").split("/")[0]
    texts = [issue.get("body") or ""] + [c["body"] for c in comments if c["user"]["login"] == owner]
    ids: list[str] = []
    for text in texts:
        for match in SHOT_RE.findall(text):
            if match not in ids:
                ids.append(match)
    return ids[-MAX_SHOTS:]


def download_shots(ids: list[str]) -> str:
    if not ids:
        return "No screenshots were attached."
    if not env("OWNER_PASSWORD"):
        return "The owner attached screenshots, but they could not be downloaded (no OWNER_PASSWORD)."
    saved: list[str] = []
    session = ""
    try:
        session = api("/owner-login", {"password": env("OWNER_PASSWORD")}).get("session", "")
        for i, shot in enumerate(ids, start=1):
            path = FIX / f"screenshot-{i}.jpg"
            path.write_bytes(api(f"/admin/fix-shot/{urllib.parse.quote(shot)}", session=session, raw=True))
            saved.append(str(path))
    except Exception as err:  # noqa: BLE001 - a missing screenshot should not stop the fix
        print(f"::warning::Could not download a screenshot: {err}")
    finally:
        if session:
            try:
                api("/logout", {}, session=session)
            except Exception:  # noqa: BLE001
                pass
    if not saved:
        return "The owner attached screenshots, but they could not be downloaded."
    return "The owner attached screenshots (oldest first). Read them with the Read tool: " + ", ".join(saved)


def prepare() -> None:
    number = env("ISSUE")
    issue = github(f"/issues/{number}")
    comments = github(f"/issues/{number}/comments?per_page=100")
    FIX.mkdir(exist_ok=True)
    screenshots = download_shots(shot_ids(issue, comments))
    prompt = PROMPT.read_text(encoding="utf-8").format(issue=number, request=conversation(issue, comments), screenshots=screenshots)
    (FIX / "prompt.txt").write_text(prompt, encoding="utf-8")


def changed_files() -> list[str]:
    out = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"], capture_output=True, text=True, check=True
    ).stdout
    files = [line[3:].split(" -> ")[-1].strip('"') for line in out.splitlines() if line.strip()]
    return [f for f in files if not f.startswith(".fix/")]


def read_result() -> dict:
    try:
        result = json.loads((FIX / "result.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"status": "error"}
    return result if isinstance(result, dict) else {"status": "error"}


def decide(result: dict, files: list[str]) -> str:
    status = result.get("status")
    if status == "no_bug":
        return "no_bug"
    if status not in ("fixed", "question", "too_big"):
        return "error"
    if status != "fixed":
        return status
    if not files:
        return "nochange"
    if any(not f.startswith("mat_kon/") or f.startswith("mat_kon/fixbot/") for f in files):
        return "outside"
    return "fixed"


def check() -> None:
    result = read_result()
    files = changed_files()
    status = decide(result, files)
    print(f"status={status} files={files}")
    if status == "fixed":
        title = (result.get("title") or "mat-kon: fix from the admin app").strip().splitlines()[0][:72]
        (FIX / "commit.txt").write_text(f"{title} (#{env('ISSUE')})\n\n{result.get('summary_he', '')}\n", encoding="utf-8")
        (FIX / "pr.md").write_text(
            f"תיקון לתקלה #{env('ISSUE')} מאפליקציית הניהול של mat-kon. מאשרים מתוך אפליקציית הניהול (\"לאשר ולהעלות\").\n\n"
            f"{result.get('summary_he', '')}\n\n"
            f"קבצים: {', '.join(files)}\n",
            encoding="utf-8",
        )
    output(status=status)


def cost() -> str:
    try:
        value = json.loads((FIX / "claude.json").read_text(encoding="utf-8")).get("total_cost_usd")
    except (OSError, ValueError, AttributeError):
        return ""
    return f" (עלות משוערת: ${value:.2f})" if isinstance(value, (int, float)) else ""


def message(status: str, result: dict, tests: str, publish: str, run_url: str) -> tuple[str, str]:
    """Returns (Hebrew text for the app, status label)."""
    if status == "fixed" and tests == "success" and publish == "success":
        return f"✅ {result.get('summary_he', '') or 'השינוי מוכן.'}", "matkon-ready"
    if status == "fixed" and tests == "failure":
        return f"Claude ניסה לתקן, אבל הבדיקות נכשלו, אז שום דבר לא השתנה. אפשר לנסות שוב.\n{run_url}", "matkon-failed"
    if status == "fixed":
        return f"השינוי מוכן, אבל לא הצלחתי לשמור אותו. אפשר לנסות שוב.\n{run_url}", "matkon-failed"
    if status == "question":
        return result.get("question_he", "") or "מה בדיוק לשנות?", "matkon-question"
    if status == "no_bug":
        return f"🔎 {result.get('summary_he', '') or 'בדקתי – זה לא באג בקוד, אין מה לתקן.'}", "matkon-nobug"
    if status == "too_big":
        plan = result.get("plan_he", "")
        return f"זה שינוי גדול, אז לפני שמתחילים, זו התוכנית:\n{plan}\n\nכדי לאשר, כתבו \"מאושר\".", "matkon-question"
    if status == "nochange":
        return result.get("summary_he", "") or "לא מצאתי מה לשנות. אפשר לכתוב עוד פרטים?", "matkon-question"
    if status == "outside":
        return f"התיקון נגע בקבצים מחוץ לאפליקציה, אז הוא לא נשמר. אפשר לנסות שוב.\n{run_url}", "matkon-failed"
    return f"משהו השתבש בטיפול בבקשה. אפשר לנסות שוב.\n{run_url}", "matkon-failed"


def report() -> None:
    number = env("ISSUE")
    status = env("STATUS") or "error"
    run_url = f"{env('GITHUB_SERVER_URL')}/{env('GITHUB_REPOSITORY')}/actions/runs/{env('GITHUB_RUN_ID')}"
    text, label = message(status, read_result(), env("TESTS"), env("PUBLISH"), run_url)
    github(f"/issues/{number}/comments", {"body": text + cost()})
    set_status(number, label)


if __name__ == "__main__":
    {"start": start, "prepare": prepare, "check": check, "report": report}[sys.argv[1]]()
