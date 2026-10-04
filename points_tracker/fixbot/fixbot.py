"""Helper for .github/workflows/bis-fix.yml ("send a fix" requests from the app).

  start    mark the request as "working" (labels are what the app shows)
  prepare  read the issue and its comments, download the screenshot, write .fix/prompt.txt
  check    read .fix/result.json and the changed files, decide what to publish
  report   comment on the issue (the app shows the last comment) and set the status label

The app user approves the PR from inside the app (proxy/feedback.js merges it).

Uses only the standard library. GitHub calls use GH_TOKEN; the screenshot needs ADMIN_CODE.
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
SHOT_RE = re.compile(r"<!-- bis-fix-screenshot: (\S+) -->")
BOT_LOGIN = "github-actions[bot]"


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


def screenshot_url(body: str) -> str | None:
    """The screenshot link the proxy wrote, only if it points to our worker."""
    found = SHOT_RE.findall(body or "")
    if not found:
        return None
    url = urllib.parse.urlparse(found[-1])
    if url.scheme != "https" or not url.hostname or not url.hostname.endswith(".workers.dev"):
        return None
    if url.path != "/feedback/image":
        return None
    return found[-1]


def conversation(issue: dict, comments: list[dict]) -> str:
    parts = [f"Title: {issue['title']}\n\n{SHOT_RE.sub('', issue.get('body') or '').strip()}"]
    for c in comments:
        who = "Claude (earlier run)" if c["user"]["login"] == BOT_LOGIN else "App user"
        parts.append(f"--- {who}:\n{c['body'].strip()}")
    return "\n\n".join(parts)


def set_status(number: str, label: str) -> None:
    github(f"/issues/{number}/labels", {"labels": ["bis-fix", label]}, method="PUT")


def start() -> None:
    set_status(env("ISSUE"), "bis-working")


def prepare() -> None:
    number = env("ISSUE")
    issue = github(f"/issues/{number}")
    comments = github(f"/issues/{number}/comments?per_page=100")
    FIX.mkdir(exist_ok=True)
    shot_note = "No screenshot was attached."
    url = screenshot_url(issue.get("body") or "")
    if url and env("ADMIN_CODE"):
        try:
            req = urllib.request.Request(url, headers={"x-admin-code": env("ADMIN_CODE")})
            with urllib.request.urlopen(req, timeout=30) as resp:
                (FIX / "screenshot.jpg").write_bytes(resp.read())
            shot_note = "The user attached a screenshot: read .fix/screenshot.jpg to see it."
        except Exception as err:  # noqa: BLE001 - a missing screenshot should not stop the fix
            print(f"::warning::Could not download the screenshot: {err}")
            shot_note = "The user attached a screenshot, but it could not be downloaded."
    prompt = PROMPT.read_text(encoding="utf-8").format(
        issue=number, request=conversation(issue, comments), screenshot=shot_note
    )
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
    if status not in ("fixed", "question", "too_big"):
        return "error"
    if status != "fixed":
        return status
    if not files:
        return "nochange"
    if any(not f.startswith("points_tracker/") for f in files):
        return "outside"
    return "fixed"


def check() -> None:
    result = read_result()
    files = changed_files()
    status = decide(result, files)
    print(f"status={status} files={files}")
    if status == "fixed":
        title = (result.get("title") or "Fix from the app").strip().splitlines()[0][:72]
        (FIX / "commit.txt").write_text(f"{title} (#{env('ISSUE')})\n\n{result.get('summary_he', '')}\n", encoding="utf-8")
        (FIX / "pr.md").write_text(
            f"תיקון לבקשה #{env('ISSUE')} מהאפליקציה. מאשרים מתוך האפליקציה (\"לאשר ולהעלות\").\n\n"
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
        return f"✅ {result.get('summary_he', '') or 'השינוי מוכן.'}", "bis-ready"
    if status == "fixed" and tests == "failure":
        return f"Claude ניסה לתקן, אבל הבדיקות נכשלו, אז שום דבר לא השתנה. אפשר לנסות שוב.\n{run_url}", "bis-failed"
    if status == "fixed":
        return f"השינוי מוכן, אבל לא הצלחתי לשמור אותו. אפשר לנסות שוב.\n{run_url}", "bis-failed"
    if status == "question":
        return result.get("question_he", "") or "מה בדיוק לשנות?", "bis-question"
    if status == "too_big":
        plan = result.get("plan_he", "")
        return f"זה שינוי גדול, אז לפני שמתחילים, זו התוכנית:\n{plan}\n\nכדי לאשר, כתבו \"מאושר\".", "bis-question"
    if status == "nochange":
        return "לא מצאתי מה לשנות. אפשר לכתוב עוד פרטים?", "bis-question"
    if status == "outside":
        return f"התיקון נגע בקבצים מחוץ לאפליקציה, אז הוא לא נשמר. אפשר לנסות שוב.\n{run_url}", "bis-failed"
    return f"משהו השתבש בטיפול בבקשה. אפשר לנסות שוב.\n{run_url}", "bis-failed"


def report() -> None:
    number = env("ISSUE")
    status = env("STATUS") or "error"
    run_url = f"{env('GITHUB_SERVER_URL')}/{env('GITHUB_REPOSITORY')}/actions/runs/{env('GITHUB_RUN_ID')}"
    text, label = message(status, read_result(), env("TESTS"), env("PUBLISH"), run_url)
    github(f"/issues/{number}/comments", {"body": text + cost()})
    set_status(number, label)


if __name__ == "__main__":
    {"start": start, "prepare": prepare, "check": check, "report": report}[sys.argv[1]]()
