"""WhatsApp (CallMeBot) and email (Gmail SMTP) notifications."""

from __future__ import annotations

import html
import json
import logging
import os
import smtplib
import urllib.parse
import urllib.request
from email.message import EmailMessage

from toto_predictor import closing

log = logging.getLogger(__name__)

CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php"
TELEGRAM_URL = "https://api.telegram.org/bot{token}/sendMessage"


def format_chance(p: float) -> str:
    """P(16) is usually tiny: '1 ל-30,303' reads better than '0.00%'."""
    if p >= 0.01:
        return f"{p * 100:.1f}%"
    return f"1 ל-{round(1 / p):,}" if p > 0 else "0"


def _pick_label(cover: list[str]) -> str:
    return "".join(cover)


def ticket_text(result: dict) -> str:
    t = result["ticket"]
    lines = [
        f"⚽ טוטו 16 – מחזור {result['round_number']}",
        f"⏰ לשלוח עד: {closing.format_he(closing.parse_time(result.get('close_time')))}",
        "(6 דקות לפני שריקת הפתיחה של המשחק הראשון)"
        if result.get("close_time_source") == "first_kickoff"
        else "",
        "",
    ]
    for m in result["matches"]:
        lines.append(f"{m['index']}. {m['home_he']} – {m['away_he']}: {_pick_label(m['cover'])}")
    lines = [line for i, line in enumerate(lines) if line or i == 3]
    lines += [
        "",
        f"{t['doubles']} כפולים, {t['triples']} משולשים · {t['columns']} טורים · {t['cost']:.0f} ₪",
        f"סיכוי משוער ל-16: {format_chance(t['p16'])}",
        "התחזית מבוססת על המידע הידוע היום. ההרכבים עוד לא פורסמו, ושחקנים בספק נספרים כחצי היעדרות.",
    ]
    failed = [str(m["index"]) for m in result["matches"] if not m.get("researched")]
    if failed:
        lines.append(f"⚠️ המחקר נכשל במשחקים: {', '.join(failed)}")
    if result.get("site_url"):
        lines += ["", result["site_url"]]
    return "\n".join(lines)


def ticket_html(result: dict) -> str:
    rows = []
    for m in result["matches"]:
        cells = "".join(
            f'<td style="text-align:center;border:1px solid #ccc;padding:4px 10px;'
            f'background:{"#1f7a4d" if o in m["cover"] else "#fff"};'
            f'color:{"#fff" if o in m["cover"] else "#999"}">{o}</td>'
            for o in ("1", "X", "2")
        )
        rows.append(
            f'<tr><td style="border:1px solid #ccc;padding:4px 8px">{m["index"]}</td>'
            f'<td style="border:1px solid #ccc;padding:4px 8px">{html.escape(m["home_he"])} – '
            f'{html.escape(m["away_he"])}</td>{cells}</tr>'
        )
    text = html.escape(ticket_text(result)).replace("\n", "<br>")
    return (
        '<div dir="rtl" style="font-family:Arial,sans-serif">'
        '<table style="border-collapse:collapse">' + "".join(rows) + "</table>"
        f"<p>{text}</p></div>"
    )


def send_whatsapp(text: str) -> bool:
    phone = os.environ.get("CALLMEBOT_PHONE", "").strip()
    apikey = os.environ.get("CALLMEBOT_APIKEY", "").strip()
    if not phone or not apikey:
        log.warning("CALLMEBOT_PHONE / CALLMEBOT_APIKEY not set; skipping WhatsApp")
        return False
    query = urllib.parse.urlencode({"phone": phone, "text": text, "apikey": apikey})
    with urllib.request.urlopen(f"{CALLMEBOT_URL}?{query}", timeout=30) as resp:
        body = resp.read().decode("utf-8", "replace")
    if resp.status != 200 or "error" in body.lower():
        log.error("CallMeBot failed (%s): %s", resp.status, body[:300])
        return False
    return True


def send_telegram(text: str) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        log.warning("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; skipping Telegram")
        return False
    data = json.dumps({"chat_id": chat_id, "text": text, "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(
        TELEGRAM_URL.format(token=token), data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8", "replace") or "{}")
    if not body.get("ok"):
        log.error("Telegram failed: %s", str(body)[:300])
        return False
    return True


def send_email(subject: str, text: str, html_body: str) -> bool:
    address = os.environ.get("GMAIL_ADDRESS", "").strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    recipient = os.environ.get("TOTO_EMAIL_TO", "").strip() or address
    if not address or not password:
        log.warning("GMAIL_ADDRESS / GMAIL_APP_PASSWORD not set; skipping email")
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = address
    msg["To"] = recipient
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(address, password)
        smtp.send_message(msg)
    return True


def send_all(subject: str, text: str, html_body: str) -> None:
    """Send on every configured channel; unconfigured channels are skipped."""
    for name, send in (
        ("WhatsApp", lambda: send_whatsapp(text)),
        ("Telegram", lambda: send_telegram(text)),
        ("email", lambda: send_email(subject, text, html_body)),
    ):
        try:
            if send():
                log.info("Sent %s notification", name)
        except Exception as e:  # one channel failing must not block the others
            # No traceback: the request URLs carry the Telegram token / CallMeBot key.
            log.error("Failed to send %s notification: %s: %s", name, type(e).__name__, e)


def notify(result: dict) -> None:
    subject = f"טוטו 16 – הטופס של מחזור {result['round_number']} מוכן"
    send_all(subject, ticket_text(result), ticket_html(result))
