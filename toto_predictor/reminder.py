"""Wednesday reminder: check there is enough API credit for Thursday's run.

Sends WhatsApp + email with a link to the billing page, the cost of the last
run, and the result of a tiny API probe (it fails when the balance is empty).

Environment: ANTHROPIC_API_KEY (optional, for the probe) and the same
notification variables as run_weekly.py.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from toto_predictor import notify  # noqa: E402

BILLING_URL = "https://platform.claude.com/settings/billing"
REPO = os.environ.get("GITHUB_REPOSITORY", "").strip() or "guygitter-bot/red-grass"
RUN_URL = f"https://github.com/{REPO}/actions/workflows/toto-weekly.yml"
LATEST = Path(__file__).resolve().parent / "data" / "latest.json"
log = logging.getLogger("toto.reminder")


def last_run_cost(path: Path = LATEST) -> float | None:
    try:
        usage = json.loads(path.read_text(encoding="utf-8")).get("usage") or {}
    except (OSError, ValueError):
        return None
    cost = usage.get("estimated_cost_usd")
    return float(cost) if isinstance(cost, (int, float)) else None


def probe_credit() -> str:
    """'ok', 'empty' (credit exhausted), 'error' or 'skipped' (no key)."""
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        return "skipped"
    import anthropic

    try:
        anthropic.Anthropic().messages.create(
            model="claude-haiku-4-5",
            max_tokens=1,
            messages=[{"role": "user", "content": "ping"}],
        )
    except anthropic.BadRequestError as e:
        if "credit balance" in str(e).lower():
            return "empty"
        log.warning("Probe failed: %s", e)
        return "error"
    except anthropic.APIError as e:
        log.warning("Probe failed: %s", e)
        return "error"
    return "ok"


PROBE_TEXT = {
    "ok": "✅ בדיקה: ה-API עונה, כלומר יש קרדיט. ודא שהיתרה מספיקה לריצה מלאה.",
    "empty": "❌ בדיקה: נגמר הקרדיט! בלי טעינה הריצה של מחר תיכשל.",
    "error": "⚠️ בדיקה: ה-API החזיר שגיאה אחרת. כדאי להיכנס ולבדוק.",
}


def reminder_text(cost: float | None, probe: str) -> str:
    body = []
    if cost is not None:
        body.append(f"הריצה האחרונה עלתה בערך {cost:.2f}$. כדאי שתהיה לפחות יתרה כזו, ועוד קצת מרווח.")
    if probe in PROBE_TEXT:
        body.append(PROBE_TEXT[probe])
    lines = ["⏰ תזכורת: מחר (חמישי) מפעילים את הסוכן של טוטו 16. לפני כן כדאי לבדוק שיש מספיק קרדיט."]
    if body:
        lines += ["", *body]
    lines += ["", f"היתרה וטעינת קרדיט: {BILLING_URL}", f"הפעלת הסוכן (Run workflow): {RUN_URL}"]
    return "\n".join(lines)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    text = reminder_text(last_run_cost(), probe_credit())
    print(text)
    if os.environ.get("DRY_RUN", "").strip() in ("1", "true"):
        return 0
    subject = "טוטו 16 – לבדוק קרדיט לפני הריצה של מחר"
    html_body = '<div dir="rtl" style="font-family:Arial,sans-serif">' + notify.html.escape(text).replace(
        "\n", "<br>"
    ).replace(BILLING_URL, f'<a href="{BILLING_URL}">{BILLING_URL}</a>').replace(
        RUN_URL, f'<a href="{RUN_URL}">{RUN_URL}</a>'
    ) + "</div>"
    notify.send_all(subject, text, html_body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
