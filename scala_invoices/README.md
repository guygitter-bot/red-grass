# Monthly Scala invoices

On the 1st of every month, a GitHub Actions workflow (`.github/workflows/scala-invoices.yml`)
runs `send_scala_invoices.py`. The script:

1. Connects to your Gmail.
2. Finds every Scala email from the previous month that has a PDF attachment.
3. Sends all the PDFs to the address you set. They go in one email, which is split
   only if the PDFs are too large for a single message.

## Setup (one time)

1. **Create a Gmail App Password**: turn on 2-Step Verification for the account, then go to
   https://myaccount.google.com/apppasswords and create a password (16 characters).
2. **Turn on IMAP in Gmail**: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP.
3. **Add repository secrets** under Settings → Secrets and variables → Actions → *Secrets*:
   | Name | Value |
   |---|---|
   | `GMAIL_ADDRESS` | your Gmail address |
   | `GMAIL_APP_PASSWORD` | the App Password from step 1 |
   | `RECIPIENT_EMAIL` | where to send the invoices (separate several with commas) |
4. *(Optional)* Add **variables** on the same page, under the *Variables* tab:
   - `SCALA_SENDER_QUERY`: the Gmail `from:` term for Scala's emails. The default is `scala`.
     If that matches other emails, set the exact sender address, for example `invoices@scala.co.il`.
   - `EXTRA_GMAIL_QUERY`: extra Gmail search terms, for example `subject:חשבונית`.

## Test it

Actions → *Monthly Scala invoices* → **Run workflow**. Tick *dry run* to only list what
would be sent. You can also set `target_month` (for example `2026-09`) to send a
specific month again.
