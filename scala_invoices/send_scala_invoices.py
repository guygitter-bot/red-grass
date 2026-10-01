#!/usr/bin/env python3
"""Collect last month's Scala EV-charging invoices from Gmail and forward the PDFs.

Connects to Gmail over IMAP, finds every message from Scala in the previous
calendar month that carries a PDF attachment, and sends all those PDFs in one
email (split into several only if the total exceeds Gmail's size limit).

Configuration (environment variables):
  GMAIL_ADDRESS        Gmail account to read from and send with (required)
  GMAIL_APP_PASSWORD   Gmail App Password for that account (required)
  RECIPIENT_EMAIL      Where to send the invoices; comma-separated for several (required)
  SCALA_SENDER_QUERY   Gmail "from:" term identifying Scala's emails (default: scala)
  EXTRA_GMAIL_QUERY    Extra Gmail search terms to narrow the match (optional)
  TIMEZONE             Time zone that defines "the month" (default: Asia/Jerusalem)
  TARGET_MONTH         YYYY-MM to process instead of the previous month (optional)
  DRY_RUN              "1" to list what would be sent without sending (optional)
"""

import email
import imaplib
import os
import smtplib
import sys
from datetime import datetime
from email.header import decode_header, make_header
from email.message import EmailMessage
from zoneinfo import ZoneInfo

IMAP_HOST = "imap.gmail.com"
SMTP_HOST = "smtp.gmail.com"
# Gmail rejects messages over 25MB; base64 inflates attachments by ~4/3.
MAX_ATTACHMENTS_BYTES = 17 * 1024 * 1024


def env(name, default=None, required=False):
    value = os.environ.get(name, "").strip() or default
    if required and not value:
        sys.exit(f"Missing required environment variable: {name}")
    return value


def month_range(tz, target_month=None):
    """Return (start, end) datetimes of the target month, previous month by default."""
    if target_month:
        year, month = (int(p) for p in target_month.split("-"))
    else:
        now = datetime.now(tz)
        year, month = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
    start = datetime(year, month, 1, tzinfo=tz)
    end = datetime(year + 1, 1, 1, tzinfo=tz) if month == 12 else datetime(year, month + 1, 1, tzinfo=tz)
    return start, end


def decode(value):
    return str(make_header(decode_header(value))) if value else ""


def all_mail_folder(imap):
    """Find Gmail's "All Mail" folder by its \\All flag; its name is localized."""
    status, folders = imap.list()
    if status == "OK":
        for line in folders:
            line = line.decode()
            if "\\All" in line:
                return line[line.index(' "/" ') + 5:]
    return '"[Gmail]/All Mail"'


def fetch_invoice_pdfs(address, password, gmail_query):
    """Return a list of (filename, bytes, received_at) for PDFs matching the query."""
    pdfs = []
    with imaplib.IMAP4_SSL(IMAP_HOST) as imap:
        imap.login(address, password)
        imap.select(all_mail_folder(imap), readonly=True)
        # X-GM-RAW lets us use Gmail's own search syntax over IMAP.
        status, data = imap.uid("SEARCH", "X-GM-RAW", f'"{gmail_query}"')
        if status != "OK":
            raise RuntimeError(f"IMAP search failed: {data}")
        uids = data[0].split()
        print(f"Found {len(uids)} matching message(s).")

        for uid in uids:
            status, msg_data = imap.uid("FETCH", uid, "(RFC822)")
            if status != "OK" or not msg_data or msg_data[0] is None:
                print(f"  ! could not fetch message {uid.decode()}")
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            subject = decode(msg.get("Subject"))
            received = email.utils.parsedate_to_datetime(msg.get("Date"))
            found = 0
            for part in msg.walk():
                filename = decode(part.get_filename())
                is_pdf = part.get_content_type() == "application/pdf" or filename.lower().endswith(".pdf")
                if not is_pdf or part.get_content_maintype() == "multipart":
                    continue
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                pdfs.append((filename or f"invoice-{uid.decode()}.pdf", payload, received))
                found += 1
            print(f"  - {received:%Y-%m-%d} | {subject} | {found} PDF(s)")

    pdfs.sort(key=lambda p: p[2])
    return dedupe_filenames(pdfs)


def dedupe_filenames(pdfs):
    seen = {}
    result = []
    for name, data, received in pdfs:
        count = seen.get(name, 0)
        seen[name] = count + 1
        if count:
            stem, dot, ext = name.rpartition(".")
            name = f"{stem}-{count + 1}.{ext}" if dot else f"{name}-{count + 1}"
        result.append((name, data, received))
    return result


def chunk_by_size(pdfs):
    chunks, current, size = [], [], 0
    for pdf in pdfs:
        if current and size + len(pdf[1]) > MAX_ATTACHMENTS_BYTES:
            chunks.append(current)
            current, size = [], 0
        current.append(pdf)
        size += len(pdf[1])
    if current:
        chunks.append(current)
    return chunks


def send_pdfs(address, password, recipients, pdfs, label):
    chunks = chunk_by_size(pdfs)
    with smtplib.SMTP_SSL(SMTP_HOST, 465) as smtp:
        smtp.login(address, password)
        for i, chunk in enumerate(chunks, 1):
            msg = EmailMessage()
            part = f" ({i}/{len(chunks)})" if len(chunks) > 1 else ""
            msg["Subject"] = f"חשבוניות טעינה Scala - {label}{part}"
            msg["From"] = address
            msg["To"] = ", ".join(recipients)
            msg.set_content(
                f"מצורפות {len(chunk)} חשבוניות טעינה של Scala עבור {label}{part}.\n"
                f"סה\"כ חשבוניות בחודש: {len(pdfs)}."
            )
            for name, data, _ in chunk:
                msg.add_attachment(data, maintype="application", subtype="pdf", filename=name)
            smtp.send_message(msg)
            print(f"Sent email {i}/{len(chunks)} with {len(chunk)} PDF(s).")


def main():
    address = env("GMAIL_ADDRESS", required=True)
    password = env("GMAIL_APP_PASSWORD", required=True).replace(" ", "")
    recipients = [r.strip() for r in env("RECIPIENT_EMAIL", required=True).split(",") if r.strip()]
    sender_query = env("SCALA_SENDER_QUERY", "scala")
    extra_query = env("EXTRA_GMAIL_QUERY", "")
    tz = ZoneInfo(env("TIMEZONE", "Asia/Jerusalem"))
    dry_run = env("DRY_RUN", "0") in ("1", "true", "yes")

    start, end = month_range(tz, env("TARGET_MONTH"))
    label = f"{start:%m/%Y}"
    # Epoch seconds make after:/before: exact regardless of Gmail's own time zone.
    query = (
        f"from:({sender_query}) has:attachment filename:pdf "
        f"after:{int(start.timestamp())} before:{int(end.timestamp())} {extra_query}"
    ).strip()
    print(f"Month: {label}  |  Gmail query: {query}")

    pdfs = fetch_invoice_pdfs(address, password, query)
    if not pdfs:
        print("No Scala invoices found for this month; nothing sent.")
        return

    print(f"Collected {len(pdfs)} PDF(s): {', '.join(p[0] for p in pdfs)}")
    if dry_run:
        print("DRY_RUN is set; not sending.")
        return
    send_pdfs(address, password, recipients, pdfs, label)


if __name__ == "__main__":
    main()
