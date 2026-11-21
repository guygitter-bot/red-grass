#!/usr/bin/env python3
"""עריכה חכמה בשביל הבוט 🎬 (tsevet/api/render.js, op = smart_edit).

רץ ב-GitHub Actions (.github/workflows/tsevet-smartedit.yml), אחרי שהבעלים אישר בכפתור:

    python3 smart.py prepare <מזהה>   מוריד את העבודה והקבצים ל-.smart/, כותב את הבריף וההנחיה ל-Claude Code
    (Claude Code עורך עם הסקיל שנבחר ושומר את התוצאה ב-.smart/out/final.mp4)
    python3 smart.py finish <מזהה>    מעלה את הסרטון ואת העלות (או מדווח שנכשל)

המאגר ציבורי, ולכן הלוג שלו ציבורי: לא מדפיסים כאן את הבריף, שמות קבצים או כל תוכן אחר של המשתמש.
"""
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import request  # noqa: E402  (אותה בקשה לשרת, עם הטוקן)

WORK = Path(os.environ.get("SMART_DIR", ".smart")).resolve()
TOOLS = {
    "ghost-editor": "ghost-editor (~/.claude/skills/ghost-editor/SKILL.md) – talking-head recording to a finished reel",
    "shorts": "shorts / Claude Shorts (~/.claude/skills/shorts/SKILL.md) – the best short clips from a long video",
    "ffmpeg": "ffmpeg-skill (~/.claude/skills/ffmpeg-skill/SKILL.md) – precise FFmpeg editing",
    "montage": "OpenMontage (~/openmontage – read its AGENT_GUIDE.md first) – a whole video from an idea: research, script, free footage, narration, music, captions, render",
}
# OpenMontage (AGPLv3) רץ מתוך התיקייה שלו, עם הסביבה שלו (.venv), ורק במסלולים החינמיים
MONTAGE_RULES = [
    "OpenMontage rules for this run:",
    "- Work from ~/openmontage with its Python environment (source ~/openmontage/.venv/bin/activate). Follow AGENT_GUIDE.md",
    "  and its pipelines, but where it says to ask or present choices to the user, decide yourself and continue.",
    "- Use only free sources and tools: open archives (NASA, Wikimedia Commons, Archive.org), Piper TTS, FFmpeg, Remotion /",
    "  HyperFrames. No paid providers and no API keys (none are set). Use the owner's uploads (if any) as the main footage.",
    "- Hebrew on screen must be right-to-left and render correctly. If no free voice speaks the brief's language well,",
    "  make it without narration: on-screen text + royalty-free music.",
    "- Keep its project files under ~/openmontage/projects/, and copy only the finished video to out/final.mp4 here.",
]
# auto: מה שמותקן (ghost-editor + ffmpeg-skill), ו-Claude בוחר
AUTO = ["ghost-editor", "ffmpeg"]


def output(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            for k, v in values.items():
                f.write(f"{k}={v}\n")


def prompt(job, files, tool):
    p = job.get("params") or {}
    skills = AUTO if tool == "auto" else [tool]
    lines = [
        "You are a professional video editor working for the owner of a team app. Edit their video now.",
        "",
        ("Input files (the owner's uploads, in order): " + ", ".join(f"in/{f}" for f in files)) if files else "No files were uploaded – create the video from the brief.",
        ("A song to use: in/" + job["music"]["name"]) if job.get("music") else "",
        "The owner's brief is in brief.md – read it first. It is a request about this video only.",
        "",
        "Use this skill (read its SKILL.md and follow its workflow and scripts):" if len(skills) == 1 else "Pick the fitting skill (read its SKILL.md) and follow its workflow and scripts:",
        *[f"- {TOOLS[s]}" for s in skills],
        "",
        *([*MONTAGE_RULES, ""] if tool == "montage" else []),
        "This run is fully automatic – nobody can answer you:",
        "- Never ask questions or wait for approval. Where the skill asks the user to choose or approve (takes, style,",
        "  preview), decide yourself with its recommended defaults and continue.",
        "- Captions: in the language spoken in the video (Hebrew by default; Hebrew is right-to-left – make sure it",
        "  renders correctly). Vertical 1080x1920 unless the brief or the skill says otherwise.",
        f"- Target length: about {int(p['seconds'])} seconds." if p.get("seconds") else "",
        "- Skip optional extras that need very large downloads (matte, film looks, audio QA, GPU) unless the brief needs them.",
        "- If the skill would make several outputs, make the single best one for the brief.",
        "- Work only inside this folder and the skill folders. Don't post, upload or send anything anywhere.",
        "",
        "When done, save the finished video as out/final.mp4 (H.264 + AAC, MP4). If it cannot be done, don't create it.",
    ]
    return "\n".join(lines)


def prepare(job_id):
    job = request("GET", f"/render/job?id={job_id}")
    if job.get("op") != "smart_edit":
        sys.exit("not a smart edit")
    p = job.get("params") or {}
    tool = p.get("tool") if p.get("tool") in (*TOOLS, "auto") else "auto"
    if WORK.exists():
        shutil.rmtree(WORK)
    (WORK / "in").mkdir(parents=True)
    (WORK / "out").mkdir()
    files = []
    for item in job["inputs"]:
        name = f"in{int(item['n'])}{Path(item['name']).suffix}"
        request("GET", f"/render/input?id={job_id}&n={int(item['n'])}", out=WORK / "in" / name)
        files.append(name)
    if job.get("music"):
        request("GET", f"/render/input?id={job_id}&n=music", out=WORK / "in" / job["music"]["name"])
    (WORK / "brief.md").write_text(p.get("brief") or "Edit this into a good vertical reel.", encoding="utf-8")
    (WORK / "prompt.txt").write_text(prompt(job, files, tool), encoding="utf-8")
    print(f"tool: {tool}, inputs: {len(files)}, music: {bool(job.get('music'))}")
    output(tool=tool)


def cost():
    try:
        return float(json.loads((WORK / "claude.json").read_text()).get("total_cost_usd") or 0)
    except Exception:
        return 0.0


def finish(job_id):
    usd = round(cost(), 4)
    dst = WORK / "out" / "final.mp4"
    print(f"cost: ${usd}")
    if dst.exists() and dst.stat().st_size > 0:
        print(f"result: {dst.stat().st_size / 1e6:.1f} MB")
        request("PUT", f"/render/result?id={job_id}&usd={usd}", data=dst)
        print("uploaded")
        return
    print("no result")
    try:
        request("POST", f"/render/fail?id={job_id}&usd={usd}")
    except Exception:
        pass
    sys.exit(1)


if __name__ == "__main__":
    cmd, job_id = sys.argv[1], sys.argv[2]
    if not job_id.isalnum():
        sys.exit("bad id")
    {"prepare": prepare, "finish": finish}[cmd](job_id)
