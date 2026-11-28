# הצינור המלא: job.json -> סרטון ערוך.
#   python3 run.py job.json OUT_DIR                 – הכול (כולל קריאה ל-Claude, דורש ANTHROPIC_API_KEY)
#   python3 run.py job.json OUT_DIR --dry-run       – בונה את הבקשה ל-Claude ושומר אותה, בלי לשלוח
#   python3 run.py job.json OUT_DIR --plan raw.json – מדלג על Claude ומשתמש בתוכנית קיימת (למשל אחרי עריכה בטיימליין)
# פלט ב-OUT_DIR: raw_plan.json (מה ש-Claude בחר), render_plan.json (אחרי האכיפה), video.mp4, result.json.
import argparse, json, os, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import graphics, planner, thumbs, validate
from render import render

DEFAULTS = {"target_min": 420, "target_max": 480, "intro_seconds": 5.0, "outro_seconds": 12.0, "fade": 0.6,
            "size": "1280x720", "sub_bottom": 62}


def duration_of(src):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def load_transcript(job, src, out):
    """התמלול של המערכת (עדיף) – או Whisper כגיבוי. פורמט: [{start, end, text, speaker?}] בשניות."""
    t = job.get("transcript")
    if isinstance(t, str):
        t = json.load(open(t))
    if isinstance(t, dict):
        t = t.get("segments", [])
    if t:
        return [{"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip(),
                 **({"speaker": str(s["speaker"])} if s.get("speaker") is not None else {})} for s in t]
    audio, tj = os.path.join(out, "audio.wav"), os.path.join(out, "transcript.json")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", audio], check=True)
    subprocess.run([sys.executable, str(HERE / "transcribe.py"), audio, tj, "--vocab", ", ".join(job.get("vocabulary", []))], check=True)
    return json.load(open(tj))["segments"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("job"); ap.add_argument("out")
    ap.add_argument("--plan"); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    job = json.load(open(a.job))
    cfg = {**DEFAULTS, **job.get("output", {}), "model": job.get("model", planner.MODEL), "effort": job.get("effort", "high")}
    os.makedirs(a.out, exist_ok=True)
    src = job["video"]
    dur = duration_of(src)
    transcript = load_transcript(job, src, a.out)

    # 1. תוכנית עריכה: מ-Claude, או מקובץ קיים
    if a.plan:
        raw = json.load(open(a.plan))
    else:
        sheets = thumbs.contact_sheets(src, os.path.join(a.out, "sheets"))
        req = planner.build_request(job, transcript, sheets, dur, cfg)
        if a.dry_run:
            preview = {**req, "messages": [{"role": "user", "content": [
                c if c["type"] == "text" else {"type": "image", "note": "contact sheet (base64 omitted)"}
                for c in req["messages"][0]["content"]]}]}
            json.dump(preview, open(os.path.join(a.out, "request_preview.json"), "w"), ensure_ascii=False, indent=1)
            print(f"OUTPUT: {os.path.join(a.out, 'request_preview.json')}  ({len(sheets)} contact sheets)")
            return
        raw, usage = planner.call_claude(req)
        print(f"planner usage: {usage}", file=sys.stderr)
    json.dump(raw, open(os.path.join(a.out, "raw_plan.json"), "w"), ensure_ascii=False, indent=1)

    # 2. אכיפת הכללים בקוד
    clips, warnings = validate.build(raw, job, transcript, dur, cfg)

    # 3. שקופית פתיחה ומסך סיכום
    b = job.get("branding", {})
    photo = b.get("photo") or graphics.frame(src, clips[0]["start"] + 3, os.path.join(a.out, "photo.jpg"))
    desk = (raw.get("markers") or {}).get("desk_start", -1)
    bg = graphics.frame(src, desk + 30 if desk and desk > 0 else dur / 2, os.path.join(a.out, "bg.jpg"))
    intro = graphics.intro(b.get("intro_lines", ["ביקור חווית לקוח"]), photo, os.path.join(a.out, "intro.png"),
                           b.get("logo_top", graphics.intro.__defaults__[0]), b.get("logo_bottom", graphics.intro.__defaults__[1]))
    s = raw.get("summary", {})
    outro = graphics.outro(s.get("keep", [])[:5], s.get("fix", [])[:5], job.get("score"), bg, os.path.join(a.out, "outro.png"))
    plan = [{"image": intro, "dur": cfg["intro_seconds"]}, *clips, {"image": outro, "dur": cfg["outro_seconds"]}]
    json.dump(plan, open(os.path.join(a.out, "render_plan.json"), "w"), ensure_ascii=False, indent=1)

    # 4. בנייה
    w, h = map(int, str(cfg["size"]).lower().split("x"))
    video = os.path.join(a.out, "video.mp4")
    total = render(src, plan, video, (w, h), cfg["sub_bottom"])
    result = {"video": video, "length_seconds": round(total, 1), "clips": len(clips), "warnings": warnings,
              "raw_plan": os.path.join(a.out, "raw_plan.json"), "render_plan": os.path.join(a.out, "render_plan.json")}
    json.dump(result, open(os.path.join(a.out, "result.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
