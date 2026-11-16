#!/usr/bin/env python3
"""עריכת וידאו בשביל הבוט 🎬 (tsevet/api/render.js).

רץ ב-GitHub Actions (.github/workflows/tsevet-render.yml): מוריד מהשרת את העבודה ואת הקבצים שלה,
מריץ את כלי העריכה שבמאגר (.claude/skills/<כלי>), ומעלה את הסרטון המוכן בחזרה.

    TSEVET_API=https://...  TSEVET_TOKEN=<הטוקן>  python3 run.py <מזהה עבודה>

המאגר ציבורי, ולכן הלוג שלו ציבורי: לא מדפיסים כאן שמות קבצים, כותרות או כל תוכן אחר של המשתמש.
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ["TSEVET_API"].rstrip("/")
TOKEN = os.environ["TSEVET_TOKEN"]
SKILLS = Path(__file__).resolve().parents[2] / ".claude" / "skills"
TIMEOUT = 20 * 60


def request(method, path, data=None, out=None):
    """בקשה לשרת עם הטוקן. out = לשמור את התשובה לקובץ (בלי להחזיק סרטון שלם בזיכרון)."""
    headers = {"authorization": f"Bearer {TOKEN}", "user-agent": "tsevet-render"}
    if data is not None:
        headers["content-length"] = str(os.path.getsize(data))
        body = open(data, "rb")
    else:
        body = None
    req = urllib.request.Request(f"{API}{path}", data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            if out:
                with open(out, "wb") as f:
                    while chunk := res.read(1 << 20):
                        f.write(chunk)
                return None
            return json.loads(res.read() or b"{}")
    finally:
        if body:
            body.close()


def clean(value):
    """טקסט שמגיע מהבוט: שורה אחת, ולא מתחיל ב-"-" (שלא ייקרא כאפשרות של הפקודה)."""
    return str(value).replace("\n", " ").strip().lstrip("-").strip()


def command(job, clips, music, dst):
    """הפקודה של כלי העריכה, כרשימה (בלי shell)."""
    p = job.get("params") or {}
    op = job["op"]
    out = [f"--out={dst}"]
    if op == "color_grade":
        return [SKILLS / "color-grade/grade.py", clips[0], f"--preset={p.get('preset', 'cinematic')}", f"--strength={float(p.get('strength', 1.0))}", *out]
    if op == "before_after":
        cmd = [SKILLS / "before-and-after/compare.py", *clips[:2], "--mode=wipe", f"--preset={p.get('preset', 'cinematic')}", *out]
        return cmd + ([f"--seconds={float(p['seconds'])}"] if p.get("seconds") else [])
    if op == "hand_drawn":
        cmd = [SKILLS / "hand-drawn/sketch.py", clips[0], *out]
        if clean(p.get("title", "")):
            cmd.append(f"--title={clean(p['title'])}")
        return cmd + ([f"--seconds={float(p['seconds'])}"] if p.get("seconds") else [])
    if op == "motion_graphics":
        lines = [clean(l) for l in p.get("lines", []) if clean(l)]
        cmd = [SKILLS / "motion-graphics/make.py", *clips, f"--format={p.get('format', '9:16')}", *out]
        if music:
            cmd.append(f"--music={music}")
        return cmd + ["--lines", *lines]
    if op == "beats_and_cuts":
        cmd = [SKILLS / "beats-and-cuts/beats.py", *clips, f"--music={music}", f"--format={p.get('format', '9:16')}", *out]
        return cmd + ([f"--seconds={float(p['seconds'])}"] if p.get("seconds") else [])
    raise ValueError("unknown op")


def main():
    render_id = sys.argv[1]
    if not render_id.isalnum():
        sys.exit("bad id")
    try:
        job = request("GET", f"/render/job?id={render_id}")
    except urllib.error.HTTPError as e:
        sys.exit(f"no such render job ({e.code})")
    print(f"op: {job['op']}, inputs: {len(job['inputs'])}, music: {bool(job.get('music'))}")
    try:
        with tempfile.TemporaryDirectory(prefix="tsevet_") as tmp:
            work = Path(tmp)
            clips = []
            for item in job["inputs"]:
                name = f"in{int(item['n'])}{Path(item['name']).suffix}"
                request("GET", f"/render/input?id={render_id}&n={int(item['n'])}", out=work / name)
                clips.append(str(work / name))
            music = None
            if job.get("music"):
                music = str(work / f"music{Path(job['music']['name']).suffix}")
                request("GET", f"/render/input?id={render_id}&n=music", out=music)
            dst = work / "result.mp4"
            cmd = ["python3", *[str(c) for c in command(job, clips, music, dst)]]
            env = {**os.environ, "VIDEO_OUT_DIR": str(work / "out")}
            # הפלט של הכלים לא מודפס (יש בו שמות וכותרות); בכישלון – רק קוד היציאה
            done = subprocess.run(cmd, cwd=work, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TIMEOUT)
            if done.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
                raise RuntimeError(f"the editing tool failed (exit {done.returncode})")
            print(f"result: {dst.stat().st_size / 1e6:.1f} MB")
            request("PUT", f"/render/result?id={render_id}", data=dst)
            print("uploaded")
    except Exception as e:  # מה שלא קרה – השיחה צריכה לדעת שהעריכה נכשלה
        print(f"failed: {type(e).__name__}: {e if isinstance(e, (RuntimeError, ValueError)) else ''}")
        try:
            request("POST", f"/render/fail?id={render_id}")
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
