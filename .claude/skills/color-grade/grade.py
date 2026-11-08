#!/usr/bin/env python3
"""צבעוניות קולנועית אחידה: נרמול חשיפה/ניגודיות לכל קליפ + לוק לפי preset.
שימוש: python3 grade.py clip1.mp4 [clip2.mp4 ...] [--preset cinematic|warm|clean|bw] [--strength 1.0] [--out תיקייה/קובץ]"""
import argparse, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
import lib

TARGET_MID = 112.0   # ממוצע בהירות רצוי (סולם 16-235)
TARGET_SPAN = 150.0  # טווח רצוי בין אחוזון 10 ל-90


def measure(path, info):
    """מודד YAVG/YLOW/YHIGH ממוצעים על דגימה של פריימים (2 לשנייה, תמונה קטנה)."""
    r = lib.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vf",
                 "fps=2,scale=160:-2,signalstats,metadata=print:file=-", "-an", "-f", "null", "-"])
    out = r.stdout + r.stderr
    vals = {}
    for k in ("YAVG", "YLOW", "YHIGH"):
        xs = [float(x) for x in re.findall(r"lavfi\.signalstats\." + k + r"=([\d.]+)", out)]
        vals[k] = sum(xs) / len(xs) if xs else None
    if None in vals.values():
        return TARGET_MID, 30.0, 180.0
    return vals["YAVG"], vals["YLOW"], vals["YHIGH"]


def build_filter(preset, yavg, ylow, yhigh, k=1.0):
    """בונה שרשרת סינון. k = עוצמת הלוק (0..1.5)."""
    # נרמול: בהירות וניגודיות לפי המדידה (מוגבל כדי לא להרוס)
    bright = max(-0.06, min(0.06, (TARGET_MID - yavg) / 255.0 * 0.4))
    gamma = max(0.85, min(1.45, (TARGET_MID / max(yavg, 20.0)) ** 0.45))  # הרמת אמצעים בלי לשרוף אורות
    span = max(20.0, yhigh - ylow)
    contrast = max(0.9, min(1.35, 1.0 + (TARGET_SPAN / span - 1.0) * 0.7))
    f = [f"eq=brightness={bright:.3f}:contrast={contrast:.3f}:gamma={gamma:.3f}"]
    c = lambda v: f"{v * k:.3f}"
    if preset == "cinematic":
        # teal-orange: צללים כחלחלים, אורות כתומים
        f += [f"colorbalance=rs={c(-0.07)}:gs={c(0.0)}:bs={c(0.08)}:rm={c(0.02)}:bm={c(-0.02)}:rh={c(0.07)}:gh={c(0.02)}:bh={c(-0.07)}",
              "curves=all='0/0.02 0.25/0.20 0.5/0.5 0.75/0.82 1/0.98'",
              f"eq=saturation={1 + 0.12 * k:.3f}",
              "vignette=angle=PI/5:mode=backward", "unsharp=5:5:0.5:5:5:0.0"]
    elif preset == "warm":
        f += [f"colorbalance=rs={c(0.04)}:bs={c(-0.04)}:rm={c(0.06)}:bm={c(-0.07)}:rh={c(0.07)}:bh={c(-0.09)}",
              "curves=all='0/0.03 0.5/0.54 1/1'", f"eq=saturation={1 + 0.15 * k:.3f}:gamma=1.04",
              "vignette=angle=PI/6:mode=backward", "unsharp=5:5:0.4:5:5:0.0"]
    elif preset == "clean":
        f += [f"eq=saturation={1 + 0.06 * k:.3f}", "curves=all='0/0 0.25/0.23 0.75/0.78 1/1'",
              "unsharp=5:5:0.6:5:5:0.0"]
    elif preset == "bw":
        f += ["hue=s=0", "curves=all='0/0 0.2/0.14 0.5/0.5 0.8/0.88 1/1'",
              "vignette=angle=PI/4.5:mode=backward", "noise=alls=5:allf=t", "unsharp=5:5:0.5:5:5:0.0"]
    else:
        sys.exit("preset לא מוכר: " + preset)
    return ",".join(f)


def grade_clip(src, dst, preset="cinematic", strength=1.0, maxdim=1080):
    info = lib.probe(src)
    if not info["has_video"]:
        sys.exit("אין וידאו בקובץ: " + src)
    yavg, ylow, yhigh = measure(src, info)
    w, h = lib.work_size(info, maxdim)
    vf = f"scale={w}:{h}," + build_filter(preset, yavg, ylow, yhigh, strength)
    print(f"{Path(src).name}: בהירות {yavg:.0f}, טווח {ylow:.0f}-{yhigh:.0f} -> {preset}")
    args = ["-i", src, "-vf", vf] + lib.ENC
    args += (lib.AUDIO_ENC if info["has_audio"] else ["-an"]) + [dst]
    lib.ffmpeg(args)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--preset", default="cinematic", choices=["cinematic", "warm", "clean", "bw"])
    ap.add_argument("--strength", type=float, default=1.0)
    ap.add_argument("--out", help="קובץ (לקלט יחיד) או תיקייה")
    a = ap.parse_args()
    for src in a.inputs:
        dst = lib.out_path(src, a.preset, a.out if (a.out and (len(a.inputs) == 1 or not Path(a.out).suffix)) else None)
        grade_clip(src, dst, a.preset, a.strength)
        print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
