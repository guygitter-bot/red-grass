#!/usr/bin/env python3
"""המתכנת של "צוות" (tsevet/api/dev.js) – מריץ בקשת שינוי שהבעלים אישר.

רץ ב-GitHub Actions (.github/workflows/tsevet-dev.yml):
    run.py prepare      – קורא את הבקשה מהשרת, כותב את ההנחיה ל-.dev/prompt.txt ומחזיר את תיקיית האפליקציה
    run.py check        – מה Claude עשה: fixed (שינוי בתוך האפליקציה) / question / none
    run.py tests        – הבדיקות והבנייה של האפליקציה (כל תת-תיקייה עם package.json)
    run.py done <pr>    – מדווח לשרת שה-PR מוכן (עם הסיכום של Claude)
    run.py question     – מדווח לשרת שיש שאלה
    run.py fail [סיבה]  – מדווח לשרת שהעבודה נכשלה

המאגר ציבורי, ולכן הלוג ציבורי: לא מדפיסים כאן את הבקשה, את הסיכום או את הפלט של Claude.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

API = os.environ.get("TSEVET_API", "").rstrip("/")
TOKEN = os.environ.get("TSEVET_TOKEN", "")
DEV_ID = os.environ.get("DEV_ID", "")
ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".dev"


def request(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"authorization": f"Bearer {TOKEN}", "user-agent": "tsevet-dev"}
    if body is not None:
        headers["content-type"] = "application/json"
    req = urllib.request.Request(f"{API}{path}?id={DEV_ID}", data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read() or b"{}")


def output(name, value):
    with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as f:
        f.write(f"{name}={value}\n")


def cost():
    """כמה עלתה הריצה של Claude Code (מהפלט שלו), בדולרים – למסך העלויות באפליקציה."""
    try:
        data = json.loads((WORK / "claude.json").read_text(encoding="utf-8"))
        if isinstance(data, list):
            data = next((x for x in reversed(data) if isinstance(x, dict) and "total_cost_usd" in x), {})
        return round(float(data.get("total_cost_usd") or 0), 4)
    except Exception:
        return 0


def read(name):
    p = WORK / name
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""


def prepare():
    job = request("GET", "/dev/job")
    app = str(job.get("app", ""))
    if not re.fullmatch(r"[a-z0-9_]+", app) or not (ROOT / app).is_dir():
        sys.exit("bad app folder")
    WORK.mkdir(exist_ok=True)
    prompt = (Path(__file__).parent / "prompt.md").read_text(encoding="utf-8")
    prompt = prompt.replace("{APP}", app).replace("{TITLE}", str(job.get("title", ""))).replace("{REQUEST}", str(job.get("request", "")))
    (WORK / "prompt.txt").write_text(prompt, encoding="utf-8")
    (WORK / "title.txt").write_text(str(job.get("title", ""))[:80], encoding="utf-8")
    output("app", app)
    print(f"app: {app}")


def changed_files():
    out = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=ROOT, capture_output=True, text=True).stdout
    files = []
    for line in out.splitlines():
        path = line[3:].split(" -> ")[-1].strip().strip('"')
        if path and not path.startswith(".dev/"):
            files.append(path)
    return files


def check(app):
    files = changed_files()
    outside = [f for f in files if not f.startswith(f"{app}/")]
    if outside:
        # שינוי מחוץ לאפליקציה – מבטלים אותו (רק תיקיית האפליקציה מותרת)
        subprocess.run(["git", "checkout", "HEAD", "--", *outside], cwd=ROOT, capture_output=True)
        subprocess.run(["git", "clean", "-fdq", "--", *outside], cwd=ROOT, capture_output=True)
        print(f"reverted {len(outside)} file(s) outside {app}/")
        files = [f for f in files if f.startswith(f"{app}/")]
    if read("question.md") and not files:
        status = "question"
    elif files:
        status = "fixed"
    else:
        status = "none"
    print(f"status: {status}, files: {len(files)}")
    output("status", status)


def tests(app):
    ok = True
    for pkg in sorted((ROOT / app).glob("*/package.json")):
        scripts = json.loads(pkg.read_text(encoding="utf-8")).get("scripts", {})
        for script in ("test", "build"):
            if script in scripts:
                done = subprocess.run(["npm", "run", script, "--silent"], cwd=pkg.parent, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"{pkg.parent.name}: npm run {script} -> {'ok' if done.returncode == 0 else 'FAILED'}")
                ok = ok and done.returncode == 0
    if not ok:
        sys.exit(1)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if not re.fullmatch(r"[a-z0-9]{8,32}", DEV_ID):
        sys.exit("bad id")
    if cmd == "prepare":
        prepare()
    elif cmd == "check":
        check(sys.argv[2])
    elif cmd == "tests":
        tests(sys.argv[2])
    elif cmd == "done":
        request("POST", "/dev/done", {"pr": int(sys.argv[2]), "summary": read("summary.md")[:3000], "cost": cost()})
        print("reported: ready")
    elif cmd == "question":
        request("POST", "/dev/question", {"question": read("question.md")[:2000], "cost": cost()})
        print("reported: question")
    elif cmd == "fail":
        reason = sys.argv[2] if len(sys.argv) > 2 else ""
        try:
            request("POST", "/dev/fail", {"error": reason, "cost": cost()})
        except Exception:
            pass
        print("reported: failed")
    else:
        sys.exit("unknown command")


if __name__ == "__main__":
    main()
