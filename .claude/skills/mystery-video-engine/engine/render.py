# בניית הסרטון מתוכנית רינדור (render_plan.json): קטעים + כתוביות + כרטיסים + שקופיות, מעברי דעיכה.
# שימוש: python3 render.py SRC.mp4 render_plan.json OUT.mp4 [--size 1280x720] [--sub-bottom 62]
# render_plan.json – רשימה לפי הסדר:
#   {"image": "intro.png", "dur": 5}
#   {"start": 85.4, "end": 111.7, "subs": [{"start","end","text"}], "cards": [{"t","end","kind","text"}]}   (זמנים במקור)
# הפלט: H.264 yuv420p (מתנגן בכל טלפון), AAC.
import argparse, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from text_he import text_png, check_raqm
from graphics import card
from PIL import Image

FADE = 0.6
FINAL = ["-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-level", "4.0", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]
# קבצי ביניים: מהיר ובאיכות גבוהה – הקידוד הסופי קובע את הגודל
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]


def has_audio(src):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                        "-of", "csv=p=0", src], capture_output=True, text=True)
    return bool(r.stdout.strip())


def render(src, plan, out, size=(1280, 720), sub_bottom=62, workers=None):
    check_raqm()
    W, H = size
    work = os.path.join(os.path.dirname(os.path.abspath(out)), "work")
    os.makedirs(work, exist_ok=True)
    audio = has_audio(src)

    def still(i, seg):
        o, d = os.path.join(work, f"seg{i:02d}.mp4"), seg["dur"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(d), "-i", seg["image"],
                        "-f", "lavfi", "-t", str(d), "-i", "anullsrc=r=48000:cl=stereo",
                        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps=30000/1001,format=yuv420p",
                        "-shortest", *ENC, o], check=True)
        return o, d

    def clip(i, seg):
        o = os.path.join(work, f"seg{i:02d}.mp4")
        s0, s1 = seg["start"], seg["end"]
        dur = s1 - s0
        inputs = ["-ss", str(s0), "-to", str(s1), "-i", src]
        n = 0
        if not audio:  # מקור בלי קול – שקט, כדי שהמעברים יעבדו
            inputs += ["-f", "lavfi", "-t", f"{dur:.2f}", "-i", "anullsrc=r=48000:cl=stereo"]; n += 1
        amap = "0:a" if audio else "1:a"
        chain = [f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,"
                 f"setsar=1,fps=30000/1001,format=yuv420p[v0]"]
        last = "[v0]"
        # כתוביות: לבן עם קו מתאר דק, מרכז התחתית
        for j, sb in enumerate(seg.get("subs", [])):
            p = os.path.join(work, f"s{i:02d}_{j:02d}.png")
            text_png(sb["text"], p, size=round(34 * H / 720), weight=600, stroke=3, stroke_color=(0, 0, 0, 255),
                     pad=8, max_width=int(W * 0.6))
            inputs += ["-i", p]; n += 1
            a, b = max(0, sb["start"] - s0), min(s1, sb["end"]) - s0
            chain.append(f"{last}[{n}:v]overlay=x=(W-w)/2:y=H-h-{sub_bottom}:enable='between(t,{a:.2f},{b:.2f})'[v{n}]")
            last = f"[v{n}]"
        # כרטיסים: נכנסים מימין בהחלקה, נערמים במקום פנוי, יוצאים בדעיכה
        placed = []
        for k, c in enumerate(seg.get("cards", [])):
            p = card(c["kind"], c["text"], os.path.join(work, f"c{i:02d}_{k:02d}.png"), c.get("scale", 0.74) * H / 720)
            ch = Image.open(p).height
            t0 = max(0.2, c["t"] - s0)
            t1 = min(dur - 0.3, (c["end"] - s0) if "end" in c else dur - 0.5)
            y = 64
            for py0, py1 in sorted((py, py + h - 16) for (a, b, h, py) in placed if b > t0):
                if y + ch - 16 > py0 and y < py1:
                    y = py1
            placed.append((t0, t1, ch, y))
            inputs += ["-loop", "1", "-t", f"{dur:.2f}", "-i", p]; n += 1
            chain.append(f"[{n}:v]format=rgba,fade=t=in:st={t0:.2f}:d=0.35:alpha=1,fade=t=out:st={max(t0, t1 - 0.4):.2f}:d=0.4:alpha=1[ci{n}]")
            x = f"W-w-6+if(lt(t\\,{t0 + 0.45:.2f})\\,pow(1-(t-{t0:.2f})/0.45\\,3)*80\\,0)"
            chain.append(f"{last}[ci{n}]overlay=x='{x}':y={y}:enable='between(t,{t0:.2f},{t1:.2f})'[v{n}]")
            last = f"[v{n}]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                        "-map", last, "-map", amap, *ENC, o], check=True)
        return o, dur

    workers = workers or max(1, min(4, (os.cpu_count() or 2) // 2 + 1))
    with ThreadPoolExecutor(max_workers=workers) as pool:  # כמה קטעים במקביל
        parts = list(pool.map(lambda a: still(*a) if "image" in a[1] else clip(*a), enumerate(plan)))

    args, vf, af = [], [], []
    for p, _ in parts:
        args += ["-i", p]
    vl, al, acc = "[0:v]", "[0:a]", parts[0][1]
    for k in range(1, len(parts)):
        vf.append(f"{vl}[{k}:v]xfade=transition=fade:duration={FADE}:offset={acc - FADE:.3f}[xv{k}]")
        af.append(f"{al}[{k}:a]acrossfade=d={FADE}:c1=tri:c2=tri[xa{k}]")
        vl, al = f"[xv{k}]", f"[xa{k}]"
        acc += parts[k][1] - FADE
    fc = ";".join(vf + af + [f"{vl}fade=t=in:d=0.6,fade=t=out:st={acc - 0.8:.2f}:d=0.8,format=yuv420p[fv]",
                             f"{al}afade=t=in:d=0.4,afade=t=out:st={acc - 0.8:.2f}:d=0.8[fa]"])
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", fc, "-map", "[fv]", "-map", "[fa]",
                    *FINAL, out], check=True)
    return acc


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("plan"); ap.add_argument("out")
    ap.add_argument("--size", default="1280x720"); ap.add_argument("--sub-bottom", type=int, default=62)
    a = ap.parse_args()
    w, h = map(int, a.size.lower().split("x"))
    total = render(a.src, json.load(open(a.plan)), a.out, (w, h), a.sub_bottom)
    print(f"OUTPUT: {a.out}  ({int(total // 60)}:{total % 60:04.1f})")
