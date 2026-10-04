"""Helper for .github/workflows/bis-fix.yml ("send a fix" requests from the app).

  prepare  read the issue and its comments, download the screenshot, write .fix/prompt.txt
  check    read .fix/result.json and the changed files, decide what to publish
  report   comment on the issue, close it when published, and send the owner a WhatsApp message

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
STAGING_URL = "https://staging.bis-app.pages.dev"
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
        who = "Claude (earlier run)" if c["user"]["login"] == BOT_LOGIN else "App owner"
        parts.append(f"--- {who}:\n{c['body'].strip()}")
    return "\n\n".join(parts)


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
            f"תיקון אוטומטי לבקשה #{env('ISSUE')} מהאפליקציה.\n\n{result.get('summary_he', '')}\n\n"
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


def message(status: str, result: dict, tests: str, publish: str, pr: str, run_url: str) -> tuple[str, bool]:
    """Returns (Hebrew text, close the issue)."""
    if status == "fixed" and tests == "success" and publish == "success":
        return (
            f"✅ התיקון מוכן לבדיקה ב-{STAGING_URL}\n\n{result.get('summary_he', '')}\n\n"
            f"השינוי: {pr}\nאם משהו לא בסדר, כתבו כאן תגובה ו-Claude ימשיך.",
            True,
        )
    if status == "fixed" and tests == "failure":
        return f"⚠️ Claude ניסה לתקן, אבל הבדיקות נכשלו, אז שום דבר לא עלה.\nפרטים: {run_url}", False
    if status == "fixed":
        return f"⚠️ התיקון מוכן, אבל ההעלאה ל-staging נכשלה.\nפרטים: {run_url}", False
    if status == "question":
        return f"❓ Claude צריך הבהרה:\n{result.get('question_he', '')}\n\nכתבו את התשובה בתגובה כאן.", False
    if status == "too_big":
        return f"📋 זה שינוי גדול, אז Claude מציע תוכנית לפני שמתחילים:\n{result.get('plan_he', '')}\n\nכדי לאשר, כתבו כאן תגובה (למשל \"מאושר\").", False
    if status == "nochange":
        return "ℹ️ Claude לא מצא מה לשנות בקוד. אפשר להוסיף פרטים בתגובה כאן.", False
    if status == "outside":
        return f"⚠️ התיקון נגע בקבצים מחוץ לאפליקציה, אז הוא לא הועלה.\nפרטים: {run_url}", False
    return f"⚠️ משהו השתבש בטיפול בבקשה.\nפרטים: {run_url}", False


def send_whatsapp(text: str) -> None:
    phone, apikey = env("CALLMEBOT_PHONE"), env("CALLMEBOT_APIKEY")
    if not phone or not apikey:
        print("CallMeBot is not configured; skipping WhatsApp")
        return
    query = urllib.parse.urlencode({"phone": phone, "text": text, "apikey": apikey})
    try:
        with urllib.request.urlopen(f"https://api.callmebot.com/whatsapp.php?{query}", timeout=30) as resp:
            resp.read()
    except Exception as err:  # noqa: BLE001 - the GitHub comment is enough
        print(f"::warning::WhatsApp failed: {err}")


def report() -> None:
    number = env("ISSUE")
    status = env("STATUS") or "error"
    run_url = f"{env('GITHUB_SERVER_URL')}/{env('GITHUB_REPOSITORY')}/actions/runs/{env('GITHUB_RUN_ID')}"
    text, close = message(status, read_result(), env("TESTS"), env("PUBLISH"), env("PR"), run_url)
    issue_url = f"{env('GITHUB_SERVER_URL')}/{env('GITHUB_REPOSITORY')}/issues/{number}"
    github(f"/issues/{number}/comments", {"body": text + cost()})
    if close:
        github(f"/issues/{number}", {"state": "closed", "state_reason": "completed"}, method="PATCH")
    send_whatsapp(f"ביס – בקשה #{number}\n{text}\n{issue_url}")


if __name__ == "__main__":
    {"prepare": prepare, "check": check, "report": report}[sys.argv[1]]()
