#!/usr/bin/env python3
"""פרסום אתר של הצוות ל-Cloudflare Pages (tsevet/api/sites.js, publish_page).

רץ ב-GitHub Actions (.github/workflows/tsevet-site.yml), אחרי שהבעלים לחץ "לפרסם" או "להוריד מהאוויר":

    python3 site.py prepare <מזהה>   מוריד את הדף והתמונות ל-.site/dist (התמונות ב-img/), ובודק אם מותר להשתמש בשם
    (wrangler pages deploy .site/dist)
    python3 site.py done <מזהה> <כתובת>  |  python3 site.py fail <מזהה> <סיבה>

**לעולם לא דורסים פרויקט Pages קיים שהצוות לא יצר** (אפליקציה אחרת של הבעלים): אם השם קיים והשרת לא מכיר אותו
כאתר של הצוות – נכשלים עם "taken".
המאגר ציבורי, ולכן הלוג שלו ציבורי: לא מדפיסים את תוכן הדף.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import request  # noqa: E402  (אותה בקשה לשרת, עם הטוקן)

WORK = Path(".site").resolve()
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg"}
CF = "https://api.cloudflare.com/client/v4"


def output(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            for k, v in values.items():
                f.write(f"{k}={v}\n")


def cloudflare(method, path):
    """בקשה ל-Cloudflare (רק קריאה / מחיקה של פרויקט). מחזיר (קוד, json)."""
    req = urllib.request.Request(f"{CF}/accounts/{os.environ['CF_ACCOUNT']}{path}", method=method,
                                 headers={"authorization": f"Bearer {os.environ['CF_TOKEN']}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def project(slug):
    """הפרויקט ב-Pages, אם קיים (None אם לא)."""
    code, data = cloudflare("GET", f"/pages/projects/{slug}")
    return data.get("result") if code == 200 else None


def prepare(job_id):
    job = request("GET", f"/site/job?id={job_id}")
    slug = job["slug"]
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,26}[a-z0-9]", slug):
        sys.exit("bad slug")
    existing = project(slug)
    # שם שקיים בחשבון ולא נוצר על ידי הצוות – לא נוגעים
    if existing and not job.get("ours"):
        print("the name belongs to another project – not touching it")
        output(action="taken", slug=slug)
        return
    if job["action"] == "remove":
        output(action="remove", slug=slug, exists="yes" if existing else "no")
        return
    dist = WORK / "dist"
    (dist / "img").mkdir(parents=True, exist_ok=True)
    page = WORK / "page.html"
    request("GET", f"/site/input?id={job_id}&f={job['page']}", out=page)
    html = page.read_text(encoding="utf-8")
    for img in job.get("images", []):
        name = f"{img['id']}.{EXT.get(img.get('type'), 'bin')}"
        request("GET", f"/site/input?id={job_id}&f={img['id']}", out=dist / "img" / name)
        html = html.replace("{{file:%s}}" % img["id"], f"img/{name}")
    html = re.sub(r"\{\{file:[a-z0-9]+\}\}", "", html)
    (dist / "index.html").write_text(html, encoding="utf-8")
    # כותרות אבטחה בסיסיות לאתר
    (dist / "_headers").write_text("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n", encoding="utf-8")
    print(f"page ready, images: {len(job.get('images', []))}, new project: {not existing}")
    output(action="deploy", slug=slug, exists="yes" if existing else "no")


def done(job_id, url=""):
    # הכתובת האמיתית של הפרויקט (Cloudflare מוסיף סיומת אם השם תפוס אצל מישהו אחר)
    slug = request("GET", f"/site/job?id={job_id}")["slug"]
    p = project(slug)
    if p and p.get("subdomain"):
        url = f"https://{p['subdomain']}"
    request_json("POST", f"/site/done?id={job_id}", {"url": url})
    print(f"live: {url}")


def fail(job_id, reason="failed"):
    request_json("POST", f"/site/fail?id={job_id}", {"reason": reason})


def request_json(method, path, body):
    data = WORK / "body.json"
    WORK.mkdir(exist_ok=True)
    data.write_text(json.dumps(body))
    return request(method, path, data=data)


if __name__ == "__main__":
    cmd, job_id = sys.argv[1], sys.argv[2]
    if not job_id.isalnum():
        sys.exit("bad id")
    {"prepare": prepare, "done": done, "fail": fail}[cmd](job_id, *sys.argv[3:])
