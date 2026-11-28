# בניית הסרטון מתוכנית (plan.json): קטעים + כתוביות לבנות + כרטיסים מונפשים + פתיח/סיכום, מעברי דעיכה.
# שימוש: python3 render.py SRC.mp4 plan.json OUT.mp4
# plan.json – רשימה לפי הסדר:
#   {"image": "intro.png", "dur": 5}                                  שקופית (פתיח / סיכום)
#   {"start": 85.4, "end": 111.7,                                     קטע מהסרטון (שניות במקור)
#    "subs":  [{"start": 86.2, "end": 89.8, "text": "..."}],          כתוביות – רק הנציג/ה, זמנים במקור
#    "cards": [{"t": 380, "end": 403, "kind": "keep|fix", "text": "..."}]}   כרטיסים, זמנים במקור
# הפלט: H.264 yuv420p (מתנגן בכל טלפון – yuv444p לא!), 1280x720.
import json, os, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "video-tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import text_png
from graphics import card
from PIL import Image

SRC, PLAN, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FADE = 1280, 720, 0.6
work = os.path.join(os.path.dirname(os.path.abspath(OUT)), "work")
os.makedirs(work, exist_ok=True)
plan = json.load(open(PLAN))
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]
FINAL = ["-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-level", "4.0", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]


def still(i, seg):
    out, d = os.path.join(work, f"seg{i:02d}.mp4"), seg["dur"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(d), "-i", seg["image"],
                    "-f", "lavfi", "-t", str(d), "-i", "anullsrc=r=48000:cl=stereo",
                    "-vf", f"scale={W}:{H},fps=30000/1001,format=yuv420p", "-shortest", *ENC, out], check=True)
    return out, d


def clip(i, seg):
    out = os.path.join(work, f"seg{i:02d}.mp4")
    s0, s1 = seg["start"], seg["end"]
    dur = s1 - s0
    inputs = ["-ss", str(s0), "-to", str(s1), "-i", SRC]
    chain = [f"[0:v]scale={W}:{H}:flags=lanczos,setsar=1,fps=30000/1001,format=yuv420p[v0]"]
    last, n = "[v0]", 0
    # כתוביות: לבן עם קו מתאר כהה דק, מרכז התחתית, מעל חותמת הזמן הצהובה
    for j, sb in enumerate(seg.get("subs", [])):
        p = os.path.join(work, f"s{i:02d}_{j:02d}.png")
        text_png(sb["text"], p, size=34, weight=600, stroke=3, stroke_color=(0, 0, 0, 255), pad=8, max_width=760)
        inputs += ["-i", p]; n += 1
        a, b = max(0, sb["start"] - s0), min(s1, sb["end"]) - s0
        chain.append(f"{last}[{n}:v]overlay=x=(W-w)/2:y=H-h-62:enable='between(t,{a:.2f},{b:.2f})'[v{n}]")
        last = f"[v{n}]"
    # כרטיסים: נכנסים מימין בהחלקה + דעיכה, נערמים במקום פנוי, יוצאים בדעיכה
    placed = []
    for k, c in enumerate(seg.get("cards", [])):
        p = card(c["kind"], c["text"], os.path.join(work, f"c{i:02d}_{k:02d}.png"), c.get("scale", 0.74))
        ch = Image.open(p).height
        t0 = max(0.2, c["t"] - s0)
        t1 = (c["end"] - s0) if "end" in c else dur - 0.5
        y = 64
        for py0, py1 in sorted((py, py + h - 16) for (a, b, h, py) in placed if b > t0):
            if y + ch - 16 > py0 and y < py1:
                y = py1
        placed.append((t0, t1, ch, y))
        inputs += ["-loop", "1", "-t", f"{dur:.2f}", "-i", p]; n += 1
        chain.append(f"[{n}:v]format=rgba,fade=t=in:st={t0:.2f}:d=0.35:alpha=1,fade=t=out:st={t1 - 0.4:.2f}:d=0.4:alpha=1[ci{n}]")
        x = f"W-w-6+if(lt(t\\,{t0 + 0.45:.2f})\\,pow(1-(t-{t0:.2f})/0.45\\,3)*80\\,0)"
        chain.append(f"{last}[ci{n}]overlay=x='{x}':y={y}:enable='between(t,{t0:.2f},{t1:.2f})'[v{n}]")
        last = f"[v{n}]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                    "-map", last, "-map", "0:a", *ENC, out], check=True)
    return out, dur


parts = [still(i, s) if "image" in s else clip(i, s) for i, s in enumerate(plan)]
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
subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", fc, "-map", "[fv]", "-map", "[fa]", *FINAL, OUT], check=True)
print(f"OUTPUT: {OUT}  ({int(acc // 60)}:{acc % 60:04.1f})")
